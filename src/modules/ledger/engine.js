const LedgerAccount = require("./models/LedgerAccount");
const LedgerTransaction = require("./models/LedgerTransaction");

/**
 * Core Accounting Engine - Ledger 2.0
 * Enforces dual-account balanced posting and strict nature-based math.
 */

// ===== ACCOUNT NATURE =====
const getAccountNature = (account) => {
    // Asset & Expense are DEBIT nature accounts (increase on debit)
    if (["Asset", "Expense"].includes(account.accountType)) return "DEBIT";
    // Liability & Income are CREDIT nature accounts (increase on credit)
    return "CREDIT";
};

// ===== APPLY DOUBLE-ENTRY =====
/**
 * Updates an account's balance based on the entry side (DEBIT or CREDIT).
 * @param {Object} account - Mongoose document
 * @param {Number} amount  - Positive value
 * @param {String} side    - "DEBIT" or "CREDIT"
 */
const applyEntry = (account, amount, side) => {
    const nature = getAccountNature(account);

    if (side === "DEBIT") {
        // Debit increases DEBIT-nature (Asset/Expense), decreases CREDIT-nature (Liability/Income)
        if (nature === "DEBIT") account.balance += amount;
        else account.balance -= amount;
    } else if (side === "CREDIT") {
        // Credit decreases DEBIT-nature (Asset/Expense), increases CREDIT-nature (Liability/Income)
        if (nature === "DEBIT") account.balance -= amount;
        else account.balance += amount;
    }
    return account.balance;
};

// ===== TYPE-SPECIFIC VALIDATION =====
/**
 * Validates that accounts are correctly assigned per transaction type.
 * Throws descriptive errors for non-accountant users.
 */
const validateTransactionAccounts = (entryType, debitAcc, creditAcc) => {
    switch (entryType) {

        case "Receipt": {
            // Receipt: External/Customer (DEBIT side, gets receivable reduced) → Cash/Bank (CREDIT side gets increased)
            // Wait — Receipt in proper double-entry:
            //   DEBIT:  Cash/Bank (increases asset)
            //   CREDIT: Customer Receivable / Income source (reduces receivable or recognises income receipt)
            // So for receipt: DEBIT account must be cashequivalent Asset, CREDIT must NOT be cashequivalent
            if (!debitAcc) throw Object.assign(new Error("Receipt requires a destination Cash/Bank account."), { statusCode: 400 });
            if (!creditAcc) throw Object.assign(new Error("Receipt requires a source (payer) account."), { statusCode: 400 });

            if (!debitAcc.cashequivalent || debitAcc.accountType !== "Asset") {
                throw Object.assign(
                    new Error(`Receipt Error: 'To Account' (${debitAcc.name}) must be a Cash/Bank account (Asset with Cash Equivalent = YES). ` +
                        "Receipt must flow INTO cash or bank."),
                    { statusCode: 400 }
                );
            }

            if (creditAcc.cashequivalent && creditAcc.accountType === "Asset") {
                throw Object.assign(
                    new Error(`Receipt Error: 'From Account' (${creditAcc.name}) is a Cash/Bank account. ` +
                        "Receipt must originate from an external/customer ledger, not from another Cash/Bank."),
                    { statusCode: 400 }
                );
            }

            if (["Income", "Expense"].includes(creditAcc.accountType)) {
                throw Object.assign(
                    new Error(`Receipt Error: 'From Account' (${creditAcc.name}) is an ${creditAcc.accountType} category. ` +
                        "Use a Receivable (Asset) or Liability account as the payer. " +
                        "If income is earned, first record an Income entry, then a Receipt."),
                    { statusCode: 400 }
                );
            }
            break;
        }

        case "Payment": {
            // Payment: Cash/Bank (CREDIT, decreases asset) → Vendor/Payee (DEBIT, reduces liability or increases expense)
            // DEBIT: Vendor/Payee (liability reduced or expense recognized)
            // CREDIT: Cash/Bank (asset decreases)
            if (!creditAcc) throw Object.assign(new Error("Payment requires a source Cash/Bank account."), { statusCode: 400 });
            if (!debitAcc) throw Object.assign(new Error("Payment requires a payee/destination account."), { statusCode: 400 });

            if (!creditAcc.cashequivalent || creditAcc.accountType !== "Asset") {
                throw Object.assign(
                    new Error(`Payment Error: 'From Account' (${creditAcc.name}) must be a Cash/Bank account (Asset with Cash Equivalent = YES). ` +
                        "Payment must flow OUT OF cash or bank."),
                    { statusCode: 400 }
                );
            }

            if (debitAcc.cashequivalent && debitAcc.accountType === "Asset") {
                throw Object.assign(
                    new Error(`Payment Error: 'To Account' (${debitAcc.name}) is a Cash/Bank account. ` +
                        "If you need to move money between bank accounts, use a Transfer instead."),
                    { statusCode: 400 }
                );
            }
            break;
        }

        case "Transfer": {
            // Transfer: both accounts must be cashequivalent Assets
            if (!debitAcc || !creditAcc) {
                throw Object.assign(new Error("Transfer requires both a source and destination account."), { statusCode: 400 });
            }
            if (!debitAcc.cashequivalent || debitAcc.accountType !== "Asset") {
                throw Object.assign(
                    new Error(`Transfer Error: 'To Account' (${debitAcc.name}) must be a Cash/Bank account (Cash Equivalent = YES).`),
                    { statusCode: 400 }
                );
            }
            if (!creditAcc.cashequivalent || creditAcc.accountType !== "Asset") {
                throw Object.assign(
                    new Error(`Transfer Error: 'From Account' (${creditAcc.name}) must be a Cash/Bank account (Cash Equivalent = YES).`),
                    { statusCode: 400 }
                );
            }
            break;
        }

        case "Income": {
            // Income (Accrual): Receivable/Person Account (DEBIT) → Income Category (CREDIT)
            // Neither account should be a cash/bank account
            if (!debitAcc) throw Object.assign(new Error("Income entry requires a receivable (person/asset) account."), { statusCode: 400 });
            if (!creditAcc) throw Object.assign(new Error("Income entry requires an income category account."), { statusCode: 400 });

            if (debitAcc.cashequivalent && debitAcc.accountType === "Asset") {
                throw Object.assign(
                    new Error(`Income Error: 'From Account' (${debitAcc.name}) is a Cash/Bank account. ` +
                        "Income accrual entries must use a Receivable (person/customer) account. " +
                        "👉 If money is already received, use a Receipt entry instead."),
                    { statusCode: 400 }
                );
            }

            if (creditAcc.accountType !== "Income") {
                throw Object.assign(
                    new Error(`Income Error: 'Income Category' (${creditAcc.name}) must be an Income type account.`),
                    { statusCode: 400 }
                );
            }
            break;
        }

        case "Expense": {
            // Expense: Expense Category (DEBIT) → Cash/Bank or Payable (CREDIT)
            if (!debitAcc) throw Object.assign(new Error("Expense requires an expense category account."), { statusCode: 400 });
            if (!creditAcc) throw Object.assign(new Error("Expense requires a payment source (cash/bank or payable) account."), { statusCode: 400 });

            if (debitAcc.accountType !== "Expense") {
                throw Object.assign(
                    new Error(`Expense Error: 'Expense Category' (${debitAcc.name}) must be an Expense type account.`),
                    { statusCode: 400 }
                );
            }
            break;
        }

        // Settlement and CreditNote are legacy types — no additional constraint
        default:
            break;
    }
};

