const User = require("../User/models");
const LedgerAccount = require("../ledger/models/LedgerAccount");
const LedgerTransaction = require("../ledger/models/LedgerTransaction");
const ProjectCampaign = require("../projects/models/ProjectCampaign");
const Notification = require("../notification/model");
const MinutesOfMeeting = require("../mintuesOfMeeting/model");
const LedgerService = require("../ledger/service");
const ProjectService = require("../projects/service");
const UserService = require("../User/service"); // Assuming this exists for user count
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const getMonthName = (monthIndex) => {
  const months = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];
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
        entryType: { $in: ["Income", "Expense"] },
      },
    },
    {
      $group: {
        _id: {
          month: { $month: "$date" },
          year: { $year: "$date" },
        },
        income: {
          $sum: {
            $cond: [{ $eq: ["$entryType", "Income"] }, "$amount", 0],
          },
        },
        expense: {
          $sum: {
            $cond: [{ $eq: ["$entryType", "Expense"] }, "$amount", 0],
          },
        },
      },
    },
    { $sort: { "_id.year": 1, "_id.month": 1 } },
  ]);

  const result = [];
  const current = new Date(start);
  while (current <= end) {
    const month = current.getMonth() + 1;
    const year = current.getFullYear();
    const found = stats.find(
      (s) => s._id.month === month && s._id.year === year,
    );

    result.push({
      label: getMonthName(month),
      income: found ? found.income : 0,
      expense: found ? found.expense : 0,
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
        entryType: { $in: ["Income", "Expense"] },
      },
    },
    {
      $group: {
        _id: {
          day: { $dayOfMonth: "$date" },
          month: { $month: "$date" },
          year: { $year: "$date" },
        },
        date: { $first: "$date" },
        income: {
          $sum: {
            $cond: [{ $eq: ["$entryType", "Income"] }, "$amount", 0],
          },
        },
        expense: {
          $sum: {
            $cond: [{ $eq: ["$entryType", "Expense"] }, "$amount", 0],
          },
        },
      },
    },
    { $sort: { "_id.year": 1, "_id.month": 1, "_id.day": 1 } },
  ]);

  const result = [];
  const current = new Date(start);
  while (current <= end) {
    const day = current.getDate();
    const month = current.getMonth() + 1;
    const year = current.getFullYear();

    const found = stats.find(
      (s) => s._id.day === day && s._id.month === month && s._id.year === year,
    );

    result.push({
      label: getDayName(current),
      income: found ? found.income : 0,
      expense: found ? found.expense : 0,
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
      notificationUnreadCount: 0,
    };

    if (user.ledgerAccountId) {
      const account = await LedgerAccount.findById(user.ledgerAccountId).lean();
      if (account) {
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
          .limit(20)
          .lean();

        const formattedTransactions = transactions.map((tx) => {
          const debitAcc = tx.debitAccountId || tx.toAccountId;
          const creditAcc = tx.creditAccountId || tx.fromAccountId;

          const isUserDebited =
            debitAcc &&
            debitAcc._id.toString() === user.ledgerAccountId.toString();
          const isUserCredited =
            creditAcc &&
            creditAcc._id.toString() === user.ledgerAccountId.toString();

          let type = "Info";
          let message = "";
          let otherPartyName = "System";

          if (isUserDebited) {
            type = "Debited";
            otherPartyName = creditAcc ? creditAcc.name : "System";
            message = `Account debited by ₹${tx.amount}`;
          } else if (isUserCredited) {
            type = "Credited";
            otherPartyName = debitAcc ? debitAcc.name : "System";
            message = `Account credited by ₹${tx.amount}`;
          }

          const isLegacyRef = !tx.debitAccountId;
          const balanceAfter = isUserDebited
            ? isLegacyRef
              ? tx.receiverBalanceAfter
              : tx.debitBalanceAfter
            : isLegacyRef
              ? tx.senderBalanceAfter
              : tx.creditBalanceAfter;

          return {
            _id: tx._id,
            date: tx.date,
            amount: tx.amount,
            type: type, // "Credited" or "Debited"
            message: message,
            otherPartyName: otherPartyName,
            balanceAfter: balanceAfter || 0,
            remark: tx.remark || "",
            reference: tx.reference || "",
            paymentType: tx.paymenttype || tx.type || null,
            entryType: tx.entryType,
            createdBy: tx.createdBy || "Admin",
            externalSource: tx.externalSource || null,
          };
        });

        response.ledger = {
          ...account,
          transactions: formattedTransactions,
        };
      }
    }

    const rawProjects = await ProjectCampaign.find({ status: "active" })
      .select(
        "title description category targetAmount collectedAmount remainingAmount startDate endDate images status createdAt",
      )
      .sort({ createdAt: -1 })
      .limit(5)
      .lean();

    response.projects = rawProjects.map((p) => ({
      _id: p._id,
      title: p.title,
      description: p.description,
      category: p.category,
      targetAmount: p.targetAmount,
      collectedAmount: p.collectedAmount,
      remainingAmount: p.remainingAmount,
      progressPercent:
        p.targetAmount > 0
          ? Math.min(
            100,
            Math.round((p.collectedAmount / p.targetAmount) * 100),
          )
          : 0,
      startDate: p.startDate,
      endDate: p.endDate,
      images: p.images || [],
      status: p.status,
      createdAt: p.createdAt,
    }));
    const notifications = await Notification.find({
      "recipients.userId": userId,
    })
      .sort({ createdAt: -1 })
      .limit(10)
      .lean();

    let unreadCount = 0;

    response.notifications = notifications.map((n) => {
      const recipient = n.recipients.find(
        (r) => r.userId.toString() === userId.toString(),
      );

      const isRead = recipient ? recipient.status === "read" : false;

      if (!isRead) unreadCount++;

      return {
        _id: n._id,
        title: n.title,
        message: n.message,
        type: n.type,
        createdAt: n.createdAt,
        read: isRead,
      };
    });

    response.notificationUnreadCount = unreadCount;
    response.role = user.role;

    return response;
  } catch (error) {
    throw error;
  }
};

