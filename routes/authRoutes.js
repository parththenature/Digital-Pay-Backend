const express = require("express");
const router = express.Router();
const { sendOtpEmail, verifyOtp } = require("../controllers/authControllers");

router.post("/send-otp", sendOtpEmail);
router.post("/verify-otp", verifyOtp);

module.exports = router;
