const express = require("express");
const Controller = require("./controller");
const apiAuth = require("../../middlewares/apiAuth");
const validate = require("./validation");
const router = express.Router();

router.get("/dashboard", apiAuth, Controller.dashboard);
router.post("/fcm-token", apiAuth, Controller.updateFcmToken);
router.post("/login", Controller.login);

module.exports = router;