const managementDashboard = async (userId) => {
  try {
    const user = await User.findById(userId);
    if (!user) {
      const err = new Error("User not found");
      err.statusCode = 404;
      throw err;
    }

    /* =========================
       FINANCIAL SUMMARY
    ========================== */
    const { data: allAccounts } = await LedgerService.getAllAccounts(
      {},
      1,
      100000,
    );

    const financialSummary =
      await LedgerService.getFinancialSummary(allAccounts);

    /* =========================
       ACTIVE PROJECTS
    ========================== */
    let totalActiveProjects = 0;
    let projects = [];

    try {
      const activeProjects = await ProjectCampaign.find({ status: "active" })
        .select(
          "title description category targetAmount collectedAmount remainingAmount startDate endDate images status createdAt",
        )
        .sort({ createdAt: -1 })
        .lean();

      totalActiveProjects = activeProjects.length;

      projects = activeProjects.map((p) => ({
        _id: p._id,
        title: p.title,
        description: p.description,
        category: p.category,
        targetAmount: p.targetAmount,
        collectedAmount: p.collectedAmount,
        remainingAmount: p.remainingAmount,
        progressPercent:
          p.targetAmount > 0
            ? Math.min(
              100,
              Math.round((p.collectedAmount / p.targetAmount) * 100),
            )
            : 0,
        startDate: p.startDate,
        endDate: p.endDate,
        images: p.images || [],
        status: p.status,
        createdAt: p.createdAt,
      }));
    } catch (e) {
      console.log("Error fetching active projects:", e.message);
    }

    /* =========================
       TOTAL USERS
    ========================== */
    let totalUsers = 0;

    try {
      const userData = await UserService.getAllUsers();
      totalUsers = userData.total;
    } catch (e) {
      console.log("Error fetching users count:", e.message);
      totalUsers = await User.countDocuments({ isDeleted: false });
    }

    /* =========================
       CHARTS
    ========================== */
    const monthlyStats = await getMonthlyStats();
    const weeklyStats = await getWeeklyStats();

    /* =========================
       NOTIFICATIONS
    ========================== */
    const notifications = await Notification.find({
      "recipients.userId": userId,
    })
      .sort({ createdAt: -1 })
      .limit(10)
      .lean();

    let unreadCount = 0;

    const formattedNotifications = notifications.map((n) => {
      const recipient = n.recipients.find(
        (r) => r.userId.toString() === userId.toString(),
      );

      const isRead = recipient ? recipient.status === "read" : false;

      if (!isRead) unreadCount++;

      return {
        _id: n._id,
        title: n.title,
        message: n.message,
        type: n.type,
        createdAt: n.createdAt,
        read: isRead,
      };
    });

    /* =========================
       FINAL RESPONSE
    ========================== */
    return {
      role: user.role,
      totalIncome: financialSummary.totalIncome,
      totalExpenses: financialSummary.totalExpenses,
      netBalance: financialSummary.netWorth,
      activeProjects: totalActiveProjects,
      totalUsers: totalUsers,
      projects,
      charts: {
        monthly: monthlyStats,
        weekly: weeklyStats,
      },
      notifications: formattedNotifications,
      notificationUnreadCount: unreadCount,
    };
  } catch (error) {
    throw error;
  }
};

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

    if (!user.profileDetails.fcmTokens) {
      user.profileDetails.fcmTokens = [];
    }

    const tokenIndex = user.profileDetails.fcmTokens.findIndex((t) => t.token === token);

    if (tokenIndex > -1) {
      user.profileDetails.fcmTokens[tokenIndex].lastActiveAt = new Date();
      if (deviceType) user.profileDetails.fcmTokens[tokenIndex].deviceType = deviceType;
      if (deviceId) user.profileDetails.fcmTokens[tokenIndex].deviceId = deviceId;
    } else {
      user.profileDetails.fcmTokens.push({
        token,
        deviceType,
        deviceId,
        lastActiveAt: new Date(),
      });
    }

    user.markModified('profileDetails');

    await user.save();
    return { success: true, message: "FCM token updated successfully" };
  } catch (error) {
    console.log(error)
    throw error;
  }
};
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
    const err = new Error(
      "Access denied. App access is for Management and Shopkeepers only.",
    );
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
    { expiresIn: "1d" },
  );

  user.password = undefined;

  return { token, user: user.profileDetails, role: user.role };
};

