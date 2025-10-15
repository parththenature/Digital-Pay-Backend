// routes/walletRoutes.js
const express = require("express");
const router = express.Router();
const User = require("../models/User");
const authMiddleware = require("../middlewares/authMiddleware");
const QRCode = require('qrcode');
const qrcodeTerminal = require("qrcode-terminal");

// ✅ Wallet to Wallet transfer using email
router.post("/transfer", authMiddleware, async (req, res) => {
  try {
    const { receiverEmail, amount } = req.body;

    // Validate input
    if (!receiverEmail || !amount || amount <= 0) {
      return res.status(400).json({ message: "Invalid transfer details" });
    }

    // Sender details from JWT token
    const sender = await User.findById(req.user.id);
    if (!sender) {
      return res.status(404).json({ message: "Sender not found" });
    }

    // Receiver details by email
    const receiver = await User.findOne({ email: receiverEmail });
    if (!receiver) {
      return res.status(404).json({ message: "Receiver not found" });
    }

    // Check sender balance
    if (sender.walletBalance < amount) {
      return res.status(400).json({ message: "Insufficient balance" });
    }

    // Perform transfer
    sender.walletBalance -= amount;
    receiver.walletBalance += amount;

    // Add transaction history
    sender.transactions.push({
      type: "debit",
      amount,
      from: sender.email,
      to: receiver.email,
      description: "Wallet transfer"
    });

    receiver.transactions.push({
      type: "credit",
      amount,
      from: sender.email,
      to: receiver.email,
      description: "Wallet transfer"
    });

    // Save changes
    await sender.save();
    await receiver.save();

    res.json({
      message: `₹${amount} transferred successfully to ${receiver.email}`,
      senderBalance: sender.walletBalance,
      receiverBalance: receiver.walletBalance
    });

  } catch (error) {
    console.error("Transfer error:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// ✅ Check Wallet Balance
router.get("/balance", authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    res.json({
      message: "Wallet balance retrieved successfully",
      walletBalance: user.walletBalance
    });

  } catch (error) {
    console.error("Balance check error:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// Generate wallet QR (return as PNG + show in terminal)
router.get('/generate-qr', authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ message: "User not found" });

    const qrData = { email: user.email };

    // Show QR in VS Code terminal
    qrcodeTerminal.generate(JSON.stringify(qrData), { small: true });

    // Send QR as PNG image in response
    res.setHeader("Content-Type", "image/png");
    QRCode.toFileStream(res, JSON.stringify(qrData));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});



// Scan QR and transfer money
router.post('/scan-qr', authMiddleware, async (req, res) => {
  try {
    const { qrData, amount } = req.body;

    if (!qrData || !amount || amount <= 0) {
      console.log("❌ Invalid request: QR data or amount is missing/invalid");
      return res.status(400).json({ message: "Invalid QR data or amount" });
    }

    // QR se user email nikal lo (receiver)
    const parsedData = JSON.parse(qrData);
    const receiver = await User.findOne({ email: parsedData.email });
    const sender = await User.findById(req.user.id);

    if (!receiver) {
      console.log("❌ Transaction failed: Receiver not found");
      return res.status(404).json({ message: "Receiver not found" });
    }

    if (!sender) {
      console.log("❌ Transaction failed: Sender not found");
      return res.status(404).json({ message: "Sender not found" });
    }

    // ✅ Prevent self transfer
    if (sender.email === receiver.email) {
      console.log(`⚠️ Transaction blocked: Sender (${sender.email}) tried to send money to self`);
      return res.status(400).json({ message: "Cannot transfer money to your own wallet" });
    }

    if (sender.walletBalance < amount) {
      console.log(`❌ Transaction failed: Insufficient balance. Sender: ${sender.email}, Balance: ₹${sender.walletBalance}, Tried to send: ₹${amount}`);
      return res.status(400).json({ message: "Insufficient balance" });
    }

    // ✅ Sender ka paisa cut karo
    sender.walletBalance -= amount;
    sender.transactions.push({
      type: "debit",
      amount,
      from: sender.email,
      to: receiver.email,
      description: "QR payment"
    });
    await sender.save();

    // ✅ Receiver ke wallet me paisa add karo
    receiver.walletBalance += amount;
    receiver.transactions.push({
      type: "credit",
      amount,
      from: sender.email,
      to: receiver.email,
      description: "QR payment"
    });
    await receiver.save();

    // ✅ Success transaction details console me print
    console.log("✅ Transaction Successful:");
    console.log(`   Sender: ${sender.email}`);
    console.log(`   Receiver: ${receiver.email}`);
    console.log(`   Amount: ₹${amount}`);
    console.log(`   Sender Balance after: ₹${sender.walletBalance}`);
    console.log(`   Receiver Balance after: ₹${receiver.walletBalance}`);
    console.log("=======================================");

    res.json({
      message: `₹${amount} transferred successfully to ${receiver.email}`,
      senderBalance: sender.walletBalance,
      receiverBalance: receiver.walletBalance
    });
  } catch (err) {
    console.error("🚨 Unexpected Transaction Error:", err.message);
    res.status(500).json({ message: err.message });
  }
});




module.exports = router;
