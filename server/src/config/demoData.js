import MenuItem from "../models/MenuItem.js\";
import Restaurant from \"../models/Restaurant.js\";
import logger from \"../utils/logger.js\";

export const seedDemoMenuItems = async (restaurantId) => {
  try {
    // Check if items already exist
    const existingItems = await MenuItem.countDocuments({ restaurant: restaurantId });
    if (existingItems > 0) {
      logger.info(`Demo items already exist for restaurant ${restaurantId}`);
      return;
    }

    const demoItems = [
      // Appetizers
      {
        name: \"Paneer Tikka\",
        description: \"Marinated paneer cubes grilled to perfection with onions and peppers\",
        price: 249,
        category: \"Appetizers\",
        vegetarian: true,
        spicyLevel: 2,
        preparationTime: 15,
        tags: [\"popular\", \"vegetarian\"],
        addons: [
          { name: \"Extra Paneer\", price: 50 },
          { name: \"Mint Chutney\", price: 20 },
        ],
        available: true,
        rating: 4.5,
        totalOrders: 156,
        isPopular: true,
      },
      {
        name: \"Chicken 65\",
        description: \"Crispy fried chicken pieces with Indian spices\",
        price: 299,
        category: \"Appetizers\",
        vegetarian: false,
        spicyLevel: 4,
        preparationTime: 20,
        tags: [\"popular\", \"spicy\"],
        addons: [
          { name: \"Extra Chicken\", price: 80 },
          { name: \"Lemon Juice\", price: 10 },
        ],
        available: true,
        rating: 4.3,
        totalOrders: 189,
        isPopular: true,
      },
      {
        name: \"Samosa (3 pieces)\",
        description: \"Crispy pastry filled with spiced potato and peas\",
        price: 99,
        category: \"Appetizers\",
        vegetarian: true,
        spicyLevel: 2,
        preparationTime: 10,
        tags: [\"vegetarian\", \"budget-friendly\"],
        addons: [
          { name: \"Extra Samosa\", price: 30 },
          { name: \"Tamarind Chutney\", price: 15 },
        ],
        available: true,
        rating: 4.1,
        totalOrders: 234,
        isPopular: false,
      },
      {
        name: \"Veg Spring Rolls (4 pieces)\",
        description: \"Crispy rolls filled with vegetables, served with sweet and spicy sauce\",
        price: 149,
        category: \"Appetizers\",
        vegetarian: true,
        spicyLevel: 1,
        preparationTime: 12,
        tags: [\"vegetarian\"],
        addons: [
          { name: \"Sweet Chilli Sauce\", price: 20 },
          { name: \"Soy Sauce\", price: 10 },
        ],
        available: true,
        rating: 4.0,
        totalOrders: 98,
        isPopular: false,
      },

      // Main Course - Vegetarian
      {
        name: \"Butter Chicken\",
        description: \"Tender chicken in creamy tomato-based butter sauce\",
        price: 399,
        category: \"Main Course\",
        vegetarian: false,
        spicyLevel: 2,
        preparationTime: 25,
        tags: [\"popular\", \"creamy\"],
        addons: [
          { name: \"Extra Rice\", price: 50 },
          { name: \"Naan\", price: 40 },
          { name: \"Extra Chicken\", price: 100 },
        ],
        available: true,
        rating: 4.6,
        totalOrders: 512,
        isPopular: true,
      },
      {
        name: \"Paneer Butter Masala\",
        description: \"Soft paneer cubes in rich tomato cream sauce\",
        price: 329,
        category: \"Main Course\",
        vegetarian: true,
        spicyLevel: 2,
        preparationTime: 20,
        tags: [\"popular\", \"vegetarian\"],
        addons: [
          { name: \"Extra Rice\", price: 50 },
          { name: \"Naan\", price: 40 },
          { name: \"Extra Paneer\", price: 80 },
        ],
        available: true,
        rating: 4.5,
        totalOrders: 345,
        isPopular: true,
      },
      {
        name: \"Chole Bhature\",
        description: \"Fluffy fried bread served with spiced chickpea curry\",
        price: 199,
        category: \"Main Course\",
        vegetarian: true,
        spicyLevel: 2,
        preparationTime: 15,
        tags: [\"vegetarian\", \"street-food\"],
        addons: [
          { name: \"Extra Bhature\", price: 60 },
          { name: \"Pickle\", price: 20 },
        ],
        available: true,
        rating: 4.2,
        totalOrders: 267,
        isPopular: false,
      },
      {
        name: \"Dal Makhani\",
        description: \"Creamy lentil curry simmered with butter and cream\",
        price: 249,
        category: \"Main Course\",
        vegetarian: true,
        spicyLevel: 1,
        preparationTime: 30,
        tags: [\"vegetarian\", \"creamy\"],
        addons: [
          { name: \"Extra Rice\", price: 50 },
          { name: \"Naan\", price: 40 },
        ],
        available: true,
        rating: 4.3,
        totalOrders: 189,
        isPopular: false,
      },
      {
        name: \"Tandoori Chicken (Half)\",
        description: \"Chicken marinated in yogurt and spices, roasted in tandoor\",
        price: 449,
        category: \"Main Course\",
        vegetarian: false,
        spicyLevel: 3,
        preparationTime: 35,
        tags: [\"popular\", \"tandoori\"],
        addons: [
          { name: \"Extra Rice\", price: 50 },
          { name: \"Naan\", price: 40 },
          { name: \"Lemon\", price: 10 },
        ],
        available: true,
        rating: 4.7,
        totalOrders: 423,
        isPopular: true,
      },
      {
        name: \"Biryani - Chicken\",
        description: \"Fragrant basmati rice cooked with tender chicken and spices\",
        price: 349,
        category: \"Main Course\",
        vegetarian: false,
        spicyLevel: 2,
        preparationTime: 25,
        tags: [\"popular\"],
        addons: [
          { name: \"Extra Chicken\", price: 100 },
          { name: \"Raita\", price: 30 },
        ],
        available: true,
        rating: 4.4,
        totalOrders: 378,
        isPopular: true,
      },

      // Breads
      {
        name: \"Garlic Naan\",
        description: \"Soft bread brushed with butter and garlic\",
        price: 79,
        category: \"Breads\",
        vegetarian: true,
        spicyLevel: 0,
        preparationTime: 8,
        tags: [\"vegetarian\"],
        addons: [
          { name: \"Extra Butter\", price: 20 },
        ],
        available: true,
        rating: 4.2,
        totalOrders: 567,
        isPopular: false,
      },
      {
        name: \"Tandoori Roti\",
        description: \"Whole wheat bread cooked in tandoor\",
        price: 39,
        category: \"Breads\",
        vegetarian: true,
        spicyLevel: 0,
        preparationTime: 5,
        tags: [\"vegetarian\", \"healthy\"],
        addons: [],
        available: true,
        rating: 4.0,
        totalOrders: 456,
        isPopular: false,
      },
      {
        name: \"Paratha\",
        description: \"Layered flatbread with butter\",
        price: 59,
        category: \"Breads\",
        vegetarian: true,
        spicyLevel: 0,
        preparationTime: 10,
        tags: [\"vegetarian\"],
        addons: [
          { name: \"Aloo (Potato)\", price: 30 },
          { name: \"Paneer\", price: 50 },
        ],
        available: true,
        rating: 4.1,
        totalOrders: 389,
        isPopular: false,
      },

      // Rice Dishes
      {
        name: \"Biryani - Vegetable\",
        description: \"Fragrant basmati rice with mixed vegetables\",
        price: 249,
        category: \"Rice Dishes\",
        vegetarian: true,
        spicyLevel: 1,
        preparationTime: 20,
        tags: [\"vegetarian\"],
        addons: [
          { name: \"Raita\", price: 30 },
        ],
        available: true,
        rating: 4.0,
        totalOrders: 123,
        isPopular: false,
      },
      {
        name: \"Fried Rice - Vegetable\",
        description: \"Rice stir-fried with vegetables and soy sauce\",
        price: 199,
        category: \"Rice Dishes\",
        vegetarian: true,
        spicyLevel: 1,
        preparationTime: 15,
        tags: [\"vegetarian\"],
        addons: [
          { name: \"Egg\", price: 40 },
          { name: \"Extra Vegetables\", price: 30 },
        ],
        available: true,
        rating: 3.9,
        totalOrders: 98,
        isPopular: false,
      },
      {
        name: \"Fried Rice - Chicken\",
        description: \"Rice stir-fried with chicken and vegetables\",
        price: 249,
        category: \"Rice Dishes\",
        vegetarian: false,
        spicyLevel: 2,
        preparationTime: 15,
        tags: [],
        addons: [
          { name: \"Extra Chicken\", price: 80 },
          { name: \"Egg\", price: 40 },
        ],
        available: true,
        rating: 4.1,
        totalOrders: 156,
        isPopular: false,
      },

      // Beverages
      {
        name: \"Mango Lassi\",
        description: \"Sweet yogurt drink with fresh mango pulp\",
        price: 99,
        category: \"Beverages\",
        vegetarian: true,
        spicyLevel: 0,
        preparationTime: 5,
        tags: [\"vegetarian\", \"cold\"],
        addons: [
          { name: \"Extra Mango\", price: 30 },
        ],
        available: true,
        rating: 4.3,
        totalOrders: 234,
        isPopular: false,
      },
      {
        name: \"Masala Chai\",
        description: \"Hot tea brewed with traditional Indian spices\",
        price: 49,
        category: \"Beverages\",
        vegetarian: true,
        spicyLevel: 0,
        preparationTime: 5,
        tags: [\"vegetarian\", \"hot\"],
        addons: [],
        available: true,
        rating: 4.0,
        totalOrders: 567,
        isPopular: false,
      },
      {
        name: \"Fresh Lime Soda\",
        description: \"Refreshing lime juice with soda and ice\",
        price: 79,
        category: \"Beverages\",
        vegetarian: true,
        spicyLevel: 0,
        preparationTime: 3,
        tags: [\"vegetarian\", \"cold\"],
        addons: [
          { name: \"Extra Lemon\", price: 10 },
          { name: \"Salt\", price: 0 },
        ],
        available: true,
        rating: 4.1,
        totalOrders: 345,
        isPopular: false,
      },

      // Desserts
      {
        name: \"Gulab Jamun (4 pieces)\",
        description: \"Soft milk solids fried and soaked in sugar syrup\",
        price: 129,
        category: \"Desserts\",
        vegetarian: true,
        spicyLevel: 0,
        preparationTime: 10,
        tags: [\"vegetarian\", \"sweet\"],
        addons: [],
        available: true,
        rating: 4.2,
        totalOrders: 189,
        isPopular: false,
      },
      {
        name: \"Kheer (Payasam)\",
        description: \"Rice pudding with condensed milk and nuts\",
        price: 149,
        category: \"Desserts\",
        vegetarian: true,
        spicyLevel: 0,
        preparationTime: 5,
        tags: [\"vegetarian\", \"sweet\"],
        addons: [],
        available: true,
        rating: 4.3,
        totalOrders: 134,
        isPopular: false,
      },
      {
        name: \"Ice Cream - Vanilla\",
        description: \"Creamy vanilla ice cream\",
        price: 99,
        category: \"Desserts\",
        vegetarian: true,
        spicyLevel: 0,
        preparationTime: 2,
        tags: [\"vegetarian\", \"cold\"],
        addons: [
          { name: \"Chocolate Sauce\", price: 30 },
          { name: \"Sprinkles\", price: 20 },
        ],
        available: true,
        rating: 4.0,
        totalOrders: 267,
        isPopular: false,
      },
      {
        name: \"Rasgulla (4 pieces)\",
        description: \"Soft cheese balls in light sugar syrup\",
        price: 119,
        category: \"Desserts\",
        vegetarian: true,
        spicyLevel: 0,
        preparationTime: 5,
        tags: [\"vegetarian\", \"sweet\"],
        addons: [],
        available: true,
        rating: 4.2,
        totalOrders: 98,
        isPopular: false,
      },
    ];

    // Add restaurant reference to all items
    const itemsWithRestaurant = demoItems.map((item) => ({
      ...item,
      restaurant: restaurantId,
    }));

    // Insert all items
    const createdItems = await MenuItem.insertMany(itemsWithRestaurant);
    logger.info(`Successfully seeded ${createdItems.length} demo menu items`);

    return createdItems;
  } catch (error) {
    logger.error(\"Error seeding demo items:\", error);
    throw error;
  }
};

export const seedDemoRestaurant = async (userId) => {
  try {
    const existingRestaurant = await Restaurant.findOne({ owner: userId });
    if (existingRestaurant) {
      logger.info(`Demo restaurant already exists for user ${userId}`);
      return existingRestaurant;
    }

    const demoRestaurant = new Restaurant({
      name: \"The Spice Haven\",
      slug: \"the-spice-haven\",
      owner: userId,
      description: \"Authentic Indian cuisine with traditional recipes passed down through generations\",
      address: {
        street: \"123 Food Street\",
        city: \"Bangalore\",
        state: \"Karnataka\",
        zipcode: \"560001\",
        country: \"India\",
      },
      phone: \"+91-9876543210\",
      email: \"contact@spicehaven.com\",
      tables: 25,
      openingHours: {
        monday: { open: \"11:00 AM\", close: \"11:00 PM\" },
        tuesday: { open: \"11:00 AM\", close: \"11:00 PM\" },
        wednesday: { open: \"11:00 AM\", close: \"11:00 PM\" },
        thursday: { open: \"11:00 AM\", close: \"11:00 PM\" },
        friday: { open: \"11:00 AM\", close: \"12:00 AM\" },
        saturday: { open: \"10:00 AM\", close: \"12:00 AM\" },
        sunday: { open: \"10:00 AM\", close: \"11:00 PM\" },
      },
      cuisineType: [\"North Indian\", \"South Indian\", \"Chinese\"],
      subscriptionPlan: \"pro\",
      subscriptionStatus: \"active\",
      features: {
        analytics: true,
        advancedOffers: true,
        kitchenDisplay: true,
        multiLanguage: true,
        whatsappIntegration: true,
      },
      settings: {
        currency: \"INR\",
        taxPercent: 5,
        deliveryCharges: 0,
        minimumOrderValue: 200,
      },
      averageRating: 4.5,
      totalOrders: 2145,
      monthlyRevenue: 450000,
    });

    const savedRestaurant = await demoRestaurant.save();
    logger.info(`Successfully created demo restaurant: ${savedRestaurant._id}`);

    return savedRestaurant;
  } catch (error) {
    logger.error(\"Error seeding demo restaurant:\", error);
    throw error;
  }
};
