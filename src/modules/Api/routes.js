const express = require("express");
const Controller = require("./controller");
const apiAuth = require("../../middlewares/apiAuth");
const upload = require("../../middlewares/upload");
const validate = require("./validation");
const router = express.Router();

router.get("/dashboard", apiAuth, Controller.dashboard);

router.get("/updateNotificationRead/:id", apiAuth,Controller.updateNotificationRead)
router.post("/fcm-token", apiAuth, Controller.updateFcmToken);
router.post("/login", Controller.login);


router.get("/minutes", apiAuth, Controller.getMinutes);
router.post("/minutes/upload", apiAuth, upload("MinutesOfMeeting"), Controller.uploadMinutesDoc);

module.exports = router;

