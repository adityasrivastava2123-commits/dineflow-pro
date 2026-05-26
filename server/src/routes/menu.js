import express from "express";
import { getMenu, getMenuCategories, createMenuItem, updateMenuItem, deleteMenuItem, toggleMenuItemAvailability } from "../controllers/menuCtrl.js";
import { authMiddleware, roleMiddleware } from "../middleware/authMiddleware.js";
import { getUpsellPayload } from "../utils/recommendationEngine.js";
import multer from "multer";
import Restaurant from "../models/Restaurant.js";
import logger from "../utils/logger.js";

const router = express.Router();
const upload = multer({ dest: "tmp/" });

router.get("/", getMenu);
router.get("/categories", getMenuCategories);
router.post("/", authMiddleware, roleMiddleware(["admin", "manager"]), upload.single("image"), createMenuItem);
router.put("/:id", authMiddleware, roleMiddleware(["admin", "manager"]), upload.single("image"), updateMenuItem);
router.delete("/:id", authMiddleware, roleMiddleware(["admin", "manager"]), deleteMenuItem);
router.patch("/:id/availability", authMiddleware, roleMiddleware(["admin", "manager", "staff"]), toggleMenuItemAvailability);

/**
 * GET /api/menu/:slug/recommendations
 * AI upsell engine — returns co-occurrence, trending, personalized, diversification
 * Query: cartItems=id1,id2 | customerId=xyz | cartCategories=Burgers,Drinks
 */
router.get("/:slug/recommendations", async (req, res) => {
  try {
    const { slug } = req.params;
    const { cartItems = "", customerId, cartCategories = "" } = req.query;

    const restaurant = await Restaurant.findOne({ slug });
    if (!restaurant) {
      return res.status(404).json({ success: false, message: "Restaurant not found" });
    }

    const cartItemIds = cartItems ? cartItems.split(",").filter(Boolean) : [];
    const cartCats = cartCategories ? cartCategories.split(",").filter(Boolean) : [];

    const payload = await getUpsellPayload(restaurant._id, cartItemIds, customerId || null, cartCats);

    res.json({ success: true, data: payload });
  } catch (error) {
    logger.error("Recommendations route error:", error);
    res.status(500).json({ success: false, message: "Failed to get recommendations" });
  }
});

export default router;
