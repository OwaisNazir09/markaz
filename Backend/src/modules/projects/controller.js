const crypto = require("crypto");
const Razorpay = require("razorpay");
const Service = require("./service");
const { sendEmail } = require("../../middlewares/email");

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

const CreateCampaign = async (req, res) => {
  try {
    console.log("CreateCampaign payload:", req.body);
    console.log("CreateCampaign user:", req.user);
    const payload = req.body;

    // Check if Joi validation error exists from middleware
    // (Wait, validate middleware sends response on error, but let's be safe)

    if (req.files && req.files.length > 0) {
      payload.images = req.files.map((file) => file.path);
    }

    if (!payload.title || !payload.category || !payload.targetAmount) {
      return res.status(400).json({
        success: false,
        message: "Required fields are missing",
      });
    }

    const now = new Date();
    let initialStatus = "active";

    if (payload.startDate) {
      const startDate = new Date(payload.startDate);
      if (startDate > now) {
        initialStatus = "upcoming";
      }
    }

    const campaignData = {
      ...payload,
      status: payload.status || initialStatus,
      collectedAmount: 0,
      remainingAmount: payload.targetAmount,
      createdBy: req.user.id,
    };

    const data = await Service.createCampaign(campaignData);

    return res.status(201).json({
      success: true,
      message: "Campaign created successfully",
      data,
    });
  } catch (err) {
    return res.status(err.statusCode || 500).json({
      success: false,
      message: err.message || "Internal Server Error",
    });
  }
};

const GetAllCampaigns = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const search = req.query.search;
    const { data, total } = await Service.getAllCampaigns(page, limit, search);

    return res.status(200).json({
      success: true,
      data,
      pagination: {
        total,
        page,
        limit,
      },
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: err.message || "Internal Server Error",
    });
  }
};
const getActiveProjectCampaign = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const { data, total } = await Service.getAllActiveProjectCampaign(
      page,
      limit,
    );

    return res.status(200).json({
      success: true,
      data,
      pagination: {
        total,
        page,
        limit,
      },
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: err.message || "Internal Server Error",
    });
  }
};

const GetCampaignById = async (req, res) => {
  try {
    const data = await Service.getCampaignById(req.params.id);
    if (!data) {
      return res.status(404).json({
        success: false,
        message: "Campaign not found",
      });
    }

    return res.status(200).json({
      success: true,
      data,
    });
  } catch (err) {
    return res.status(err.statusCode || 500).json({
      success: false,
      message: err.message || "Internal Server Error",
    });
  }
};

const UpdateCampaign = async (req, res) => {
  try {
    const data = await Service.updateCampaign(req.params.id, req.body);
    if (!data) {
      return res.status(404).json({
        success: false,
        message: "Campaign not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Campaign updated successfully",
      data,
    });
  } catch (err) {
    return res.status(err.statusCode || 500).json({
      success: false,
      message: err.message || "Internal Server Error",
    });
  }
};

const UpdateCampaignStatus = async (req, res) => {
  try {
    const status = req.body.status;
    const allowed = ["active", "completed", "paused", "cancelled"];
    if (!allowed.includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Invalid campaign status",
      });
    }

    const data = await Service.updateCampaign(req.params.id, { status });
    if (!data) {
      return res.status(404).json({
        success: false,
        message: "Campaign not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Campaign status updated",
      data,
    });
  } catch (err) {
    return res.status(err.statusCode || 500).json({
      success: false,
      message: err.message || "Internal Server Error",
    });
  }
};

