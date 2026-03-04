const Joi = require("joi");

// ==================== ACCOUNT VALIDATION ====================
const validateAccountSchema = (req, res, next) => {
    const schema = Joi.object({
        name: Joi.string().trim().min(3).required(),
        accountType: Joi.string()
            .valid("Asset", "Liability", "Income", "Expense")
            .required(),
        balance: Joi.number().default(0),
        remarks: Joi.string().trim().allow("", null).optional(),
        cashequivalent: Joi.boolean().optional(),

        // Bank details
        bankName: Joi.string().trim().allow("", null).optional(),
        branch: Joi.string().trim().allow("", null).optional(),
        accountNumber: Joi.string().trim().allow("", null).optional(),
        ifscCode: Joi.string().trim().allow("", null).optional(),
        upiId: Joi.string().trim().allow("", null).optional(),

        // Contact info
        personName: Joi.string().trim().allow("", null).optional(),
        phone: Joi.string().trim().allow("", null).optional(),
        email: Joi.string().trim().email().allow("", null).optional(),
        address: Joi.string().trim().allow("", null).optional(),
        gstNumber: Joi.string().trim().allow("", null).optional(),
        panNumber: Joi.string().trim().allow("", null).optional(),
        defaultType: Joi.string()
            .valid("None", "OnlineCollection", "GeneralDonation", "GeneralIncome")
            .optional(),
    });

    const { error } = schema.validate(req.body, { abortEarly: false });
    if (error) {
        return res.status(400).json({
            success: false,
            message: "Validation error",
            errors: error.details.map((err) => err.message),
        });
    }

    // Custom: Income accounts must not represent people
    if (req.body.accountType === "Income" && req.body.name) {
        const forbiddenTerms = ["Tenant", "Person", "Mr.", "Ms.", "Mrs.", "M/s"];
        const name = req.body.name.toLowerCase();
        const found = forbiddenTerms.find((term) =>
            name.includes(term.toLowerCase())
        );
        if (found) {
            return res.status(400).json({
                success: false,
                message: "Accounting Violation",
                errors: [
                    `Income accounts must represent revenue sources, not people (e.g., '${found}' detected). ` +
                    "Please use a Receivable account (Asset) for the person instead.",
                ],
            });
        }
    }

    next();
};

// ==================== RECEIPT VALIDATION ====================
/**
 * Receipt: fromAccountId = payer (non-cash), toAccountId = cash/bank
 */
const validateReceiptSchema = (req, res, next) => {
    const schema = Joi.object({
        fromAccountId: Joi.string().required().messages({
            "any.required": "Payer account (From Account) is required.",
        }),
        toAccountId: Joi.string().required().messages({
            "any.required": "Cash/Bank account (To Account) is required.",
        }),
        amount: Joi.number().positive().required(),
        remark: Joi.string().trim().allow("", null).optional(),
        paymenttype: Joi.string().valid("Cash", "Online", "Cheque", "UPI", "NEFT", "RTGS").optional(),
        createdBy: Joi.string().trim().allow("", null).optional(),
    });

    const { error } = schema.validate(req.body, { abortEarly: false });
    if (error) {
        return res.status(400).json({
            success: false,
            message: "Receipt Validation Error",
            errors: error.details.map((e) => e.message),
        });
    }

    if (req.body.fromAccountId === req.body.toAccountId) {
        return res.status(400).json({
            success: false,
            message: "Receipt Error",
            errors: ["From Account and To Account cannot be the same."],
        });
    }

    next();
};

// ==================== PAYMENT VALIDATION ====================
/**
 * Payment: fromAccountId = cash/bank, toAccountId = payee (non-cash)
 */
const validatePaymentSchema = (req, res, next) => {
    const schema = Joi.object({
        fromAccountId: Joi.string().required().messages({
            "any.required": "Cash/Bank account (From Account) is required.",
        }),
        toAccountId: Joi.string().required().messages({
            "any.required": "Payee account (To Account) is required.",
        }),
        amount: Joi.number().positive().required(),
        remark: Joi.string().trim().allow("", null).optional(),
        paymenttype: Joi.string().valid("Cash", "Online", "Cheque", "UPI", "NEFT", "RTGS").optional(),
        createdBy: Joi.string().trim().allow("", null).optional(),
    });

    const { error } = schema.validate(req.body, { abortEarly: false });
    if (error) {
        return res.status(400).json({
            success: false,
            message: "Payment Validation Error",
            errors: error.details.map((e) => e.message),
        });
    }

    if (req.body.fromAccountId === req.body.toAccountId) {
        return res.status(400).json({
            success: false,
            message: "Payment Error",
            errors: ["From Account and To Account cannot be the same."],
        });
    }

    next();
};

