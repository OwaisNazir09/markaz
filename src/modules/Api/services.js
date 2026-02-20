const User = require("../User/models");
const LedgerAccount = require("../ledger/models/LedgerAccount");
const LedgerTransaction = require("../ledger/models/LedgerTransaction");
const ProjectCampaign = require("../projects/models/ProjectCampaign");
const Notification = require("../notification/model");
const LedgerService = require("../ledger/service");
const ProjectService = require("../projects/service");
const UserService = require("../User/service"); // Assuming this exists for user count
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const getMonthName = (monthIndex) => {
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    return months[monthIndex - 1];
};

const getDayName = (date) => {
    const days = ["S", "M", "T", "W", "T", "F", "S"];
    return days[date.getDay()];
};

const getMonthlyStats = async () => {
    const end = new Date();
    const start = new Date();
    start.setMonth(start.getMonth() - 11);
    start.setDate(1);
    start.setHours(0, 0, 0, 0);

    const stats = await LedgerTransaction.aggregate([
        {
            $match: {
                date: { $gte: start },
                entryType: { $in: ["Income", "Expense"] }
            }
        },
        {
            $group: {
                _id: {
                    month: { $month: "$date" },
                    year: { $year: "$date" }
                },
                income: {
                    $sum: {
                        $cond: [{ $eq: ["$entryType", "Income"] }, "$amount", 0]
                    }
                },
                expense: {
                    $sum: {
                        $cond: [{ $eq: ["$entryType", "Expense"] }, "$amount", 0]
                    }
                }
            }
        },
        { $sort: { "_id.year": 1, "_id.month": 1 } }
    ]);

    const result = [];
    const current = new Date(start);
    while (current <= end) {
        const month = current.getMonth() + 1;
        const year = current.getFullYear();
        const found = stats.find(s => s._id.month === month && s._id.year === year);

        result.push({
            label: getMonthName(month),
            income: found ? found.income : 0,
            expense: found ? found.expense : 0
        });

        current.setMonth(current.getMonth() + 1);
    }

    return result;
};

const getWeeklyStats = async () => {
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - 6);
    start.setHours(0, 0, 0, 0);

    const stats = await LedgerTransaction.aggregate([
        {
            $match: {
                date: { $gte: start },
                entryType: { $in: ["Income", "Expense"] }
            }
        },
        {
            $group: {
                _id: {
                    day: { $dayOfMonth: "$date" },
                    month: { $month: "$date" },
                    year: { $year: "$date" }
                },
                date: { $first: "$date" },
                income: {
                    $sum: {
                        $cond: [{ $eq: ["$entryType", "Income"] }, "$amount", 0]
                    }
                },
                expense: {
                    $sum: {
                        $cond: [{ $eq: ["$entryType", "Expense"] }, "$amount", 0]
                    }
                }
            }
        },
        { $sort: { "_id.year": 1, "_id.month": 1, "_id.day": 1 } }
    ]);

    const result = [];
    const current = new Date(start);
    while (current <= end) {
        const day = current.getDate();
        const month = current.getMonth() + 1;
        const year = current.getFullYear();

        const found = stats.find(s => s._id.day === day && s._id.month === month && s._id.year === year);

        result.push({
            label: getDayName(current),
            income: found ? found.income : 0,
            expense: found ? found.expense : 0
        });

        current.setDate(current.getDate() + 1);
    }

    return result;
};

const shopkeperDashboard = async (userId) => {
    try {
        const user = await User.findById(userId);
        if (!user) {
            throw new Error("User not found");
        }

        const response = {
            ledger: null,
            projects: [],
            notifications: [],
        };

        // 1. Get Ledger Details
        if (user.ledgerAccountId) {
            const account = await LedgerAccount.findById(user.ledgerAccountId).lean();
            if (account) {
                // Get recent transactions for this account
                const transactions = await LedgerTransaction.find({
                    $or: [
                        { debitAccountId: user.ledgerAccountId },
                        { creditAccountId: user.ledgerAccountId },
                        { fromAccountId: user.ledgerAccountId },
                        { toAccountId: user.ledgerAccountId },
                    ],
                })
                    .populate("debitAccountId", "name")
                    .populate("creditAccountId", "name")
                    .populate("fromAccountId", "name")
                    .populate("toAccountId", "name")
                    .sort({ date: -1 })
                    .limit(20) // Increased limit slightly
                    .lean();

                // Format transactions for clearer display
                const formattedTransactions = transactions.map(tx => {
                    const isDebit = (tx.debitAccountId && tx.debitAccountId._id.toString() === user.ledgerAccountId) ||
                        (tx.toAccountId && tx.toAccountId._id.toString() === user.ledgerAccountId);

                    let otherPartyName = "Unknown";
                    if (isDebit) {
                        // Money coming IN (Debit in Asset) or Expense
                        // The other party is the Credit Account (Sender)
                        if (tx.creditAccountId) otherPartyName = tx.creditAccountId.name;
                        else if (tx.fromAccountId) otherPartyName = tx.fromAccountId.name;
                    } else {
                        // Money going OUT (Credit in Asset)
                        // The other party is the Debit Account (Receiver)
                        if (tx.debitAccountId) otherPartyName = tx.debitAccountId.name;
                        else if (tx.toAccountId) otherPartyName = tx.toAccountId.name;
                    }

                    return {
                        ...tx,
                        otherPartyName,
                        isDebit // Helper flag: true if account was debited, false if credited
                    };
                });

                response.ledger = {
                    ...account,
                    transactions: formattedTransactions
                };
            }
        }

        // 2. Get Active Project Details (Read-only)
        const projects = await ProjectCampaign.find({
            status: "active",
        })
            .select("title description targetAmount collectedAmount remainingAmount startDate endDate images")
            .sort({ createdAt: -1 })
            .limit(5)
            .lean();

        response.projects = projects;

        // 3. Get Recent Notifications
        const notifications = await Notification.find({
            "recipients.userId": userId,
        })
            .sort({ createdAt: -1 })
            .limit(10)
            .lean();

        // Map to simple structure
        response.notifications = notifications.map(n => {
            const recipient = n.recipients.find(r => r.userId.toString() === userId.toString());
            return {
                _id: n._id,
                title: n.title,
                message: n.message,
                type: n.type,
                createdAt: n.createdAt,
                read: recipient ? recipient.status === 'read' : false
            };
        });

        return response;

    } catch (error) {
        throw error;
    }
};

