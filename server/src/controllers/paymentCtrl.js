import Payment from "../models/Payment.js";
import Order from "../models/Order.js";
import logger from "../utils/logger.js";
import { createOrder, verifyPaymentSignature } from "../config/razorpay.js";
import crypto from "crypto";
import razorpayInstance from "../config/razorpay.js";

/**
 * POST /api/payments/create
 * Create a Razorpay order and a pending Payment record
 */
export const createPayment = async (req, res) => {
  try {
    const { orderId, amount } = req.body;
    const actorId = req.user?.id || "anonymous";

    const order = await Order.findById(orderId).populate("restaurant", "name");
    if (!order) {
      return res.status(404).json({ success: false, message: "Order not found" });
    }
    if (order.paymentStatus === "paid") {
      return res.status(400).json({ success: false, message: "Order is already paid" });
    }

    // Check for existing pending payment — reuse if valid
    const existingPending = await Payment.findOne({
      order: orderId,
      status: "pending",
      razorpayOrderId: { $exists: true, $ne: null },
    });
    if (existingPending) {
      existingPending.addAuditEvent("retry_attempted", actorId, { reused: true }, req);
      await existingPending.save();
      return res.status(200).json({
        success: true,
        data: {
          razorpayOrderId: existingPending.razorpayOrderId,
          amount: existingPending.amount,
          currency: existingPending.currency,
          paymentId: existingPending._id,
          keyId: process.env.RAZORPAY_KEY_ID,
        },
      });
    }

    const billAmount = amount || order.totalAmount;
    const razorpayOrder = await createOrder(billAmount, "INR", orderId, {
      orderId: order.orderNumber,
      restaurantName: order.restaurant?.name || "DineFlow",
    });

    const payment = new Payment({
      order: orderId,
      restaurant: order.restaurant?._id || order.restaurant,
      amount: billAmount,
      currency: "INR",
      razorpayOrderId: razorpayOrder.id,
      status: "pending",
    });
    payment.addAuditEvent("created", actorId, { razorpayOrderId: razorpayOrder.id, amount: billAmount }, req);
    await payment.save();

    // Link payment to order
    await Order.findByIdAndUpdate(orderId, { payment: payment._id });

    logger.info(`Payment created: ${payment._id} for order ${orderId}, ₹${billAmount}`);

    res.status(201).json({
      success: true,
      data: {
        razorpayOrderId: razorpayOrder.id,
        amount: billAmount,
        currency: "INR",
        paymentId: payment._id,
        keyId: process.env.RAZORPAY_KEY_ID,
        restaurantName: order.restaurant?.name,
        orderNumber: order.orderNumber,
      },
    });
  } catch (error) {
    logger.error("Create payment error:", error);
    res.status(500).json({ success: false, message: "Failed to create payment" });
  }
};

/**
 * POST /api/payments/verify
 * Verify Razorpay signature after successful payment
 */
