import Order from "../models/Order.js";
import MenuItem from "../models/MenuItem.js";
import logger from "./logger.js";

/**
 * DineFlow Pro — AI Recommendation & Upselling Engine
 *
 * Algorithms:
 * 1. Co-occurrence ("people who ordered X also ordered Y")
 * 2. Trending items (ordered most in last 24h)
 * 3. Category diversification (suggest uncovered categories)
 * 4. Personalization (customer's past orders)
 */

/**
 * Build a co-occurrence map from recent orders
 * Returns: Map<itemId, Map<otherItemId, count>>
 */
const buildCoOccurrenceMap = async (restaurantId, days = 30) => {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const orders = await Order.find({
    restaurant: restaurantId,
    createdAt: { $gte: since },
    status: { $in: ["delivered", "ready", "preparing", "accepted"] },
  }).select("items");

  const coMap = new Map();

  for (const order of orders) {
    const itemIds = order.items.map((i) => i.menuItem?.toString()).filter(Boolean);
    for (let i = 0; i < itemIds.length; i++) {
      for (let j = 0; j < itemIds.length; j++) {
        if (i === j) continue;
        if (!coMap.has(itemIds[i])) coMap.set(itemIds[i], new Map());
        const inner = coMap.get(itemIds[i]);
        inner.set(itemIds[j], (inner.get(itemIds[j]) || 0) + 1);
      }
    }
  }
  return coMap;
};

/**
 * Get co-occurrence recommendations for a set of cart item IDs
 * Returns top N recommended MenuItem documents
 */
export const getCoOccurrenceRecommendations = async (restaurantId, cartItemIds, limit = 4) => {
  try {
    if (!cartItemIds || cartItemIds.length === 0) return [];

    const coMap = await buildCoOccurrenceMap(restaurantId);
    const scores = new Map();

    for (const id of cartItemIds) {
      const related = coMap.get(id);
      if (!related) continue;
      for (const [relId, count] of related.entries()) {
        if (cartItemIds.includes(relId)) continue; // already in cart
        scores.set(relId, (scores.get(relId) || 0) + count);
      }
    }

    if (scores.size === 0) return [];

    const sorted = [...scores.entries()].sort((a, b) => b[1] - a[1]).slice(0, limit);
    const recommendedIds = sorted.map(([id]) => id);

    const items = await MenuItem.find({
      _id: { $in: recommendedIds },
      restaurant: restaurantId,
      available: true,
    }).select("name price image category isVeg ratings");

    // Preserve score order
    const itemMap = Object.fromEntries(items.map((i) => [i._id.toString(), i]));
    return recommendedIds.map((id) => itemMap[id]).filter(Boolean);
  } catch (error) {
    logger.error("Co-occurrence recommendation error:", error);
    return [];
  }
};

/**
 * Get trending items for a restaurant (most ordered in past N hours)
 */
export const getTrendingItems = async (restaurantId, hours = 24, limit = 6) => {
  try {
    const since = new Date(Date.now() - hours * 60 * 60 * 1000);

    const pipeline = [
      {
        $match: {
          restaurant: restaurantId,
          createdAt: { $gte: since },
          status: { $nin: ["cancelled"] },
        },
      },
      { $unwind: "$items" },
      {
        $group: {
          _id: "$items.menuItem",
          orderCount: { $sum: "$items.quantity" },
          revenue: { $sum: { $multiply: ["$items.price", "$items.quantity"] } },
        },
      },
      { $sort: { orderCount: -1 } },
      { $limit: limit },
    ];

    const results = await Order.aggregate(pipeline);
    const itemIds = results.map((r) => r._id).filter(Boolean);

    const items = await MenuItem.find({
      _id: { $in: itemIds },
      available: true,
    }).select("name price image category isVeg ratings");

    const countMap = Object.fromEntries(results.map((r) => [r._id?.toString(), r.orderCount]));
    const revenueMap = Object.fromEntries(results.map((r) => [r._id?.toString(), r.revenue]));

    return items
      .map((item) => ({
        ...item.toObject(),
        orderCount: countMap[item._id.toString()] || 0,
        revenue: revenueMap[item._id.toString()] || 0,
      }))
      .sort((a, b) => b.orderCount - a.orderCount);
  } catch (error) {
    logger.error("Trending items error:", error);
    return [];
  }
};

