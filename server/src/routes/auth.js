import express from "express";
import {
  register,
  login,
  logout,
  getProfile,
  updateProfile,
  refreshAccessToken,
  seedDemoData,
  customerIdentify,
  createStaff,
} from "../controllers/authCtrl.js";
import { authMiddleware, roleMiddleware } from "../middleware/authMiddleware.js";
import { strictRateLimit } from "../middleware/rateLimit.js";

const router = express.Router();

// Public
router.post("/register", strictRateLimit, register);
router.post("/login", strictRateLimit, login);
router.post("/refresh-token", refreshAccessToken);
router.post("/customer-identify", strictRateLimit, customerIdentify);

// Authenticated
router.post("/logout", authMiddleware, logout);
router.get("/me", authMiddleware, getProfile);
router.get("/profile", authMiddleware, getProfile);
router.put("/profile", authMiddleware, updateProfile);

// Admin: create staff accounts
router.post(
  "/staff",
  authMiddleware,
  roleMiddleware(["admin", "manager", "superadmin"]),
  createStaff
);

// Dev only
router.post("/seed-demo", authMiddleware, seedDemoData);

export default router;
