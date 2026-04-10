const mongoose = require("mongoose");
const LedgerAccount = require("../ledger/models/LedgerAccount");
const LedgerTransaction = require("../ledger/models/LedgerTransaction");

class ReportsService {
  /**
   * Helper to determine net balance change for an account based on type
   */
  getNetBalance(accountType, totalDebit, totalCredit) {
    if (["Asset", "Expense"].includes(accountType)) {
      return totalDebit - totalCredit;
    } else {
      // Liability, Income
      return totalCredit - totalDebit;
    }
  }

  /**
   * Build a $or match that covers BOTH legacy (fromAccountId/toAccountId)
   * and new double-entry (debitAccountId/creditAccountId) fields.
   */
  buildAccountMatch(accountId) {
    return {
      $or: [
        { debitAccountId: accountId },
        { creditAccountId: accountId },
        { fromAccountId: accountId },
        { toAccountId: accountId },
      ],
    };
  }

  /**
   * Build a $or match that covers BOTH legacy and new fields for a list of accountIds.
   */
  buildAccountListMatch(accountIds) {
    return {
      $or: [
        { debitAccountId: { $in: accountIds } },
        { creditAccountId: { $in: accountIds } },
        { fromAccountId: { $in: accountIds } },
        { toAccountId: { $in: accountIds } },
      ],
    };
  }

  /**
   * Resolve debit/credit side for a transaction, covering both schemas.
   */
  resolveDebitCredit(txn, accountId) {
    const idStr = accountId.toString();
    let debit = 0;
    let credit = 0;
    let counterpartyName = null;
    let side = null; // "debit" | "credit"

    // --- New double-entry fields ---
    if (txn.debitAccountId) {
      const dId = txn.debitAccountId._id
        ? txn.debitAccountId._id.toString()
        : txn.debitAccountId.toString();
      if (dId === idStr) {
        debit = txn.amount;
        side = "debit";
        if (txn.creditAccountId) {
          counterpartyName = txn.creditAccountId.name || null;
        }
      }
    }
    if (txn.creditAccountId) {
      const cId = txn.creditAccountId._id
        ? txn.creditAccountId._id.toString()
        : txn.creditAccountId.toString();
      if (cId === idStr) {
        credit = txn.amount;
        side = "credit";
        if (txn.debitAccountId) {
          counterpartyName = txn.debitAccountId.name || null;
        }
      }
    }

    // --- Legacy fields (fromAccountId = sender = debit, toAccountId = receiver = credit) ---
    if (debit === 0 && credit === 0) {
      if (txn.fromAccountId) {
        const fId = txn.fromAccountId._id
          ? txn.fromAccountId._id.toString()
          : txn.fromAccountId.toString();
        if (fId === idStr) {
          debit = txn.amount;
          side = "debit";
          if (txn.toAccountId) {
            counterpartyName = txn.toAccountId.name || null;
          }
        }
      }
      if (txn.toAccountId) {
        const tId = txn.toAccountId._id
          ? txn.toAccountId._id.toString()
          : txn.toAccountId.toString();
        if (tId === idStr) {
          credit = txn.amount;
          side = "credit";
          if (txn.fromAccountId) {
            counterpartyName = txn.fromAccountId.name || null;
          }
        }
      }
    }

    return { debit, credit, side, counterpartyName };
  }

  /**
   * 1. Get Ledger Report for a specific account and date range
   */
  async getLedgerReport(accountId, fromDate, toDate) {
    const account = await LedgerAccount.findById(accountId);
    if (!account) throw new Error("Account not found");

    // Parse dates — toDate must cover the full selected day (end of day)
    const fromDateParsed = fromDate ? new Date(fromDate) : null;
    const toDateParsed = toDate
      ? new Date(new Date(toDate).setHours(23, 59, 59, 999))
      : null;

    const accountObjId = account._id;

    // Build match for transactions BEFORE the range (opening balance)
    const matchBefore = {
      ...this.buildAccountMatch(accountObjId),
      date: fromDateParsed
        ? { $lt: fromDateParsed }
        : { $lt: new Date("1970-01-01") },
    };

    // Build match for transactions WITHIN the range
    const matchRange = {
      ...this.buildAccountMatch(accountObjId),
    };
    if (fromDateParsed || toDateParsed) {
      matchRange.date = {};
      if (fromDateParsed) matchRange.date.$gte = fromDateParsed;
      if (toDateParsed) matchRange.date.$lte = toDateParsed;
    }

    // 1. Calculate Opening Balance from transactions strictly before 'fromDate'
    let openingTotalDebit = 0;
    let openingTotalCredit = 0;

    if (fromDateParsed) {
      const beforeTxns = await LedgerTransaction.find(matchBefore)
        .select("amount debitAccountId creditAccountId fromAccountId toAccountId")
        .lean();

      beforeTxns.forEach((txn) => {
        const { debit, credit } = this.resolveDebitCredit(txn, accountObjId);
        openingTotalDebit += debit;
        openingTotalCredit += credit;
      });
    }

    const openingBalance = this.getNetBalance(
      account.accountType,
      openingTotalDebit,
      openingTotalCredit
    );

    // 2. Fetch transactions within range, populating both field sets
    const transactions = await LedgerTransaction.find(matchRange)
      .populate("debitAccountId creditAccountId fromAccountId toAccountId", "name")
      .sort({ date: 1, _id: 1 })
      .lean();

    // 3. Compute running balance
    let runningBalance = openingBalance;
    const ledgerEntries = transactions.map((txn) => {
      const { debit, credit, side, counterpartyName } = this.resolveDebitCredit(
        txn,
        accountObjId
      );

      let description = txn.remark || txn.entryType || "";
      if (side === "debit" && counterpartyName) {
        description = `To ${counterpartyName} - ${description}`;
      } else if (side === "credit" && counterpartyName) {
        description = `By ${counterpartyName} - ${description}`;
      }

      const netChange = this.getNetBalance(account.accountType, debit, credit);
      runningBalance += netChange;

      return {
        _id: txn._id,
        date: txn.date,
        entryType: txn.entryType,
        description,
        debit,
        credit,
        runningBalance,
        reference: txn.reference,
      };
    });

    return {
      account,
      openingBalance,
      closingBalance: runningBalance,
      transactions: ledgerEntries,
    };
  }

