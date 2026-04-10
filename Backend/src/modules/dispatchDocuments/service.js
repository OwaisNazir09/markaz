const Model = require("./models");
require("../User/models"); // Ensure Users model is registered

const CreateDispatch = async (data) => {
  return await Model.create(data);
};

const GetAllDispatch = async (filter = {}, page, limit, search) => {
  try {
    if (search) {
      filter.$or = [
        { title: { $regex: search, $options: "i" } },
        { subject: { $regex: search, $options: "i" } },
        { to: { $regex: search, $options: "i" } },
      ];
    }
    let query = Model.find(filter).sort({ createdAt: -1 });

    query = query.populate({
      path: "assignedUser",
      select: "profileDetails role",
      match: { _id: { $ne: null } }
    });

    if (page && limit) {
      query = query.skip((page - 1) * limit).limit(limit);
    }
    const data = await query;
    const total = await Model.countDocuments(filter);
    return { data, total };
  } catch (err) {
    console.error("Error in GetAllDispatch Service:", err);
    throw err;
  }
};

const GetDispatchById = async (id) => {
  return await Model.findById(id).populate("assignedUser", "profileDetails role");
};

const UpdateDispatch = async (id, data) => {
  return await Model.findByIdAndUpdate(id, data, { new: true });
};

const DeleteDispatch = async (id) => {
  return await Model.findByIdAndDelete(id);
};

module.exports = {
  CreateDispatch,
  GetAllDispatch,
  GetDispatchById,
  UpdateDispatch,
  DeleteDispatch,
};
