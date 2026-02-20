const Service = require("./service");

// ========== ACCOUNT MANAGEMENT ==========
const renderAddRemovePage = async (req, res, next) => {
    try {
        const accounts = await Service.getAllAccounts();
        res.render("addremoveacct", {
            title: "Add / Remove Account",
            accounts,
            isSuccess: req.query.success === "true",
        });
    } catch (err) {
        next(err);
    }
};

const addAccount = async (req, res, next) => {
    try {
        const {
            name,
            balance,
            accountType,
            remarks,
            bankName,
            branch,
            cashequivalent,
            accountNumber,
            ifscCode,
            upiId,
            personName,
            phone,
            email,
            address,
            gstNumber,
            panNumber,
            defaultType,
        } = req.body;

        const accountData = {
            name,
            accountType,
            balance: balance || 0,
            remarks,
            cashequivalent,
            defaultType: defaultType || "None",
            bankDetails: { bankName, branch, accountNumber, ifscCode, upiId },
            contactInfo: { personName, phone, email, address, gstNumber, panNumber },
            createdBy: req.user?.name || "Admin",
        };

        const account = await Service.createAccount(accountData);

        if (account && defaultType && defaultType !== "None") {
            await Service.setAccountDefaultType(account._id, defaultType);
        }

        if (account) res.redirect("/ledger/addaccount?success=true");
    } catch (err) {
        if (err.statusCode === 400) {
            return res.render("addremoveacct", {
                isSuccess: false,
                message: err.message,
            });
        }
        next(err);
    }
};

const deleteAccount = async (req, res, next) => {
    try {
        const { id } = req.params;
        const deletedAccount = await Service.deleteAccountById(id);

        if (!deletedAccount) {
            req.session.message = {
                type: "danger",
                text: "Account not found!",
            };
            return res.redirect("/ledger/addaccount?success=false");
        }

        req.session.message = {
            type: "success",
            text: `Account "${deletedAccount.name}" deleted successfully!`,
        };
        res.redirect("/ledger/addaccount?success=true");
    } catch (err) {
        next(err);
    }
};

// ========== EXPENSE MANAGEMENT ==========
const renderExpenseEntryPage = async (req, res) => {
    try {
        const GiversAccts = await Service.getAccountsByType([
            "Liability",
            "Asset",
        ]);

        const ReceiversAccts = await Service.getAccountsByType([
            "Expense",
            "Liability",
            "Asset",
        ]);

        const recentEntries = await Service.getRecentTransactions("Expense", 20);

        const { success, error } = req.query;

        res.render("expense-entry", {
            title: "Expense Entry",
            GiversAccts,
            ReceiversAccts,
            transactions: recentEntries,
            success,
            error,
            today: new Date().toISOString().split("T")[0],
        });
    } catch (err) {
        console.error("Error rendering expense entry page:", err);
        res.status(500).send("Error loading page");
    }
};

const addExpenseEntry = async (req, res) => {
    try {
        const { fromAccountId, toAccountId, amount, remark, paymenttype } =
            req.body;

        const transactionData = {
            fromAccountId,
            toAccountId,
            amount,
            remark,
            paymenttype,
            createdBy: req.user?.name || "Admin",
        };

        await Service.createExpenseTransaction(transactionData);

        return res.redirect("/ledger/ExpenseEntry?success=true");
    } catch (err) {
        console.error("Error adding expense entry:", err);
        const errorMsg = encodeURIComponent(err.message);
        res.redirect(`/ledger/ExpenseEntry?success=false&error=${errorMsg}`);
    }
};

// ========== SETTLEMENT MANAGEMENT ==========
const renderSettlementPage = async (req, res) => {
    try {
        const CompanyAcctsaccounts = await Service.getAccountsByType(["Asset"]);

        const Acctstobesettled = await Service.getAccountsByType([
            "Liability",
            "Asset",
        ]);

        const settlements = await Service.getRecentTransactions("Settlement");

        res.render("settlement", {
            title: "Settlement",
            CompanyAcctsaccounts,
            Acctstobesettled,
            settlements,
        });
    } catch (err) {
        console.error("Error rendering settlement page:", err);
        res.status(500).send("Error loading settlement page");
    }
};

const addSettlementEntry = async (req, res) => {
    try {
        const { fromAccountId, toAccountId, type, amount, remark } = req.body;

        const transactionData = {
            fromAccountId,
            toAccountId,
            type,
            amount,
            remark,
            createdBy: req.user?.name || "Admin",
        };

        await Service.createSettlementTransaction(transactionData);

        req.flash("success", "Settlement recorded successfully!");
        res.redirect("/ledger/Settlement");
    } catch (err) {
        console.error("❌ Error adding settlement entry:", err);
        req.flash("error", err.message || "Failed to record settlement!");
        res.redirect("/ledger/Settlement");
    }
};

