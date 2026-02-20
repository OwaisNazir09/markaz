const ProjectCampaign = require("./models/ProjectCampaign");
const ProjectCampaignTransaction = require("./models/ProjectCampaignTransaction");

const createCampaign = async (data) => {
  return await ProjectCampaign.create(data);
};

const getAllCampaigns = async (page, limit, search) => {
  const filter = {};
  if (search) {
    filter.$or = [
      { title: { $regex: search, $options: "i" } },
      { category: { $regex: search, $options: "i" } },
    ];
  }

  let query = ProjectCampaign.find(filter).sort({ createdAt: -1 });
  if (page && limit) {
    query = query.skip((page - 1) * limit).limit(limit);
  }
  const data = await query;
  const total = await ProjectCampaign.countDocuments(filter);
  return { data, total };
};

const getAllActiveProjectCampaign = async (page, limit) => {
  const now = new Date();
  const filter = {
    status: "active",
    $and: [
      {
        $or: [
          { startDate: { $exists: false } },
          { startDate: { $eq: null } },
          { startDate: { $lte: now } },
        ]
      },
      {
        $or: [
          { endDate: { $exists: false } },
          { endDate: { $eq: null } },
          { endDate: { $gte: now } },
        ]
      }
    ]
  };

  let query = ProjectCampaign.find(filter).sort({ createdAt: -1 });
  if (page && limit) {
    query = query.skip((page - 1) * limit).limit(limit);
  }
  const data = await query;
  const total = await ProjectCampaign.countDocuments(filter);
  return { data, total };
};
const getCampaignById = async (id) => {
  const totalUniqueSupporters = await ProjectCampaignTransaction.distinct(
    "donorPhone",
    { campaignId: id },
  );

  const supporter = totalUniqueSupporters.length;

  const project = await ProjectCampaign.findById(id);
  if (!project) return null;

  return {
    ...project.toObject(),
    supporter,
  };
};

const updateCampaign = async (id, payload) => {
  return await ProjectCampaign.findByIdAndUpdate(id, payload, {
    new: true,
  });
};

const createTransaction = async (data) => {
  return await ProjectCampaignTransaction.create(data);
};

const getTransactionById = async (id) => {
  return await ProjectCampaignTransaction.findById(id);
};

const updateTransaction = async (id, data) => {
  return await ProjectCampaignTransaction.findByIdAndUpdate(id, data, {
    new: true,
  });
};

const getTransactionsByCampaign = async (campaignId, page, limit) => {
  const filter = { campaignId };
  let query = ProjectCampaignTransaction.find(filter)
    .populate("campaignId", "title category")
    .sort({
      createdAt: -1,
    });
  if (page && limit) {
    query = query.skip((page - 1) * limit).limit(limit);
  }
  const data = await query;
  const total = await ProjectCampaignTransaction.countDocuments(filter);
  return { data, total };
};

const getAllTransactions = async (page, limit, search) => {
  const filter = {};
  if (search) {
    filter.$or = [
      { donorName: { $regex: search, $options: "i" } },
      { donorEmail: { $regex: search, $options: "i" } },
    ];
  }

  let query = ProjectCampaignTransaction.find(filter)
    .populate("campaignId", "title category")
    .sort({ createdAt: -1 });
  if (page && limit) {
    query = query.skip((page - 1) * limit).limit(limit);
  }
  const data = await query;
  const total = await ProjectCampaignTransaction.countDocuments(filter);
  return { data, total };
};

const getRecentCampaignTransactions = async (limit = 10) => {
  return await ProjectCampaignTransaction.find({ paymentStatus: "success" })
    .populate("campaignId", "title")
    .sort({ createdAt: -1 })
    .limit(limit)
    .select("donorName amountPaid createdAt campaignId");
};

module.exports = {
  createCampaign,
  getAllCampaigns,
  getCampaignById,
  updateCampaign,
  createTransaction,
  getTransactionById,
  updateTransaction,
  getTransactionsByCampaign,
  getAllTransactions,
  getAllActiveProjectCampaign,
  getRecentCampaignTransactions,
};
