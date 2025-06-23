const express = require("express");
const cors = require("cors");
const mysql = require("mysql2");

const app = express();
app.use(cors());

// Create DB connection
const db = mysql.createConnection({
  host: "localhost",
  user: "root",
  password: "your_password", // Replace with yours
  database: "campus_delivery"
});

// Products endpoint
app.get("/products", (req, res) => {
  db.query("SELECT * FROM products", (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(results);
  });
});

// Services endpoint
app.get("/services", (req, res) => {
  db.query("SELECT * FROM services", (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(results);
  });
});

// Start server
app.listen(5000, () => {
  console.log("API running at http://localhost:5000");
});
