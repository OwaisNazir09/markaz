const express = require("express");
const router = express.Router();
const controller = require("./controller");
const Service = require("./service");
const {
  validateAccountSchema,
  validateExpenseSchema,
  validateSettlementSchema,
  validateCreditNoteSchema,
} = require("./validate");

// ========== JSON API ROUTES (for React frontend) ==========

// Account API routes
router.get("/accounts", async (req, res) => {
  try {
    const page = parseInt(req.query.page);
    const limit = parseInt(req.query.limit);
    const search = req.query.search;
    const accountType = req.query.accountType;

    const filter = {};
    if (accountType) {
      filter.accountType = accountType;
    }

    const { data, total } = await Service.getAllAccounts(filter, page, limit, search);

    res.json({
      success: true,
      data,
      pagination: {
        total,
        page: page || 1,
        limit: limit || total,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get("/accounts/:id", async (req, res) => {
  try {
    const account = await Service.getAccountById(req.params.id);
    if (!account) {
      return res
        .status(404)
        .json({ success: false, message: "Account not found" });
    }
    res.json({ success: true, data: account });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post(
  "/accounts/create",
  validateAccountSchema,
  async (req, res, next) => {
    try {
      const account = await Service.createAccount(req.body);
      res
        .status(201)
        .json({
          success: true,
          data: account,
          message: "Account created successfully",
        });
    } catch (error) {
      // Forward errors to centralized error handler
      return next(error);
    }
  },
);

router.put("/accounts/:id", async (req, res) => {
  try {
    const account = await Service.updateAccountById(req.params.id, req.body);
    if (!account) {
      return res
        .status(404)
        .json({ success: false, message: "Account not found" });
    }
    res.json({
      success: true,
      data: account,
      message: "Account updated successfully",
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.delete("/accounts/:id", async (req, res) => {
  try {
    const account = await Service.deleteAccountById(req.params.id);
    if (!account) {
      return res
        .status(404)
        .json({ success: false, message: "Account not found" });
    }
    res.json({
      success: true,
      data: account,
      message: "Account deleted successfully",
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post("/accounts/:id/set-default", async (req, res) => {
  try {
    const account = await Service.setAccountAsDefault(req.params.id);
    res.json({
      success: true,
      data: account,
      message: "Default account set successfully",
    });
  } catch (error) {
    res
      .status(error.statusCode || 500)
      .json({ success: false, message: error.message });
  }
});

// Transaction API routes
router.get("/transactions/account/:accountId", async (req, res) => {
  try {
    const page = parseInt(req.query.page);
    const limit = parseInt(req.query.limit);
    const { data, total } = await Service.getAccountTransactions(
      req.params.accountId,
      page,
      limit,
    );
    res.json({
      success: true,
      data,
      pagination: {
        total,
        page: page || 1,
        limit: limit || total,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post("/expenses/create", async (req, res) => {
  try {
    const transaction = await Service.createExpenseTransaction(req.body);
    res
      .status(201)
      .json({
        success: true,
        data: transaction,
        message: "Expense recorded successfully",
      });
  } catch (error) {
    res
      .status(error.statusCode || 500)
      .json({ success: false, message: error.message });
  }
});

router.post("/settlements/create", async (req, res) => {
  try {
    const transaction = await Service.createSettlementTransaction(req.body);
    res
      .status(201)
      .json({
        success: true,
        data: transaction,
        message: "Settlement recorded successfully",
      });
  } catch (error) {
    res
      .status(error.statusCode || 500)
      .json({ success: false, message: error.message });
  }
});

router.post("/credit-notes/create", async (req, res) => {
  try {
    const transaction = await Service.createCreditNoteTransaction(req.body);
    res
      .status(201)
      .json({
        success: true,
        data: transaction,
        message: "Credit note recorded successfully",
      });
  } catch (error) {
    res
      .status(error.statusCode || 500)
      .json({ success: false, message: error.message });
  }
});

// Reports API routes
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

// ========== LEGACY VIEW-BASED ROUTES (for server-rendered pages) ==========

// Account routes
router.get("/addaccount", controller.renderAddRemovePage);
router.post("/addaccount", controller.addAccount);
router.get("/deleteaccount/:id", controller.deleteAccount);
router.get("/editaccount/:id", controller.renderEditAccount);
router.post("/editaccount/:id", controller.updateAccount);
router.get("/viewaccount/:id", controller.viewAccount);
router.post("/setDefaultAccount/:id", controller.setDefaultAccount);

// Expense routes
router.get("/ExpenseEntry", controller.renderExpenseEntryPage);
router.post("/ExpenseEntry/add", controller.addExpenseEntry);

// Settlement routes
router.get("/Settlement", controller.renderSettlementPage);
router.post("/Settlement/add", controller.addSettlementEntry);

// Report routes
router.get("/reports", controller.renderReportsHome);
router.get("/reports/account/:accountId", controller.renderSingleAccountLedger);

// Credit note routes
router.get("/CreditNote", controller.renderCreditNote);
router.post("/addCreditNote", controller.addCreditNoteEntry);

module.exports = router;
