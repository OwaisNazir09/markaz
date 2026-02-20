module.exports = {
  profilePicture: {
    folder: "/users/profile",
    fields: [
      { name: "profilePicture", maxCount: 1 },
      { name: "coverPhoto", maxCount: 1 }
    ],
    allowedTypes: ["image/jpeg", "image/png", "image/webp"],
    maxSize: 5 * 1024 * 1024,
  },

  campaign: {
    folder: "/projects/campaigns",
    field: "images",
    maxCount: 10,
    allowedTypes: ["image/jpeg", "image/png", "image/webp"],
    maxSize: 5 * 1024 * 1024,
  },

  documents: {
    folder: "/users/documents",
    field: "documents",
    maxCount: 5,
    allowedTypes: ["application/pdf"],
    maxSize: 5 * 1024 * 1024,
  },

  MinutesOfMeeting: {
    folder: "/MinutesOfMeeting",
    fields: [{ name: "MinutesOfMeeting", maxCount: 5 }],
    allowedTypes: ["application/pdf", "image/jpeg", "image/png"],
    maxSize: 5 * 1024 * 1024,
  },
  DispatchDocuments: {
    folder: "/DispatchDocuments",
    fields: [{ name: "DispatchDocuments", maxCount: 50 }],
    allowedTypes: [
      "application/pdf",
      "image/jpeg",
      "image/png",
      "application/vnd.ms-excel",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/vnd.ms-powerpoint",
      "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      "text/plain",
    ],
    maxSize: 10 * 1024 * 1024,
  },

  kyc: {
    folder: "/users/kyc",
    fields: [
      { name: "aadhaar", maxCount: 1 },
      { name: "pan", maxCount: 1 },
    ],
    allowedTypes: ["application/pdf", "image/jpeg"],
    maxSize: 5 * 1024 * 1024,
  },
};
