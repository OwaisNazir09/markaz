const Joi = require("joi");

// Account validation
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
        defaultType: Joi.string().valid("None", "OnlineCollection", "GeneralDonation", "GeneralIncome").optional(),
    });

    const { error } = schema.validate(req.body, { abortEarly: false });

    if (error) {
        return res.status(400).json({
            success: false,
            message: "Validation error",
            errors: error.details.map((err) => err.message),
        });
    }

    // Custom check: Income accounts must not represent people
    if (req.body.accountType === "Income" && req.body.name) {
        const forbiddenTerms = ["Tenant", "Person", "Mr.", "Ms.", "Mrs.", "M/s"];
        const name = req.body.name.toLowerCase();
        const found = forbiddenTerms.find(term => name.includes(term.toLowerCase()));

        if (found) {
            return res.status(400).json({
                success: false,
                message: "Accounting Violation",
                errors: [`Income accounts must represent revenue sources, not people (e.g., '${found}' detected). Please use a Receivable account (Asset) for the person instead.`],
            });
        }
    }

    next();
};

// Expense entry validation
const validateExpenseSchema = (req, res, next) => {
    const schema = Joi.object({
        fromAccountId: Joi.string().required(),
        toAccountId: Joi.string().required(),
        amount: Joi.number().positive().required(),
        remark: Joi.string().trim().allow("", null).optional(),
        paymenttype: Joi.string().valid("Cash", "Credit").optional(),
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

// Settlement validation
const validateSettlementSchema = (req, res, next) => {
    const schema = Joi.object({
        fromAccountId: Joi.string().required(),
        toAccountId: Joi.string().required(),
        type: Joi.string().valid("Payment", "Receipt").required(),
        amount: Joi.number().positive().required(),
        remark: Joi.string().trim().allow("", null).optional(),
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

// Credit note validation
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
    validateExpenseSchema,
    validateSettlementSchema,
    validateCreditNoteSchema,
};
