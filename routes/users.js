const express = require("express");
const router = express.Router();
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

// Register new user (Step 1)
router.post("/register", async (req, res) => {
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
    zipcode,
    address,
    password,
  } = req.body;

  const checkQuery = "SELECT * FROM users WHERE email = ? OR phone = ?";
  db.query(checkQuery, [email, phone], async (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    if (results.length > 0) {
      return res.status(400).json({ error: "Email or phone already exists" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const otp = "123456"; // Use a secure generator in production

    const insertQuery = `
      INSERT INTO users 
      (first_name, last_name, gender, phone, email, country, dob, city, zipcode, address, password, otp_code) 
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    db.query(
      insertQuery,
      [
        first_name,
        last_name,
        gender,
        phone,
        email,
        country,
        dob,
        city,
        zipcode,
        address,
        hashedPassword,
        otp,
      ],
      (err2) => {
        if (err2) return res.status(500).json({ error: err2.message });

        res.status(201).json({
          message: "User registered successfully. Please verify OTP.",
          email,
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
    if (results.length === 0) return res.status(404).json({ error: "User not found" });

    const user = results[0];
    if (user.otp_code !== otp_code) {
      return res.status(400).json({ error: "Invalid OTP code" });
    }

    const updateUserQuery = "UPDATE users SET otp_verified = 1, otp_code = NULL WHERE email = ?";
    db.query(updateUserQuery, [email], (err2) => {
      if (err2) return res.status(500).json({ error: err2.message });

      const token = jwt.sign(
        {
          id: user.id,
          email: user.email,
          first_name: user.first_name,
          is_admin: user.is_admin === 1,
        },
        process.env.JWT_SECRET,
        { expiresIn: "7d" }
      );

      res.json({ message: "OTP verified successfully", token });
    });
  });
});

// Login route
router.post("/login", (req, res) => {
  const db = req.app.get("db");
  const { emailOrPhone, password } = req.body;

  if (!emailOrPhone || !password) {
    return res.status(400).json({ error: "Email/phone and password are required" });
  }

  const query = "SELECT * FROM users WHERE email = ? OR phone = ?";
  db.query(query, [emailOrPhone, emailOrPhone], async (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    if (results.length === 0) return res.status(401).json({ error: "Invalid credentials" });

    const user = results[0];
    if (!user.otp_verified) {
      return res.status(403).json({ error: "Please verify your OTP before logging in" });
    }

    const match = await bcrypt.compare(password, user.password);
    if (!match) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const token = jwt.sign(
      {
        id: user.id,
        email: user.email,
        first_name: user.first_name,
        is_admin: user.is_admin === 1,
      },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.json({
      message: "Login successful",
      token,
      user: {
        id: user.id,
        name: `${user.first_name} ${user.last_name}`,
        email: user.email,
        is_admin: user.is_admin === 1,
      },
    });
  });
});

module.exports = router;