export const verifyPayment = async (req, res) => {
  try {
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      orderId,
    } = req.body;
    const actorId = req.user?.id || "customer";

    // Signature verification
    const isValid = verifyPaymentSignature(
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature
    );
    if (!isValid) {
      logger.warn(`Invalid payment signature for Razorpay order ${razorpay_order_id}`);
      return res.status(400).json({ success: false, message: "Invalid payment signature" });
    }

    const payment = await Payment.findOne({ razorpayOrderId: razorpay_order_id });
    if (!payment) {
      return res.status(404).json({ success: false, message: "Payment record not found" });
    }

    // Idempotency — already verified
    if (payment.status === "paid") {
      return res.status(200).json({ success: true, message: "Payment already verified", data: { payment } });
    }

    payment.status = "paid";
    payment.razorpayPaymentId = razorpay_payment_id;
    payment.razorpaySignature = razorpay_signature;
    payment.paidAt = new Date();
    payment.webhookVerified = false; // Will be confirmed via webhook
    payment.addAuditEvent("verified", actorId, {
      razorpayPaymentId: razorpay_payment_id,
      razorpayOrderId: razorpay_order_id,
    }, req);
    await payment.save();

    // Update order payment status
    const order = await Order.findByIdAndUpdate(
      payment.order,
      { paymentStatus: "paid", payment: payment._id },
      { new: true }
    ).populate("restaurant", "name");

    // Emit payment-done socket event
    if (req.app.get("io") && order) {
      const io = req.app.get("io");
      const restaurantId = order.restaurant?._id?.toString() || order.restaurant?.toString();
      io.to(`restaurant-admin-${restaurantId}`).emit("payment-done", {
        orderId: order._id,
        amount: payment.amount,
        paymentId: payment._id,
        timestamp: new Date(),
      });
      io.to(`customer-room-${order._id}`).emit("payment-done", {
        orderId: order._id,
        message: "Payment confirmed! ✅",
        timestamp: new Date(),
      });
    }

    logger.info(`Payment verified: ${payment._id}, order ${payment.order}, ₹${payment.amount}`);

    res.status(200).json({
      success: true,
      message: "Payment verified successfully",
      data: { payment, order },
    });
  } catch (error) {
    logger.error("Verify payment error:", error);
    res.status(500).json({ success: false, message: "Failed to verify payment" });
  }
};

/**
 * POST /api/payments/webhook
 * Razorpay webhook handler — HMAC-SHA256 signature verification
 */
export const handleWebhook = async (req, res) => {
  try {
    const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;
    const receivedSig = req.headers["x-razorpay-signature"];

    if (webhookSecret && receivedSig) {
      const expectedSig = crypto
        .createHmac("sha256", webhookSecret)
        .update(JSON.stringify(req.body))
        .digest("hex");

      if (expectedSig !== receivedSig) {
        logger.warn("Razorpay webhook signature mismatch");
        return res.status(400).json({ success: false, message: "Invalid webhook signature" });
      }
    }

    const { event, payload } = req.body;
    logger.info(`Razorpay webhook: ${event}`);

    switch (event) {
      case "payment.captured": {
        const rpPayment = payload?.payment?.entity;
        if (!rpPayment) break;
        const payment = await Payment.findOne({ razorpayOrderId: rpPayment.order_id });
        if (payment && payment.status !== "paid") {
          payment.status = "paid";
          payment.razorpayPaymentId = rpPayment.id;
          payment.paidAt = new Date(rpPayment.created_at * 1000);
          payment.method = rpPayment.method;
          payment.bank = rpPayment.bank;
          payment.wallet = rpPayment.wallet;
          payment.vpa = rpPayment.vpa;
          payment.webhookVerified = true;
          payment.webhookReceivedAt = new Date();
          payment.addAuditEvent("captured", "webhook", { razorpayPaymentId: rpPayment.id, method: rpPayment.method });
          await payment.save();
          await Order.findByIdAndUpdate(payment.order, { paymentStatus: "paid" });
          logger.info(`Webhook: payment.captured for ${payment._id}`);
        }
        break;
      }

      case "payment.failed": {
        const rpPayment = payload?.payment?.entity;
        if (!rpPayment) break;
        const payment = await Payment.findOne({ razorpayOrderId: rpPayment.order_id });
        if (payment) {
          payment.status = "failed";
          payment.failureReason = rpPayment.error_description || rpPayment.error_reason;
          payment.failureCode = rpPayment.error_code;
          payment.webhookVerified = true;
          payment.webhookReceivedAt = new Date();
          payment.addAuditEvent("failed", "webhook", {
            reason: rpPayment.error_description,
            code: rpPayment.error_code,
          });
          await payment.save();
          await Order.findByIdAndUpdate(payment.order, { paymentStatus: "failed" });
          logger.warn(`Webhook: payment.failed for ${payment._id} — ${rpPayment.error_description}`);
        }
        break;
      }

      case "refund.processed": {
        const refund = payload?.refund?.entity;
        if (!refund) break;
        const payment = await Payment.findOne({ razorpayPaymentId: refund.payment_id });
        if (payment) {
          payment.status = "refunded";
          payment.razorpayRefundId = refund.id;
          payment.refundAmount = refund.amount / 100;
          payment.refundedAt = new Date(refund.created_at * 1000);
          payment.addAuditEvent("refunded", "webhook", { refundId: refund.id, amount: refund.amount / 100 });
          await payment.save();
          await Order.findByIdAndUpdate(payment.order, { paymentStatus: "refunded" });
          logger.info(`Webhook: refund.processed for payment ${payment._id}`);
        }
        break;
      }

      default:
        logger.info(`Webhook: unhandled event ${event}`);
    }

    res.status(200).json({ success: true });
  } catch (error) {
    logger.error("Webhook error:", error);
    res.status(500).json({ success: false, message: "Webhook processing failed" });
  }
};

