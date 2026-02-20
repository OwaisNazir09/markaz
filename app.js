require("dotenv").config();
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");

const connectDB = require("./src/config/db");
const moduleExporter = require("./src/modules/moduleExporter");

const app = express();

/* -------------------- DATABASE -------------------- */
connectDB();

/* -------------------- BODY PARSER -------------------- */
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

//Cors
const allowedOrigins = [
  "https://markazi-auqaf.netlify.app",
  "https://grand-raindrop-f94ac1.netlify.app",
];
app.use(
  cors({
    credentials: true,
    origin: (origin, callback) => {
      // allow requests with no origin (e.g. mobile apps, curl, Postman)
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error(`CORS: origin ${origin} not allowed`));
      }
    },
    optionsSuccessStatus: 200,
  }),
);
/* -------------------- SECURITY -------------------- */
app.use(helmet());

const requestLogger = require("./src/middlewares/requestLogger");
app.use(requestLogger);

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
