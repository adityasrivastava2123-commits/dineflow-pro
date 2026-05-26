import express from "express";
import { authMiddleware, roleMiddleware } from "../middleware/authMiddleware.js";

const router = express.Router();

// GET /api/inventory/low-stock
router.get(
  "/low-stock",
  authMiddleware,
  roleMiddleware(["admin", "manager", "superadmin"]),
  (req, res) => {
    res.status(200).json({
      success: true,
      data: { items: [] },
    });
  }
);

// GET /api/inventory
router.get(
  "/",
  authMiddleware,
  roleMiddleware(["admin", "manager", "superadmin"]),
  (req, res) => {
    res.status(200).json({
      success: true,
      data: { items: [] },
    });
  }
);

export default router;