/**
 * POST /api/payments/retry
 * Retry a failed payment — creates a new Razorpay order linked to original payment
 */
export const retryPayment = async (req, res) => {
  try {
    const { paymentId } = req.body;
    const actorId = req.user?.id || "customer";

    const originalPayment = await Payment.findById(paymentId).populate("order");
    if (!originalPayment) {
      return res.status(404).json({ success: false, message: "Payment not found" });
    }
    if (originalPayment.status === "paid") {
      return res.status(400).json({ success: false, message: "Payment already completed" });
    }
    if (originalPayment.retryCount >= 3) {
      return res.status(400).json({ success: false, message: "Maximum retry attempts reached" });
    }

    const order = originalPayment.order;
    const razorpayOrder = await createOrder(originalPayment.amount, "INR", order._id?.toString(), {
      retry: true,
      originalPaymentId: originalPayment._id?.toString(),
    });

    // Create new payment record for the retry
    const retryPayment = new Payment({
      order: order._id,
      restaurant: order.restaurant,
      amount: originalPayment.amount,
      currency: originalPayment.currency,
      razorpayOrderId: razorpayOrder.id,
      status: "pending",
      originalPaymentId: originalPayment._id,
      retryCount: originalPayment.retryCount + 1,
    });
    retryPayment.addAuditEvent("retry_attempted", actorId, {
      originalPaymentId: originalPayment._id,
      retryCount: retryPayment.retryCount,
    }, req);
    await retryPayment.save();

    // Update original payment retry count
    originalPayment.retryCount += 1;
    originalPayment.lastRetryAt = new Date();
    originalPayment.addAuditEvent("retry_attempted", actorId, { newPaymentId: retryPayment._id }, req);
    await originalPayment.save();

    logger.info(`Payment retry created: ${retryPayment._id} (retry ${retryPayment.retryCount}) for order ${order._id}`);

    res.status(201).json({
      success: true,
      message: "Retry payment initiated",
      data: {
        razorpayOrderId: razorpayOrder.id,
        amount: retryPayment.amount,
        currency: retryPayment.currency,
        paymentId: retryPayment._id,
        keyId: process.env.RAZORPAY_KEY_ID,
      },
    });
  } catch (error) {
    logger.error("Retry payment error:", error);
    res.status(500).json({ success: false, message: "Failed to retry payment" });
  }
};

/**
 * POST /api/payments/:id/refund
 * Initiate a refund via Razorpay
 */
