const mongoose = require("mongoose");
const dotenv = require("dotenv");
dotenv.config();

const connectMongoDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("✅ MongoDB connected");
  } catch (error) {
    console.error("❌ MongoDB connection error:", error.message);
  }
};

connectMongoDB();

module.exports = mongoose;
