require("dotenv").config();
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit"); // You have this in package.json
const path = require("path");

const connectDB = require("./src/config/db");
const moduleExporter = require("./src/modules/moduleExporter");

const app = express();

/* -------------------- DATABASE -------------------- */
connectDB();

/* -------------------- SECURITY HEADERS -------------------- */
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
    hsts: {
      maxAge: 31536000,
      includeSubDomains: true,
      preload: true,
    },
  }),
);

/* -------------------- RATE LIMITING -------------------- */
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: "Too many requests from this IP, please try again later.",
  standardHeaders: true,
  legacyHeaders: false,
});
app.use("/api/", limiter); // Apply to API routes only

/* -------------------- BODY PARSER -------------------- */
app.use(express.json({ limit: "10mb" })); // Increased limit for file uploads
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

/* -------------------- CORS CONFIG -------------------- */
app.use(
  cors({
    credentials: true,
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      return callback(null, true);
    },
    optionsSuccessStatus: 200,
  }),
);
/* -------------------- LOGGER -------------------- */
const requestLogger = require("./src/middlewares/requestLogger");
app.use(requestLogger);

/* -------------------- HEALTH CHECK (for hosting platforms) -------------------- */
app.get("/health", (req, res) => {
  res.status(200).json({
    status: "healthy",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || "development",
    memory: process.memoryUsage(),
  });
});

app.get("/", (req, res) => {
  res.json({
    message: "Markaz-i-Auqaf API is running",
    version: "1.0.0",
    status: "active",
    endpoints: "/api/*",
  });
});

moduleExporter(app);

app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `Cannot find ${req.originalUrl} on this server`,
  });
});

app.use(require("./src/middlewares/errorHandler"));

process.on("unhandledRejection", (reason, promise) => {
  console.error("❌ Unhandled Rejection at:", promise, "reason:", reason);
  // Don't crash the server, just log
});

process.on("uncaughtException", (err) => {
  console.error("❌ Uncaught Exception:", err);
  // Log and exit gracefully
  console.error("Server shutting down due to uncaught exception");
  process.exit(1);
});

// Graceful shutdown
process.on("SIGTERM", () => {
  console.log("👋 SIGTERM received, shutting down gracefully");
  process.exit(0);
});

process.on("SIGINT", () => {
  console.log("👋 SIGINT received, shutting down gracefully");
  process.exit(0);
});

const { initializeFirebase } = require("./src/services/firebase");
initializeFirebase().catch((err) => {
  console.error("❌ Firebase init failed:", err);
  // Don't crash the server, just log
});

/* -------------------- CRON JOBS -------------------- */
const { startCronJobs } = require("./src/services/cronJobs");
startCronJobs();

/* -------------------- START SERVER -------------------- */
const PORT = process.env.PORT || 5000;

const server = app.listen(PORT, () => {
  console.log(" Server started successfully");
  console.log(` URL: http://localhost:${PORT}`);
  console.log(` Environment: ${process.env.NODE_ENV || "development"}`);
  console.log(` Process ID: ${process.pid}`);
});

module.exports = { app, server };
