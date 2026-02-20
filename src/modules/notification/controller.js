const Service = require("./service");
const User = require("../User/models");
const { sendPushNotificationInBatches } = require("../../services/firebase");

const createAndSendNotification = async (req, res) => {
    try {
        const { title, message, type, data, selectedUsers, sendToAll } = req.body;

        let userIds = [];
        let fcmTokens = [];

        if (sendToAll) {
            // Send to all active users
            const users = await User.find({ status: true }).select("_id fcmTokens");
            userIds = users.map(u => u._id);

            users.forEach(user => {
                if (user.fcmTokens && user.fcmTokens.length > 0) {
                    user.fcmTokens.forEach(tokenObj => {
                        if (tokenObj.token) {
                            fcmTokens.push(tokenObj.token);
                        }
                    });
                }
            });
        } else if (selectedUsers && selectedUsers.length > 0) {
            // Send to specific users
            const users = await User.find({
                _id: { $in: selectedUsers },
                status: true,
            }).select("_id fcmTokens");

            userIds = users.map(u => u._id);

            users.forEach(user => {
                if (user.fcmTokens && user.fcmTokens.length > 0) {
                    user.fcmTokens.forEach(tokenObj => {
                        if (tokenObj.token) {
                            fcmTokens.push(tokenObj.token);
                        }
                    });
                }
            });
        } else {
            return res.status(400).json({
                success: false,
                message: "Please select recipients or choose to send to all users",
            });
        }

        // Create notification in database
        const notification = await Service.createNotification(
            {
                title,
                message,
                type: type || "system",
                data: data || {},
                sender: req.user.id,
                sentAt: new Date(),
            },
            userIds
        );

        // Send push notifications in batches
        let pushResult = { totalSuccess: 0, totalFailure: 0 };
        if (fcmTokens.length > 0) {
            pushResult = await sendPushNotificationInBatches(
                title,
                message,
                fcmTokens,
                {
                    type: type || "system",
                    notificationId: notification._id.toString(),
                    ...data,
                }
            );

            // Update notification with sent status
            await Service.updateRecipientStatus(notification._id, null, "sent");
        }

        return res.status(201).json({
            success: true,
            message: "Notification created and sent successfully",
            data: {
                notification,
                pushStats: {
                    sent: pushResult.totalSuccess,
                    failed: pushResult.totalFailure,
                },
            },
        });
    } catch (err) {
        console.error("Error in createAndSendNotification:", err);
        return res.status(err.statusCode || 500).json({
            success: false,
            message: err.message || "Internal Server Error",
        });
    }
};

const getAllNotifications = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const { type, search } = req.query;

        const { data, total } = await Service.getAllNotifications({ type }, page, limit, search);

        return res.status(200).json({
            success: true,
            data,
            pagination: {
                total,
                page,
                limit,
            },
        });
    } catch (err) {
        console.error("Error in getAllNotifications:", err);
        return res.status(500).json({
            success: false,
            message: err.message || "Internal Server Error",
        });
    }
};

const getMyNotifications = async (req, res) => {
    try {
        const notifications = await Service.getNotificationsForUser(req.user.id);

        return res.status(200).json({
            success: true,
            data: notifications,
        });
    } catch (err) {
        return res.status(500).json({
            success: false,
            message: err.message || "Internal Server Error",
        });
    }
};

const getNotificationById = async (req, res) => {
    try {
        const notification = await Service.getNotificationById(req.params.id);

        return res.status(200).json({
            success: true,
            data: notification,
        });
    } catch (err) {
        return res.status(err.statusCode || 500).json({
            success: false,
            message: err.message || "Internal Server Error",
        });
    }
};

const markNotificationAsRead = async (req, res) => {
    try {
        const notification = await Service.markAsRead(
            req.params.id,
            req.user.id
        );

        return res.status(200).json({
            success: true,
            message: "Notification marked as read",
            data: notification,
        });
    } catch (err) {
        return res.status(err.statusCode || 500).json({
            success: false,
            message: err.message || "Internal Server Error",
        });
    }
};

const getUnreadCount = async (req, res) => {
    try {
        const count = await Service.getUnreadCount(req.user.id);

        return res.status(200).json({
            success: true,
            data: { count },
        });
    } catch (err) {
        return res.status(500).json({
            success: false,
            message: err.message || "Internal Server Error",
        });
    }
};

const deleteNotification = async (req, res) => {
    try {
        await Service.deleteNotification(req.params.id);

        return res.status(200).json({
            success: true,
            message: "Notification deleted successfully",
        });
    } catch (err) {
        return res.status(err.statusCode || 500).json({
            success: false,
            message: err.message || "Internal Server Error",
        });
    }
};

module.exports = {
    createAndSendNotification,
    getAllNotifications,
    getMyNotifications,
    getNotificationById,
    markNotificationAsRead,
    getUnreadCount,
    deleteNotification,
};