  /**
   * Helper to get aggregate report for a specific account type array.
   * Covers both legacy and new transaction field names.
   */
  async getAggregatedAccountTypeReport(accountTypes, fromDate, toDate) {
    // toDate covers the full calendar day — set to 23:59:59.999
    const fromDateParsed = fromDate ? new Date(fromDate) : null;
    const toDateParsed = toDate
      ? new Date(new Date(toDate).setHours(23, 59, 59, 999))
      : null;

    // Find all accounts of the requested types
    const accounts = await LedgerAccount.find({ accountType: { $in: accountTypes } });
    const accountMap = {};
    accounts.forEach((acc) => {
      accountMap[acc._id.toString()] = {
        id: acc._id,
        name: acc.name,
        accountType: acc.accountType,
        totalDebit: 0,
        totalCredit: 0,
      };
    });

    const accountIds = Object.keys(accountMap).map(
      (id) => new mongoose.Types.ObjectId(id)
    );

    // Build date filter
    const dateFilter = {};
    if (fromDateParsed || toDateParsed) {
      dateFilter.date = {};
      if (fromDateParsed) dateFilter.date.$gte = fromDateParsed;
      if (toDateParsed) dateFilter.date.$lte = toDateParsed;
    }

    // Fetch all relevant transactions (both schema versions)
    const txns = await LedgerTransaction.find({
      ...dateFilter,
      ...this.buildAccountListMatch(accountIds),
    })
      .select("amount debitAccountId creditAccountId fromAccountId toAccountId")
      .lean();

    // Distribute amounts using both field sets
    txns.forEach((txn) => {
      // --- New double-entry fields ---
      if (txn.debitAccountId) {
        const key = txn.debitAccountId.toString();
        if (accountMap[key]) accountMap[key].totalDebit += txn.amount;
      }
      if (txn.creditAccountId) {
        const key = txn.creditAccountId.toString();
        if (accountMap[key]) accountMap[key].totalCredit += txn.amount;
      }
      // --- Legacy fields ---
      if (!txn.debitAccountId && !txn.creditAccountId) {
        if (txn.fromAccountId) {
          const key = txn.fromAccountId.toString();
          if (accountMap[key]) accountMap[key].totalDebit += txn.amount;
        }
        if (txn.toAccountId) {
          const key = txn.toAccountId.toString();
          if (accountMap[key]) accountMap[key].totalCredit += txn.amount;
        }
      }
    });

    // Calculate net for each
    const reportData = [];
    let totalNet = 0;

    Object.values(accountMap).forEach((acc) => {
      const net = this.getNetBalance(acc.accountType, acc.totalDebit, acc.totalCredit);
      if (net !== 0 || acc.totalDebit !== 0 || acc.totalCredit !== 0) {
        reportData.push({
          accountId: acc.id,
          name: acc.name,
          accountType: acc.accountType,
          totalDebit: acc.totalDebit,
          totalCredit: acc.totalCredit,
          netBalance: net,
        });
        totalNet += net;
      }
    });

    reportData.sort((a, b) => b.netBalance - a.netBalance);

    return {
      entries: reportData,
      totalNet,
    };
  }

  /**
   * 2. Get Income Report
   */
  async getIncomeReport(fromDate, toDate) {
    return this.getAggregatedAccountTypeReport(["Income"], fromDate, toDate);
  }

  /**
   * 3. Get Expense Report
   */
  async getExpenseReport(fromDate, toDate) {
    return this.getAggregatedAccountTypeReport(["Expense"], fromDate, toDate);
  }

  /**
   * 4. Get Profit & Loss
   */
  async getProfitLossReport(fromDate, toDate) {
    const incomeReport = await this.getIncomeReport(fromDate, toDate);
    const expenseReport = await this.getExpenseReport(fromDate, toDate);

    const totalIncome = incomeReport.totalNet;
    const totalExpense = expenseReport.totalNet;
    const netProfit = totalIncome - totalExpense;

    return {
      income: incomeReport,
      expense: expenseReport,
      summary: {
        totalIncome,
        totalExpense,
        netProfit,
        isProfit: netProfit >= 0,
      },
    };
  }
}

module.exports = new ReportsService();
