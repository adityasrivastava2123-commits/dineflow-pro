import express from "express";
import {
  createPayment,
  verifyPayment,
  handleWebhook,
  getPaymentHistory,
  refundPayment,
  retryPayment,
  getPaymentAuditLog,
  markAsPaid,
} from "../controllers/paymentCtrl.js";
import { authMiddleware } from "../middleware/authMiddleware.js";
import { requireAdmin, requireManager } from "../middleware/roleMiddleware.js";

const router = express.Router();

// Customer routes
router.post("/create-order", authMiddleware, createPayment);
router.post("/verify", verifyPayment);          // no auth — signature is the proof
router.post("/retry", authMiddleware, retryPayment);

// Razorpay webhook — raw body required, signature-verified inside handler
router.post("/webhook", express.raw({ type: "application/json" }), handleWebhook);

// Admin routes
router.get("/history", authMiddleware, requireManager, getPaymentHistory);
router.post("/:id/refund", authMiddleware, requireManager, refundPayment);
router.get("/:id/audit", authMiddleware, requireManager, getPaymentAuditLog);
router.post("/:id/mark-paid", authMiddleware, requireAdmin, markAsPaid);

export default router;
