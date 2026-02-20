const mongoose = require("mongoose");

const LedgerTransactionSchema = new mongoose.Schema({
  debitAccountId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "LedgerAccount",
    required: false,
  },
  creditAccountId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "LedgerAccount",
    required: false,
  },
  debitBalanceBefore: { type: Number, default: 0 },
  debitBalanceAfter: { type: Number, default: 0 },
  creditBalanceBefore: { type: Number, default: 0 },
  creditBalanceAfter: { type: Number, default: 0 },

  fromAccountId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "LedgerAccount",
    required: false,
  },
  toAccountId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "LedgerAccount",
    required: false,
  },
  senderBalanceBefore: { type: Number, default: 0 },
  senderBalanceAfter: { type: Number, default: 0 },
  receiverBalanceBefore: { type: Number, default: 0 },
  receiverBalanceAfter: { type: Number, default: 0 },

  entryType: {
    type: String,
    enum: ["Expense", "Settlement", "CreditNote", "Income"],
    required: true,
  },

  type: {
    type: String,
    enum: ["Payment", "Receipt", "Debit", "Credit"],
    required: false,
  },
  paymenttype: {
    type: String,
    required: false,
  },
  amount: {
    type: Number,
    required: true,
  },
  remark: {
    type: String,
    trim: true,
  },
  reference: {
    type: String,
    trim: true,
  },
  externalSource: {
    type: String,
    required: false,
  },

  createdBy: {
    type: String,
    trim: true,
    default: "Admin",
  },
  date: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model("LedgerTransaction", LedgerTransactionSchema);