// ==================== TRANSFER VALIDATION ====================
/**
 * Transfer: both accounts must be cash-equivalent assets
 */
const validateTransferSchema = (req, res, next) => {
    const schema = Joi.object({
        fromAccountId: Joi.string().required().messages({
            "any.required": "Source Cash/Bank account (From Account) is required.",
        }),
        toAccountId: Joi.string().required().messages({
            "any.required": "Destination Cash/Bank account (To Account) is required.",
        }),
        amount: Joi.number().positive().required(),
        remark: Joi.string().trim().allow("", null).optional(),
        createdBy: Joi.string().trim().allow("", null).optional(),
    });

    const { error } = schema.validate(req.body, { abortEarly: false });
    if (error) {
        return res.status(400).json({
            success: false,
            message: "Transfer Validation Error",
            errors: error.details.map((e) => e.message),
        });
    }

    if (req.body.fromAccountId === req.body.toAccountId) {
        return res.status(400).json({
            success: false,
            message: "Transfer Error",
            errors: ["Source and Destination accounts cannot be the same."],
        });
    }

    next();
};

// ==================== INCOME (ACCRUAL) VALIDATION ====================
/**
 * Income: fromAccountId = receivable (asset), toAccountId = income category
 */
const validateIncomeSchema = (req, res, next) => {
    const schema = Joi.object({
        fromAccountId: Joi.string().required().messages({
            "any.required": "Receivable/Person account (From Account) is required.",
        }),
        toAccountId: Joi.string().required().messages({
            "any.required": "Income Category account (To Account) is required.",
        }),
        amount: Joi.number().positive().required(),
        remark: Joi.string().trim().allow("", null).optional(),
        createdBy: Joi.string().trim().allow("", null).optional(),
    });

    const { error } = schema.validate(req.body, { abortEarly: false });
    if (error) {
        return res.status(400).json({
            success: false,
            message: "Income Validation Error",
            errors: error.details.map((e) => e.message),
        });
    }

    next();
};

// ==================== EXPENSE VALIDATION ====================
const validateExpenseSchema = (req, res, next) => {
    const schema = Joi.object({
        fromAccountId: Joi.string().required(),
        toAccountId: Joi.string().required(),
        amount: Joi.number().positive().required(),
        remark: Joi.string().trim().allow("", null).optional(),
        paymenttype: Joi.string().valid("Cash", "Credit").optional(),
        createdBy: Joi.string().trim().allow("", null).optional(),
    });

    const { error } = schema.validate(req.body, { abortEarly: false });
    if (error) {
        return res.status(400).json({
            success: false,
            message: "Validation error",
            errors: error.details.map((err) => err.message),
        });
    }
    next();
};

// ==================== SETTLEMENT VALIDATION (Legacy) ====================
const validateSettlementSchema = (req, res, next) => {
    const schema = Joi.object({
        fromAccountId: Joi.string().required(),
        toAccountId: Joi.string().required(),
        type: Joi.string().valid("Payment", "Receipt").required(),
        amount: Joi.number().positive().required(),
        remark: Joi.string().trim().allow("", null).optional(),
        createdBy: Joi.string().trim().allow("", null).optional(),
    });

    const { error } = schema.validate(req.body, { abortEarly: false });
    if (error) {
        return res.status(400).json({
            success: false,
            message: "Validation error",
            errors: error.details.map((err) => err.message),
        });
    }
    next();
};

// ==================== CREDIT NOTE VALIDATION (Legacy) ====================
const validateCreditNoteSchema = (req, res, next) => {
    const schema = Joi.object({
        fromType: Joi.string().valid("internal", "external").required(),
        fromAccountId: Joi.when("fromType", {
            is: "internal",
            then: Joi.string().required(),
            otherwise: Joi.string().allow("", null).optional(),
        }),
        externalSource: Joi.when("fromType", {
            is: "external",
            then: Joi.string().trim().required(),
            otherwise: Joi.string().allow("", null).optional(),
        }),
        toAccountId: Joi.string().required(),
        amount: Joi.number().positive().required(),
        remark: Joi.string().trim().allow("", null).optional(),
        createdBy: Joi.string().trim().allow("", null).optional(),
    });

    const { error } = schema.validate(req.body, { abortEarly: false });
    if (error) {
        return res.status(400).json({
            success: false,
            message: "Validation error",
            errors: error.details.map((err) => err.message),
        });
    }
    next();
};

module.exports = {
    validateAccountSchema,
    validateReceiptSchema,
    validatePaymentSchema,
    validateTransferSchema,
    validateIncomeSchema,
    validateExpenseSchema,
    validateSettlementSchema,
    validateCreditNoteSchema,
};