export const refundPayment = async (req, res) => {
  try {
    const { id } = req.params;
    const { amount, reason = "Customer request" } = req.body;
    const actorId = req.user?.id || "admin";

    const payment = await Payment.findById(id).populate("order");
    if (!payment) {
      return res.status(404).json({ success: false, message: "Payment not found" });
    }
    if (payment.status !== "paid") {
      return res.status(400).json({ success: false, message: "Only paid payments can be refunded" });
    }
    if (!payment.razorpayPaymentId) {
      return res.status(400).json({ success: false, message: "No Razorpay payment ID — cannot refund" });
    }

    const refundAmount = amount
      ? Math.round(amount * 100)
      : Math.round(payment.amount * 100);

    payment.addAuditEvent("refund_initiated", actorId, { refundAmount: refundAmount / 100, reason }, req);
    await payment.save();

    const refund = await razorpayInstance.payments.refund(payment.razorpayPaymentId, {
      amount: refundAmount,
      speed: "normal",
      notes: { reason, actorId },
    });

    const isFullRefund = refundAmount >= Math.round(payment.amount * 100);
    payment.status = isFullRefund ? "refunded" : "partially_refunded";
    payment.razorpayRefundId = refund.id;
    payment.refundAmount = refund.amount / 100;
    payment.refundedAt = new Date();
    payment.refundReason = reason;
    payment.addAuditEvent("refunded", actorId, { refundId: refund.id, refundAmount: refund.amount / 100 }, req);
    await payment.save();

    await Order.findByIdAndUpdate(payment.order._id, { paymentStatus: payment.status });

    logger.info(`Refund initiated: ${refund.id} for payment ${payment._id}, ₹${refund.amount / 100}`);

    res.status(200).json({
      success: true,
      message: "Refund initiated successfully",
      data: { refund, payment },
    });
  } catch (error) {
    logger.error("Refund error:", error);
    res.status(500).json({ success: false, message: `Refund failed: ${error.message}` });
  }
};

/**
 * GET /api/payments/history
 * Payment history for a restaurant (admin)
 */
export const getPaymentHistory = async (req, res) => {
  try {
    const restaurantId = req.headers["x-restaurant-id"] || req.user.restaurant;
    const { page = 1, limit = 50, status, startDate, endDate } = req.query;

    const query = { restaurant: restaurantId };
    if (status) query.status = status;
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate);
    }

    const [payments, total] = await Promise.all([
      Payment.find(query)
        .populate({ path: "order", select: "orderNumber tableNumber totalAmount items" })
        .sort({ createdAt: -1 })
        .limit(Number(limit))
        .skip((Number(page) - 1) * Number(limit))
        .select("-razorpaySignature -auditLog"), // omit sensitive/heavy fields from list view
      Payment.countDocuments(query),
    ]);

    res.status(200).json({
      success: true,
      data: { payments, total, page: Number(page), pages: Math.ceil(total / Number(limit)) },
    });
  } catch (error) {
    logger.error("Get payment history error:", error);
    res.status(500).json({ success: false, message: "Failed to fetch payment history" });
  }
};

/**
 * GET /api/payments/:id/audit
 * Return audit log for a specific payment (admin only)
 */
export const getPaymentAuditLog = async (req, res) => {
  try {
    const { id } = req.params;
    const payment = await Payment.findById(id)
      .populate("order", "orderNumber tableNumber")
      .select("auditLog status amount razorpayOrderId razorpayPaymentId order createdAt");

    if (!payment) {
      return res.status(404).json({ success: false, message: "Payment not found" });
    }

    res.status(200).json({ success: true, data: payment });
  } catch (error) {
    logger.error("Get audit log error:", error);
    res.status(500).json({ success: false, message: "Failed to fetch audit log" });
  }
};

/**
 * POST /api/payments/:id/mark-paid
 * Manually mark an order as paid (cash / admin override)
 */
export const markAsPaid = async (req, res) => {
  try {
    const { id } = req.params;
    const { notes } = req.body;
    const actorId = req.user?.id;

    const payment = await Payment.findById(id);
    if (!payment) {
      return res.status(404).json({ success: false, message: "Payment not found" });
    }

    payment.status = "paid";
    payment.paidAt = new Date();
    payment.notes = notes;
    payment.addAuditEvent("manually_marked", actorId, { notes }, req);
    await payment.save();

    await Order.findByIdAndUpdate(payment.order, { paymentStatus: "paid" });

    logger.info(`Payment ${id} manually marked as paid by ${actorId}`);
    res.status(200).json({ success: true, message: "Payment marked as paid", data: { payment } });
  } catch (error) {
    logger.error("Mark paid error:", error);
    res.status(500).json({ success: false, message: "Failed to mark payment" });
  }
};
