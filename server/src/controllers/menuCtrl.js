import MenuItem from "../models/MenuItem.js";
import Restaurant from "../models/Restaurant.js";
import logger from "../utils/logger.js";
import { uploadToCloudinary, deleteFromCloudinary } from "../config/cloudinary.js";
import { getCache, setCache, invalidatePattern } from "../config/redis.js";

/**
 * GET /api/menu?slug=restaurant-slug
 * Customer-facing menu: returns restaurant info + grouped menu items + categories
 */
export const getMenu = async (req, res) => {
  try {
    const { slug, restaurantId: queryRestaurantId } = req.query;
    const headerRestaurantId = req.headers["x-restaurant-id"];

    let restaurant = null;
    let restaurantId = queryRestaurantId || headerRestaurantId;

    // Slug-based lookup (customer QR flow)
    if (slug) {
      const cacheKey = `menu-slug-${slug}`;
      const cached = await getCache(cacheKey);
      if (cached) return res.status(200).json({ success: true, data: cached });

      restaurant = await Restaurant.findOne({ slug })
        .select("name slug logo address phone gstNumber tables subscriptionPlan isActive");
      if (!restaurant) {
        return res.status(404).json({ success: false, message: "Restaurant not found" });
      }
      if (!restaurant.isActive) {
        return res.status(503).json({ success: false, message: "Restaurant is currently closed" });
      }
      restaurantId = restaurant._id;
    }

    if (!restaurantId) {
      return res.status(400).json({ success: false, message: "Restaurant ID or slug required" });
    }

    const cacheKey = `menu-${restaurantId}`;
    const cached = await getCache(cacheKey);
    if (cached && !slug) return res.status(200).json({ success: true, data: cached });

    const items = await MenuItem.find({ restaurant: restaurantId, available: true })
      .select("name description price image category isVeg isVegan isJain isSpicy isBestseller available addons ratings preparationTime")
      .sort({ category: 1, isBestseller: -1, name: 1 });

    // Build category list preserving order
    const categorySet = new Set();
    items.forEach(i => categorySet.add(i.category));
    const categories = [...categorySet];

    const payload = {
      restaurant: restaurant
        ? {
            id: restaurant._id,
            name: restaurant.name,
            slug: restaurant.slug,
            logo: restaurant.logo,
            address: restaurant.address,
            phone: restaurant.phone,
            gstNumber: restaurant.gstNumber,
            tables: restaurant.tables,
          }
        : null,
      items,
      categories,
      totalItems: items.length,
    };

    await setCache(cacheKey, payload, 1800); // 30 min cache
    if (slug) await setCache(`menu-slug-${slug}`, payload, 1800);

    res.status(200).json({ success: true, data: payload });
  } catch (error) {
    logger.error("Get menu error:", error);
    res.status(500).json({ success: false, message: "Failed to fetch menu" });
  }
};

export const getMenuCategories = async (req, res) => {
  try {
    const restaurantId = req.headers["x-restaurant-id"];

    const categories = await MenuItem.distinct("category", { restaurant: restaurantId, available: true });

    res.status(200).json({
      success: true,
      data: { categories },
    });
  } catch (error) {
    logger.error("Get categories error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch categories",
    });
  }
};

export const createMenuItem = async (req, res) => {
  try {
    const restaurantId = req.headers["x-restaurant-id"];
    const itemData = req.body;

    // Upload image if provided
    if (req.file) {
      const uploadResult = await uploadToCloudinary(req.file, `dineflow/menu/${restaurantId}`);
      itemData.image = uploadResult;
    }

    const menuItem = new MenuItem({
      ...itemData,
      restaurant: restaurantId,
    });

    await menuItem.save();

    // Invalidate cache
    await invalidatePattern(`menu-${restaurantId}`);

    res.status(201).json({
      success: true,
      message: "Menu item created successfully",
      data: { item: menuItem },
    });
  } catch (error) {
    logger.error("Create menu item error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to create menu item",
    });
  }
};

export const updateMenuItem = async (req, res) => {
  try {
    const { id } = req.params;
    const restaurantId = req.headers["x-restaurant-id"];
    const updateData = req.body;

    // Handle image upload
    if (req.file) {
      const existingItem = await MenuItem.findById(id);
      if (existingItem?.image?.publicId) {
        await deleteFromCloudinary(existingItem.image.publicId);
      }

      const uploadResult = await uploadToCloudinary(req.file, `dineflow/menu/${restaurantId}`);
      updateData.image = uploadResult;
    }

    const menuItem = await MenuItem.findByIdAndUpdate(id, updateData, { new: true });

    // Invalidate cache
    await invalidatePattern(`menu-${restaurantId}`);

    res.status(200).json({
      success: true,
      message: "Menu item updated successfully",
      data: { item: menuItem },
    });
  } catch (error) {
    logger.error("Update menu item error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update menu item",
    });
  }
};

export const deleteMenuItem = async (req, res) => {
  try {
    const { id } = req.params;
    const restaurantId = req.headers["x-restaurant-id"];

    const item = await MenuItem.findById(id);
    if (item?.image?.publicId) {
      await deleteFromCloudinary(item.image.publicId);
    }

    await MenuItem.findByIdAndDelete(id);

    // Invalidate cache
    await invalidatePattern(`menu-${restaurantId}`);

    res.status(200).json({
      success: true,
      message: "Menu item deleted successfully",
    });
  } catch (error) {
    logger.error("Delete menu item error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to delete menu item",
    });
  }
};

export const toggleMenuItemAvailability = async (req, res) => {
  try {
    const { id } = req.params;
    const restaurantId = req.headers["x-restaurant-id"];

    const item = await MenuItem.findById(id);
    item.available = !item.available;
    await item.save();

    // Invalidate cache
    await invalidatePattern(`menu-${restaurantId}`);

    res.status(200).json({
      success: true,
      message: `Item ${item.available ? "enabled" : "disabled"}`,
      data: { item },
    });
  } catch (error) {
    logger.error("Toggle availability error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to toggle availability",
    });
  }
};
