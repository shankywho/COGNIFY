import crypto from "crypto";
import { stripe } from "../../config/stripe";
import { prisma } from "../../config/db";
import { subscriptionService } from "./subscription.service";
import { creditLedgerService } from "./creditLedger.service";
import { logger } from "../../config/logger";
import { env } from "../../config/env";

export interface WebhookProcessResult {
  received: boolean;
  deduplicated?: boolean;
}

/**
 * Deep Webhook Module.
 * Encapsulates cryptographic verification, timing-safe equality, P2002 idempotency,
 * and subscription credit allocation behind a clean processing seam.
 */
export const webhookService = {
  /**
   * Validates and constructs Stripe webhook event from raw Buffer and header signature.
   */
  constructEvent(rawBody: Buffer, signature: string) {
    if (!stripe) {
      throw new Error(
        "Stripe integration is not configured. Please set STRIPE_SECRET_KEY."
      );
    }
    return stripe.webhooks.constructEvent(
      rawBody,
      signature,
      env.STRIPE_WEBHOOK_SECRET
    );
  },

  /**
   * Constant-time HMAC-SHA256 signature verification for Razorpay webhooks.
   */
  verifyRazorpaySignature(
    rawBody: string | Buffer,
    signature: string,
    secret?: string
  ): boolean {
    const webhookSecret = secret || env.RAZORPAY_WEBHOOK_SECRET || env.RAZORPAY_KEY_SECRET;
    if (!webhookSecret || !signature) return false;

    const hmac = crypto.createHmac("sha256", webhookSecret);
    hmac.update(rawBody);
    const expectedSignature = hmac.digest("hex");

    const expectedBuffer = Buffer.from(expectedSignature, "utf8");
    const signatureBuffer = Buffer.from(signature, "utf8");

    if (expectedBuffer.length !== signatureBuffer.length) {
      return false;
    }
    return crypto.timingSafeEqual(expectedBuffer, signatureBuffer);
  },

  /**
   * Atomically records an incoming webhook event.
   * Returns `true` if new event recorded.
   * Returns `false` if duplicate event caught via P2002 (idempotent duplicate).
   */
  async recordWebhookEvent(
    provider: "STRIPE" | "RAZORPAY",
    externalEventId: string
  ): Promise<boolean> {
    try {
      await prisma.webhookEvent.create({
        data: {
          provider,
          externalEventId,
          status: "RECEIVED",
        },
      });
      return true;
    } catch (err: any) {
      if (err.code === "P2002") {
        logger.info(
          `Webhook event ${externalEventId} already recorded (${provider}). Deduplicating.`
        );
        return false;
      }
      throw err;
    }
  },

  /**
   * Marks a webhook event as PROCESSED in the database.
   */
  async markWebhookProcessed(externalEventId: string): Promise<void> {
    try {
      await prisma.webhookEvent.update({
        where: { externalEventId },
        data: {
          status: "PROCESSED",
          processedAt: new Date(),
        },
      });
    } catch (err: any) {
      logger.error(`Failed to mark webhook ${externalEventId} as processed: ${err.message}`);
    }
  },

  /**
   * Handles Stripe events with automatic credit ledger allocation and plan upgrading.
   */
  async handleEvent(event: { id?: string; type: string; data: { object: any } }): Promise<void> {
    const eventId = event.id || `stripe-${Date.now()}`;
    logger.info(`Processing Stripe webhook: ${event.type} (ID: ${eventId})`);

    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object;
        const userId = session.metadata?.userId as string | undefined;
        const plan = session.metadata?.plan as "PRO" | "ENTERPRISE" | undefined;
        let workspaceId = session.metadata?.workspaceId as string | undefined;

        if (!userId || !plan) break;

        await subscriptionService.upgradePlan(
          userId,
          plan,
          typeof session.subscription === "string" ? session.subscription : undefined
        );

        if (!workspaceId) {
          const ws = await prisma.workspace.findFirst({
            where: { user_id: userId },
            orderBy: { created_at: "asc" },
          });
          workspaceId = ws?.id;
        }

        if (workspaceId) {
          const creditsToAdd = plan === "PRO" ? 100000 : 1000000;
          await creditLedgerService.addCredit(workspaceId, creditsToAdd, eventId);
        }
        break;
      }

      case "customer.subscription.updated": {
        const sub = event.data.object;
        const userId = sub.metadata?.userId as string | undefined;
        const planNick = sub.items?.data?.[0]?.price?.nickname?.toUpperCase?.() as string | undefined;

        if (!userId) break;

        const plan = (["PRO", "ENTERPRISE"].includes(planNick ?? "")
          ? planNick
          : "FREE") as "FREE" | "PRO" | "ENTERPRISE";

        await subscriptionService.upgradePlan(
          userId,
          plan,
          sub.id,
          typeof sub.current_period_end === "number"
            ? new Date(sub.current_period_end * 1000)
            : undefined
        );
        break;
      }

      case "customer.subscription.deleted": {
        const sub = event.data.object;
        const userId = sub.metadata?.userId as string | undefined;

        if (!userId) break;
        await subscriptionService.cancelPlan(userId);
        break;
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object;
        logger.warn(`Payment failed for customer: ${invoice.customer}`);
        break;
      }

      default:
        logger.info(`Unhandled Stripe event: ${event.type}`);
    }
  },

  /**
   * Handles verified Razorpay webhook payloads with credit allocation.
   */
  async handleRazorpayPayment(
    paymentId: string,
    orderId: string,
    amountPaise: number,
    userId?: string,
    workspaceId?: string
  ): Promise<void> {
    logger.info(`Processing Razorpay payment ${paymentId} for order ${orderId}`);

    if (userId) {
      const plan = amountPaise >= 2000000 ? "ENTERPRISE" : "PRO";
      await subscriptionService.upgradePlan(userId, plan, orderId);

      if (!workspaceId) {
        const ws = await prisma.workspace.findFirst({
          where: { user_id: userId },
          orderBy: { created_at: "asc" },
        });
        workspaceId = ws?.id;
      }
    }

    if (workspaceId) {
      const creditsToAdd = Math.max(1000, Math.floor(amountPaise / 10));
      await creditLedgerService.addCredit(workspaceId, creditsToAdd, paymentId);
    }
  },

  /**
   * Deep processing pipeline for Stripe webhooks.
   */
  async processStripeWebhook(
    rawBody: Buffer,
    signature: string
  ): Promise<WebhookProcessResult> {
    const event = this.constructEvent(rawBody, signature);
    const eventId = event.id || `stripe-${Date.now()}`;

    const isNew = await this.recordWebhookEvent("STRIPE", eventId);
    if (!isNew) {
      return { received: true, deduplicated: true };
    }

    await this.handleEvent(event);
    await this.markWebhookProcessed(eventId);

    return { received: true };
  },

  /**
   * Deep processing pipeline for Razorpay webhooks.
   */
  async processRazorpayWebhook(
    rawBody: Buffer,
    signature: string
  ): Promise<WebhookProcessResult> {
    const isValid = this.verifyRazorpaySignature(rawBody, signature);
    if (!isValid) {
      throw new Error("Invalid Razorpay webhook signature");
    }

    const payload = JSON.parse(rawBody.toString("utf8"));
    const eventId = payload.event_id || payload.payload?.payment?.entity?.id || `rzp-${Date.now()}`;

    const isNew = await this.recordWebhookEvent("RAZORPAY", eventId);
    if (!isNew) {
      return { received: true, deduplicated: true };
    }

    const payment = payload.payload?.payment?.entity;
    if (payment) {
      const paymentId = payment.id;
      const orderId = payment.order_id;
      const amountPaise = payment.amount || 0;
      const userId = payment.notes?.userId;
      const workspaceId = payment.notes?.workspaceId;

      await this.handleRazorpayPayment(
        paymentId,
        orderId,
        amountPaise,
        userId,
        workspaceId
      );
    }

    await this.markWebhookProcessed(eventId);
    return { received: true };
  },
};
