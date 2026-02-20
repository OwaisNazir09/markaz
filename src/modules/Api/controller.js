const service = require("./services");

const dashboard = async (req, res) => {
  try {
    const id = req.user.id;
    const role = req.user.role;

    if (role === "shopkeeper") {
      const data = await service.shopkeperDashboard(id);
      return res.status(200).json({
        success: true,
        data: data
      });
    } else {

      const data = await service.managementDashboard(id);
      return res.status(200).json({
        success: true,
        data: data
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

    const result = await service.updateFcmToken(userId, { token, deviceType, deviceId });

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
        role
      }
    });
  } catch (err) {
    console.error("App Login error:", err.message);

    return res.status(err.statusCode || 500).json({
      success: false,
      message: err.message,
    });
  }
};

module.exports = { dashboard, updateFcmToken, login };