const managementDashboard = async (userId) => {
    try {
        // 1. Get Financial Summary
        const { data: allAccounts } = await LedgerService.getAllAccounts({}, 1, 100000);
        const financialSummary = await LedgerService.getFinancialSummary(allAccounts);

        // 2. Get Active Projects Count
        let totalActiveProjects = 0;
        try {
            const projectData = await ProjectService.getAllActiveProjectCampaign();
            totalActiveProjects = projectData.total;
        } catch (e) {
            console.log("Error fetching active projects count:", e.message);
        }

        // 3. Get Total Users Count
        let totalUsers = 0;
        try {
            // Assuming UserService has getAllUsers, need to verify
            const userData = await UserService.getAllUsers();
            totalUsers = userData.total;
        } catch (e) {
            console.log("Error fetching user users count:", e.message);
            // Fallback if service call fails or structure is different
            totalUsers = await User.countDocuments({ isDeleted: false });
        }


        // 4. Get Charts Data
        const monthlyStats = await getMonthlyStats();
        const weeklyStats = await getWeeklyStats();

        // 5. Get Recent Notifications for Admin/Management
        const notifications = await Notification.find({
            "recipients.userId": userId,
        })
            .sort({ createdAt: -1 })
            .limit(10)
            .lean();

        const formattedNotifications = notifications.map(n => {
            const recipient = n.recipients.find(r => r.userId.toString() === userId.toString());
            return {
                _id: n._id,
                title: n.title,
                message: n.message,
                type: n.type,
                createdAt: n.createdAt,
                read: recipient ? recipient.status === 'read' : false
            };
        });

        return {
            totalIncome: financialSummary.totalIncome,
            totalExpenses: financialSummary.totalExpenses,
            netBalance: financialSummary.netWorth,
            activeProjects: totalActiveProjects,
            totalUsers: totalUsers,
            charts: {
                monthly: monthlyStats,
                weekly: weeklyStats
            },
            notifications: formattedNotifications
        };
    } catch (error) {
        throw error;
    }
}

const updateFcmToken = async (userId, tokenData) => {
    try {
        const { token, deviceType, deviceId } = tokenData;

        if (!token) {
            throw new Error("Token is required");
        }

        const user = await User.findById(userId);
        if (!user) {
            throw new Error("User not found");
        }

        const tokenIndex = user.fcmTokens.findIndex(t => t.token === token);

        if (tokenIndex > -1) {
            user.fcmTokens[tokenIndex].lastActiveAt = new Date();
            if (deviceType) user.fcmTokens[tokenIndex].deviceType = deviceType;
            if (deviceId) user.fcmTokens[tokenIndex].deviceId = deviceId;
        } else {
            user.fcmTokens.push({
                token,
                deviceType,
                deviceId,
                lastActiveAt: new Date()
            });
        }

        await user.save();
        return { success: true, message: "FCM token updated successfully" };

    } catch (error) {
        throw error;
    }
}

const appLogin = async (email, password, req) => {
    const user = await User.findOne({
        "profileDetails.email": email,
        isDeleted: false,
    }).select("+password");

    if (!user) {
        const err = new Error("Invalid email or password");
        err.statusCode = 401;
        throw err;
    }

    // Mobile App Login Restriction: Only Management & Shopkeeper
    if (user.role !== "management" && user.role !== "shopkeeper") {
        const err = new Error("Access denied. App access is for Management and Shopkeepers only.");
        err.statusCode = 403;
        throw err;
    }

    if (user.accountLockedUntil && user.accountLockedUntil > new Date()) {
        const err = new Error("Account temporarily locked");
        err.statusCode = 403;
        throw err;
    }

    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
        user.failedLoginAttempts += 1;

        if (user.failedLoginAttempts >= 5) {
            user.accountLockedUntil = new Date(Date.now() + 30 * 60 * 1000);
        }

        await user.save();

        const err = new Error("Invalid email or password");
        err.statusCode = 401;
        throw err;
    }

    if (!user.status) {
        const err = new Error("Account is disabled");
        err.statusCode = 403;
        throw err;
    }

    user.lastLoginAt = new Date();
    user.lastLoginIP = req.ip;
    user.lastLoginDevice = req.headers["user-agent"]; // Could be device type from app
    user.failedLoginAttempts = 0;
    user.accountLockedUntil = null;

    user.loginHistory.push({
        ip: req.ip,
        device: "mobile",
        userAgent: req.headers["user-agent"],
    });

    await user.save();

    const token = jwt.sign(
        { id: user._id, role: user.role },
        process.env.JWT_SECRET,
        { expiresIn: "1d" }
    );

    user.password = undefined;

    return { token, user: user.profileDetails, role: user.role };
};

module.exports = { shopkeperDashboard, managementDashboard, updateFcmToken, appLogin };
