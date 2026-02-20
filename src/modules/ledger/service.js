const LedgerAccount = require("./models/LedgerAccount");
const LedgerTransaction = require("./models/LedgerTransaction");
const { postJournalEntry } = require("./engine");

// ========== UTILITIES ==========

/**
 * Adjusts account balance based on accounting nature.
 * Asset/Expense nature: DEBIT increases (+), CREDIT decreases (-)
 * Liability/Income nature: DEBIT decreases (-), CREDIT increases (+)
 */
const adjustAccountBalance = (account, amount, direction) => {
  const isDebitNature = ["Asset", "Expense"].includes(account.accountType);

  if (direction === "DEBIT") {
    if (isDebitNature) account.balance += amount;
    else account.balance -= amount;
  } else if (direction === "CREDIT") {
    if (isDebitNature) account.balance -= amount;
    else account.balance += amount;
  }

  // Protection for Cash Equivalent accounts
  if (account.cashequivalent && account.balance < 0) {
    throw new Error(
      `Insufficient balance in cash-equivalent account: ${account.name}`
    );
  }

  return account.balance;
};

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

  // Add summary info (all time total in/out and current calculated balance)
  const allTransactionsQuery = await LedgerTransaction.find({
    $or: [
      { debitAccountId: id },
      { creditAccountId: id },
      { fromAccountId: id }, // Keep legacy for transitional data
      { toAccountId: id }
    ],
  }).lean();

  const { totalDebit, totalCredit } = enrichTransactionsWithBalance(
    allTransactionsQuery,
    id
  );

  // NATURE AWARE BALANCE:
  // Asset/Expense: In (Debit) - Out (Credit)
  // Liability/Income: In (Credit) - Out (Debit)
  const calculatedBalance = nature === "DEBIT"
    ? (totalDebit - totalCredit)
    : (totalCredit - totalDebit);

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

  // Check if any specific field group exists in flat format
  const hasBankFields = bankFields.some((f) => accountData[f] !== undefined);
  const hasContactFields = contactFields.some((f) => accountData[f] !== undefined);

  // Structure Bank Details if flat fields are present
  if (hasBankFields && !accountData.bankDetails) {
    accountData.bankDetails = {
      bankName: accountData.bankName || null,
      branch: accountData.branch || null,
      accountNumber: accountData.accountNumber || null,
      ifscCode: accountData.ifscCode || null,
      upiId: accountData.upiId || null,
    };
  }

  // Structure Contact Info if flat fields are present
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

  // Remove flat fields to avoid cluttering or schema issues
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

  // Handle default type side effects if specified
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

  // Unset this specific default type from all other accounts
  if (defaultType !== "None") {
    await LedgerAccount.updateMany(
      { defaultType: defaultType },
      { $set: { defaultType: "None" } }
    );
  }

  account.defaultType = defaultType;

  // Backward compatibility
  if (defaultType === "GeneralIncome") account.isDefault = true;
  else account.isDefault = false;

  return await account.save();
};

const getDefaultAccount = async (defaultType) => {
  return await LedgerAccount.findOne({ defaultType });
};

const setAccountAsDefault = async (id) => {
  // Wrapper function for backward compatibility
  // Sets the account as the default "GeneralIncome" account
  return await setAccountDefaultType(id, "GeneralIncome");
};


