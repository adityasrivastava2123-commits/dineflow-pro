import express from "express";
import { authMiddleware } from "../middleware/authMiddleware.js";
import { requireAdmin, requireManager } from "../middleware/roleMiddleware.js";
import User from "../models/User.js";
import logger from "../utils/logger.js";
import bcrypt from "bcryptjs";

const router = express.Router();

/**
 * GET /api/staff
 * Get all staff for the current restaurant
 */
router.get("/", authMiddleware, requireManager, async (req, res) => {
  try {
    const restaurantId = req.headers["x-restaurant-id"] || req.user.restaurant;
    const staff = await User.find({
      restaurant: restaurantId,
      role: { $in: ["manager", "staff", "kitchen"] },
    }).select("-password -refreshToken");

    res.json({ success: true, data: { staff } });
  } catch (error) {
    logger.error("Get staff error:", error);
    res.status(500).json({ success: false, message: "Failed to fetch staff" });
  }
});

/**
 * POST /api/staff
 * Create a new staff member
 */
router.post("/", authMiddleware, requireAdmin, async (req, res) => {
  try {
    const { name, phone, email, password, role, restaurantId: bodyRestaurantId } = req.body;
    const restaurantId = bodyRestaurantId || req.headers["x-restaurant-id"] || req.user.restaurant;

    const validRoles = ["manager", "staff", "kitchen"];
    if (!validRoles.includes(role)) {
      return res.status(400).json({ success: false, message: `Role must be one of: ${validRoles.join(", ")}` });
    }

    const existing = await User.findOne({ $or: [{ phone }, ...(email ? [{ email }] : [])] });
    if (existing) {
      return res.status(409).json({ success: false, message: "User with this phone/email already exists" });
    }

    const hashed = await bcrypt.hash(password, 12);
    const staff = await User.create({
      name,
      phone,
      email,
      password: hashed,
      role,
      restaurant: restaurantId,
    });

    const { password: _, ...staffData } = staff.toObject();
    logger.info(`Staff created: ${staff._id} (${role}) for restaurant ${restaurantId}`);
    res.status(201).json({ success: true, message: "Staff member created", data: { staff: staffData } });
  } catch (error) {
    logger.error("Create staff error:", error);
    res.status(500).json({ success: false, message: "Failed to create staff" });
  }
});

/**
 * PATCH /api/staff/:id
 * Update staff member (name, role, active status)
 */
router.patch("/:id", authMiddleware, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, role, isActive, email } = req.body;

    const updates = {};
    if (name) updates.name = name;
    if (role) updates.role = role;
    if (typeof isActive === "boolean") updates.isActive = isActive;
    if (email) updates.email = email;

    const staff = await User.findByIdAndUpdate(id, updates, { new: true }).select("-password -refreshToken");
    if (!staff) return res.status(404).json({ success: false, message: "Staff not found" });

    res.json({ success: true, message: "Staff updated", data: { staff } });
  } catch (error) {
    logger.error("Update staff error:", error);
    res.status(500).json({ success: false, message: "Failed to update staff" });
  }
});

/**
 * DELETE /api/staff/:id
 * Remove a staff member
 */
router.delete("/:id", authMiddleware, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const staff = await User.findByIdAndDelete(id);
    if (!staff) return res.status(404).json({ success: false, message: "Staff not found" });

    logger.info(`Staff deleted: ${id}`);
    res.json({ success: true, message: "Staff member removed" });
  } catch (error) {
    logger.error("Delete staff error:", error);
    res.status(500).json({ success: false, message: "Failed to delete staff" });
  }
});

/**
 * POST /api/staff/:id/reset-password
 * Admin resets a staff member's password
 */
router.post("/:id/reset-password", authMiddleware, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { newPassword } = req.body;
    if (!newPassword || newPassword.length < 6) {
      return res.status(400).json({ success: false, message: "Password must be at least 6 characters" });
    }

    const hashed = await bcrypt.hash(newPassword, 12);
    await User.findByIdAndUpdate(id, { password: hashed });
    logger.info(`Password reset for staff: ${id}`);
    res.json({ success: true, message: "Password reset successfully" });
  } catch (error) {
    logger.error("Reset staff password error:", error);
    res.status(500).json({ success: false, message: "Failed to reset password" });
  }
});

export default router;
