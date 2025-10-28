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
const nodemailer = require("nodemailer");
const crypto = require("crypto");

// temporary storage for OTPs (later you can use database or Redis)
let otpStore = {};

// ✅ Send OTP
exports.sendOtpEmail = async (req, res) => {
  const { email } = req.body;

  if (!email) return res.status(400).json({ status: "FAILED", message: "Email required" });

  // Generate 6 digit OTP
  const otp = Math.floor(100000 + Math.random() * 900000).toString();

  // Store in memory (or use DB)
  otpStore[email] = { otp, expiresAt: Date.now() + 5 * 60 * 1000 }; // valid for 5 min

  try {
    // Transporter setup (use your Gmail or company mail)
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.EMAIL_USER, // Your Gmail ID
        pass: process.env.EMAIL_PASS, // Your App Password
      },
    });

    const mailOptions = {
      from: `"Digital Pay" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: "Your Digital Pay OTP Code",
      html: `
        <div style="font-family:sans-serif; text-align:center;">
          <h2>Welcome to Digital Pay</h2>
          <p>Your OTP code is:</p>
          <h1>${otp}</h1>
          <p>This code will expire in 5 minutes.</p>
        </div>
      `,
    };

    await transporter.sendMail(mailOptions);

    res.status(200).json({
      status: "SUCCESS",
      message: "OTP sent successfully",
    });
  } catch (error) {
    console.log("Email Error:", error);
    res.status(500).json({ status: "FAILED", message: "Failed to send OTP" });
  }
};

// ✅ Verify OTP
exports.verifyOtp = async (req, res) => {
  const { email, otp } = req.body;
  if (!email || !otp) return res.status(400).json({ status: "FAILED", message: "Email and OTP required" });

  const stored = otpStore[email];

  if (!stored) return res.status(400).json({ status: "FAILED", message: "OTP not found or expired" });
  if (stored.expiresAt < Date.now()) return res.status(400).json({ status: "FAILED", message: "OTP expired" });
  if (stored.otp !== otp) return res.status(400).json({ status: "FAILED", message: "Invalid OTP" });

  // Success
  delete otpStore[email];
  res.status(200).json({ status: "SUCCESS", message: "OTP verified successfully" });
};

module.exports = mongoose;