/**
 * Personalized recommendations based on customer's past orders
 */
export const getPersonalizedRecommendations = async (restaurantId, customerId, cartItemIds = [], limit = 4) => {
  try {
    // Get customer's past orders at this restaurant
    const pastOrders = await Order.find({
      restaurant: restaurantId,
      customer: customerId,
      status: { $in: ["delivered", "ready"] },
    })
      .select("items")
      .sort({ createdAt: -1 })
      .limit(10);

    const pastItemIds = new Set();
    for (const order of pastOrders) {
      for (const item of order.items) {
        if (item.menuItem) pastItemIds.add(item.menuItem.toString());
      }
    }

    // Find items NOT yet ordered — diverse suggestions
    const alreadySeen = new Set([...pastItemIds, ...cartItemIds]);
    const candidates = await MenuItem.find({
      restaurant: restaurantId,
      available: true,
      _id: { $nin: [...alreadySeen] },
    })
      .select("name price image category isVeg ratings")
      .limit(20);

    // Score by rating
    const scored = candidates
      .map((item) => ({
        ...item.toObject(),
        score: (item.ratings?.average || 3) * (Math.log((item.ratings?.count || 0) + 1) + 1),
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);

    return scored;
  } catch (error) {
    logger.error("Personalized recommendation error:", error);
    return [];
  }
};

/**
 * Category diversification — suggest a category not yet in cart
 */
export const getCategoryDiversificationSuggestions = async (restaurantId, cartCategories = [], limit = 3) => {
  try {
    const pipeline = [
      { $match: { restaurant: restaurantId, available: true, category: { $nin: cartCategories } } },
      { $sort: { "ratings.average": -1 } },
      { $limit: limit * 3 },
    ];

    const candidates = await MenuItem.aggregate(pipeline);
    // Pick one per uncovered category, up to limit
    const seen = new Set();
    const result = [];
    for (const item of candidates) {
      if (!seen.has(item.category)) {
        seen.add(item.category);
        result.push(item);
        if (result.length >= limit) break;
      }
    }
    return result;
  } catch (error) {
    logger.error("Category diversification error:", error);
    return [];
  }
};

/**
 * Main entry point — returns a combined upsell payload
 * Used by GET /api/menu/:slug/recommendations?cartItems=id1,id2&customerId=xyz
 */
export const getUpsellPayload = async (restaurantId, cartItemIds = [], customerId = null, cartCategories = []) => {
  try {
    const [coOccurrence, trending, personalized, diversification] = await Promise.all([
      getCoOccurrenceRecommendations(restaurantId, cartItemIds, 4),
      getTrendingItems(restaurantId, 24, 4),
      customerId
        ? getPersonalizedRecommendations(restaurantId, customerId, cartItemIds, 4)
        : Promise.resolve([]),
      getCategoryDiversificationSuggestions(restaurantId, cartCategories, 3),
    ]);

    // Build "people also ordered" message strings for co-occurrence
    const coWithMessages = coOccurrence.map((item) => ({
      ...item,
      upsellMessage: `🔥 Popular with your order`,
    }));

    const trendingWithMessages = trending
      .filter((t) => !cartItemIds.includes(t._id?.toString()))
      .slice(0, 3)
      .map((item) => ({
        ...item,
        upsellMessage: `📈 Trending right now`,
      }));

    return {
      coOccurrence: coWithMessages,
      trending: trendingWithMessages,
      personalized: personalized.map((i) => ({ ...i, upsellMessage: "⭐ You might like this" })),
      diversification: diversification.map((i) => ({ ...i, upsellMessage: `Try something from ${i.category}` })),
    };
  } catch (error) {
    logger.error("Upsell payload error:", error);
    return { coOccurrence: [], trending: [], personalized: [], diversification: [] };
  }
};

export default {
  getCoOccurrenceRecommendations,
  getTrendingItems,
  getPersonalizedRecommendations,
  getCategoryDiversificationSuggestions,
  getUpsellPayload,
};
