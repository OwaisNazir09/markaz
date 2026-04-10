const mongoose = require("mongoose");

const LedgerSettlementSchema = new mongoose.Schema({
  fromAccount: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "LedgerAccount",
    required: true,
  },
  toAccount: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "LedgerAccount",
    required: true,
  },

  amount: {
    type: Number,
    required: true,
    min: 0,
  },

  paymentMode: {
    type: String,
    enum: ["Cash", "Bank Transfer", "UPI", "Cheque", "Adjustment", "Other"],
    default: "Cash",
  },

  referenceNumber: {
    type: String,
    trim: true,
    default: null,
  },

  remark: {
    type: String,
    trim: true,
    default: null,
  },

  date: {
    type: Date,
    default: Date.now,
  },

  createdBy: {
    type: String,
    trim: true,
    default: null,
  },

  createdOn: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model("LedgerSettlement", LedgerSettlementSchema);
