import { Queue } from "bullmq";
import { redisConnection } from "../config/redis.js";
import logger from "../utils/logger.js";

/**
 * WhatsApp notification queue — separate from worker
 * Enqueues WhatsApp jobs that whatsappWorker.js processes
 */
export const whatsappQueue = new Queue("whatsapp-notifications", {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: "exponential", delay: 3000 },
    removeOnComplete: { count: 500 },
    removeOnFail: { count: 100 },
  },
});

/**
 * Add invoice-share job to the WhatsApp queue
 * @param {string} phone - Customer phone (with country code, e.g. 919876543210)
 * @param {string} orderId - Order ID
 * @param {string} restaurantName - Restaurant name for context
 * @param {number} delay - Delay in ms before processing (default 0)
 */
export const queueInvoiceWhatsApp = async (phone, orderId, restaurantName = "", delay = 0) => {
  try {
    const job = await whatsappQueue.add(
      "invoice-share",
      { phone, orderId, restaurantName, type: "invoice" },
      { delay }
    );
    logger.info(`WhatsApp invoice job queued: ${job.id} for order ${orderId}`);
    return job;
  } catch (error) {
    logger.error("Failed to queue WhatsApp invoice job:", error);
    throw error;
  }
};

/**
 * Add order-status-update job to the WhatsApp queue
 */
export const queueOrderStatusWhatsApp = async (phone, orderId, status, restaurantName = "") => {
  try {
    const job = await whatsappQueue.add(
      "status-update",
      { phone, orderId, status, restaurantName, type: "status" },
      { delay: 1000 }
    );
    logger.info(`WhatsApp status job queued: ${job.id} for order ${orderId} → ${status}`);
    return job;
  } catch (error) {
    logger.error("Failed to queue WhatsApp status job:", error);
    throw error;
  }
};

/**
 * Get queue stats
 */
export const getWhatsappQueueStats = async () => {
  const [waiting, active, completed, failed] = await Promise.all([
    whatsappQueue.getWaitingCount(),
    whatsappQueue.getActiveCount(),
    whatsappQueue.getCompletedCount(),
    whatsappQueue.getFailedCount(),
  ]);
  return { waiting, active, completed, failed };
};

export default whatsappQueue;
