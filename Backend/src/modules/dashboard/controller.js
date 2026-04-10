const LedgerService = require("../ledger/service");
const ProjectService = require("../projects/service");
const UserService = require("../User/service");
const LedgerTransaction = require("../ledger/models/LedgerTransaction");

const getMonthName = (monthIndex) => {
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    return months[monthIndex - 1];
};

const getDayName = (date) => {
    const days = ["S", "M", "T", "W", "T", "F", "S"];
    return days[date.getDay()];
};

const getMonthlyStats = async () => {
    const end = new Date();
    const start = new Date();
    start.setMonth(start.getMonth() - 11);
    start.setDate(1);
    start.setHours(0, 0, 0, 0);

    const stats = await LedgerTransaction.aggregate([
        {
            $match: {
                date: { $gte: start },
                entryType: { $in: ["Income", "Expense"] }
            }
        },
        {
            $group: {
                _id: {
                    month: { $month: "$date" },
                    year: { $year: "$date" }
                },
                income: {
                    $sum: {
                        $cond: [{ $eq: ["$entryType", "Income"] }, "$amount", 0]
                    }
                },
                expense: {
                    $sum: {
                        $cond: [{ $eq: ["$entryType", "Expense"] }, "$amount", 0]
                    }
                }
            }
        },
        { $sort: { "_id.year": 1, "_id.month": 1 } }
    ]);

    const result = [];
    const current = new Date(start);
    while (current <= end) {
        const month = current.getMonth() + 1;
        const year = current.getFullYear();
        const found = stats.find(s => s._id.month === month && s._id.year === year);

        result.push({
            label: getMonthName(month),
            income: found ? Math.round(found.income * 100) / 100 : 0,
            expense: found ? Math.round(found.expense * 100) / 100 : 0
        });

        current.setMonth(current.getMonth() + 1);
    }

    return result;
};

const getWeeklyStats = async () => {
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - 6);
    start.setHours(0, 0, 0, 0);

    const stats = await LedgerTransaction.aggregate([
        {
            $match: {
                date: { $gte: start },
                entryType: { $in: ["Income", "Expense"] }
            }
        },
        {
            $group: {
                _id: {
                    day: { $dayOfMonth: "$date" },
                    month: { $month: "$date" },
                    year: { $year: "$date" }
                },
                date: { $first: "$date" },
                income: {
                    $sum: {
                        $cond: [{ $eq: ["$entryType", "Income"] }, "$amount", 0]
                    }
                },
                expense: {
                    $sum: {
                        $cond: [{ $eq: ["$entryType", "Expense"] }, "$amount", 0]
                    }
                }
            }
        },
        { $sort: { "_id.year": 1, "_id.month": 1, "_id.day": 1 } }
    ]);

    // Fill in missing days
    const result = [];
    const current = new Date(start);
    while (current <= end) {
        const day = current.getDate();
        const month = current.getMonth() + 1;
        const year = current.getFullYear();

        const found = stats.find(s => s._id.day === day && s._id.month === month && s._id.year === year);

        result.push({
            label: getDayName(current),
            income: found ? Math.round(found.income * 100) / 100 : 0,
            expense: found ? Math.round(found.expense * 100) / 100 : 0
        });

        current.setDate(current.getDate() + 1);
    }

    return result;
};

const getDashboardStats = async (req, res, next) => {
    try {
        // 1. Get Financial Summary
        const { data: allAccounts } = await LedgerService.getAllAccounts({}, 1, 100000);
        const financialSummary = await LedgerService.getFinancialSummary(allAccounts);

        // 2. Calculate period-specific income/expenses (last 12 months) to match chart data
        const start = new Date();
        start.setMonth(start.getMonth() - 11); // Last 12 months including this one
        start.setDate(1);
        start.setHours(0, 0, 0, 0);

        const periodStats = await LedgerTransaction.aggregate([
            {
                $match: {
                    date: { $gte: start },
                    entryType: { $in: ["Income", "Expense"] }
                }
            },
            {
                $group: {
                    _id: "$entryType",
                    total: { $sum: "$amount" }
                }
            }
        ]);

        const periodIncome = periodStats.find(s => s._id === "Income")?.total || 0;
        const periodExpenses = periodStats.find(s => s._id === "Expense")?.total || 0;

        // 3. Get Active Projects Count & Details
        const { data: activeCampaigns, total: totalActiveProjects } = await ProjectService.getAllActiveProjectCampaign(1, 5);

        // Enrich active campaigns with progress percentage
        const topCampaigns = activeCampaigns.map(c => ({
            _id: c._id,
            title: c.title,
            targetAmount: c.targetAmount,
            collectedAmount: c.collectedAmount,
            progress: Math.min(Math.round((c.collectedAmount / c.targetAmount) * 100), 100),
            category: c.category
        }));

        // 4. Get Total Users Count
        const { total: totalUsers } = await UserService.getAllUsers();

        // 5. Get Charts Data
        const monthlyStats = await getMonthlyStats();
        const weeklyStats = await getWeeklyStats();

        // 6. Get Recent Donations (from campaigns)
        const recentDonations = await ProjectService.getRecentCampaignTransactions(5);

        // 7. Get Recent Expenses (from ledger)
        const recentExpenses = await LedgerService.getRecentTransactions("Expense", 5);

        // 8. Asset Accounts Summary (Cash & Bank)
        const assetAccounts = allAccounts
            .filter(acc => acc.accountType === "Asset" && acc.balance > 0)
            .sort((a, b) => b.balance - a.balance)
            .slice(0, 5)
            .map(acc => ({
                _id: acc._id,
                name: acc.name,
                balance: acc.balance,
                cashequivalent: acc.cashequivalent
            }));

        res.status(200).json({
            success: true,
            data: {
                // Period-specific totals (last 12 months) to match charts
                totalIncome: Math.round(periodIncome * 100) / 100,
                totalExpenses: Math.round(periodExpenses * 100) / 100,
                // Net balance remains all-time from account balances
                netBalance: financialSummary.netWorth,
                activeProjects: totalActiveProjects,
                totalUsers: totalUsers,
                topCampaigns,
                recentDonations,
                recentExpenses,
                assetAccounts,
                charts: {
                    monthly: monthlyStats,
                    weekly: weeklyStats
                }
            },
        });
    } catch (error) {
        next(error);
    }
};

const getDebugStats = async (req, res, next) => {
    try {
        const { data: allAccounts } = await LedgerService.getAllAccounts({}, 1, 100000);
        const financialSummary = await LedgerService.getFinancialSummary(allAccounts);

        const accountsByType = {
            Asset: allAccounts.filter(acc => acc.accountType === "Asset"),
            Liability: allAccounts.filter(acc => acc.accountType === "Liability"),
            Income: allAccounts.filter(acc => acc.accountType === "Income"),
            Expense: allAccounts.filter(acc => acc.accountType === "Expense")
        };

        res.status(200).json({
            success: true,
            data: {
                summary: financialSummary,
                accountsByType,
                totalAccounts: allAccounts.length
            }
        });
    } catch (error) {
        next(error);
    }
};

module.exports = {
    getDashboardStats,
    getDebugStats,
};
