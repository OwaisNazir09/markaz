const express = require("express");
const Controller = require("./contoller");
const auth = require("../../middlewares/auth");
const allowRoles = require("../../middlewares/role");
const upload = require("../../middlewares/upload");
const validate = require("./validate");

const router = express.Router();

router.post(
  "/Create",
  auth,
  upload("MinutesOfMeeting"),
  validate.createMinutes,
  Controller.CreateMinutes
);

router.get("/GetAll", auth, Controller.GetAllMinutes);
router.get("/GetById/:id", auth, Controller.GetMinutesById);

router.put(
  "/Approve/:id",
  auth,
  allowRoles("admin"),
  Controller.ApproveMinutes
);

router.delete(
  "/Delete/:id",
  auth,
  allowRoles("admin"),
  Controller.DeleteMinutes
);

module.exports = router;
