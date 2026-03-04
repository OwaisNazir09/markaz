const service = require("./services");

const dashboard = async (req, res) => {
  try {
    const id = req.user.id;
    const role = req.user.role;

    if (role === "shopkeeper") {
      const data = await service.shopkeperDashboard(id);
      return res.status(200).json({
        success: true,
        data: data,
      });
    } else {
      const data = await service.managementDashboard(id);
      return res.status(200).json({
        success: true,
        data: data,
      });
    }
  } catch (err) {
    console.error("Dashboard error:", err.message);

    return res.status(err.statusCode || 500).json({
      success: false,
      message: err.message,
    });
  }
};

const updateFcmToken = async (req, res) => {
  try {
    const userId = req.user.id;
    const { token, deviceType, deviceId } = req.body;

    const result = await service.updateFcmToken(userId, {
      token,
      deviceType,
      deviceId,
    });

    return res.status(200).json(result);
  } catch (err) {
    console.error("FCM Token update error:", err.message);
    return res.status(err.statusCode || 500).json({
      success: false,
      message: err.message,
    });
  }
};

const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    const { token, user, role } = await service.appLogin(email, password, req);

    return res.status(200).json({
      success: true,
      message: "Login successful",
      token,
      data: {
        user,
        role,
      },
    });
  } catch (err) {
    console.error("App Login error:", err.message);

    return res.status(err.statusCode || 500).json({
      success: false,
      message: err.message,
    });
  }
};

/* ─────────────────────────────────────────────
   Minutes of Meeting Controllers
───────────────────────────────────────────── */

/**
 * GET /api/minutes
 * Returns approved minutes + minutes uploaded by the logged-in user.
 * Query params: page, limit, search
 */
const getMinutes = async (req, res) => {
  try {
    const userId = req.user.id;
    const { page, limit, search } = req.query;

    const result = await service.getMinutesForUser(userId, {
      page,
      limit,
      search,
    });

    return res.status(200).json({
      success: true,
      ...result,
    });
  } catch (err) {
    console.error("Get Minutes error:", err.message);
    return res.status(err.statusCode || 500).json({
      success: false,
      message: err.message,
    });
  }
};

const uploadMinutesDoc = async (req, res) => {
  try {
    const userId = req.user.id;

    // Files come from multer upload.fields([{ name: "MinutesOfMeeting", maxCount: 5 }])
    const rawFiles = req.files?.MinutesOfMeeting || req.files || [];
    // Normalise to array regardless of multer mode
    const files = Array.isArray(rawFiles)
      ? rawFiles
      : Object.values(rawFiles).flat();

    const result = await service.uploadMinutesDocument(req.body, files, userId);

    return res.status(201).json({
      success: true,
      message: "Minutes uploaded successfully. Pending admin approval.",
      data: result,
    });
  } catch (err) {
    console.error("Upload Minutes error:", err.message);
    return res.status(err.statusCode || 500).json({
      success: false,
      message: err.message,
    });
  }
};

const updateNotificationRead = async (req, res) => {
  try {
    const userId = req.user.id;
    const notificationId = req.params.id; 

    const result = await service.updateNotificationRead(userId, notificationId);

    return res.status(200).json(result);
  } catch (err) {
    console.error("updateNotificationRead error:", err.message);
    return res.status(err.statusCode || 500).json({
      success: false,
      message: err.message,
    });
  }
};
module.exports = {
  dashboard,
  updateFcmToken,
  login,
  updateNotificationRead,
  getMinutes,
  uploadMinutesDoc,
};
