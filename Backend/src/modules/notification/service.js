const Notification = require("./model");
const User = require("../User/models");

const createNotification = async (notificationData, userIds = []) => {
    try {
        const recipients = userIds.map(userId => ({
            userId,
            status: "pending",
        }));

        const notification = new Notification({
            ...notificationData,
            recipients,
        });

        await notification.save();
        return notification;
    } catch (error) {
        throw error;
    }
};

const getNotificationById = async (id) => {
    try {
        const notification = await Notification.findById(id)
            .populate("sender", "profileDetails.name profileDetails.email")
            .populate("recipients.userId", "profileDetails.name profileDetails.email");

        if (!notification) {
            const err = new Error("Notification not found");
            err.statusCode = 404;
            throw err;
        }

        return notification;
    } catch (error) {
        throw error;
    }
};

const getAllNotifications = async (filters = {}, page, limit, search) => {
    try {
        const query = {};

        if (filters.type) {
            query.type = filters.type;
        }

        if (search && typeof search === 'string') {
            query.$or = [
                { title: { $regex: search.trim(), $options: "i" } },
                { message: { $regex: search.trim(), $options: "i" } },
            ];
        }

        let notificationQuery = Notification.find(query)
            .populate("sender", "profileDetails.name profileDetails.email")
            .sort({ createdAt: -1 });

        if (page && limit) {
            notificationQuery = notificationQuery.skip((page - 1) * limit).limit(limit);
        }

        const data = await notificationQuery.lean();
        const total = await Notification.countDocuments(query);

        return { data, total };
    } catch (error) {
        console.error("Error in getAllNotifications service:", error);
        throw error;
    }
};

const getNotificationsForUser = async (userId) => {
    try {
        const notifications = await Notification.find({
            "recipients.userId": userId,
        })
            .populate("sender", "profileDetails.name profileDetails.email")
            .sort({ createdAt: -1 })
            .lean();

        return notifications.map(notification => ({
            ...notification,
            recipientStatus: notification.recipients.find(
                r => r.userId.toString() === userId.toString()
            ),
        }));
    } catch (error) {
        throw error;
    }
};

const markAsRead = async (notificationId, userId) => {
    try {
        const notification = await Notification.findOneAndUpdate(
            {
                _id: notificationId,
                "recipients.userId": userId,
            },
            {
                $set: {
                    "recipients.$.status": "read",
                    "recipients.$.readAt": new Date(),
                },
            },
            { new: true }
        );

        if (!notification) {
            const err = new Error("Notification not found");
            err.statusCode = 404;
            throw err;
        }

        return notification;
    } catch (error) {
        throw error;
    }
};

const updateRecipientStatus = async (notificationId, userId, status) => {
    try {
        const notification = await Notification.findOneAndUpdate(
            {
                _id: notificationId,
                "recipients.userId": userId,
            },
            {
                $set: {
                    "recipients.$.status": status,
                },
            },
            { new: true }
        );

        return notification;
    } catch (error) {
        throw error;
    }
};

const deleteNotification = async (id) => {
    try {
        const notification = await Notification.findByIdAndDelete(id);

        if (!notification) {
            const err = new Error("Notification not found");
            err.statusCode = 404;
            throw err;
        }

        return notification;
    } catch (error) {
        throw error;
    }
};

const getUnreadCount = async (userId) => {
    try {
        const count = await Notification.countDocuments({
            "recipients": {
                $elemMatch: {
                    userId: userId,
                    status: { $in: ["pending", "sent"] }
                }
            }
        });

        return count;
    } catch (error) {
        throw error;
    }
};

module.exports = {
    createNotification,
    getNotificationById,
    getAllNotifications,
    getNotificationsForUser,
    markAsRead,
    updateRecipientStatus,
    deleteNotification,
    getUnreadCount,
};
