const mongoose = require("mongoose");

const notificationRecipientSchema = new mongoose.Schema(
    {
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Users",
            required: true
        },
        status: {
            type: String,
            enum: ["pending", "sent", "failed", "read"],
            default: "pending"
        },
        readAt: Date
    },
    { _id: false }
);

const notificationSchema = new mongoose.Schema(
    {
        title: {
            type: String,
            required: true
        },
        message: {
            type: String,
            required: true
        },

        type: {
            type: String,
            enum: ["system", "project", "document", "meeting"],
            required: true
        },

        data: {
            type: Object
        },

        sender: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Users"
        },

        recipients: [notificationRecipientSchema],

        sentAt: Date
    },
    {
        timestamps: true
    }
);

module.exports = mongoose.model("Notification", notificationSchema);
