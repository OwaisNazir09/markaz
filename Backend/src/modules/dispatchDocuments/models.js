const mongoose = require("mongoose");

const dispatchDocumentSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },

    dispatchNo: {
      type: String,
      required: true,
      index: true,
    },

    dispatchDate: {
      type: Date,
      default: Date.now,
    },

    to: {
      type: String,
      trim: true,
    },

    subject: {
      type: String,
      required: true,
      trim: true,
    },

    remarks: {
      type: String,
      trim: true,
    },

    files: [
      {
        fileName: String,
        originalName: String,
        mimeType: String,
        path: String,
      },
    ],
    assignedUser: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Users",
    },
    isIndependent: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("DispatchDocument", dispatchDocumentSchema);