// ===== NEGATIVE BALANCE CHECK =====
/**
 * Checks if a cash-equivalent account would go negative after an entry.
 * Returns a warning string or null.
 */
const checkNegativeBalance = (account, amount, side) => {
    if (!account.cashequivalent || account.accountType !== "Asset") return null;

    const nature = getAccountNature(account);
    let projectedBalance = account.balance;

    if (side === "DEBIT") {
        projectedBalance = nature === "DEBIT" ? account.balance + amount : account.balance - amount;
    } else {
        projectedBalance = nature === "DEBIT" ? account.balance - amount : account.balance + amount;
    }

    if (projectedBalance < 0) {
        return `Warning: ${account.name} will have a negative balance of ₹${projectedBalance.toFixed(2)} after this transaction. Current balance: ₹${account.balance.toFixed(2)}.`;
    }
    return null;
};

// ===== CORE JOURNAL POSTING =====
/**
 * Posts a balanced Journal Entry between two accounts.
 * Enforces accounting rules per entryType.
 *
 * Accounting direction convention:
 *   debitAccountId  = account that gets DEBITED
 *   creditAccountId = account that gets CREDITED
 *
 * For Receipt:  debitAccountId = Cash/Bank,  creditAccountId = Customer/Payer
 * For Payment:  debitAccountId = Payee,       creditAccountId = Cash/Bank
 * For Transfer: debitAccountId = To Account,  creditAccountId = From Account
 * For Income:   debitAccountId = Receivable,  creditAccountId = Income Category
 * For Expense:  debitAccountId = Expense Cat, creditAccountId = Payer (Cash/Payable)
 */
