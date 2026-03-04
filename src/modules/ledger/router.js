const express = require("express");
const router = express.Router();
const controller = require("./controller");
const Service = require("./service");
const {
  validateAccountSchema,
  validateExpenseSchema,
  validateSettlementSchema,
  validateCreditNoteSchema,
  validateReceiptSchema,
  validatePaymentSchema,
  validateTransferSchema,
  validateIncomeSchema,
} = require("./validate");

// ========== JSON API ROUTES (for React frontend) ==========

// ---------- Account API routes ----------

router.get("/accounts", async (req, res) => {
  try {
    const page = parseInt(req.query.page);
    const limit = parseInt(req.query.limit);
    const search = req.query.search;
    const accountType = req.query.accountType;
    const cashequivalent = req.query.cashequivalent;

    const filter = {};
    if (accountType) filter.accountType = accountType;
    if (cashequivalent === "true") filter.cashequivalent = true;

    const { data, total } = await Service.getAllAccounts(filter, page, limit, search);
    res.json({
      success: true,
      data,
      pagination: { total, page: page || 1, limit: limit || total },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get("/accounts/:id", async (req, res) => {
  try {
    const account = await Service.getAccountById(req.params.id);
    if (!account) {
      return res.status(404).json({ success: false, message: "Account not found" });
    }
    res.json({ success: true, data: account });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post("/accounts/create", validateAccountSchema, async (req, res, next) => {
  try {
    const account = await Service.createAccount(req.body);
    res.status(201).json({
      success: true,
      data: account,
      message: "Account created successfully",
    });
  } catch (error) {
    return next(error);
  }
});

router.put("/accounts/:id", async (req, res) => {
  try {
    const account = await Service.updateAccountById(req.params.id, req.body);
    if (!account) {
      return res.status(404).json({ success: false, message: "Account not found" });
    }
    res.json({ success: true, data: account, message: "Account updated successfully" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.delete("/accounts/:id", async (req, res) => {
  try {
    const account = await Service.deleteAccountById(req.params.id);
    if (!account) {
      return res.status(404).json({ success: false, message: "Account not found" });
    }
    res.json({ success: true, data: account, message: "Account deleted successfully" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post("/accounts/:id/set-default", async (req, res) => {
  try {
    const account = await Service.setAccountAsDefault(req.params.id);
    res.json({ success: true, data: account, message: "Default account set successfully" });
  } catch (error) {
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
});

// ---------- Transaction API routes ----------

router.get("/transactions/account/:accountId", async (req, res) => {
  try {
    const page = parseInt(req.query.page);
    const limit = parseInt(req.query.limit);
    const search = req.query.search;
    const { data, total } = await Service.getAccountTransactions(
      req.params.accountId,
      page,
      limit,
      search
    );
    res.json({
      success: true,
      data,
      pagination: { total, page: page || 1, limit: limit || total },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// --- Receipt ---
router.post("/receipts/create", validateReceiptSchema, async (req, res) => {
  try {
    const transaction = await Service.createReceiptTransaction({
      ...req.body,
      createdBy: req.user?.name || req.body.createdBy || "Admin",
    });
    res.status(201).json({
      success: true,
      data: transaction,
      message: "Receipt recorded successfully",
    });
  } catch (error) {
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
});

// --- Payment ---
router.post("/payments/create", validatePaymentSchema, async (req, res) => {
  try {
    const transaction = await Service.createPaymentTransaction({
      ...req.body,
      createdBy: req.user?.name || req.body.createdBy || "Admin",
    });
    res.status(201).json({
      success: true,
      data: transaction,
      message: "Payment recorded successfully",
    });
  } catch (error) {
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
});

// --- Transfer ---
router.post("/transfers/create", validateTransferSchema, async (req, res) => {
  try {
    const transaction = await Service.createTransferTransaction({
      ...req.body,
      createdBy: req.user?.name || req.body.createdBy || "Admin",
    });
    res.status(201).json({
      success: true,
      data: transaction,
      message: "Transfer recorded successfully",
    });
  } catch (error) {
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
});

// --- Income (Accrual) ---
router.post("/income/create", validateIncomeSchema, async (req, res) => {
  try {
    const transaction = await Service.createIncomeTransaction({
      ...req.body,
      createdBy: req.user?.name || req.body.createdBy || "Admin",
    });
    res.status(201).json({
      success: true,
      data: transaction,
      message: "Income recorded successfully",
    });
  } catch (error) {
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
});

// --- Expense ---
router.post("/expenses/create", async (req, res) => {
  try {
    const transaction = await Service.createExpenseTransaction({
      ...req.body,
      createdBy: req.user?.name || req.body.createdBy || "Admin",
    });
    res.status(201).json({
      success: true,
      data: transaction,
      message: "Expense recorded successfully",
    });
  } catch (error) {
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
});

// --- Settlement (Legacy) ---
router.post("/settlements/create", async (req, res) => {
  try {
    const transaction = await Service.createSettlementTransaction({
      ...req.body,
      createdBy: req.user?.name || req.body.createdBy || "Admin",
    });
    res.status(201).json({
      success: true,
      data: transaction,
      message: "Settlement recorded successfully",
    });
  } catch (error) {
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
});

// --- Credit Note (Legacy Income) ---
router.post("/credit-notes/create", async (req, res) => {
  try {
    const transaction = await Service.createCreditNoteTransaction({
      ...req.body,
      createdBy: req.user?.name || req.body.createdBy || "Admin",
    });
    res.status(201).json({
      success: true,
      data: transaction,
      message: "Credit note recorded successfully",
    });
  } catch (error) {
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
});

// --- Reverse Transaction (Audit Safe) ---
router.post("/transactions/:id/reverse", async (req, res) => {
  try {
    const reversedBy = req.user?.name || req.body.reversedBy || "Admin";
    const reversal = await Service.reverseTransactionService(req.params.id, reversedBy);
    res.status(201).json({
      success: true,
      data: reversal,
      message: "Transaction reversed successfully. Original transaction preserved for audit.",
    });
  } catch (error) {
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
});

// ---------- Reports API routes ----------

router.get("/reports/financial-summary", async (req, res) => {
  try {
    const { data: accounts } = await Service.getAllAccounts();
    const financials = await Service.getFinancialSummary(accounts);
    res.json({ success: true, data: financials });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get("/reports/expense-summary", async (req, res) => {
  try {
    const expenses = await Service.getExpenseSummary();
    res.json({ success: true, data: expenses });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get("/reports/health", async (req, res) => {
  try {
    const alerts = await Service.getLedgerHealthAlerts();
    res.json({ success: true, data: alerts, count: alerts.length });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ========== LEGACY VIEW-BASED ROUTES (for server-rendered pages) ==========

router.get("/addaccount", controller.renderAddRemovePage);
router.post("/addaccount", controller.addAccount);
router.get("/deleteaccount/:id", controller.deleteAccount);
router.get("/editaccount/:id", controller.renderEditAccount);
router.post("/editaccount/:id", controller.updateAccount);
router.get("/viewaccount/:id", controller.viewAccount);
router.post("/setDefaultAccount/:id", controller.setDefaultAccount);

router.get("/ExpenseEntry", controller.renderExpenseEntryPage);
router.post("/ExpenseEntry/add", controller.addExpenseEntry);

router.get("/Settlement", controller.renderSettlementPage);
router.post("/Settlement/add", controller.addSettlementEntry);

router.get("/reports", controller.renderReportsHome);
router.get("/reports/account/:accountId", controller.renderSingleAccountLedger);

router.get("/CreditNote", controller.renderCreditNote);
router.post("/addCreditNote", controller.addCreditNoteEntry);

module.exports = router;
