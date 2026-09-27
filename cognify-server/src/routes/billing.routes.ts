import { Router } from "express";
import { authMiddleware } from "../middleware/auth.middleware";
import { workspaceAccess } from "../middleware/workspaceAccess.middleware";
import { stripeService } from "../services/billing/stripe.service";
import { webhookService } from "../services/billing/webhook.service";
import { subscriptionService } from "../services/billing/subscription.service";
import { creditLedgerService } from "../services/billing/creditLedger.service";
import { razorpay } from "../config/razorpay";
import { prisma } from "../config/db";
import { env } from "../config/env";
import { logger } from "../config/logger";
import express from "express";

const router = Router();

/** GET /api/billing/subscription — current user subscription */
router.get("/subscription", authMiddleware, async (req, res) => {
  try {
    const sub = await subscriptionService.getSubscription((req as any).userId);
    res.json(sub);
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

/** POST /api/billing/checkout — create checkout order or session */
router.post("/checkout", authMiddleware, async (req, res) => {
  try {
    const { plan } = req.body;

    if (!["PRO", "ENTERPRISE"].includes(plan)) {
      return res.status(400).json({ message: "Invalid plan. Choose PRO or ENTERPRISE." });
    }

    // Primary gateway: Razorpay Orders for INR
    if (razorpay) {
      const amount = plan === "PRO" ? 650000 : 2500000; // in INR paise
      const order = await (razorpay as any).orders.create({
        amount,
        currency: "INR",
        receipt: `rcpt_${Date.now()}_${(req as any).userId.slice(0, 8)}`,
        notes: {
          userId: (req as any).userId,
          plan,
        },
      });

      return res.json({
        gateway: "razorpay",
        key_id: env.RAZORPAY_KEY_ID,
        amount: order.amount,
        order_id: order.id,
        plan,
      });
    }

    // Fallback gateway: Stripe Checkout
    const url = await stripeService.createCheckoutSession(
      (req as any).userId,
      plan
    );

    res.json({ url });
  } catch (err: any) {
    logger.error("Checkout error", { err });
    res.status(500).json({ message: err.message });
  }
});

/** POST /api/billing/verify — verify Razorpay payment and upgrade subscription */
router.post("/verify", authMiddleware, async (req, res) => {
  try {
    const { razorpay_payment_id, razorpay_order_id, razorpay_signature, plan } = req.body;
    const userId = (req as any).userId;

    if (!razorpay_payment_id || !razorpay_order_id || !razorpay_signature) {
      return res.status(400).json({ message: "Missing verification parameters" });
    }

    // Verify signature via constant-time comparison
    const isValid = webhookService.verifyRazorpaySignature(
      `${razorpay_order_id}|${razorpay_payment_id}`,
      razorpay_signature,
      env.RAZORPAY_KEY_SECRET
    );

    if (!isValid) {
      return res.status(400).json({ message: "Payment verification failed" });
    }

    // Update locally in Prisma
    const tokenLimit = plan === "PRO" ? 100000 : 10000000;
    await prisma.subscription.upsert({
      where: { user_id: userId },
      create: {
        user_id: userId,
        plan,
        stripe_sub_id: razorpay_order_id,
        stripe_customer_id: razorpay_payment_id,
        current_period_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
        token_limit: tokenLimit,
      },
      update: {
        plan,
        stripe_sub_id: razorpay_order_id,
        stripe_customer_id: razorpay_payment_id,
        current_period_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
        token_limit: tokenLimit,
        tokens_used: 0,
      },
    });

    res.json({ success: true, message: "Subscription upgraded successfully" });
  } catch (err: any) {
    logger.error("Verification error", { err });
    res.status(500).json({ message: err.message });
  }
});

/** POST /api/billing/portal — create Stripe billing portal session */
router.post("/portal", authMiddleware, async (req, res) => {
  try {
    const url = await stripeService.createPortalSession((req as any).userId);
    res.json({ url });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

/** GET /api/billing/credits/:workspaceId — get current ledger balance */
router.get(
  "/credits/:workspaceId",
  authMiddleware,
  workspaceAccess,
  async (req, res) => {
    try {
      const workspaceId = req.params.workspaceId as string;
      const balance = await creditLedgerService.getBalance(workspaceId);
      res.json(balance);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  }
);

/**
 * POST /api/billing/webhook
 * Stripe webhook with raw body verification and atomic P2002 deduplication.
 */
router.post(
  "/webhook",
  express.raw({ type: "application/json" }),
  async (req, res) => {
    const signature = req.headers["stripe-signature"] as string;

    if (!signature) {
      return res.status(400).json({ message: "Missing stripe-signature header" });
    }

    try {
      const result = await webhookService.processStripeWebhook(req.body as Buffer, signature);
      res.json(result);
    } catch (err: any) {
      logger.error("Stripe webhook error", { err });
      res.status(400).json({ message: `Webhook error: ${err.message}` });
    }
  }
);

/**
 * POST /api/billing/webhook/razorpay
 * Razorpay webhook with constant-time HMAC verification and atomic P2002 deduplication.
 */
router.post(
  "/webhook/razorpay",
  express.raw({ type: "application/json" }),
  async (req, res) => {
    const signature = req.headers["x-razorpay-signature"] as string;

    if (!signature) {
      return res.status(400).json({ message: "Missing x-razorpay-signature header" });
    }

    try {
      const result = await webhookService.processRazorpayWebhook(req.body as Buffer, signature);
      res.json(result);
    } catch (err: any) {
      logger.error("Razorpay webhook error", { err });
      res.status(400).json({ message: err.message || "Invalid Razorpay webhook signature" });
    }
  }
);

export default router;
