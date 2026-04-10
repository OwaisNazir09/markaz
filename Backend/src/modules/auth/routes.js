const express = require("express");
const Controller = require("./controller");
const auth = require("../../middlewares/auth");
const validate = require("./validation");
const router = express.Router();

router.post("/login", validate.login, Controller.Login);

module.exports = router;
