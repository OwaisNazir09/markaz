const User = require("./models");
const bcrypt = require("bcryptjs");

const createAccount = async (data) => {
  const exists = await User.findOne({
    "profileDetails.email": data.profileDetails.email,
    isDeleted: false,
  });

  if (exists) {
    const err = new Error("User already exists");
    err.statusCode = 409;
    throw err;
  }

  data.password = await bcrypt.hash(data.password, 10);

  // Create user first
  const user = await User.create(data);

  // If user role is shopkeeper, try to create a Ledger account for them
  try {
    if (user.role === "shopkeeper") {
      const LedgerService = require("../ledger/service");

      // Use a clear name and default to Asset (receivable/customer)
      const ledgerPayload = {
        name: `${user.profileDetails.name} (Shopkeeper)`,
        accountType: "Asset",
        balance: 0,
        remarks: `Auto-created ledger for shopkeeper ${user.profileDetails.name}`,
        createdBy: user.profileDetails.name,
      };

      const acct = await LedgerService.createAccount(ledgerPayload);

      if (acct && acct._id) {
        // store the ledger account id on the user record (non-blocking)
        user.ledgerAccountId = acct._id.toString();
        await user.save();
      }
    }
  } catch (ledgerErr) {
    // Do not fail user creation if ledger creation fails — log for later inspection
    console.error("Failed to auto-create ledger account for shopkeeper:", ledgerErr && (ledgerErr.stack || ledgerErr));
  }

  return user;
};

const getAllUsers = async (page, limit, search) => {
  const filter = { isDeleted: false };
  if (search) {
    filter.$or = [
      { "profileDetails.name": { $regex: search, $options: "i" } },
      { "profileDetails.email": { $regex: search, $options: "i" } },
      { role: { $regex: search, $options: "i" } },
    ];
  }

  let query = User.find(filter);
  if (page && limit) {
    query = query.skip((page - 1) * limit).limit(limit);
  }
  const data = await query;
  const total = await User.countDocuments(filter);
  return { data, total };
};

const getUserById = async (id) => {
  const user = await User.findById(id);
  if (!user) {
    const err = new Error("User not found");
    err.statusCode = 404;
    throw err;
  }

  // Fetch dispatches assigned to this user
  const DispatchModel = require("../dispatchDocuments/models");
  const dispatches = await DispatchModel.find({ assignedUser: id }).sort({ createdAt: -1 });

  const userData = user.toObject();
  userData.dispatches = dispatches;

  return userData;
};

const updateUser = async (id, data) => {
  if (data.password) {
    data.password = await bcrypt.hash(data.password, 10);
  }

  // Handle nested profileDetails update
  if (data.profileDetails) {
    const updateQuery = {};
    for (const key in data.profileDetails) {
      updateQuery[`profileDetails.${key}`] = data.profileDetails[key];
    }
    delete data.profileDetails;
    data = { ...data, ...updateQuery };
  }

  const user = await User.findByIdAndUpdate(id, { $set: data }, { new: true });
  if (!user) {
    const err = new Error("User not found");
    err.statusCode = 404;
    throw err;
  }

  return user;
};

const deleteUser = async (id) => {
  const user = await User.findByIdAndUpdate(
    id,
    { isDeleted: true, status: false },
    { new: true }
  );

  if (!user) {
    const err = new Error("User not found");
    err.statusCode = 404;
    throw err;
  }

  return true;
};

module.exports = {
  createAccount,
  getAllUsers,
  getUserById,
  updateUser,
  deleteUser,
};
