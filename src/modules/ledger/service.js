const LedgerAccount = require("./models/LedgerAccount");
const LedgerTransaction = require("./models/LedgerTransaction");
const { postJournalEntry, reverseTransaction } = require("./engine");

// ========== UTILITIES ==========

// ========== ACCOUNT SERVICES ==========
const getAllAccounts = async (filter = {}, page, limit, search) => {
  if (search) {
    filter.$or = [
      { name: { $regex: search, $options: "i" } },
      { accountType: { $regex: search, $options: "i" } },
    ];
  }
  const query = LedgerAccount.find(filter).sort({ name: 1 });
  if (page && limit) {
    query.skip((page - 1) * limit).limit(limit);
  }
  const data = await query.lean();
  const total = await LedgerAccount.countDocuments(filter);
  return { data, total };
};

const getAccountById = async (id) => {
  const account = await LedgerAccount.findById(id).lean();
  if (!account) return null;

  const { getAccountNature } = require("./engine");
  const nature = getAccountNature(account);

  const allTransactionsQuery = await LedgerTransaction.find({
    $or: [
      { debitAccountId: id },
      { creditAccountId: id },
      { fromAccountId: id },
      { toAccountId: id },
    ],
  }).lean();

  const { totalDebit, totalCredit } = enrichTransactionsWithBalance(
    allTransactionsQuery,
    id
  );

  // NATURE AWARE BALANCE:
  // Asset/Expense: In (Debit) - Out (Credit)
  // Liability/Income: In (Credit) - Out (Debit)
  const calculatedBalance =
    nature === "DEBIT"
      ? totalDebit - totalCredit
      : totalCredit - totalDebit;

  return {
    ...account,
    totalDebit,
    totalCredit,
    calculatedBalance,
  };
};

const prepareAccountData = (data) => {
  const accountData = { ...data };

  const bankFields = ["bankName", "branch", "accountNumber", "ifscCode", "upiId"];
  const contactFields = [
    "personName",
    "phone",
    "email",
    "address",
    "gstNumber",
    "panNumber",
  ];

  const hasBankFields = bankFields.some((f) => accountData[f] !== undefined);
  const hasContactFields = contactFields.some((f) => accountData[f] !== undefined);

  if (hasBankFields && !accountData.bankDetails) {
    accountData.bankDetails = {
      bankName: accountData.bankName || null,
      branch: accountData.branch || null,
      accountNumber: accountData.accountNumber || null,
      ifscCode: accountData.ifscCode || null,
      upiId: accountData.upiId || null,
    };
  }

  if (hasContactFields && !accountData.contactInfo) {
    accountData.contactInfo = {
      personName: accountData.personName || null,
      phone: accountData.phone || null,
      email: accountData.email || null,
      address: accountData.address || null,
      gstNumber: accountData.gstNumber || null,
      panNumber: accountData.panNumber || null,
    };
  }

  bankFields.forEach((f) => delete accountData[f]);
  contactFields.forEach((f) => delete accountData[f]);

  return accountData;
};

const createAccount = async (accountData) => {
  const structuredData = prepareAccountData(accountData);

  const exists = await LedgerAccount.findOne({ name: structuredData.name });
  if (exists) {
    const error = new Error("Account already exists!");
    error.statusCode = 400;
    throw error;
  }
  const account = await LedgerAccount.create(structuredData);

  if (structuredData.defaultType && structuredData.defaultType !== "None") {
    await setAccountDefaultType(account._id, structuredData.defaultType);
  }

  return account;
};

const updateAccountById = async (id, updateData) => {
  const structuredData = prepareAccountData(updateData);
  const account = await LedgerAccount.findByIdAndUpdate(id, structuredData, {
    new: true,
  });

  if (account && updateData.defaultType) {
    await setAccountDefaultType(id, updateData.defaultType);
  }

  return account;
};

const deleteAccountById = async (id) => {
  return await LedgerAccount.findByIdAndDelete(id);
};

