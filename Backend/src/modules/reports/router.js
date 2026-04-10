const express = require("express");
const router = express.Router();
const controller = require("./controller");
const auth = require("../../middlewares/auth");

router.use(auth);

router.get("/ledger", controller.getLedgerReport);
router.get("/income", controller.getIncomeReport);
router.get("/expense", controller.getExpenseReport);
router.get("/profit-loss", controller.getProfitLossReport);

module.exports = router;
