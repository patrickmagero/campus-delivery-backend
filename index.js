const express = require("express");
const cors = require("cors");
const mysql = require("mysql2");
require("dotenv").config();


const app = express();
app.use(cors());

// Create DB connection
const db = mysql.createConnection({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD, // Replace with yours
  database: process.env.DB_NAME
});

// Products endpoint
app.get("/api/products", (req, res) => {
  db.query("SELECT * FROM products", (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(results);
  });
});

// Services endpoint
app.get("/api/services", (req, res) => {
  db.query("SELECT * FROM services", (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(results);
  });
});

// Start server
app.listen(5000, () => {
  console.log("API running at http://localhost:5000");
});
