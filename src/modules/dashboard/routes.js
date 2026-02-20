const express = require("express");
const router = express.Router();
const controller = require("./controller");

router.get("/stats", controller.getDashboardStats);
router.get("/debug", controller.getDebugStats);

module.exports = router;
