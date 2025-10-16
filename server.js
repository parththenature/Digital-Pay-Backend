const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const dotenv = require("dotenv");
const cors = require("cors");

// Load environment variables
dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

// Create HTTP server for Socket.IO
const server = http.createServer(app);

// Initialize Socket.IO
const io = new Server(server, {
  cors: {
    origin: "*", // yahan apne frontend ka URL likh sakte ho for security
    methods: ["GET", "POST"]
  }
});

// Database connections
require("./config/mongo");
require("./config/mysql");

// Routes
const authRoutes = require("./routes/authRoutes");
const userRoutes = require("./routes/userRoutes");
const walletRoutes = require("./routes/walletRoutes");

// Use Routes
app.use("/api/auth", authRoutes);
app.use("/api/user", userRoutes);
app.use("/api/wallet", walletRoutes);

// Socket.IO Logic
io.on("connection", (socket) => {
  console.log("🟢 New user connected:", socket.id);

  // Example event: send welcome message
  socket.emit("welcome", "Welcome to Digital Pay Socket Server!");

  // Example: listen for wallet update
  socket.on("walletUpdated", (data) => {
    console.log("💰 Wallet updated:", data);
    io.emit("walletUpdateBroadcast", data); // send to all clients
  });

  socket.on("disconnect", () => {
    console.log("🔴 User disconnected:", socket.id);
  });
});

// Start Server
const PORT = process.env.PORT || 4000;
server.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
