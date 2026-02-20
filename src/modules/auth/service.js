const User = require("../User/models");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const loginUser = async (email, password, req) => {
  const user = await User.findOne({
    "profileDetails.email": email,
    isDeleted: false,
  }).select("+password");

  if (!user) {
    const err = new Error("Invalid email or password");
    err.statusCode = 401;
    throw err;
  }
  if (user.role !== "admin") {
    const err = new Error("Invalid email or password");
    err.statusCode = 401;
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
  user.lastLoginDevice = req.headers["user-agent"];
  user.failedLoginAttempts = 0;
  user.accountLockedUntil = null;

  user.loginHistory.push({
    ip: req.ip,
    device: "web",
    userAgent: req.headers["user-agent"],
  });

  await user.save();

  const token = jwt.sign(
    { id: user._id, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: "1d" }
  );

  user.password = undefined;

  return { token };
};

module.exports = {
  loginUser,
};
