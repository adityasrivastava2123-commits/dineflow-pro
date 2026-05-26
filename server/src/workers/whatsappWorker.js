import { Worker } from "bullmq";
import { redisConnection } from "../config/redis.js";
import { whatsappQueue } from "../queues/whatsappQueue.js";
import Order from "../models/Order.js";
import logger from "../utils/logger.js";
import https from "https";

const sendWhatsAppMessage = async (phone, apiKey, message) => {
  const encoded = encodeURIComponent(message);

  const url =
    `https://api.callmebot.com/whatsapp.php?phone=${phone}` +
    `&text=${encoded}&apikey=${apiKey}`;

  return new Promise((resolve, reject) => {
    https
      .get(url, (res) => {
        let data = "";

        res.on("data", (chunk) => {
          data += chunk;
        });

        res.on("end", () => {
          if (res.statusCode === 200) {
            resolve(data);
          } else {
            reject(
              new Error(
                `WhatsApp API error: ${res.statusCode} - ${data}`
              )
            );
          }
        });
      })
      .on("error", reject);
  });
};

const buildOrderConfirmationMessage = (order, restaurant) => {
  const items = order.items
    .map(
      (item) =>
        `• ${item.name} ×${item.quantity} — ₹${(
          item.price * item.quantity
        ).toFixed(0)}`
    )
    .join("\n");

  return `
🍽️ Order Confirmed — ${restaurant.name}

📋 Order: #${order.orderNumber}
🪑 Table: ${order.tableNumber}

Items:
${items}

💰 Subtotal: ₹${order.subtotal?.toFixed(0)}
🧾 Tax: ₹${order.tax?.toFixed(0)}
✅ Total: ₹${order.totalAmount?.toFixed(0)}

Track Order:
${process.env.CLIENT_URL}/order/${order._id}
`;
};

const buildOrderReadyMessage = (order, restaurant) => {
  return `
✅ Your order is ready

🍽️ ${restaurant.name}
📋 Order: #${order.orderNumber}
🪑 Table: ${order.tableNumber}

Your food is ready.
Enjoy your meal 😊
`;
};

const buildOrderStatusMessage = (
  order,
  restaurant,
  status
) => {
  const statusEmoji = {
    accepted: "👨‍🍳",
    preparing: "🔥",
    ready: "✅",
    delivered: "🎉"
  };

  const statusText = {
    accepted: "accepted your order",
    preparing: "is preparing your food",
    ready: "Your order is READY",
    delivered: "Your order has been delivered"
  };

  return `
${statusEmoji[status] || "📋"} ${restaurant.name}

Order #${order.orderNumber}

${statusText[status] || status}

Track:
${process.env.CLIENT_URL}/order/${order._id}
`;
};

const buildInvoiceMessage = (
  order,
  restaurant
) => {
  const invoiceUrl =
    `${process.env.CLIENT_URL}/order/${order._id}`;

  return `
🧾 Invoice - ${restaurant.name}

Order: #${order.orderNumber}

Date:
${new Date(
  order.createdAt
).toLocaleDateString("en-IN")}

Amount Paid:
₹${order.totalAmount?.toFixed(0)}

Payment:
${order.paymentStatus?.toUpperCase()}

Invoice:
${invoiceUrl}

Thank you for dining with us ⭐
`;
};

const processWhatsAppJob = async (job) => {
  const {
    type,
    orderId,
    phone: jobPhone,
    status
  } = job.data;

  logger.info(
    `Processing WhatsApp job ${type} for ${orderId}`
  );

  const order = await Order.findById(orderId)
    .populate(
      "customer",
      "name phone"
    )
    .populate(
      "restaurant",
      "name whatsappNumber callMeBotApiKey"
    );

  if (!order) {
    throw new Error(
      `Order ${orderId} not found`
    );
  }

  const restaurant = order.restaurant;

  if (!restaurant?.callMeBotApiKey) {
    logger.warn(
      "WhatsApp not configured"
    );

    return {
      skipped: true
    };
  }

  const customerPhone =
    jobPhone ||
    order.customer?.phone ||
    order.customerPhone;

  if (!customerPhone) {
    logger.warn(
      "No customer phone found"
    );

    return {
      skipped: true
    };
  }

  let message;

  switch (type) {
    case "invoice":
    case "invoice-share":
      message =
        buildInvoiceMessage(
          order,
          restaurant
        );
      break;

    case "order-confirmed":
      message =
        buildOrderConfirmationMessage(
          order,
          restaurant
        );
      break;

    case "order-ready":
      message =
        buildOrderReadyMessage(
          order,
          restaurant
        );
      break;

    case "status":
    case "status-update":
      message =
        buildOrderStatusMessage(
          order,
          restaurant,
          status || order.status
        );
      break;

    default:
      throw new Error(
        `Unknown type ${type}`
      );
  }

  await sendWhatsAppMessage(
    customerPhone,
    restaurant.callMeBotApiKey,
    message
  );

  logger.info(
    `WhatsApp sent to ${customerPhone}`
  );

  return {
    sent: true
  };
};

export const whatsappWorker =
  new Worker(
    "whatsapp-notifications",
    processWhatsAppJob,
    {
      connection:
        redisConnection,

      concurrency: 2,

      limiter: {
        max: 5,
        duration: 1000
      }
    }
  );

whatsappWorker.on(
  "completed",
  (job) => {
    logger.info(
      `Job ${job.id} completed`
    );
  }
);

whatsappWorker.on(
  "failed",
  (job, error) => {
    logger.error(
      `Job ${job?.id} failed ${error.message}`
    );
  }
);

whatsappWorker.on(
  "error",
  (error) => {
    logger.error(error);
  }
);

export { whatsappQueue };

export const queueOrderConfirmation =
  (orderId, phone) =>
    whatsappQueue.add(
      "order-confirmed",
      {
        type: "order-confirmed",
        orderId,
        phone
      }
    );

export const queueOrderReady =
  (orderId) =>
    whatsappQueue.add(
      "order-ready",
      {
        type: "order-ready",
        orderId
      }
    );

export default whatsappWorker;
