import mongoose from "mongoose";

/**
 * Payment Audit Log Entry — immutable event history
 */
const auditLogSchema = new mongoose.Schema(
  {
    event: {
      type: String,
      enum: [
        "created",
        "initiated",
        "captured",
        "verified",
        "failed",
        "refund_initiated",
        "refunded",
        "refund_failed",
        "retry_attempted",
        "webhook_received",
        "manually_marked",
      ],
      required: true,
    },
    timestamp: { type: Date, default: Date.now },
    actor: { type: String, default: "system" }, // "system" | userId | "webhook"
    meta: { type: mongoose.Schema.Types.Mixed, default: {} },
    ipAddress: String,
    userAgent: String,
  },
  { _id: true }
);

const paymentSchema = new mongoose.Schema(
  {
    order: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Order",
      required: true,
      index: true,
    },
    restaurant: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Restaurant",
      index: true,
    },
    amount: { type: Number, required: true },
    currency: { type: String, default: "INR" },

    status: {
      type: String,
      enum: ["pending", "paid", "failed", "refunded", "partially_refunded"],
      default: "pending",
      index: true,
    },

    // Razorpay IDs
    razorpayOrderId: { type: String, index: true },
    razorpayPaymentId: { type: String, index: true, sparse: true },
    razorpaySignature: String,

    // Refund
    razorpayRefundId: String,
    refundAmount: { type: Number, default: 0 },
    refundedAt: Date,
    refundReason: String,

    // Payment details
    method: String,          // upi | card | netbanking | wallet
    bank: String,
    wallet: String,
    vpa: String,             // UPI VPA
    email: String,
    contact: String,

    paidAt: Date,
    failureReason: String,
    failureCode: String,

    // Retry tracking
    retryCount: { type: Number, default: 0 },
    lastRetryAt: Date,
    originalPaymentId: {     // For retries: links to the original failed payment
      type: mongoose.Schema.Types.ObjectId,
      ref: "Payment",
    },

    // Webhook
    webhookVerified: { type: Boolean, default: false },
    webhookReceivedAt: Date,

    // Audit log — append-only array of events
    auditLog: [auditLogSchema],

    notes: String,
  },
  {
    timestamps: true,
  }
);

// ── Indexes ───────────────────────────────────────────────────────────────
paymentSchema.index({ restaurant: 1, createdAt: -1 });
paymentSchema.index({ status: 1, createdAt: -1 });

/**
 * Instance method: append an immutable audit event
 */
paymentSchema.methods.addAuditEvent = function (event, actor = "system", meta = {}, req = null) {
  this.auditLog.push({
    event,
    timestamp: new Date(),
    actor,
    meta,
    ipAddress: req?.ip,
    userAgent: req?.headers?.["user-agent"],
  });
  return this;
};

export default mongoose.model("Payment", paymentSchema);
