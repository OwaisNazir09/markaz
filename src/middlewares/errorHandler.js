const multer = require("multer");

module.exports = (err, req, res, next) => {
  // Always log the full error stack for easier debugging
  console.error("Unhandled Error:", err && (err.stack || err));

  if (err instanceof multer.MulterError) {
    return res.status(400).json({
      success: false,
      message: err.message,
    });
  }

  if (err) {
    const status = err.statusCode || 500;
    const payload = {
      success: false,
      message: err.message || "Server error",
    };

    // Include stack in non-production for diagnostics
    if (process.env.NODE_ENV !== "production") payload.stack = err.stack;

    return res.status(status).json(payload);
  }

  // If no error (should not normally happen for this middleware), pass control
  return next();
};
