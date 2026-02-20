const Service = require("./service");

const Login = async (req, res) => {
  try {
    const { email, password } = req.body;

    const { token } = await Service.loginUser(email, password, req);

    return res.status(200).json({
      success: true,
      message: "Login successful",
      token,
    });
  } catch (err) {
    console.error("Login error:", err.message);

    return res.status(err.statusCode || 500).json({
      success: false,
      message: err.message,
    });
  }
};

module.exports = {
  Login,
};
