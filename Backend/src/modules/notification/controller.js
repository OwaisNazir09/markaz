const Service = require("./service");
const User = require("../User/models");
const { sendPushNotificationInBatches } = require("../../services/firebase");

const createAndSendNotification = async (req, res) => {
    try {
        console.log("=== Starting createAndSendNotification ===");
        console.log("Request body:", JSON.stringify(req.body, null, 2));
        console.log("User ID from req.user:", req.user?.id);

        const { title, message, type, data, selectedUsers, sendToAll } = req.body;

        console.log("Extracted values:", {
            title,
            message,
            type,
            data: data ? "present" : "undefined",
            selectedUsers: selectedUsers ? `${selectedUsers.length} users` : "undefined",
            sendToAll
        });

        let userIds = [];
        let fcmTokens = [];

        if (sendToAll) {
            console.log("Fetching ALL users with status: true");

            const users = await User.find({ status: true }).select("_id profileDetails.fcmTokens");
            console.log(`Found ${users.length} active users`);

            if (users.length > 0) {
                console.log("First user sample:", JSON.stringify(users[0], null, 2));
            }

            userIds = users.map(u => {
                console.log(`User ${u._id}: profileDetails.fcmTokens exists?`, !!u.profileDetails?.fcmTokens);
                return u._id;
            });

            users.forEach(user => {
                // Check nested structure - fcmTokens is inside profileDetails
                const userTokens = user.profileDetails?.fcmTokens;
                console.log(`User ${user._id}: Tokens found: ${userTokens?.length || 0}`);

                if (userTokens && userTokens.length > 0) {
                    userTokens.forEach((tokenObj, index) => {
                        if (tokenObj && tokenObj.token) {
                            console.log(`  Token ${index + 1}: ${tokenObj.token.substring(0, 15)}... (valid)`);
                            fcmTokens.push(tokenObj.token);
                        } else {
                            console.log(`  Token ${index + 1}: INVALID or missing token property`);
                        }
                    });
                } else {
                    console.log(`  User ${user._id}: No valid tokens found`);
                }
            });
        } else if (selectedUsers && selectedUsers.length > 0) {
            console.log(`Fetching SPECIFIC users (${selectedUsers.length} IDs):`, selectedUsers);

            const users = await User.find({
                _id: { $in: selectedUsers },
                status: true,
            }).select("_id profileDetails.fcmTokens");

            console.log(`Found ${users.length} matching users from the selected list`);

            if (users.length !== selectedUsers.length) {
                const foundIds = users.map(u => u._id.toString());
                const missingIds = selectedUsers.filter(id => !foundIds.includes(id));
                console.log("WARNING: Some selected users not found or inactive:", missingIds);
            }

            userIds = users.map(u => {
                console.log(`User ${u._id}: profileDetails.fcmTokens exists?`, !!u.profileDetails?.fcmTokens);
                return u._id;
            });

            users.forEach(user => {
                const userTokens = user.profileDetails?.fcmTokens;
                console.log(`User ${user._id}: Tokens found: ${userTokens?.length || 0}`);

                if (userTokens && userTokens.length > 0) {
                    userTokens.forEach((tokenObj, index) => {
                        if (tokenObj && tokenObj.token) {
                            console.log(`  Token ${index + 1}: ${tokenObj.token.substring(0, 15)}... (valid)`);
                            fcmTokens.push(tokenObj.token);
                        } else {
                            console.log(`  Token ${index + 1}: INVALID or missing token property`);
                        }
                    });
                } else {
                    console.log(`  User ${user._id}: No valid tokens found`);
                }
            });
        } else {
            console.log("ERROR: No recipients specified");
            return res.status(400).json({
                success: false,
                message: "Please select recipients or choose to send to all users",
            });
        }

        console.log("=== Recipient Summary ===");
        console.log(`Total userIds: ${userIds.length}`);
        console.log(`Total fcmTokens collected: ${fcmTokens.length}`);

        if (fcmTokens.length > 0) {
            console.log("Sample of collected tokens (first 3):");
            fcmTokens.slice(0, 3).forEach((token, i) => {
                console.log(`  Token ${i + 1}: ${token.substring(0, 25)}...`);
            });
        } else {
            console.log("WARNING: No FCM tokens collected!");
        }

        // Create notification in database
        console.log("=== Creating Notification ===");
        console.log("Notification data:", {
            title,
            message,
            type: type || "system",
            data: data || {},
            sender: req.user.id,
            sentAt: new Date(),
            userIdsCount: userIds.length
        });

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

        console.log("Notification created with ID:", notification._id);
        console.log("Notification object:", JSON.stringify(notification, null, 2));

        let pushResult = { totalSuccess: 0, totalFailure: 0 };

        if (fcmTokens.length > 0) {
            console.log("=== Sending Push Notifications ===");
            console.log("Push notification data:", {
                title,
                message,
                tokenCount: fcmTokens.length,
                data: {
                    type: type || "system",
                    notificationId: notification._id.toString(),
                    ...data,
                }
            });

            try {
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

                console.log("Push notification result:", pushResult);
            } catch (pushError) {
                console.error("Error sending push notifications:", pushError);
                console.error("Push error stack:", pushError.stack);
            }

            console.log("=== Updating Recipient Status ===");
            try {
                await Service.updateRecipientStatus(notification._id, null, "sent");
                console.log("Recipient status updated to 'sent'");
            } catch (statusError) {
                console.error("Error updating recipient status:", statusError);
            }
        } else {
            console.log("Skipping push notifications - no tokens available");
        }

        console.log("=== Request Completed Successfully ===");
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
        console.error("=== ERROR in createAndSendNotification ===");
        console.error("Error name:", err.name);
        console.error("Error message:", err.message);
        console.error("Error stack:", err.stack);
        console.error("Error statusCode:", err.statusCode);

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
