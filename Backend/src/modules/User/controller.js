const Service = require("./service");

const CreateAcct = async (req, res) => {
  try {
    const payload = {
      profileDetails: {
        ...req.body.profileDetails,
      },
      address: req.body.address || {},
      password: req.body.password,
      role: req.body.role,
      status: req.body.status,
    };

    if (req.files && req.files.profilePicture && req.files.profilePicture.length > 0) {
      payload.profileDetails.profilePicture = req.files.profilePicture[0].path;
    }

    const user = await Service.createAccount(payload);
    user.password = undefined;

    return res.status(201).json({
      success: true,
      message: "Account created successfully",
      data: user,
    });
  } catch (err) {
    return res.status(err.statusCode || 500).json({
      success: false,
      message: err.message,
    });
  }
};

const GetAllUsers = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const search = req.query.search;
    const { data, total } = await Service.getAllUsers(page, limit, search);

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
    return res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};

const GetUserById = async (req, res) => {
  try {
    const user = await Service.getUserById(req.params.id);
    user.password = undefined;

    return res.status(200).json({
      success: true,
      data: user,
    });
  } catch (err) {
    return res.status(err.statusCode || 500).json({
      success: false,
      message: err.message,
    });
  }
};

const GetMe = async (req, res) => {
  try {
    const user = await Service.getUserById(req.user.id);
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }
    user.password = undefined;

    return res.status(200).json({
      success: true,
      data: user,
    });
  } catch (err) {
    return res.status(err.statusCode || 500).json({
      success: false,
      message: err.message,
    });
  }
};

const UpdateUser = async (req, res) => {
  try {
    const payload = {};

    if (req.body.profileDetails) {
      payload.profileDetails = { ...req.body.profileDetails };
    }

    if (req.body.address) {
      payload.address = { ...req.body.address };
    }

    if (req.body.password) payload.password = req.body.password;
    if (req.body.role) payload.role = req.body.role;
    if (req.body.status !== undefined) payload.status = req.body.status;

    if (req.files && Object.keys(req.files).length > 0) {
      if (!payload.profileDetails) {
        payload.profileDetails = payload.profileDetails || {};
      }

      // Handle profilePicture
      if (req.files.profilePicture && req.files.profilePicture.length > 0) {
        payload.profileDetails.profilePicture = req.files.profilePicture[0].path;
      }

      // Handle coverPhoto
      if (req.files.coverPhoto && req.files.coverPhoto.length > 0) {
        payload.profileDetails.coverPhoto = req.files.coverPhoto[0].path;
      }
    }

    const user = await Service.updateUser(req.params.id, payload);
    user.password = undefined;

    return res.status(200).json({
      success: true,
      message: "User updated successfully",
      data: user,
    });
  } catch (err) {
    return res.status(err.statusCode || 500).json({
      success: false,
      message: err.message,
    });
  }
};

const DeleteUser = async (req, res) => {
  try {
    await Service.deleteUser(req.params.id);

    return res.status(200).json({
      success: true,
      message: "User deleted successfully",
    });
  } catch (err) {
    return res.status(err.statusCode || 500).json({
      success: false,
      message: err.message,
    });
  }
};

module.exports = {
  CreateAcct,
  GetAllUsers,
  GetUserById,
  GetMe,
  UpdateUser,
  DeleteUser,
};