const setAccountDefaultType = async (id, defaultType) => {
  const account = await LedgerAccount.findById(id);
  if (!account) {
    const error = new Error("Account not found!");
    error.statusCode = 404;
    throw error;
  }

  if (defaultType === "OnlineCollection" && account.accountType !== "Asset") {
    const error = new Error("Online Collection must be an Asset account.");
    error.statusCode = 400;
    throw error;
  }
  if (defaultType === "GeneralDonation" && account.accountType !== "Income") {
    const error = new Error("General Donation must be an Income account.");
    error.statusCode = 400;
    throw error;
  }
  if (defaultType === "GeneralIncome" && account.accountType !== "Income") {
    const error = new Error("General Income must be an Income account.");
    error.statusCode = 400;
    throw error;
  }

  if (defaultType !== "None") {
    await LedgerAccount.updateMany(
      { defaultType: defaultType },
      { $set: { defaultType: "None" } }
    );
  }

  account.defaultType = defaultType;
  if (defaultType === "GeneralIncome") account.isDefault = true;
  else account.isDefault = false;

  return await account.save();
};

const getDefaultAccount = async (defaultType) => {
  return await LedgerAccount.findOne({ defaultType });
};

const setAccountAsDefault = async (id) => {
  return await setAccountDefaultType(id, "GeneralIncome");
};

const getAccountsByType = async (types) => {
  return await LedgerAccount.find({
    accountType: { $in: types },
  })
    .select("_id name accountType balance cashequivalent")
    .lean();
};

// ========== ONLINE TRANSACTION (Razorpay/External) ==========
const recordOnlineTransaction = async (
  amount,
  transactionId,
  description,
  createdBy = "System"
) => {
  let assetAccount = await getDefaultAccount("OnlineCollection");
  let incomeAccount = await getDefaultAccount("GeneralDonation");

  if (!assetAccount) {
    console.log("Auto-creating default Online Collection account...");
    assetAccount = await LedgerAccount.create({
      name: "Online Collection (Auto)",
      accountType: "Asset",
      balance: 0,
      cashequivalent: true,
      defaultType: "OnlineCollection",
      createdBy: "System",
    });
  }

  if (!incomeAccount) {
    console.log("Auto-creating default General Donation account...");
    incomeAccount = await LedgerAccount.create({
      name: "General Donation (Auto)",
      accountType: "Income",
      balance: 0,
      defaultType: "GeneralDonation",
      createdBy: "System",
    });
  }

  // Correct double-entry for online receipt:
  //   DEBIT:  Cash/Bank Asset (Online Collection) — asset increases
  //   CREDIT: Income Account (General Donation)   — income increases
  // This is a Receipt + Income in one step (cash received directly)
  return await postJournalEntry({
    debitAccountId: assetAccount._id,
    creditAccountId: incomeAccount._id,
    amount: parseFloat(amount),
    entryType: "Receipt",
    paymenttype: "Online",
    externalSource: "Razorpay",
    reference: transactionId,
    remark: description,
    createdBy,
    skipValidation: true, // System-generated entry, bypass UI validation
  });
};

// ========== TRANSACTION SERVICES ==========
const getRecentTransactions = async (entryType, limit = 20) => {
  return await LedgerTransaction.find({ entryType })
    .populate("fromAccountId", "name")
    .populate("toAccountId", "name")
    .populate("debitAccountId", "name")
    .populate("creditAccountId", "name")
    .sort({ date: -1 })
    .limit(limit)
    .lean();
};

const getAccountTransactions = async (
  accountId,
  page = 1,
  limit = 10,
  search = ""
) => {
  const filter = {
    $or: [
      { debitAccountId: accountId },
      { creditAccountId: accountId },
      { fromAccountId: accountId },
      { toAccountId: accountId },
    ],
  };

  if (search) {
    filter.remark = { $regex: search, $options: "i" };
  }

  const query = LedgerTransaction.find(filter)
    .populate("debitAccountId creditAccountId fromAccountId toAccountId")
    .sort({ date: -1 });

  const transactions = await query
    .skip((page - 1) * limit)
    .limit(limit)
    .lean();

  const total = await LedgerTransaction.countDocuments(filter);

  const { enriched, totalDebit, totalCredit } = enrichTransactionsWithBalance(
    transactions,
    accountId
  );

  return { data: enriched, total, totalDebit, totalCredit };
};

