// routes/userRoutes.js

const express = require('express');
const router = express.Router();
const User = require('../models/User');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../config/mysql'); // ✅ MySQL connection import

const JWT_SECRET = process.env.JWT_SECRET;

// ✅ Send OTP
router.post('/send-otp', async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ message: "Email is required" });

  try {
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiry = new Date(Date.now() + 5 * 60 * 1000);

    let user = await User.findOne({ email });
    if (!user) user = new User({ email });

    user.otp = otp;
    user.otpExpiry = expiry;
    await user.save();

    // ✅ MySQL me bhi OTP save/update
    const query = `
      INSERT INTO users (email, otp, otpExpiry, isVerified)
      VALUES (?, ?, ?, 0)
      ON DUPLICATE KEY UPDATE otp=?, otpExpiry=?, isVerified=0;
    `;
    db.query(query, [email, otp, expiry, otp, expiry], (err) => {
      if (err) console.error("MySQL OTP save error:", err);
    });

    console.log(`📧 OTP for ${email}: ${otp}`);
    res.json({ message: "OTP sent successfully to email" });
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

// ✅ Verify OTP
router.post('/verify-otp', async (req, res) => {
  const { email, otp } = req.body;
  if (!email || !otp) return res.status(400).json({ message: "Email and OTP are required" });

  try {
    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ message: "User not found" });

    if (String(user.otp) !== String(otp)) return res.status(400).json({ message: "Invalid OTP" });
    if (user.otpExpiry < new Date()) return res.status(400).json({ message: "OTP expired" });

    user.isVerified = true;
    user.otp = null;
    user.otpExpiry = null;
    await user.save();

    // ✅ MySQL update
    const query = `UPDATE users SET isVerified=1, otp=NULL, otpExpiry=NULL WHERE email=?`;
    db.query(query, [email], (err) => {
      if (err) console.error("MySQL verify error:", err);
    });

    res.json({ message: "✅ OTP verified. You can now proceed." });
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

// ✅ Register (Mongo + MySQL both)
router.post('/register', async (req, res) => {
  const { name, email, mobile, password } = req.body;
  if (!name || !email || !mobile || !password)
    return res.status(400).json({ message: "All fields are required" });

  try {
    const user = await User.findOne({ email });
    if (!user || !user.isVerified)
      return res.status(400).json({ message: "OTP not verified or user not found" });

    if (user.password)
      return res.status(409).json({ message: "User already registered" });

    const hashedPassword = await bcrypt.hash(password, 10);
    user.name = name;
    user.mobile = mobile;
    user.password = hashedPassword;
    await user.save();

    // ✅ MySQL me bhi save/update
    const query = `
      INSERT INTO users (name, email, mobile, password, isVerified, walletBalance)
      VALUES (?, ?, ?, ?, 1, 0)
      ON DUPLICATE KEY UPDATE name=?, mobile=?, password=?, isVerified=1;
    `;
    db.query(query, [name, email, mobile, hashedPassword, name, mobile, hashedPassword], (err) => {
      if (err) console.error("MySQL register error:", err);
    });

    res.json({ message: "User registered successfully in both MongoDB & MySQL" });
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

// ✅ Login (only MongoDB check, but can sync with MySQL)
router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  try {
    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) return res.status(404).json({ message: "User not found" });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(401).json({ message: "Invalid credentials" });

    const token = jwt.sign({ id: user._id, email: user.email }, JWT_SECRET, { expiresIn: '2h' });
    res.json({ message: "Login successful", token });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ✅ Add Money
router.post('/add-money', async (req, res) => {
  const { email, amount } = req.body;
  if (!email || !amount)
    return res.status(400).json({ message: "email and amount are required" });

  try {
    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ message: "User not found" });

    user.walletBalance += Number(amount);
    user.transactions.push({
      type: 'credit',
      amount,
      details: `Added money to wallet`,
      timestamp: new Date()
    });
    await user.save();

    // ✅ MySQL update
    const updateBalance = `
      UPDATE users SET walletBalance = walletBalance + ? WHERE email = ?;
    `;
    db.query(updateBalance, [amount, email], (err) => {
      if (err) console.error("MySQL add-money error:", err);
    });

    res.json({ message: "Money added", newBalance: user.walletBalance });
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

// ✅ Recharge
router.post('/recharge', async (req, res) => {
  const { email, mobile, amount } = req.body;
  if (!email || !mobile || !amount)
    return res.status(400).json({ message: "email, mobile, and amount are required" });

  try {
    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ message: "User not found" });
    if (user.walletBalance < amount)
      return res.status(400).json({ message: "Insufficient balance" });

    user.walletBalance -= Number(amount);
    user.transactions.push({
      type: 'debit',
      amount,
      details: `Recharge done to mobile ${mobile}`,
      timestamp: new Date()
    });
    await user.save();

    // ✅ MySQL update
    const updateBalance = `
      UPDATE users SET walletBalance = walletBalance - ? WHERE email = ?;
    `;
    db.query(updateBalance, [amount, email], (err) => {
      if (err) console.error("MySQL recharge error:", err);
    });

    res.json({
      message: "Recharge successful",
      rechargedTo: mobile,
      remainingBalance: user.walletBalance
    });
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

// ✅ Transaction History
router.get('/transactions/:email', async (req, res) => {
  const { email } = req.params;
  try {
    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ message: 'User not found' });

    res.json({ transactions: user.transactions });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

module.exports = router;
