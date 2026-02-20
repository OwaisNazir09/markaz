const mongoose = require("mongoose");

const ProjectCampaignSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },

    description: {
      type: String,
      trim: true,
    },

    category: {
      type: String,
      required: true,
    },

    targetAmount: {
      type: Number,
      required: true,
      min: 1,
    },

    images: [String],

    collectedAmount: {
      type: Number,
      default: 0,
    },

    remainingAmount: {
      type: Number,
      default: function () {
        return this.targetAmount;
      },
    },

    status: {
      type: String,
      enum: ["upcoming", "active", "completed", "paused", "cancelled", "expired"],
      default: "active",
    },

    startDate: Date,
    endDate: Date,

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Users",
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("ProjectCampaign", ProjectCampaignSchema);
