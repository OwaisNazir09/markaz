const express = require("express");
const controller = require("./controller");
const auth = require("../../middlewares/auth");
const allowRoles = require("../../middlewares/role");
const validate = require("./validation");
const upload = require("../../middlewares/upload");

const router = express.Router();

router.post(
  "/campaign/create",
  auth,
  allowRoles("admin"),
  upload("campaign"),
  validate.createCampaign,
  controller.CreateCampaign,
);

router.get("/campaign", auth, controller.GetAllCampaigns);

router.get("/campaign/:id", auth, controller.GetCampaignById);

router.put(
  "/campaign/:id",
  auth,
  allowRoles("admin"),
  controller.UpdateCampaign,
);

router.patch(
  "/campaign/:id/status",
  auth,
  allowRoles("admin"),
  controller.UpdateCampaignStatus,
);

router.post("/donation/create", controller.CreateTransaction);
router.post(
  "/donation/manual",
  auth,
  allowRoles("admin"),
  controller.RecordManualDonation,
);
router.post("/donation/verify", controller.VerifyRazorpayPayment);

router.get(
  "/donation/campaign/:campaignId",
  auth,
  controller.GetTransactionsByCampaign,
);

router.get(
  "/donation",
  auth,
  allowRoles("admin"),
  controller.GetAllTransactions,
);

router.put(
  "/donation/:id/approve",
  auth,
  allowRoles("admin"),
  controller.ApproveTransaction,
);

router.put(
  "/donation/:id/refund",
  auth,
  allowRoles("admin"),
  controller.RefundTransaction,
);

//api which will be need needed in the UI
router.get("/v1/getcampaigns", controller.getActiveProjectCampaign);
router.get("/v1/campaign/:id", controller.GetCampaignById);
router.get("/v1/getRecentCompainTrans", controller.getRecentCompainTrans);

module.exports = router;
