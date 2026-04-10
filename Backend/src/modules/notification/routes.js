const express = require("express");
const router = express.Router();
const Controller = require("./controller");
const auth = require("../../middlewares/auth");
const allowRoles = require("../../middlewares/role");
const validate = require("./validate");

// Admin routes - Create and send notifications
router.post(
    "/send",
    auth,
    allowRoles("admin"),
    validate.validateCreateNotification,
    Controller.createAndSendNotification
);

// Admin routes - Get all notifications
router.get(
    "/all",
    auth,
    allowRoles("admin"),
    Controller.getAllNotifications
);

// User routes - Get my notifications
router.get("/my", auth, Controller.getMyNotifications);

// User routes - Get unread count
router.get("/unread-count", auth, Controller.getUnreadCount);

// User routes - Get notification by ID
router.get("/:id", auth, Controller.getNotificationById);

// User routes - Mark notification as read
router.put("/:id/read", auth, Controller.markNotificationAsRead);

// Admin routes - Delete notification
router.delete(
    "/:id",
    auth,
    allowRoles("admin"),
    Controller.deleteNotification
);

module.exports = router;
