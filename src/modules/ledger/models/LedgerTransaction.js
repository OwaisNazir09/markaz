const mongoose = require("mongoose");

const LedgerTransactionSchema = new mongoose.Schema({
  // === LEDGER 2.0 FIELDS (Double-Entry) ===
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

  // === LEGACY FIELDS (backward compat) ===
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

  // === TRANSACTION CLASSIFICATION ===
  entryType: {
    type: String,
    enum: ["Expense", "Settlement", "CreditNote", "Income", "Receipt", "Payment", "Transfer"],
    required: true,
  },

  // Legacy type sub-field kept for compatibility
  type: {
    type: String,
    enum: ["Payment", "Receipt", "Debit", "Credit", "Transfer"],
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

  // === AUDIT TRAIL ===
  reference: {
    type: String,
    trim: true,
  },
  // If this is a reversal, link back to original transaction
  originalTransactionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "LedgerTransaction",
    required: false,
  },
  isReversal: {
    type: Boolean,
    default: false,
  },
  reversedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "LedgerTransaction",
    required: false,
  },
  reversedAt: {
    type: Date,
    required: false,
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
