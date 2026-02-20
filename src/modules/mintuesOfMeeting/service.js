const Minutes = require("./model");

const createMinutes = async (data, files, userId) => {
  try {

    const minutes = await Minutes.create({
      title: data.title,
      meetingDate: data.meetingDate?.trim(),
      description: data.description,
      text: data.text,
      files: files?.map((f) => f.path) || [],
      createdBy: userId,
    });

    return minutes;
  } catch (err) {
    throw err;
  }
};

module.exports = {
  createMinutes,
};

const getAllMinutes = async (page, limit, search) => {
  const filter = { isDeleted: false };
  if (search) {
    filter.$or = [
      { title: { $regex: search, $options: "i" } },
      { description: { $regex: search, $options: "i" } },
    ];
  }
  const query = Minutes.find(filter)
    .populate("createdBy", "profileDetails.name profileDetails.email")
    .populate("approvedBy", "profileDetails.name")
    .sort({ createdAt: -1 });

  if (page && limit) {
    query.skip((page - 1) * limit).limit(limit);
  }
  const data = await query;
  const total = await Minutes.countDocuments(filter);
  return { data, total };
};

const getMinutesById = async (id) => {
  const minutes = await Minutes.findById(id);
  if (!minutes) {
    const err = new Error("Minutes not found");
    err.statusCode = 404;
    throw err;
  }
  return minutes;
};

const approveMinutes = async (id, userId) => {
  const minutes = await Minutes.findByIdAndUpdate(
    id,
    {
      approvedBy: userId,
      approvedAt: new Date(),
    },
    { new: true }
  );

  if (!minutes) {
    const err = new Error("Minutes not found");
    err.statusCode = 404;
    throw err;
  }

  return minutes;
};

const deleteMinutes = async (id) => {
  const minutes = await Minutes.findByIdAndUpdate(
    id,
    { isDeleted: true, deletedAt: new Date() },
    { new: true }
  );

  if (!minutes) {
    const err = new Error("Minutes not found");
    err.statusCode = 404;
    throw err;
  }

  return true;
};

module.exports = {
  createMinutes,
  getAllMinutes,
  getMinutesById,
  approveMinutes,
  deleteMinutes,
};
