import http from "http";
import dotenv from "dotenv";
import app, { initializeSocket } from "./app.js";
import logger from "./utils/logger.js";
import mongoose from "mongoose";

// Load environment variables
dotenv.config();

const PORT = process.env.PORT || 3000;
const MONGODB_URI = process.env.MONGODB_URI;

// Connect to MongoDB
const connectDB = async () => {
  try {
    await mongoose.connect(MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    logger.info("MongoDB connected successfully");
  } catch (error) {
    logger.error("MongoDB connection failed:", error.message);
    process.exit(1);
  }
};

// Create HTTP server
const server = http.createServer(app);

// Initialize Socket.io
initializeSocket(server);

// Start server
const startServer = async () => {
  try {
    // Connect to database
    await connectDB();

    // Start listening
    server.listen(PORT, () => {
      logger.info(`DineFlow Pro Server running on port ${PORT}`);
      logger.info(`Environment: ${process.env.NODE_ENV || "development"}`);
      logger.info(`API URL: http://localhost:${PORT}/api`);
    });
  } catch (error) {
    logger.error("Server startup error:", error);
    process.exit(1);
  }
};

// Handle unhandled promise rejections
process.on("unhandledRejection", (error) => {
  logger.error("Unhandled Rejection:", error);
  process.exit(1);
});

// Handle SIGTERM
process.on("SIGTERM", () => {
  logger.info("SIGTERM received. Closing server...");
  server.close(() => {
    logger.info("Server closed");
    process.exit(0);
  });
});

// Start the server
startServer();
