const Service = require("./service");

const CreateDispatch = async (req, res) => {
  try {
    const payload = req.body;
    const uploadedFiles = req.files?.["DispatchDocuments"] || [];

    const filesData = uploadedFiles.map(file => ({
      fileName: file.filename,
      originalName: file.originalname,
      mimeType: file.mimetype,
      path: file.path
    }));

    const dispatchData = {
      ...payload,
      files: filesData
    };

    // Sanitize: If assignedUser or to are empty strings, remove them so Mongoose doesn't fail validation
    if (dispatchData.assignedUser === "") delete dispatchData.assignedUser;
    if (dispatchData.to === "") delete dispatchData.to;

    const data = await Service.CreateDispatch(dispatchData);

    return res.status(201).json({
      success: true,
      message: "Dispatch document created successfully",
      data,
    });
  } catch (err) {
    return res.status(err.statusCode || 500).json({
      success: false,
      message: err.message || "Internal Server Error",
    });
  }
};

const GetAllDispatch = async (req, res) => {
  try {
    console.log("GetAllDispatch Query:", req.query);
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const search = req.query.search;
    const isIndependent = req.query.isIndependent;

    const filter = {};
    if (isIndependent !== undefined) {
      filter.isIndependent = isIndependent === "true";
    }
    console.log("GetAllDispatch Filter:", filter);

    const { data, total } = await Service.GetAllDispatch(filter, page, limit, search);

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
      message: err.message || "Internal Server Error",
    });
  }
};

const GetDispatchById = async (req, res) => {
  try {
    const data = await Service.GetDispatchById(req.params.id);
    if (!data) {
      return res.status(404).json({
        success: false,
        message: "Dispatch document not found",
      });
    }
    return res.status(200).json({
      success: true,
      data,
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: err.message || "Internal Server Error",
    });
  }
};

const UpdateDispatch = async (req, res) => {
  try {
    const payload = req.body;
    const uploadedFiles = req.files?.["DispatchDocuments"];

    if (uploadedFiles && uploadedFiles.length > 0) {
      const filesData = uploadedFiles.map(file => ({
        fileName: file.filename,
        originalName: file.originalname,
        mimeType: file.mimetype,
        path: file.path
      }));
      payload.files = filesData;
    }

    // Sanitize: If assignedUser or to are empty strings, remove them so Mongoose doesn't fail validation
    if (payload.assignedUser === "") delete payload.assignedUser;
    if (payload.to === "") delete payload.to;

    const data = await Service.UpdateDispatch(req.params.id, payload);
    if (!data) {
      return res.status(404).json({
        success: false,
        message: "Dispatch document not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Dispatch document updated successfully",
      data,
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: err.message || "Internal Server Error",
    });
  }
};

const DeleteDispatch = async (req, res) => {
  try {
    const data = await Service.DeleteDispatch(req.params.id);
    if (!data) {
      return res.status(404).json({
        success: false,
        message: "Dispatch document not found",
      });
    }
    return res.status(200).json({
      success: true,
      message: "Dispatch document deleted successfully",
      data,
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: err.message || "Internal Server Error",
    });
  }
};

module.exports = {
  CreateDispatch,
  GetAllDispatch,
  GetDispatchById,
  UpdateDispatch,
  DeleteDispatch,
};
