const mongoose = require("mongoose");

const LedgerAccountSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
  },

  accountType: {
    type: String,
    enum: ["Asset", "Liability", "Income", "Expense"],
    required: true,
  },

  balance: {
    type: Number,
    default: 0,
  },

  bankDetails: {
    bankName: { type: String, trim: true, default: null },
    branch: { type: String, trim: true, default: null },
    accountNumber: { type: String, trim: true, default: null },
    ifscCode: { type: String, trim: true, default: null },
    upiId: { type: String, trim: true, default: null },
  },

  contactInfo: {
    personName: { type: String, trim: true, default: null },
    phone: { type: String, trim: true, default: null },
    email: { type: String, trim: true, lowercase: true, default: null },
    address: { type: String, trim: true, default: null },
    gstNumber: { type: String, trim: true, default: null },
    panNumber: { type: String, trim: true, default: null },
  },

  remarks: {
    type: String,
    trim: true,
    default: null,
  },

  createdBy: {
    type: String,
    trim: true,
    default: null,
  },
  isDefault: {
    type: Boolean,
    default: null,
  },
  defaultType: {
    type: String,
    enum: ["None", "OnlineCollection", "GeneralDonation", "GeneralIncome"],
    default: "None",
  },
  cashequivalent: {
    type: Boolean,
    default: false,
  },
  createdOn: {
    type: Date,
    default: Date.now,
  },

  updatedOn: {
    type: Date,
    default: Date.now,
  },
});

LedgerAccountSchema.pre("save", function () {
  this.updatedOn = Date.now();
});

module.exports = mongoose.model("LedgerAccount", LedgerAccountSchema);
