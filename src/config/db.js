const mongoose = require("mongoose");

const Connectdb = async () => {
  try {
    const connect = await mongoose.connect(process.env.MongooseConnectURI);

    if (!connect) {
      console.log("Failed to connect the database");
      return;
    }

    console.log("Db connected successfully");
  } catch (err) {
    console.log("Failed to connect the database");
    console.error(err.message);
    process.exit(1);
  }
};

module.exports = Connectdb;