// ========== RECEIPT ==========
/**
 * Receipt: Cash/Bank receives money from customer/external payer.
 * Double-Entry:
 *   DEBIT:  Cash/Bank (from toAccountId — where money lands)
 *   CREDIT: Customer/Payer (from fromAccountId — who paid)
 *
 * UI convention: fromAccountId = payer, toAccountId = cash/bank
 */
const createReceiptTransaction = async (transactionData) => {
  const { fromAccountId, toAccountId, amount, remark, paymenttype, createdBy } = transactionData;

  return await postJournalEntry({
    debitAccountId: toAccountId,   // Cash/Bank receives → DEBIT asset
    creditAccountId: fromAccountId, // Payer ledger reduces → CREDIT receivable
    amount,
    entryType: "Receipt",
    remark,
    createdBy,
    paymenttype: paymenttype || "Cash",
  });
};

// ========== PAYMENT ==========
/**
 * Payment: Cash/Bank pays out to a vendor/payee.
 * Double-Entry:
 *   DEBIT:  Payee/Vendor (from toAccountId — receiving the payment)
 *   CREDIT: Cash/Bank (from fromAccountId — paying out)
 *
 * UI convention: fromAccountId = cash/bank, toAccountId = payee
 */
const createPaymentTransaction = async (transactionData) => {
  const { fromAccountId, toAccountId, amount, remark, paymenttype, createdBy } = transactionData;

  return await postJournalEntry({
    debitAccountId: toAccountId,   // Payee account → DEBIT (reduces their payable)
    creditAccountId: fromAccountId, // Cash/Bank → CREDIT (reduces asset)
    amount,
    entryType: "Payment",
    remark,
    createdBy,
    paymenttype: paymenttype || "Cash",
  });
};

// ========== TRANSFER ==========
/**
 * Transfer: Move money between own Cash/Bank accounts.
 * Double-Entry:
 *   DEBIT:  To Account (destination cash/bank — increases)
 *   CREDIT: From Account (source cash/bank — decreases)
 */
const createTransferTransaction = async (transactionData) => {
  const { fromAccountId, toAccountId, amount, remark, createdBy } = transactionData;

  return await postJournalEntry({
    debitAccountId: toAccountId,
    creditAccountId: fromAccountId,
    amount,
    entryType: "Transfer",
    remark,
    createdBy,
    paymenttype: "Transfer",
  });
};

// ========== INCOME (Accrual) ==========
/**
 * Income Accrual: Income earned but not yet received.
 * Double-Entry:
 *   DEBIT:  Customer/Receivable (from fromAccountId — now owes money)
 *   CREDIT: Income Category (from toAccountId — income recognized)
 *
 * NOTE: Does NOT touch any Cash/Bank account.
 */
const createIncomeTransaction = async (transactionData) => {
  const { fromAccountId, toAccountId, amount, remark, createdBy } = transactionData;

  return await postJournalEntry({
    debitAccountId: fromAccountId, // Receivable/Person → DEBIT (increases receivable)
    creditAccountId: toAccountId,   // Income Category → CREDIT (increases income)
    amount,
    entryType: "Income",
    remark,
    createdBy,
    paymenttype: "Accrual",
  });
};

// ========== EXPENSE ==========
/**
 * Expense: Record spending.
 * Double-Entry:
 *   DEBIT:  Expense Category (from toAccountId — expense recognized)
 *   CREDIT: Payer / Cash/Bank (from fromAccountId — asset decreases or payable increases)
 */
const createExpenseTransaction = async (transactionData) => {
  const { fromAccountId, toAccountId, amount, remark, paymenttype, createdBy } = transactionData;

  return await postJournalEntry({
    debitAccountId: toAccountId,   // Expense Category → DEBIT
    creditAccountId: fromAccountId, // Cash/Bank or Payable → CREDIT
    amount,
    entryType: "Expense",
    remark,
    createdBy,
    paymenttype: paymenttype || "Credit",
  });
};

// ========== SETTLEMENT (Legacy) ==========
/**
 * Settlement: Clears debt between accounts.
 * Type = Payment: Cash/Bank (from) → Payee (to)
 * Type = Receipt: Customer (from) → Cash/Bank (to)
 */