const recordOnlineTransaction = async (amount, transactionId, description, createdBy = "System") => {


  let assetAccount = await getDefaultAccount("OnlineCollection");
  let incomeAccount = await getDefaultAccount("GeneralDonation");

  // Auto-create default accounts if they don't exist
  if (!assetAccount) {
    console.log("Auto-creating default Online Collection account...");
    const newAsset = await LedgerAccount.create({
      name: "Online Collection (Auto)",
      accountType: "Asset",
      balance: 0,
      defaultType: "OnlineCollection",
      createdBy: "System"
    });
    assetAccount = newAsset;
  }

  if (!incomeAccount) {
    console.log("Auto-creating default General Donation account...");
    const newIncome = await LedgerAccount.create({
      name: "General Donation (Auto)",
      accountType: "Income",
      balance: 0,
      defaultType: "GeneralDonation",
      createdBy: "System"
    });
    incomeAccount = newIncome;
  }

  const numericAmount = parseFloat(amount);


  const incomeBefore = incomeAccount.balance;
  const assetBefore = assetAccount.balance;

  incomeAccount.balance += numericAmount;
  assetAccount.balance += numericAmount;

  await Promise.all([incomeAccount.save(), assetAccount.save()]);

  const ledgerEntry = new LedgerTransaction({
    fromAccountId: incomeAccount._id,
    toAccountId: assetAccount._id,
    amount: numericAmount,
    remark: description,
    entryType: "Income",
    type: "Receipt",
    paymenttype: "Online",
    externalSource: "Razorpay",
    reference: transactionId,
    createdBy,
    senderBalanceBefore: incomeBefore,
    senderBalanceAfter: incomeAccount.balance,
    receiverBalanceBefore: assetBefore,
    receiverBalanceAfter: assetAccount.balance,
  });

  return await ledgerEntry.save();
};

const getAccountsByType = async (types) => {
  return await LedgerAccount.find({
    accountType: { $in: types },
  })
    .select("_id name accountType balance")
    .lean();
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

const getAccountTransactions = async (accountId, page = 1, limit = 10, search = "") => {
  const filter = {
    $or: [
      { debitAccountId: accountId },
      { creditAccountId: accountId },
      { fromAccountId: accountId }, // Logic for transitional data
      { toAccountId: accountId }
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

const createExpenseTransaction = async (transactionData) => {
  const { fromAccountId, toAccountId, amount, remark, paymenttype, createdBy } =
    transactionData;

  // Validate that from and to accounts are different
  if (fromAccountId === toAccountId) {
    const error = new Error("From and To accounts cannot be the same!");
    error.statusCode = 400;
    throw error;
  }

  // Ledger 2.0 Role Mapping:
  // DEBIT: Expense Category (Increases Expense)
  // CREDIT: Payer Account (Decreases Asset or Increases Liability)
  return await postJournalEntry({
    debitAccountId: toAccountId,
    creditAccountId: fromAccountId,
    amount,
    entryType: "Expense",
    remark,
    createdBy,
    paymenttype: paymenttype || "Credit",
  });
};

const createSettlementTransaction = async (transactionData) => {
  const { fromAccountId, toAccountId, type, amount, remark, createdBy } =
    transactionData;

  // Validate that from and to accounts are different
  if (fromAccountId === toAccountId) {
    const error = new Error("From and To accounts cannot be the same!");
    error.statusCode = 400;
    throw error;
  }

  // Ledger 2.0 Role Mapping for Settlement:
  // IF type is Payment (Source -> Dest):
  //   DEBIT: Destination account (Increases balance)
  //   CREDIT: Source account (Decreases balance)
  // IF type is Receipt (Dest -> Source reversed):
  //   DEBIT: Source account
  //   CREDIT: Destination account

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
  });
};

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

  // Ledger 2.0 Role Mapping for Income (Credit Note):
  // DEBIT: Payer/Receivable (Increases Receivable) OR external
  // CREDIT: Income Category (Increases Income)

  return await postJournalEntry({
    debitAccountId: fromType === "internal" ? fromAccountId : null,
    creditAccountId: toAccountId,
    amount,
    entryType: "Income",
    externalSource: fromType === "external" ? externalSource : null,
    remark,
    createdBy,
  });
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

  // Corrected accounting equation: Net Worth = Assets - Liabilities
  const netWorth = totalAssets - totalLiabilities;

  return {
    totalAssets,
    totalLiabilities,
    totalIncome,
    totalExpenses,
    netWorth,
  };
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

  // Calculation MUST follow nature-aware logic. 
  // For reporting, we provide real-time totals, but the closing balance depends on account type.
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
  createExpenseTransaction,
  createSettlementTransaction,
  createCreditNoteTransaction,

  // Reporting services
  getExpenseSummary,
  getFinancialSummary,
  enrichTransactionsWithBalance,
};
