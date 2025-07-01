const express = require("express");
const router = express.Router();
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const JWT_SECRET = process.env.JWT_SECRET || "agentSecretKey"; // Set securely in env

// Agent login
router.post("/login", (req, res) => {
  const db = req.app.get("db");
  const { email, password } = req.body;

  const query = `SELECT * FROM delivery_agents WHERE email = ? AND is_active = 1`;
  db.query(query, [email], async (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    if (results.length === 0) return res.status(401).json({ error: "Invalid credentials" });

    const agent = results[0];
    const passwordMatch = await bcrypt.compare(password, agent.password);
    if (!passwordMatch) return res.status(401).json({ error: "Invalid credentials" });

    const token = jwt.sign(
      { id: agent.id, role: "agent" },
      JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.json({ token, agent: { id: agent.id, name: agent.name, email: agent.email } });
  });
});
router.post("/register", async (req, res) => {
  const db = req.app.get("db");
  const { name, phone, email, password } = req.body;

  const hashedPassword = await bcrypt.hash(password, 10);
  const query = `
    INSERT INTO delivery_agents (name, phone, email, password)
    VALUES (?, ?, ?, ?)
  `;

  db.query(query, [name, phone, email, hashedPassword], (err, result) => {
    if (err) return res.status(500).json({ error: err.message });
    res.status(201).json({ message: "Agent registered", agent_id: result.insertId });
  });
});
module.exports = router;

