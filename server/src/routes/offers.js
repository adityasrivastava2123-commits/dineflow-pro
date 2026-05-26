import express from "express";
import {
  getActiveOffers,
  validateCoupon,
  createOffer,
  updateOffer,
  deleteOffer,
} from "../controllers/offerCtrl.js";
import { authMiddleware } from "../middleware/authMiddleware.js";
import { requireManager } from "../middleware/roleMiddleware.js";
import Offer from "../models/Offer.js";
import logger from "../utils/logger.js";

const router = express.Router();

// Public endpoints (no auth)
router.get("/", getActiveOffers);
router.post("/validate", validateCoupon);

/**
 * GET /api/offers/public?restaurantId=xxx
 * Returns active, non-expired public coupons for a restaurant (customer-facing)
 */
router.get("/public", async (req, res) => {
  try {
    const { restaurantId } = req.query;
    if (!restaurantId) {
      return res.status(400).json({ success: false, message: "restaurantId required" });
    }

    const now = new Date();
    const coupons = await Offer.find({
      restaurant: restaurantId,
      isActive: true,
      $or: [
        { expiresAt: { $exists: false } },
        { expiresAt: null },
        { expiresAt: { $gt: now } },
      ],
      isPublic: { $ne: false }, // Only show public coupons
    })
      .select("code discountType discountValue minimumOrder maxDiscount description expiresAt")
      .sort({ createdAt: -1 })
      .limit(20);

    res.json({ success: true, data: { coupons } });
  } catch (error) {
    logger.error("Get public coupons error:", error);
    res.status(500).json({ success: false, message: "Failed to fetch offers" });
  }
});

// Admin / manager endpoints
router.post("/", authMiddleware, requireManager, createOffer);
router.put("/:id", authMiddleware, requireManager, updateOffer);
router.delete("/:id", authMiddleware, requireManager, deleteOffer);

export default router;
