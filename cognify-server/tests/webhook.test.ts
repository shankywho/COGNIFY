import { test, describe, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import crypto from "crypto";
import { webhookService } from "../src/services/billing/webhook.service";
import { prisma } from "../src/config/db";

describe("WebhookService - Idempotency & Signature Verification", () => {
  let originalCreate: any;

  beforeEach(() => {
    originalCreate = (prisma.webhookEvent as any).create;
  });

  afterEach(() => {
    (prisma.webhookEvent as any).create = originalCreate;
  });

  test("recordWebhookEvent returns true on first event arrival (new event recorded)", async () => {
    (prisma.webhookEvent as any).create = async (args: any) => {
      return { id: "we-1", ...args.data, createdAt: new Date() };
    };

    const isNew = await webhookService.recordWebhookEvent("STRIPE", "evt_test_new_001");
    assert.strictEqual(isNew, true);
  });

  test("recordWebhookEvent catches P2002 unique constraint violation and returns false (deduplicated)", async () => {
    (prisma.webhookEvent as any).create = async () => {
      const p2002Error: any = new Error("Unique constraint failed on the fields: (`external_event_id`)");
      p2002Error.code = "P2002";
      throw p2002Error;
    };

    const isNew = await webhookService.recordWebhookEvent("STRIPE", "evt_duplicate_001");
    assert.strictEqual(isNew, false, "Duplicate event must return false for deduplication");
  });

  test("recordWebhookEvent re-throws unexpected non-P2002 database errors", async () => {
    (prisma.webhookEvent as any).create = async () => {
      throw new Error("FATAL: Database connection timeout");
    };

    await assert.rejects(
      async () => {
        await webhookService.recordWebhookEvent("RAZORPAY", "rzp_err_001");
      },
      /FATAL: Database connection timeout/
    );
  });

  describe("Razorpay Signature Verification & Constant-Time Comparison", () => {
    const webhookSecret = "rzp_sec_test_mock_secret_key_12345";
    const payload = JSON.stringify({
      event: "payment.captured",
      payload: {
        payment: {
          entity: {
            id: "pay_xyz123",
            order_id: "order_abc456",
            amount: 50000,
          },
        },
      },
    });

    function verifyRazorpaySignature(rawBody: string | Buffer, signature: string, secret: string): boolean {
      const hmac = crypto.createHmac("sha256", secret);
      hmac.update(rawBody);
      const expectedSignature = hmac.digest("hex");

      const expectedBuffer = Buffer.from(expectedSignature, "utf8");
      const signatureBuffer = Buffer.from(signature, "utf8");

      if (expectedBuffer.length !== signatureBuffer.length) {
        return false;
      }
      return crypto.timingSafeEqual(expectedBuffer, signatureBuffer);
    }

    test("accepts valid HMAC-SHA256 signature", () => {
      const validSignature = crypto
        .createHmac("sha256", webhookSecret)
        .update(payload)
        .digest("hex");

      const isValid = verifyRazorpaySignature(payload, validSignature, webhookSecret);
      assert.strictEqual(isValid, true);
    });

    test("rejects invalid/tampered HMAC signature", () => {
      const validSignature = crypto
        .createHmac("sha256", webhookSecret)
        .update(payload)
        .digest("hex");

      // Flip character in signature
      const invalidSignature =
        validSignature.slice(0, -1) + (validSignature.endsWith("0") ? "1" : "0");

      const isValid = verifyRazorpaySignature(payload, invalidSignature, webhookSecret);
      assert.strictEqual(isValid, false);
    });

    test("rejects tampered payload when signature is unchanged", () => {
      const validSignature = crypto
        .createHmac("sha256", webhookSecret)
        .update(payload)
        .digest("hex");

      const tamperedPayload = payload.replace("50000", "99999");
      const isValid = verifyRazorpaySignature(tamperedPayload, validSignature, webhookSecret);
      assert.strictEqual(isValid, false);
    });

    test("safely rejects mismatched signature lengths without throwing RangeError", () => {
      const shortSignature = "short_invalid_sig";
      assert.doesNotThrow(() => {
        const isValid = verifyRazorpaySignature(payload, shortSignature, webhookSecret);
        assert.strictEqual(isValid, false);
      });
    });
  });
});
