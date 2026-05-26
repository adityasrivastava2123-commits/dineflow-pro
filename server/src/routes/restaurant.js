import express from "express";
import {
  getRestaurantBySlug,
  updateRestaurantSettings,
  getRestaurantStaff,
  addStaff,
} from "../controllers/restaurantCtrl.js";
import { authMiddleware, roleMiddleware } from "../middleware/authMiddleware.js";

const router = express.Router();

// Public
router.get("/:slug", getRestaurantBySlug);

// Authenticated admin routes
router.put(
  "/settings",
  authMiddleware,
  roleMiddleware(["admin", "manager", "superadmin"]),
  updateRestaurantSettings
);

router.get(
  "/staff",
  authMiddleware,
  roleMiddleware(["admin", "manager", "superadmin"]),
  getRestaurantStaff
);

router.post(
  "/staff",
  authMiddleware,
  roleMiddleware(["admin", "superadmin"]),
  addStaff
);

export default router;

// Admin details route
router.get(
  "/admin/details",
  authMiddleware,
  roleMiddleware(["admin", "manager", "superadmin"]),
  async (req, res) => {
    try {
      const { Restaurant } = await import("../models/Restaurant.js");
      const userId = req.user.id;
      const restaurant = await Restaurant.findOne({ owner: userId });
      if (!restaurant) {
        return res.status(404).json({ success: false, message: "Restaurant not found" });
      }
      res.status(200).json({ success: true, data: { restaurant } });
    } catch (error) {
      res.status(500).json({ success: false, message: "Failed to fetch restaurant details" });
    }
  }
);