const CreateTransaction = async (req, res) => {
  try {
    const {
      campaignId,
      donorName,
      donorEmail,
      donorPhone,
      donorAddress,
      amountPaid,
    } = req.body;

    if (!campaignId || !donorName || !amountPaid) {
      return res.status(400).json({
        success: false,
        message: "Required fields are missing",
      });
    }

    const campaign = await Service.getCampaignById(campaignId);
    if (!campaign || campaign.status !== "active") {
      return res.status(400).json({
        success: false,
        message: "Invalid or inactive campaign",
      });
    }

    if (amountPaid > campaign.remainingAmount) {
      return res.status(400).json({
        success: false,
        message: "Donation exceeds remaining campaign amount",
      });
    }

    const order = await razorpay.orders.create({
      amount: amountPaid * 100,
      currency: "INR",
      receipt: `rcpt_${Date.now()}`,
    });

    const transactionData = {
      campaignId,
      donorName,
      donorEmail,
      donorPhone,
      donorAddress,
      amountPaid,
      paymentGateway: "razorpay",
      paymentMode: "online",
      orderId: order.id,
      paymentStatus: "pending",
      isApproved: false,
    };

    const transaction = await Service.createTransaction(transactionData);

    const data = {
      transactionId: transaction._id,
      order,
      razorpayKey: process.env.RAZORPAY_KEY_ID,
    };

    return res.status(201).json({
      success: true,
      message: "Donation initiated successfully",
      data,
    });
  } catch (err) {
    return res.status(err.statusCode || 500).json({
      success: false,
      message: err.message || "Internal Server Error",
    });
  }
};

const VerifyRazorpayPayment = async (req, res) => {
  try {
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      transactionId,
    } = req.body;

    if (
      !razorpay_order_id ||
      !razorpay_payment_id ||
      !razorpay_signature ||
      !transactionId
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid payment verification payload",
      });
    }

    const body = razorpay_order_id + "|" + razorpay_payment_id;
    const expectedSignature = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(body)
      .digest("hex");

    if (expectedSignature !== razorpay_signature) {
      return res.status(401).json({
        success: false,
        message: "Invalid payment signature",
      });
    }

    let transaction = await Service.getTransactionById(transactionId);
    if (!transaction) {
      return res.status(404).json({
        success: false,
        message: "Transaction not found",
      });
    }

    if (transaction.paymentStatus === "success") {
      return res.status(200).json({
        success: true,
        message: "Payment verified successfully",
        data: transaction,
      });
    }

    // Update Transaction
    transaction = await Service.updateTransaction(transactionId, {
      paymentId: razorpay_payment_id,
      paymentStatus: "success",
      isApproved: true,
      approvedAt: new Date(),
    });

    // Update Campaign
    const campaign = await Service.getCampaignById(transaction.campaignId);
    if (!campaign) {
      return res.status(404).json({
        success: false,
        message: "Campaign not found",
      });
    }

    let newCollected = campaign.collectedAmount + transaction.amountPaid;
    let newRemaining = campaign.remainingAmount - transaction.amountPaid;
    let newStatus = campaign.status;

    if (newRemaining <= 0) {
      newStatus = "completed";
      newRemaining = 0;
    }

    await Service.updateCampaign(campaign._id, {
      collectedAmount: newCollected,
      remainingAmount: newRemaining,
      status: newStatus,
    });

    await transaction.populate("campaignId", "title");

    const data = transaction;

    if (data.donorEmail) {
      try {
        await sendEmail(
          data.donorEmail,
          "Donation Successful - Markaz-i-Auqaf",
          "donationSuccess.html",
          {
            donorName: data.donorName,
            transactionId: data._id.toString(),
            campaignTitle: data.campaignId?.title || "Campaign",
            amount: data.amountPaid,
            date: new Date().toLocaleDateString(),
          },
        );
      } catch (err) {
        console.log(err);
      }
    }

    // Record in Ledger
    try {
      const LedgerService = require("../ledger/service");
      await LedgerService.recordOnlineTransaction(
        transaction.amountPaid,
        transaction._id.toString(),
        `Online Donation from ${transaction.donorName} for ${data.campaignId?.title || "Campaign"}`,
      );
    } catch (ledgerError) {
      console.error("Failed to record ledger transaction:", ledgerError);
      // We do not fail the request if ledger recording fails, but we log it.
    }

    return res.status(200).json({
      success: true,
      message: "Payment verified successfully",
      data,
    });
  } catch (err) {
    return res.status(err.statusCode || 500).json({
      success: false,
      message: err.message || "Payment verification failed",
    });
  }
};

