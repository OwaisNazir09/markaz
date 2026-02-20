const mongoose = require("mongoose");

const UsersSchema = new mongoose.Schema(
  {
    profileDetails: {
      name: {
        type: String,
        required: true,
        trim: true,
      },

      email: {
        type: String,
        required: true,
        lowercase: true,
        unique: true,
        index: true,
      },

      phone: {
        type: String,
        trim: true,
      },

      fcmTokens: [
        {
          token: String,
          deviceType: String,
          deviceId: String,
          lastActiveAt: Date,
        },
      ],

      profilePicture: {
        type: String,
        default: null,
      },

      coverPhoto: {
        type: String,
        default: null,
      },

      gender: {
        type: String,
        enum: ["male", "female", "other"],
      },

      dob: {
        type: Date,
      },
    },

    address: {
      line1: String,
      line2: String,
      city: String,
      state: String,
      country: {
        type: String,
        default: "India",
      },
      pincode: String,
    },

    password: {
      type: String,
      required: true,
      select: false,
    },

    role: {
      type: String,
      default: "admin",
      enum: ["admin", "management", "shopkeeper"],
    },

    permissions: [String],

    lastLoginAt: {
      type: Date,
    },

    lastLoginIP: {
      type: String,
    },

    lastLoginDevice: {
      type: String,
    },

    loginHistory: [
      {
        ip: String,
        device: String,
        userAgent: String,
        loggedAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],

    failedLoginAttempts: {
      type: Number,
      default: 0,
    },

    accountLockedUntil: {
      type: Date,
    },

    status: {
      type: Boolean,
      default: true,
    },

    isDeleted: {
      type: Boolean,
      default: false,
    },

    deletedAt: {
      type: Date,
    },

    ledgerAccountId: {
      type: String,
      default: null,
    },
  },
  {
    timestamps: true,
  },
);

module.exports = mongoose.model("Users", UsersSchema);