const createSettlementTransaction = async (transactionData) => {
  const { fromAccountId, toAccountId, type, amount, remark, createdBy } = transactionData;

  if (fromAccountId === toAccountId) {
    const error = new Error("From and To accounts cannot be the same!");
    error.statusCode = 400;
    throw error;
  }

  // For Settlement (Payment type): FromAccount credits, ToAccount debits
  // For Settlement (Receipt type): ToAccount credits, FromAccount debits
  const debitId = type === "Payment" ? toAccountId : fromAccountId;
  const creditId = type === "Payment" ? fromAccountId : toAccountId;

  return await postJournalEntry({
    debitAccountId: debitId,
    creditAccountId: creditId,
    amount,
    entryType: "Settlement",
    remark,
    createdBy,
    paymenttype: "Cash",
    skipValidation: true, // Legacy type — skip strict validation
  });
};

// ========== CREDIT NOTE (Legacy Income) ==========
/**
 * Credit Note: Record income, optionally with external source.
 * DEBIT:  Payer/Receivable (internal) or null (external)
 * CREDIT: Income Category
 */
const createCreditNoteTransaction = async (transactionData) => {
  const {
    fromType,
    fromAccountId,
    externalSource,
    toAccountId,
    amount,
    remark,
    createdBy,
  } = transactionData;

  return await postJournalEntry({
    debitAccountId: fromType === "internal" ? fromAccountId : null,
    creditAccountId: toAccountId,
    amount,
    entryType: "CreditNote",
    externalSource: fromType === "external" ? externalSource : null,
    remark,
    createdBy,
    skipValidation: true,
  });
};

// ========== REVERSE TRANSACTION (Audit Safe) ==========
const reverseTransactionService = async (transactionId, reversedBy) => {
  return await reverseTransaction(transactionId, reversedBy);
};

// ========== REPORTING SERVICES ==========
const getExpenseSummary = async () => {
  const now = new Date();
  const oneMonthAgo = new Date(new Date().setMonth(now.getMonth() - 1));
  const threeMonthsAgo = new Date(new Date().setMonth(now.getMonth() - 3));
  const sixMonthsAgo = new Date(new Date().setMonth(now.getMonth() - 6));

  const [lastMonth, last3Months, last6Months] = await Promise.all([
    LedgerTransaction.aggregate([
      { $match: { entryType: "Expense", date: { $gte: oneMonthAgo } } },
      { $group: { _id: null, total: { $sum: "$amount" } } },
    ]),
    LedgerTransaction.aggregate([
      { $match: { entryType: "Expense", date: { $gte: threeMonthsAgo } } },
      { $group: { _id: null, total: { $sum: "$amount" } } },
    ]),
    LedgerTransaction.aggregate([
      { $match: { entryType: "Expense", date: { $gte: sixMonthsAgo } } },
      { $group: { _id: null, total: { $sum: "$amount" } } },
    ]),
  ]);

  return {
    lastMonth: lastMonth[0]?.total || 0,
    last3Months: last3Months[0]?.total || 0,
    last6Months: last6Months[0]?.total || 0,
  };
};

const getFinancialSummary = async (allAccounts) => {
  const totalAssets = allAccounts
    .filter((acc) => acc.accountType === "Asset")
    .reduce((sum, acc) => sum + (acc.balance || 0), 0);

  const totalLiabilities = allAccounts
    .filter((acc) => acc.accountType === "Liability")
    .reduce((sum, acc) => sum + (acc.balance || 0), 0);

  const totalIncome = allAccounts
    .filter((acc) => acc.accountType === "Income")
    .reduce((sum, acc) => sum + (acc.balance || 0), 0);

  const totalExpenses = allAccounts
    .filter((acc) => acc.accountType === "Expense")
    .reduce((sum, acc) => sum + (acc.balance || 0), 0);

  const netWorth = totalAssets - totalLiabilities;

  // Cash position: sum of all cashequivalent Asset accounts
  const cashPosition = allAccounts
    .filter((acc) => acc.accountType === "Asset" && acc.cashequivalent)
    .reduce((sum, acc) => sum + (acc.balance || 0), 0);

  return {
    totalAssets,
    totalLiabilities,
    totalIncome,
    totalExpenses,
    netWorth,
    cashPosition,
  };
};