const GetTransactionsByCampaign = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const { data, total } = await Service.getTransactionsByCampaign(
      req.params.campaignId,
      page,
      limit,
    );

    return res.status(200).json({
      success: true,
      data,
      pagination: {
        total,
        page,
        limit,
      },
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: err.message || "Internal Server Error",
    });
  }
};

const GetAllTransactions = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const search = req.query.search;
    const { data, total } = await Service.getAllTransactions(
      page,
      limit,
      search,
    );

    return res.status(200).json({
      success: true,
      data,
      pagination: {
        total,
        page,
        limit,
      },
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: err.message || "Internal Server Error",
    });
  }
};

const ApproveTransaction = async (req, res) => {
  try {
    let transaction = await Service.getTransactionById(req.params.id);
    if (!transaction) {
      return res.status(404).json({
        success: false,
        message: "Transaction not found",
      });
    }

    if (!transaction.isApproved) {
      transaction = await Service.updateTransaction(req.params.id, {
        isApproved: true,
        approvedBy: req.user.id,
        approvedAt: new Date(),
        paymentStatus: "success",
      });

      const campaign = await Service.getCampaignById(transaction.campaignId);
      if (!campaign) {
        return res.status(404).json({
          success: false,
          message: "Campaign not found",
        });
      }

      let newCollected = campaign.collectedAmount + transaction.amountPaid;
      let newRemaining = campaign.remainingAmount - transaction.amountPaid;
      let newStatus = campaign.status;

      if (newRemaining <= 0) {
        newStatus = "completed";
        newRemaining = 0;
      }

      await Service.updateCampaign(campaign._id, {
        collectedAmount: newCollected,
        remainingAmount: newRemaining,
        status: newStatus,
      });

      await transaction.populate("campaignId", "title");
    }

    const data = transaction;

    if (data.donorEmail) {
      try {
        await sendEmail(
          data.donorEmail,
          "Donation Successful - Markaz-i-Auqaf",
          "donationSuccess.html",
          {
            donorName: data.donorName,
            transactionId: data._id.toString(),
            campaignTitle: data.campaignId?.title || "Campaign",
            amount: data.amountPaid,
            date: new Date().toLocaleDateString(),
          },
        );
      } catch (err) {
        console.log(err);
      }
    }

    try {
      const LedgerService = require("../ledger/service");
      await LedgerService.recordOnlineTransaction(
        transaction.amountPaid,
        transaction._id.toString(),
        `Approved Donation from ${transaction.donorName} for ${data.campaignId?.title || "Campaign"}`,
        req.user.name || "Admin",
      );
    } catch (ledgerError) {
      console.error("Failed to record ledger transaction:", ledgerError);
    }

    return res.status(200).json({
      success: true,
      message: "Donation approved successfully",
      data,
    });
  } catch (err) {
    return res.status(err.statusCode || 500).json({
      success: false,
      message: err.message || "Internal Server Error",
    });
  }
};

const RefundTransaction = async (req, res) => {
  try {
    let transaction = await Service.getTransactionById(req.params.id);
    if (!transaction) {
      return res.status(404).json({
        success: false,
        message: "Transaction not found",
      });
    }

    if (transaction.paymentStatus !== "success") {
      return res.status(400).json({
        success: false,
        message: "Only successful payments can be refunded",
      });
    }

    transaction = await Service.updateTransaction(req.params.id, {
      paymentStatus: "refunded",
    });

    const campaign = await Service.getCampaignById(transaction.campaignId);
    if (campaign) {
      let newCollected = campaign.collectedAmount - transaction.amountPaid;
      let newRemaining = campaign.remainingAmount + transaction.amountPaid;
      await Service.updateCampaign(campaign._id, {
        collectedAmount: newCollected,
        remainingAmount: newRemaining,
        status: "active",
      });
    }

    const data = transaction;

    return res.status(200).json({
      success: true,
      message: "Donation refunded successfully",
      data,
    });
  } catch (err) {
    return res.status(err.statusCode || 500).json({
      success: false,
      message: err.message || "Internal Server Error",
    });
  }
};

