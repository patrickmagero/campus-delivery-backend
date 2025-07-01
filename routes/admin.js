const express = require("express");
const router = express.Router();
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");

// Admin login
router.post("/login", (req, res) => {
  const db = req.app.get("db");
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: "Email and password are required" });
  }

  const query = "SELECT * FROM users WHERE email = ? AND is_admin = 1";
  db.query(query, [email], async (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    if (results.length === 0) return res.status(403).json({ error: "Unauthorized" });

    const admin = results[0];

    try {
      const match = await bcrypt.compare(password, admin.password);
      if (!match) return res.status(401).json({ error: "Invalid credentials" });

      const token = jwt.sign(
        {
          id: admin.id,
          email: admin.email,
          first_name: admin.first_name,
          is_admin: admin.is_admin,
        },
        process.env.JWT_SECRET,
        { expiresIn: "7d" }
      );

      res.json({
        message: "Login successful",
        token,
        user: {
          id: admin.id,
          name: `${admin.first_name} ${admin.last_name}`,
          email: admin.email,
          role: "admin",
        },
      });
    } catch (bcryptErr) {
      console.error("Bcrypt error:", bcryptErr);
      res.status(500).json({ error: "Something went wrong during authentication" });
    }
  });
});

module.exports = router;
