const mongoose = require("mongoose");

const ProjectCampaignTransactionSchema = new mongoose.Schema(
  {
    campaignId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ProjectCampaign",
      required: true,
    },

    donorName: {
      type: String,
      required: true,
      trim: true,
    },

    donorEmail: {
      type: String,
      lowercase: true,
      trim: true,
    },

    donorPhone: {
      type: String,
      trim: true,
    },

    donorAddress: {
      type: String,
      trim: true,
    },

    amountPaid: {
      type: Number,
      required: true,
      min: 1,
    },

    currency: {
      type: String,
      default: "INR",
    },

    paymentGateway: {
      type: String,
      enum: ["razorpay", "cashfree", "offline"],
      required: true,
    },

    paymentMode: {
      type: String,
    },

    orderId: String,
    paymentId: String,
    transactionId: String,

    paymentStatus: {
      type: String,
      enum: ["pending", "success", "failed", "refunded"],
      default: "pending",
    },

    isApproved: {
      type: Boolean,
      default: false,
    },

    approvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Users",
    },

    approvedAt: Date,

    receiptNumber: {
      type: String,
      unique: true,
      sparse: true,
    },

    receiptUrl: String,
  },
  { timestamps: true }
);

module.exports = mongoose.model(
  "ProjectCampaignTransaction",
  ProjectCampaignTransactionSchema
);
