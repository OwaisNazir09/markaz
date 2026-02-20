require("dotenv").config();
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");

const connectDB = require("./src/config/db");
const moduleExporter = require("./src/modules/moduleExporter");

const app = express();
const requestLogger = require("./src/middlewares/requestLogger");
app.use(requestLogger);

/* -------------------- DATABASE -------------------- */
connectDB();

/* -------------------- BODY PARSER -------------------- */
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

/* -------------------- CORS CONFIG -------------------- */
const allowedOrigins = [
  "https://markazi-auqaf.netlify.app",
  "https://markaziauqaf.rationaltabs.com",
  "https://grand-raindrop-f94ac1.netlify.app",
];

const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests without origin (Postman, curl, mobile apps)
    if (
      !origin ||
      origin.startsWith("http://localhost") ||
      origin.startsWith("http://127.0.0.1") ||
      origin.startsWith("http://192.168.") ||
      origin.startsWith("http://[::1]") ||
      allowedOrigins.includes(origin)
    ) {
      callback(null, true);
    } else {
      callback(new Error("Not allowed by CORS"));
    }
  },
  credentials: true,
  methods: ["GET", "HEAD", "PUT", "PATCH", "POST", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
};

app.use(cors(corsOptions));

/* 🔴 IMPORTANT: Handle preflight requests */
app.options("/*", cors(corsOptions));

/* -------------------- SECURITY -------------------- */
app.use(helmet());

/* -------------------- ROUTES -------------------- */
moduleExporter(app);

/* -------------------- ERROR HANDLER -------------------- */
app.use(require("./src/middlewares/errorHandler"));

/* -------------------- GLOBAL ERROR LOGGING -------------------- */
process.on("unhandledRejection", (reason, promise) => {
  console.error("Unhandled Rejection at:", promise, "reason:", reason);
});

process.on("uncaughtException", (err) => {
  console.error("Uncaught Exception:", err && (err.stack || err));
});

/* -------------------- FIREBASE INIT -------------------- */
const { initializeFirebase } = require("./src/services/firebase");
initializeFirebase().catch((err) => {
  console.error("Failed to initialize Firebase:", err);
});

/* -------------------- CRON JOBS -------------------- */
const { startCronJobs } = require("./src/services/cronJobs");
startCronJobs();

/* -------------------- START SERVER -------------------- */
const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log("Server started successfully");
  console.log(`URL: http://localhost:${PORT}`);
});
