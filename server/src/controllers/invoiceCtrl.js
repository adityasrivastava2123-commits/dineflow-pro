import Order from "../models/Order.js";
import Payment from "../models/Payment.js";
import Restaurant from "../models/Restaurant.js";
import logger from "../utils/logger.js";
import { generateInvoicePDF } from "../utils/invoiceGenerator.js";
import { queueInvoiceWhatsApp } from "../queues/whatsappQueue.js";

/**
 * GET /api/invoices/:orderId
 * Generate & stream PDF invoice for an order
 */
export const downloadInvoice = async (req, res) => {
  try {
    const { orderId } = req.params;

    const order = await Order.findById(orderId)
      .populate("items.menuItem")
      .populate("restaurant")
      .populate("payment");

    if (!order) {
      return res.status(404).json({ success: false, message: "Order not found" });
    }

    const payment = await Payment.findOne({ order: orderId });

    const invoiceData = {
      order,
      payment,
      restaurant: order.restaurant,
      generatedAt: new Date(),
    };

    const pdfBuffer = await generateInvoicePDF(invoiceData);

    const filename = `DineFlow_Invoice_${order.orderNumber || orderId}.pdf`;
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.setHeader("Content-Length", pdfBuffer.length);
    res.end(pdfBuffer);

    logger.info(`Invoice downloaded for order ${orderId}`);
  } catch (error) {
    logger.error("Download invoice error:", error);
    res.status(500).json({ success: false, message: "Failed to generate invoice" });
  }
};

/**
 * POST /api/invoices/:orderId/whatsapp
 * Queue WhatsApp invoice delivery to customer
 */
export const sendInvoiceWhatsApp = async (req, res) => {
  try {
    const { orderId } = req.params;
    const { phone } = req.body;

    const order = await Order.findById(orderId).populate("restaurant");
    if (!order) {
      return res.status(404).json({ success: false, message: "Order not found" });
    }

    const recipientPhone = phone || order.customerPhone;
    if (!recipientPhone) {
      return res.status(400).json({ success: false, message: "Phone number required" });
    }

    // Normalize phone: strip +, ensure country code
    const normalizedPhone = recipientPhone.replace(/\D/g, "").replace(/^0/, "91");

    await queueInvoiceWhatsApp(normalizedPhone, orderId, order.restaurant?.name || "DineFlow");

    logger.info(`WhatsApp invoice queued for order ${orderId} → ${normalizedPhone}`);

    res.status(200).json({
      success: true,
      message: "Invoice will be sent via WhatsApp shortly",
      phone: normalizedPhone,
    });
  } catch (error) {
    logger.error("Send invoice WhatsApp error:", error);
    res.status(500).json({ success: false, message: "Failed to queue WhatsApp invoice" });
  }
};

/**
 * GET /api/invoices/:orderId/data
 * Return invoice data as JSON (for client-side PDF generation)
 */
export const getInvoiceData = async (req, res) => {
  try {
    const { orderId } = req.params;

    const order = await Order.findById(orderId)
      .populate("items.menuItem", "name price image isVeg")
      .populate("restaurant", "name address phone gstNumber logo")
      .populate("payment");

    if (!order) {
      return res.status(404).json({ success: false, message: "Order not found" });
    }

    const payment = await Payment.findOne({ order: orderId });

    const invoiceData = {
      invoiceNumber: `INV-${order.orderNumber || orderId.slice(-6).toUpperCase()}`,
      invoiceDate: order.createdAt,
      order: {
        id: order._id,
        orderNumber: order.orderNumber,
        tableNumber: order.tableNumber,
        status: order.status,
        paymentStatus: order.paymentStatus,
        paymentMethod: order.paymentMethod,
        items: order.items.map((item) => ({
          name: item.name,
          quantity: item.quantity,
          price: item.price,
          addons: item.addons || [],
          specialInstructions: item.specialInstructions,
          isVeg: item.isVeg,
          total: item.price * item.quantity,
        })),
        subtotal: order.subtotal,
        tax: order.tax,
        taxRate: order.taxRate || 5,
        tipAmount: order.tipAmount || 0,
        couponDiscount: order.couponDiscount || 0,
        loyaltyDiscount: order.loyaltyDiscount || 0,
        totalAmount: order.totalAmount,
        notes: order.notes,
        createdAt: order.createdAt,
        deliveredAt: order.deliveredAt,
      },
      restaurant: {
        name: order.restaurant?.name || "Restaurant",
        address: order.restaurant?.address || "",
        phone: order.restaurant?.phone || "",
        gstNumber: order.restaurant?.gstNumber || "",
        logo: order.restaurant?.logo || "",
      },
      payment: payment
        ? {
            razorpayPaymentId: payment.razorpayPaymentId,
            method: payment.method,
            paidAt: payment.paidAt,
            status: payment.status,
          }
        : null,
      customerName: order.customerName,
      customerPhone: order.customerPhone,
    };

    res.status(200).json({ success: true, data: invoiceData });
  } catch (error) {
    logger.error("Get invoice data error:", error);
    res.status(500).json({ success: false, message: "Failed to fetch invoice data" });
  }
};

/**
 * POST /api/invoices/:orderId/email
 * (Stub) Queue email delivery of invoice
 */
export const emailInvoice = async (req, res) => {
  try {
    const { orderId } = req.params;
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ success: false, message: "Email required" });
    }

    // TODO: Integrate email service (SendGrid / Resend)
    logger.info(`Email invoice requested for order ${orderId} → ${email}`);

    res.status(200).json({
      success: true,
      message: "Invoice email queued (email service not yet configured)",
    });
  } catch (error) {
    logger.error("Email invoice error:", error);
    res.status(500).json({ success: false, message: "Failed to queue invoice email" });
  }
};
