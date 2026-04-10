require("dotenv").config();
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");

const connectDB = require("./src/config/db");
const moduleExporter = require("./src/modules/moduleExporter");

const app = express();

/* -------------------- DATABASE -------------------- */
connectDB();

/* -------------------- BODY PARSER -------------------- */
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

/* -------------------- CORS CONFIG -------------------- */
const allowedOrigins = [
  "https://markazi-auqaf.netlify.app",
  "https://markaziauqaf.rationaltabs.com",
  "http://localhost:5173",
  "byhttps://markazijamiahandwara.com",
  "https://crm.markazijamiahandwara.com",
];

const corsOptions = {
  origin: function (origin, callback) {
    if (
      !origin ||
      origin.startsWith("http://localhost") ||
      origin.startsWith("http://127.0.0.1") ||
      origin.startsWith("http://192.168.") ||
      allowedOrigins.includes(origin)
    ) {
      return callback(null, true);
    }
    console.log("Blocked origin:", origin);
    return callback(new Error("Not allowed by CORS"));
  },
  credentials: true,
};

app.use(cors(corsOptions));
/* -------------------- SECURITY -------------------- */
app.use(helmet());

/* -------------------- LOGGER -------------------- */
const requestLogger = require("./src/middlewares/requestLogger");
app.use(requestLogger);

/* -------------------- ROUTES -------------------- */
moduleExporter(app);

/* -------------------- ERROR HANDLER -------------------- */
app.use(require("./src/middlewares/errorHandler"));

/* -------------------- GLOBAL ERROR LOGGING -------------------- */
process.on("unhandledRejection", (reason, promise) => {
  console.error("Unhandled Rejection:", reason);
});

process.on("uncaughtException", (err) => {
  console.error("Uncaught Exception:", err);
});

/* -------------------- FIREBASE INIT -------------------- */
const { initializeFirebase } = require("./src/services/firebase");
initializeFirebase().catch((err) => {
  console.error("Firebase init failed:", err);
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
