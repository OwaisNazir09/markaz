const Service = require("./service");

const CreateMinutes = async (req, res) => {
  try {
    const files =
      req.files?.MinutesOfMeeting ||
      (Array.isArray(req.files) ? req.files : []) ||
      (req.file ? [req.file] : []);

    const minutes = await Service.createMinutes(req.body, files, req.user.id);

    return res.status(201).json({
      success: true,
      message: "Minutes created successfully",
      data: minutes,
    });
  } catch (err) {
    return res.status(err.statusCode || 500).json({
      success: false,
      message: err.message || "Internal Server Error",
    });
  }
};

const GetAllMinutes = async (req, res) => {
  try {
    const page = parseInt(req.query.page);
    const limit = parseInt(req.query.limit);
    const search = req.query.search;
    const { data, total } = await Service.getAllMinutes(page, limit, search);

    return res.status(200).json({
      success: true,
      data,
      pagination: {
        total,
        page: page || 1,
        limit: limit || total,
      },
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: err.message || "Internal Server Error",
    });
  }
};

const GetMinutesById = async (req, res) => {
  try {
    const data = await Service.getMinutesById(req.params.id);
    return res.status(200).json({
      success: true,
      data,
    });
  } catch (err) {
    return res.status(err.statusCode || 500).json({
      success: false,
      message: err.message || "Internal Server Error",
    });
  }
};

const ApproveMinutes = async (req, res) => {
  try {
    const data = await Service.approveMinutes(req.params.id, req.user.id);

    return res.status(200).json({
      success: true,
      message: "Minutes approved",
      data,
    });
  } catch (err) {
    return res.status(err.statusCode || 500).json({
      success: false,
      message: err.message || "Internal Server Error",
    });
  }
};

const DeleteMinutes = async (req, res) => {
  try {
    await Service.deleteMinutes(req.params.id);
    return res.status(200).json({
      success: true,
      message: "Minutes deleted",
    });
  } catch (err) {
    return res.status(err.statusCode || 500).json({
      success: false,
      message: err.message || "Internal Server Error",
    });
  }
};

module.exports = {
  CreateMinutes,
  GetAllMinutes,
  GetMinutesById,
  ApproveMinutes,
  DeleteMinutes,
};
