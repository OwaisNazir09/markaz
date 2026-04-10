module.exports = (app) => {
  app.use("/api/user", require("./User/routes"));
  app.use("/api/auth", require("./auth/routes"));
  app.use("/api/min", require("./mintuesOfMeeting/routes"));
  app.use("/api/dispatch", require("./dispatchDocuments/router"));
  app.use("/api/projects", require("./projects/router"));
  app.use("/api/notifications", require("./notification/routes"));
  app.use("/api/ledger", require("./ledger/router"));
  app.use("/api/dashboard", require("./dashboard/routes"));
  app.use("/api/reports", require("./reports/router"));
  app.use("/api/v1", require("./Api/routes"));
};