const postJournalEntry = async ({
    debitAccountId,
    creditAccountId,
    amount,
    entryType,
    remark,
    createdBy,
    externalSource = null,
    reference = null,
    paymenttype = "Credit",
    skipValidation = false, // Allow bypass for legacy/online transactions
}) => {
    const numericAmount = parseFloat(amount);
    if (isNaN(numericAmount) || numericAmount <= 0) {
        throw Object.assign(new Error("Invalid transaction amount. Amount must be a positive number."), { statusCode: 400 });
    }

    // 1. Fetch Accounts
    const [debitAcc, creditAcc] = await Promise.all([
        debitAccountId ? LedgerAccount.findById(debitAccountId) : null,
        creditAccountId ? LedgerAccount.findById(creditAccountId) : null,
    ]);

    if (!debitAcc && !creditAcc) {
        throw Object.assign(new Error("Invalid transaction: No accounts identified."), { statusCode: 400 });
    }

    if (debitAcc && creditAcc && debitAcc._id.toString() === creditAcc._id.toString()) {
        throw Object.assign(new Error("From and To accounts cannot be the same."), { statusCode: 400 });
    }

    // 2. Type-specific validation
    if (!skipValidation) {
        validateTransactionAccounts(entryType, debitAcc, creditAcc);
    }

    // 3. Capture Balances Before
    const debitBefore = debitAcc ? debitAcc.balance : 0;
    const creditBefore = creditAcc ? creditAcc.balance : 0;

    // 4. Negative Balance Warning (non-blocking, stored in transaction remark)
    let negativeWarning = null;
    if (creditAcc) {
        negativeWarning = checkNegativeBalance(creditAcc, numericAmount, "CREDIT");
    }

    // 5. Apply Balances
    if (debitAcc) applyEntry(debitAcc, numericAmount, "DEBIT");
    if (creditAcc) applyEntry(creditAcc, numericAmount, "CREDIT");

    // 6. Create Transaction Record
    const transaction = new LedgerTransaction({
        debitAccountId: debitAcc?._id || null,
        creditAccountId: creditAcc?._id || null,
        debitBalanceBefore: debitBefore,
        debitBalanceAfter: debitAcc ? debitAcc.balance : 0,
        creditBalanceBefore: creditBefore,
        creditBalanceAfter: creditAcc ? creditAcc.balance : 0,
        amount: numericAmount,
        entryType,
        remark: negativeWarning ? `${remark || ""} [⚠️ ${negativeWarning}]`.trim() : remark,
        externalSource,
        reference,
        paymenttype,
        createdBy,
        date: new Date(),

        // Legacy support fields
        fromAccountId: creditAcc?._id || null,
        toAccountId: debitAcc?._id || null,
        senderBalanceBefore: creditBefore,
        senderBalanceAfter: creditAcc ? creditAcc.balance : 0,
        receiverBalanceBefore: debitBefore,
        receiverBalanceAfter: debitAcc ? debitAcc.balance : 0,
    });

    await Promise.all([
        transaction.save(),
        debitAcc ? debitAcc.save() : Promise.resolve(),
        creditAcc ? creditAcc.save() : Promise.resolve(),
    ]);

    return transaction;
};

// ===== REVERSE TRANSACTION =====
/**
 * Reverses an existing transaction by creating a mirror entry with swapped debit/credit.
 * This creates an audit trail and never deletes the original.
 */
const reverseTransaction = async (transactionId, reversedBy) => {
    const original = await LedgerTransaction.findById(transactionId);
    if (!original) {
        throw Object.assign(new Error("Transaction not found."), { statusCode: 404 });
    }
    if (original.isReversal) {
        throw Object.assign(new Error("Cannot reverse a reversal transaction."), { statusCode: 400 });
    }
    if (original.reversedBy) {
        throw Object.assign(new Error("This transaction has already been reversed."), { statusCode: 400 });
    }

    // Create the mirror/reversal entry (swap debit and credit)
    const reversal = await postJournalEntry({
        debitAccountId: original.creditAccountId,
        creditAccountId: original.debitAccountId,
        amount: original.amount,
        entryType: original.entryType,
        remark: `REVERSAL of Txn #${original._id} | Original: ${original.remark || ""}`,
        createdBy: reversedBy || "System",
        reference: original.reference,
        paymenttype: original.paymenttype,
        skipValidation: true,
    });

    reversal.isReversal = true;
    reversal.originalTransactionId = original._id;
    await reversal.save();

    // Mark original as reversed
    original.reversedBy = reversal._id;
    original.reversedAt = new Date();
    await original.save();

    return reversal;
};

module.exports = {
    postJournalEntry,
    reverseTransaction,
    getAccountNature,
    validateTransactionAccounts,
    checkNegativeBalance,
};
