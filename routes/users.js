const express = require("express");
const router = express.Router();
const generateToken = require('../utils/jwt'); // Adjust path accordingly
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");


// Register new user (Step 1)
router.post("/register", (req, res) => {
  const db = req.app.get("db");
  const {
    first_name,
    last_name,
    gender,
    phone,
    email,
    country,
    dob,
    city,
    zipcode
  } = req.body;

  // Check for existing user
  const checkQuery = "SELECT * FROM users WHERE email = ? OR phone = ?";
  db.query(checkQuery, [email, phone], (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    if (results.length > 0) {
      return res.status(400).json({ error: "Email or phone already exists" });
    }

    // Generate OTP (for now, hardcoded)
    const otp = "123456";

    const insertQuery = `
      INSERT INTO users 
      (first_name, last_name, gender, phone, email, country, dob, city, zipcode, otp_code) 
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    db.query(
      insertQuery,
      [first_name, last_name, gender, phone, email, country, dob, city, zipcode, otp],
      (err2, result) => {
        if (err2) return res.status(500).json({ error: err2.message });

        res.status(201).json({
          message: "User registered successfully. Please verify OTP.",
          email,
          otpSent: true,
          // otp: otp, // For testing only — remove in production
        });
      }
    );
  });
});
// OTP verification (Step 2)
router.post("/verify-otp", (req, res) => {
  const db = req.app.get("db");
  const { email, otp_code } = req.body;

  if (!email || !otp_code) {
    return res.status(400).json({ error: "Email and OTP code are required" });
  }

  const findUserQuery = "SELECT * FROM users WHERE email = ?";
  db.query(findUserQuery, [email], (err, results) => {
    if (err) return res.status(500).json({ error: err.message });

    if (results.length === 0) {
      return res.status(404).json({ error: "User not found" });
    }

    const user = results[0];

    if (user.otp_code !== otp_code) {
      return res.status(400).json({ error: "Invalid OTP code" });
    }

    const updateUserQuery = "UPDATE users SET otp_verified = 1, otp_code = NULL WHERE email = ?";
    db.query(updateUserQuery, [email], (err2) => {
      if (err2) return res.status(500).json({ error: err2.message });

      // Generate JWT token
      const token = generateToken(user);

      res.json({ message: "OTP verified successfully", token });
    });
  });
});
// Set user password after OTP verification
router.post("/set-password", async (req, res) => {
  const db = req.app.get("db");
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: "Email and password are required" });
  }

  try {
    const hashedPassword = await bcrypt.hash(password, 10);

    const updateQuery = "UPDATE users SET password = ? WHERE email = ?";
    db.query(updateQuery, [hashedPassword, email], (err, result) => {
      if (err) return res.status(500).json({ error: err.message });

      if (result.affectedRows === 0) {
        return res.status(404).json({ error: "User not found" });
      }

      return res.json({ success: true, message: "Password set successfully" });
    });
  } catch (err) {
    res.status(500).json({ error: "Something went wrong while setting password" });
  }
});
// Login user and return JWT
router.post("/login", (req, res) => {
  const db = req.app.get("db");
  const { emailOrPhone, password } = req.body;

  if (!emailOrPhone || !password) {
    return res.status(400).json({ error: "Email/Phone and password are required" });
  }

  const findUserQuery = "SELECT * FROM users WHERE email = ? OR phone = ?";
  db.query(findUserQuery, [emailOrPhone, emailOrPhone], async (err, results) => {
    if (err) return res.status(500).json({ error: err.message });

    if (results.length === 0) {
      return res.status(401).json({ error: "User not found" });
    }

    const user = results[0];

    if (!user.password) {
      return res.status(401).json({ error: "Password not set. Please complete registration." });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ error: "Incorrect password" });
    }

    // Generate JWT
    const token = jwt.sign(
      {
        id: user.id,
        email: user.email,
        first_name: user.first_name,
      },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.json({
      message: "Login successful",
      token,
      user: {
        id: user.id,
        name: user.first_name + " " + user.last_name,
        email: user.email,
      },
    });
  });
});
module.exports = router;
