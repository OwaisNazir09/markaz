const ReportsService = require("./service");

class ReportsController {
  async getLedgerReport(req, res) {
    try {
      const { accountId } = req.query;
      const fromDate = req.query.from;
      const toDate = req.query.to;

      if (!accountId) {
        return res
          .status(400)
          .json({ success: false, message: "accountId is required" });
      }

      const report = await ReportsService.getLedgerReport(
        accountId,
        fromDate,
        toDate,
      );
      console.log("---------------------------------------");
      console.log(report);
      res.json({ success: true, data: report });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  async getIncomeReport(req, res) {
    try {
      const fromDate = req.query.from;
      const toDate = req.query.to;

      const report = await ReportsService.getIncomeReport(fromDate, toDate);
      res.json({ success: true, data: report });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  async getExpenseReport(req, res) {
    try {
      const fromDate = req.query.from;
      const toDate = req.query.to;

      const report = await ReportsService.getExpenseReport(fromDate, toDate);
      res.json({ success: true, data: report });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  async getProfitLossReport(req, res) {
    try {
      const fromDate = req.query.from;
      const toDate = req.query.to;

      const report = await ReportsService.getProfitLossReport(fromDate, toDate);
      res.json({ success: true, data: report });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }
}

module.exports = new ReportsController();
