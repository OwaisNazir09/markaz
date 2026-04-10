const mongoose = require("mongoose");

const Connectdb = async () => {
  try {
    await mongoose.connect(process.env.MongooseConnectURI);

    console.log("DB connected successfully");
  } catch (err) {
    console.error("Failed to connect the database");
    console.error(err.message);
    process.exit(1);
  }
};

module.exports = Connectdb;
