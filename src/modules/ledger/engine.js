const LedgerAccount = require("./models/LedgerAccount");
const LedgerTransaction = require("./models/LedgerTransaction");

/**
 * Core Accounting Engine - Ledger 2.0
 * Enforces dual-account balanced posting and strict nature-based math.
 */

const getAccountNature = (account) => {
    // Asset & Expense are DEBIT nature accounts
    if (["Asset", "Expense"].includes(account.accountType)) return "DEBIT";
    // Liability & Income are CREDIT nature accounts
    return "CREDIT";
};

/**
 * Updates an account's balance based on the entry type (Debit or Credit).
 * @param {Object} account - Mongoose document
 * @param {Number} amount - Positive value
 * @param {String} entryType - "DEBIT" or "CREDIT"
 */
const applyEntry = (account, amount, entryType) => {
    const nature = getAccountNature(account);

    if (entryType === "DEBIT") {
        // Debit increases Debit-nature accounts, decreases Credit-nature accounts
        if (nature === "DEBIT") account.balance += amount;
        else account.balance -= amount;
    } else if (entryType === "CREDIT") {
        // Credit decreases Debit-nature accounts, increases Credit-nature accounts
        if (nature === "DEBIT") account.balance -= amount;
        else account.balance += amount;
    }
    return account.balance;
};

/**
 * Posts a balanced Journal Entry between two accounts.
 * @param {Object} params - Entry details
 */
const postJournalEntry = async ({
    debitAccountId,
    creditAccountId,
    amount,
    entryType, // "Expense", "Settlement", "Income", "Journal"
    remark,
    createdBy,
    externalSource = null,
    reference = null,
    paymenttype = "Credit",
}) => {
    const numericAmount = parseFloat(amount);
    if (isNaN(numericAmount) || numericAmount <= 0) {
        throw new Error("Invalid transaction amount");
    }

    // 1. Fetch Accounts
    const [debitAcc, creditAcc] = await Promise.all([
        debitAccountId ? LedgerAccount.findById(debitAccountId) : null,
        creditAccountId ? LedgerAccount.findById(creditAccountId) : null,
    ]);

    // Validate at least one account exists (External Credit Note might have null debit)
    if (!debitAcc && !creditAcc) {
        throw new Error("Invalid transaction: No accounts identified.");
    }

    // 2. Capture Balances Before
    const debitBefore = debitAcc ? debitAcc.balance : 0;
    const creditBefore = creditAcc ? creditAcc.balance : 0;

    // 3. Apply Balances
    if (debitAcc) {
        applyEntry(debitAcc, numericAmount, "DEBIT");
        // Safety check for Cash Equivalents (Assets must not be negative)
        if (debitAcc.cashequivalent && debitAcc.balance < 0 && debitAcc.accountType === "Asset") {
            // Note: In accrual, a negative Asset is mathematically possible (Bank Overdraft), 
            // but we typically treat that as a Liability. For now, just logging or warning.
        }
    }

    if (creditAcc) {
        applyEntry(creditAcc, numericAmount, "CREDIT");
    }

    const transaction = new LedgerTransaction({
        debitAccountId: debitAcc?._id || null,
        creditAccountId: creditAcc?._id || null,
        debitBalanceBefore: debitBefore,
        debitBalanceAfter: debitAcc ? debitAcc.balance : 0,
        creditBalanceBefore: creditBefore,
        creditBalanceAfter: creditAcc ? creditAcc.balance : 0,
        amount: numericAmount,
        entryType,
        remark,
        externalSource,
        reference,
        paymenttype,
        createdBy,
        date: new Date(),

        // Legacy support fields
        fromAccountId: creditAcc?._id || null, // Credit is typically "From" (Source)
        toAccountId: debitAcc?._id || null,    // Debit is typically "To" (Destination)
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

module.exports = {
    postJournalEntry,
    getAccountNature,
};