const getRecentCompainTrans = async (req, res) => {
  try {
    const data = await Service.getRecentCampaignTransactions(10);
    return res.status(200).json({
      success: true,
      data,
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: err.message || "Internal Server Error",
    });
  }
};

const RecordManualDonation = async (req, res) => {
  try {
    const {
      campaignId,
      donorName,
      donorEmail,
      donorPhone,
      donorAddress,
      amountPaid,
      paymentMethod,
      remark,
    } = req.body;

    if (!campaignId || !donorName || !amountPaid || !paymentMethod) {
      return res.status(400).json({
        success: false,
        message: "Required fields are missing",
      });
    }

    const campaign = await Service.getCampaignById(campaignId);
    if (!campaign || campaign.status !== "active") {
      return res.status(400).json({
        success: false,
        message: "Invalid or inactive campaign",
      });
    }

    const numericAmount = parseFloat(amountPaid);

    if (numericAmount > campaign.remainingAmount) {
      return res.status(400).json({
        success: false,
        message: "Donation exceeds remaining campaign amount",
      });
    }

    const transactionData = {
      campaignId,
      donorName,
      donorEmail,
      donorPhone,
      donorAddress,
      amountPaid: numericAmount,
      paymentGateway: "offline",
      paymentMode: paymentMethod, // 'Cash', 'Check', 'Bank Transfer', etc.
      paymentStatus: "success",
      isApproved: true,
      approvedBy: req.user.id,
      approvedAt: new Date(),
      remark: remark || `Manual donation recorded by ${req.user.name}`,
    };

    const transaction = await Service.createTransaction(transactionData);

    // Update Campaign
    let newCollected = campaign.collectedAmount + numericAmount;
    let newRemaining = campaign.remainingAmount - numericAmount;
    let newStatus = campaign.status;

    if (newRemaining <= 0) {
      newStatus = "completed";
      newRemaining = 0;
    }

    await Service.updateCampaign(campaign._id, {
      collectedAmount: newCollected,
      remainingAmount: newRemaining,
      status: newStatus,
    });

    await transaction.populate("campaignId", "title");

    // Send Email
    if (donorEmail) {
      try {
        await sendEmail(
          donorEmail,
          "Donation Receipt - Markaz-i-Auqaf",
          "donationSuccess.html",
          {
            donorName: donorName,
            transactionId: transaction._id.toString(),
            campaignTitle: transaction.campaignId?.title || "Campaign",
            amount: numericAmount,
            date: new Date().toLocaleDateString(),
          },
        );
      } catch (emailErr) {
        console.error("Failed to send manual donation email:", emailErr);
      }
    }

    // Record in Ledger
    try {
      const LedgerService = require("../ledger/service");
      await LedgerService.recordOnlineTransaction(
        numericAmount,
        transaction._id.toString(),
        `Manual ${paymentMethod} Donation from ${donorName} for ${transaction.campaignId?.title || "Campaign"}`,
        req.user.name || "Admin",
      );
    } catch (ledgerError) {
      console.error(
        "Failed to record ledger transaction for manual donation:",
        ledgerError,
      );
    }

    return res.status(201).json({
      success: true,
      message: "Manual donation recorded successfully",
      data: transaction,
    });
  } catch (err) {
    return res.status(err.statusCode || 500).json({
      success: false,
      message: err.message || "Internal Server Error",
    });
  }
};

module.exports = {
  CreateCampaign,
  GetAllCampaigns,
  GetCampaignById,
  UpdateCampaign,
  UpdateCampaignStatus,
  CreateTransaction,
  VerifyRazorpayPayment,
  GetTransactionsByCampaign,
  GetAllTransactions,
  ApproveTransaction,
  RefundTransaction,
  RecordManualDonation,
  getActiveProjectCampaign,
  getRecentCompainTrans,
};