const renderReportsHome = async (req, res) => {
    try {
        const allAccounts = await Service.getAllAccounts();
        const negativeAccounts = allAccounts.filter((acc) => acc.balance < 0);

        const expenses = await Service.getExpenseSummary();
        const financials = await Service.getFinancialSummary(allAccounts);

        res.render("reportsHome", {
            title: "Ledger Reports",
            negativeAccounts,
            accounts: allAccounts,
            expenses,
            financials,
        });
    } catch (err) {
        console.error("Error rendering reports page:", err);
        res
            .status(500)
            .render("error", { message: "Error loading report summary" });
    }
};

const renderEditAccount = async (req, res, next) => {
    try {
        const { id } = req.params;
        const account = await Service.getAccountById(id);

        if (!account) {
            return res.status(404).render("404", { message: "Account not found" });
        }

        res.render("editaccount", {
            title: "Edit Account",
            account,
        });
    } catch (err) {
        next(err);
    }
};

const updateAccount = async (req, res, next) => {
    try {
        const { id } = req.params;

        const updatedData = {
            name: req.body.name,
            accountType: req.body.accountType,
            balance: req.body.balance,
            remarks: req.body.remarks,
            "bankDetails.bankName": req.body.bankName,
            "bankDetails.branch": req.body.branch,
            "bankDetails.accountNumber": req.body.accountNumber,
            "bankDetails.ifscCode": req.body.ifscCode,
            "bankDetails.upiId": req.body.upiId,
            "contactInfo.personName": req.body.personName,
            "contactInfo.phone": req.body.phone,
            "contactInfo.email": req.body.email,
            "contactInfo.address": req.body.address,
            "contactInfo.gstNumber": req.body.gstNumber,
            "contactInfo.panNumber": req.body.panNumber,
            updatedOn: new Date(),
        };

        await Service.updateAccountById(id, updatedData);

        if (req.body.defaultType) {
            await Service.setAccountDefaultType(id, req.body.defaultType);
        }

        res.redirect("/ledger/addaccount");
    } catch (err) {
        next(err);
    }
};

const viewAccount = async (req, res, next) => {
    try {
        const { id } = req.params;
        const account = await Service.getAccountById(id);

        if (!account) {
            return res.status(404).render("error", { message: "Account not found" });
        }

        res.render("viewaccount", {
            title: "View Account Details",
            account,
        });
    } catch (err) {
        next(err);
    }
};

const setDefaultAccount = async (req, res, next) => {
    try {
        const { id } = req.params;

        const account = await Service.setAccountAsDefault(id);

        req.flash(
            "success",
            `${account.name} has been set as the default Income account.`
        );
        res.redirect("/ledger/addaccount");
    } catch (err) {
        console.error("Error setting default account:", err);
        req.flash("error", err.message || "Something went wrong while setting default account.");
        res.redirect("/ledger/addaccount");
    }
};

const renderSingleAccountLedger = async (req, res) => {
    try {
        const { accountId } = req.params;
        const account = await Service.getAccountById(accountId);

        if (!account) {
            return res.status(404).render("404", { message: "Account not found" });
        }

        const transactions = await Service.getAccountTransactions(accountId);

        const { enriched, totalDebit, totalCredit, closingBalance } =
            Service.enrichTransactionsWithBalance(transactions, accountId);

        res.render("singleAccountLedger", {
            account,
            transactions: enriched,
            totalDebit,
            totalCredit,
            closingBalance,
        });
    } catch (err) {
        console.error("Error loading ledger:", err);
        res.status(500).send("Server Error");
    }
};

const addCreditNoteEntry = async (req, res) => {
    try {
        const {
            fromType,
            fromAccountId,
            externalSource,
            toAccountId,
            amount,
            remark,
        } = req.body;

        const transactionData = {
            fromType,
            fromAccountId,
            externalSource,
            toAccountId,
            amount,
            remark,
            createdBy: req.user?.name || "Admin",
        };

        await Service.createCreditNoteTransaction(transactionData);

        res.redirect("/ledger/CreditNote?success=true");
    } catch (err) {
        console.error("Error adding credit note entry:", err);
        const errorMsg = encodeURIComponent(err.message);
        res.redirect(`/ledger/CreditNote?success=false&error=${errorMsg}`);
    }
};

const renderCreditNote = async (req, res) => {
    try {
        const accounts = await Service.getAllAccounts();

        res.render("creditnote", {
            title: "Add Credit Note",
            accounts,
            success: req.query.success === "true",
            error: req.query.error || null,
        });
    } catch (err) {
        console.error("Error rendering credit note page:", err);
        res.render("creditnote", { error: "Unable to load accounts." });
    }
};

module.exports = {
    addSettlementEntry,
    renderSettlementPage,
    addAccount,
    renderAddRemovePage,
    deleteAccount,
    addExpenseEntry,
    renderExpenseEntryPage,
    renderEditAccount,
    updateAccount,
    viewAccount,
    setDefaultAccount,
    renderReportsHome,
    addCreditNoteEntry,
    renderSingleAccountLedger,
    renderCreditNote,
};
