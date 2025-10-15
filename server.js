const express = require("express");
const dotenv = require("dotenv");

// Load environment variables
dotenv.config();

const app = express();

// Import both DB connections
require("./config/mongo");
require("./config/mysql");

// Routes
const authRoutes = require("./routes/authRoutes");
const userRoutes = require("./routes/userRoutes");
const walletRoutes = require("./routes/walletRoutes");

// Middleware
app.use(express.json());

// Route usage
app.use("/api/auth", authRoutes);
app.use("/api/user", userRoutes);
app.use("/api/wallet", walletRoutes);

// Server port
const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