const getMinutesForUser = async (
  userId,
  { page = 1, limit = 20, search } = {},
) => {
  const skip = (page - 1) * limit;

  const filter = {
    isDeleted: false,
    $or: [
      { approvedBy: { $exists: true, $ne: null } }, // approved by anyone
      { createdBy: userId }, // uploaded by this user
    ],
  };

  if (search) {
    filter.$and = [
      {
        $or: [
          { title: { $regex: search, $options: "i" } },
          { description: { $regex: search, $options: "i" } },
        ],
      },
    ];

    filter.$and.push({ $or: filter.$or });
    delete filter.$or;
  }

  const [data, total] = await Promise.all([
    MinutesOfMeeting.find(filter)
      .populate("createdBy", "profileDetails.name profileDetails.email")
      .populate("approvedBy", "profileDetails.name")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit))
      .lean(),
    MinutesOfMeeting.countDocuments(filter),
  ]);

  return {
    data: data.map((m) => ({
      _id: m._id,
      title: m.title,
      description: m.description,
      text: m.text,
      meetingDate: m.meetingDate,
      files: m.files,
      status: m.status,
      isApproved: !!m.approvedBy,
      approvedAt: m.approvedAt || null,
      approvedBy: m.approvedBy ? m.approvedBy.profileDetails?.name : null,
      uploadedBy: m.createdBy ? m.createdBy.profileDetails?.name : null,
      isOwnUpload: m.createdBy
        ? m.createdBy._id.toString() === userId.toString()
        : false,
      createdAt: m.createdAt,
    })),
    total,
    page: Number(page),
    limit: Number(limit),
    totalPages: Math.ceil(total / limit),
  };
};

const uploadMinutesDocument = async (data, files, userId) => {
  const { title, description, text, meetingDate } = data;

  if (!title || !meetingDate) {
    const err = new Error("title and meetingDate are required");
    err.statusCode = 400;
    throw err;
  }

  const filePaths = files?.map((f) => f.path) || [];

  const minutes = await MinutesOfMeeting.create({
    title: title.trim(),
    description: description?.trim(),
    text: text?.trim(),
    meetingDate: new Date(meetingDate),
    files: filePaths,
    createdBy: userId,
  });

  return {
    _id: minutes._id,
    title: minutes.title,
    description: minutes.description,
    meetingDate: minutes.meetingDate,
    files: minutes.files,
    isApproved: false,
    createdAt: minutes.createdAt,
  };
};

const updateNotificationRead = async (userId, notificationId) => {
  try {
    if (!notificationId) {
      const err = new Error("Notification ID is required");
      err.statusCode = 400;
      throw err;
    }

    const notification = await Notification.findOne({
      _id: notificationId,
      "recipients.userId": userId,
    });

    if (!notification) {
      const err = new Error("Notification not found");
      err.statusCode = 404;
      throw err;
    }

    const recipient = notification.recipients.find(
      (r) => r.userId.toString() === userId.toString(),
    );

    if (!recipient) {
      const err = new Error("Recipient not found for this user");
      err.statusCode = 404;
      throw err;
    }

    // Already read → no change
    if (recipient.status === "read") {
      return {
        success: true,
        message: "Notification already marked as read",
      };
    }

    recipient.status = "read";
    recipient.readAt = new Date();

    await notification.save();

    return {
      success: true,
      message: "Notification marked as read",
    };
  } catch (error) {
    throw error;
  }
};

module.exports = {
  shopkeperDashboard,
  managementDashboard,
  updateFcmToken,
  appLogin,
  getMinutesForUser,
  uploadMinutesDocument,
  updateNotificationRead,
};
