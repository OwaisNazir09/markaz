const requestLogger = (req, res, next) => {
  console.log("\n================ REQUEST DEBUG =================");
  console.log("Time:", new Date().toISOString());
  console.log("Method:", req.method);
  console.log("URL:", req.originalUrl);
  console.log("IP:", req.ip);

  console.log("Headers:", {
    "content-type": req.headers["content-type"],
    authorization: req.headers.authorization,
    client: req.headers.client,
  });

  console.log("Params:", req.params);
  console.log("Query:", req.query);
  console.log("Body:", req.body);

  if (req.file) console.log("File:", req.file);
  if (req.files) console.log("Files:", req.files);

  console.log("================================================\n");

  next();
};

module.exports = requestLogger;
