import logger from "../utils/logger.js";

/**
 * DineFlow Pro — Socket.io Handler
 *
 * Room structure (per prompt spec):
 *   restaurant-{id}          → all restaurant staff (admin view)
 *   restaurant-admin-{id}    → admin room
 *   restaurant-kitchen-{id}  → kitchen display
 *   customer-room-{orderId}  → individual customer order tracking
 *
 * Events emitted:
 *   new-order           → kitchen when customer places order
 *   status-update       → customer & admin when order status changes
 *   payment-done        → admin & kitchen when payment verified
 *   customer-connected  → admin when a customer scans QR & joins
 *   kitchen-accept      → customer when kitchen accepts order
 *   order-ready         → customer when order marked ready
 *   table-joined        → admin when customer joins a table
 */
export const socketHandler = (io) => {
  // Track connected clients per restaurant for metrics
  const connectedClients = new Map();

  io.on("connection", (socket) => {
    logger.info(`Socket connected: ${socket.id}`);

    // ── Customer joins a restaurant table ──────────────────────────────────
    socket.on("join-restaurant", (restaurantId, userId, tableNumber) => {
      // Join restaurant-level room
      socket.join(`restaurant-${restaurantId}`);
      // Join customer-specific room (for targeted updates)
      if (userId) socket.join(`user-${userId}`);

      // Track
      if (!connectedClients.has(restaurantId)) connectedClients.set(restaurantId, new Set());
      connectedClients.get(restaurantId).add(socket.id);

      logger.info(`Customer joined restaurant ${restaurantId}, table ${tableNumber}`);

      // Notify admin — customer-connected event (per spec)
      io.to(`restaurant-admin-${restaurantId}`).emit("customer-connected", {
        userId,
        tableNumber,
        socketId: socket.id,
        timestamp: new Date(),
      });

      // Confirm join to customer
      socket.emit("restaurant-joined", { restaurantId, tableNumber, timestamp: new Date() });
    });

    // ── Table joined event (spec) ──────────────────────────────────────────
    socket.on("table-join", ({ restaurantId, tableNumber, customerId, customerName }) => {
      socket.join(`restaurant-${restaurantId}`);
      socket.join(`customer-room-table-${restaurantId}-${tableNumber}`);

      io.to(`restaurant-admin-${restaurantId}`).emit("table-joined", {
        tableNumber,
        customerId,
        customerName,
        timestamp: new Date(),
      });

      logger.info(`Table ${tableNumber} joined in restaurant ${restaurantId} by ${customerName}`);
    });

    // ── Join customer order room (for status tracking) ────────────────────
    socket.on("join-order", (orderId) => {
      socket.join(`customer-room-${orderId}`);
      logger.info(`Socket ${socket.id} joined order room: customer-room-${orderId}`);
    });

    // ── Admin joins their restaurant admin room ───────────────────────────
    socket.on("join-admin", (restaurantId) => {
      socket.join(`restaurant-${restaurantId}`);
      socket.join(`restaurant-admin-${restaurantId}`);
      logger.info(`Admin joined: restaurant-admin-${restaurantId}`);
      socket.emit("admin-joined", { restaurantId, timestamp: new Date() });
    });

    // ── Kitchen joins their room ──────────────────────────────────────────
    socket.on("join-kitchen", (restaurantId) => {
      socket.join(`restaurant-kitchen-${restaurantId}`);
      socket.join(`restaurant-${restaurantId}`);
      logger.info(`Kitchen joined: restaurant-kitchen-${restaurantId}`);
      socket.emit("kitchen-joined", { restaurantId, timestamp: new Date() });
    });

    // ── Customer places order → emit new-order to kitchen ────────────────
    socket.on("order-placed", ({ restaurantId, orderData }) => {
      // new-order event to kitchen (per spec)
      io.to(`restaurant-kitchen-${restaurantId}`).emit("new-order", {
        ...orderData,
        timestamp: new Date(),
      });
      // Also notify admin panel
      io.to(`restaurant-admin-${restaurantId}`).emit("new-order", {
        ...orderData,
        timestamp: new Date(),
      });
      logger.info(`New order event → kitchen & admin for restaurant ${restaurantId}`);
    });

    // ── Kitchen accepts order → emit kitchen-accept to customer ──────────
    socket.on("kitchen-accept", ({ orderId, restaurantId, estimatedTime }) => {
      // kitchen-accept event to customer (per spec)
      io.to(`customer-room-${orderId}`).emit("kitchen-accept", {
        orderId,
        estimatedTime,
        message: "Your order has been accepted! 🎉",
        timestamp: new Date(),
      });
      // status-update to customer (per spec)
      io.to(`customer-room-${orderId}`).emit("status-update", {
        orderId,
        status: "accepted",
        timestamp: new Date(),
      });
      logger.info(`kitchen-accept emitted for order ${orderId}`);
    });

    // ── Order status changed (admin/kitchen updates) ───────────────────────
    socket.on("order-status-change", ({ restaurantId, orderId, status, customerId }) => {
      // status-update to customer order room (per spec)
      io.to(`customer-room-${orderId}`).emit("status-update", {
        orderId,
        status,
        timestamp: new Date(),
      });

      // Also emit to customer by userId if available
      if (customerId) {
        io.to(`user-${customerId}`).emit("status-update", { orderId, status, timestamp: new Date() });
      }

      // Notify all restaurant staff
      io.to(`restaurant-${restaurantId}`).emit("order-status-updated", {
        orderId,
        status,
        timestamp: new Date(),
      });

      // Specific events for key statuses (per spec)
      if (status === "ready") {
        io.to(`customer-room-${orderId}`).emit("order-ready", {
          orderId,
          message: "Your order is ready! 🍽️",
          timestamp: new Date(),
        });
        logger.info(`order-ready emitted for order ${orderId}`);
      }

      if (status === "accepted") {
        io.to(`customer-room-${orderId}`).emit("kitchen-accept", {
          orderId,
          message: "Kitchen accepted your order! 👨‍🍳",
          timestamp: new Date(),
        });
      }

      logger.info(`status-update: order ${orderId} → ${status}`);
    });

    // ── Payment verified → emit payment-done ─────────────────────────────
    socket.on("payment-verified", ({ restaurantId, orderId, customerId, amount }) => {
      // payment-done event (per spec)
      io.to(`restaurant-admin-${restaurantId}`).emit("payment-done", {
        orderId,
        customerId,
        amount,
        timestamp: new Date(),
      });
      io.to(`restaurant-kitchen-${restaurantId}`).emit("payment-done", {
        orderId,
        amount,
        timestamp: new Date(),
      });
      io.to(`customer-room-${orderId}`).emit("payment-done", {
        orderId,
        message: "Payment received! ✅",
        timestamp: new Date(),
      });
      logger.info(`payment-done emitted for order ${orderId}, amount ₹${amount}`);
    });

    // ── Table status updates ──────────────────────────────────────────────
    socket.on("table-status", ({ restaurantId, tableNumber, status }) => {
      io.to(`restaurant-admin-${restaurantId}`).emit("table-updated", {
        tableNumber,
        status,
        timestamp: new Date(),
      });
    });

    socket.on("table-occupied", ({ restaurantId, tableNumber, customerId }) => {
      io.to(`restaurant-${restaurantId}`).emit("table-status", {
        tableNumber,
        status: "occupied",
        customerId,
        timestamp: new Date(),
      });
    });

    socket.on("table-vacant", ({ restaurantId, tableNumber }) => {
      io.to(`restaurant-${restaurantId}`).emit("table-status", {
        tableNumber,
        status: "vacant",
        timestamp: new Date(),
      });
    });

    // ── Waiter/bill requests ──────────────────────────────────────────────
    socket.on("call-waiter", ({ restaurantId, tableNumber }) => {
      io.to(`restaurant-admin-${restaurantId}`).emit("waiter-call", {
        tableNumber,
        timestamp: new Date(),
      });
    });

    socket.on("request-bill", ({ restaurantId, tableNumber, orderId }) => {
      io.to(`restaurant-admin-${restaurantId}`).emit("bill-request", {
        tableNumber,
        orderId,
        timestamp: new Date(),
      });
    });

    // ── Get connected client count ────────────────────────────────────────
    socket.on("get-restaurant-stats", (restaurantId, callback) => {
      const count = connectedClients.get(restaurantId)?.size || 0;
      if (typeof callback === "function") callback({ connectedClients: count });
    });

    // ── Disconnect ────────────────────────────────────────────────────────
    socket.on("disconnect", (reason) => {
      // Remove from connectedClients tracking
      for (const [rId, clients] of connectedClients.entries()) {
        clients.delete(socket.id);
        if (clients.size === 0) connectedClients.delete(rId);
      }
      logger.info(`Socket disconnected: ${socket.id} (${reason})`);
    });

    socket.on("error", (error) => {
      logger.error(`Socket error on ${socket.id}:`, error);
    });
  });
};