// ========== LEDGER HEALTH CHECK ==========
/**
 * Detects potential accounting anomalies:
 * 1. Reversed receipt/payment (cash/bank was CREDITED in a Receipt, or DEBITED in a Payment)
 * 2. Receivable increasing after receipts (should decrease)
 * 3. Accounts with abnormal debit growth
 */
const getLedgerHealthAlerts = async () => {
  const alerts = [];

  // 1. Find Receipt transactions where debitAccountId is NOT cashequivalent
  const suspectReceipts = await LedgerTransaction.find({ entryType: "Receipt", isReversal: false })
    .populate("debitAccountId creditAccountId")
    .lean();

  for (const tx of suspectReceipts) {
    if (tx.debitAccountId && !tx.debitAccountId.cashequivalent) {
      alerts.push({
        type: "REVERSED_RECEIPT",
        severity: "HIGH",
        message: `Possible reversed receipt detected: Transaction #${tx._id} — 'To Account' is "${tx.debitAccountId.name}" which is not a Cash/Bank account.`,
        transactionId: tx._id,
        date: tx.date,
      });
    }
  }

  // 2. Find Payment transactions where creditAccountId is NOT cashequivalent
  const suspectPayments = await LedgerTransaction.find({ entryType: "Payment", isReversal: false })
    .populate("debitAccountId creditAccountId")
    .lean();

  for (const tx of suspectPayments) {
    if (tx.creditAccountId && !tx.creditAccountId.cashequivalent) {
      alerts.push({
        type: "REVERSED_PAYMENT",
        severity: "HIGH",
        message: `Possible reversed payment detected: Transaction #${tx._id} — 'From Account' is "${tx.creditAccountId.name}" which is not a Cash/Bank account.`,
        transactionId: tx._id,
        date: tx.date,
      });
    }
  }

  // 3. Accounts with negative cash balance
  const cashAccounts = await LedgerAccount.find({
    accountType: "Asset",
    cashequivalent: true,
    balance: { $lt: 0 },
  }).lean();

  for (const acc of cashAccounts) {
    alerts.push({
      type: "NEGATIVE_CASH_BALANCE",
      severity: "MEDIUM",
      message: `Cash/Bank account "${acc.name}" has a negative balance of ₹${acc.balance.toFixed(2)}.`,
      accountId: acc._id,
    });
  }

  return alerts;
};

const enrichTransactionsWithBalance = (transactions, accountId) => {
  let totalDebit = 0;
  let totalCredit = 0;

  const enriched = transactions.map((tx) => {
    const debitId = tx.debitAccountId?._id || tx.debitAccountId;
    const creditId = tx.creditAccountId?._id || tx.creditAccountId;

    const isDebit = debitId && debitId.toString() === accountId.toString();
    const isCredit = creditId && creditId.toString() === accountId.toString();

    const balance = isDebit
      ? (tx.debitBalanceAfter !== undefined ? tx.debitBalanceAfter : tx.receiverBalanceAfter)
      : (tx.creditBalanceAfter !== undefined ? tx.creditBalanceAfter : tx.senderBalanceAfter);

    if (isDebit) totalDebit += tx.amount;
    if (isCredit) totalCredit += tx.amount;

    return { ...tx, isDebit, isCredit, displayBalance: balance };
  });

  return { enriched, totalDebit, totalCredit };
};

module.exports = {
  // Account services
  getAllAccounts,
  getAccountById,
  createAccount,
  updateAccountById,
  deleteAccountById,
  setAccountDefaultType,
  setAccountAsDefault,
  getDefaultAccount,
  recordOnlineTransaction,
  getAccountsByType,

  // Transaction services
  getRecentTransactions,
  getAccountTransactions,
  createReceiptTransaction,
  createPaymentTransaction,
  createTransferTransaction,
  createIncomeTransaction,
  createExpenseTransaction,
  createSettlementTransaction,
  createCreditNoteTransaction,
  reverseTransactionService,

  // Reporting services
  getExpenseSummary,
  getFinancialSummary,
  getLedgerHealthAlerts,
  enrichTransactionsWithBalance,
};
