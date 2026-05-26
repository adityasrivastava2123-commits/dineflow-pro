import express from "express";
import { authMiddleware } from "../middleware/authMiddleware.js";
import {
  downloadInvoice,
  sendInvoiceWhatsApp,
  getInvoiceData,
  emailInvoice,
} from "../controllers/invoiceCtrl.js";

const router = express.Router();

/**
 * GET  /api/invoices/:orderId        → PDF download (auth optional — token OR order ownership check)
 * GET  /api/invoices/:orderId/data   → JSON invoice data (for client-side PDF generation)
 * POST /api/invoices/:orderId/whatsapp → Queue WhatsApp delivery
 * POST /api/invoices/:orderId/email  → Queue email delivery
 */

// Public PDF download — accessible by customer via order link (no auth required for download)
router.get("/:orderId", downloadInvoice);

// JSON data for client-side PDF generation
router.get("/:orderId/data", getInvoiceData);

// WhatsApp invoice share
router.post("/:orderId/whatsapp", sendInvoiceWhatsApp);

// Email invoice
router.post("/:orderId/email", authMiddleware, emailInvoice);

export default router;
