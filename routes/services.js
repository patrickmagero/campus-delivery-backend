const express = require("express");
const router = express.Router();

router.get("/", (req, res) => {
  const db = req.app.get("db");

  const query = `
    SELECT id, name, description, price, rating, category 
    FROM services
  `;

  db.query(query, (err, results) => {
    if (err) {
      console.error("Error fetching services:", err);
      return res.status(500).json({ error: err.message });
    }

    res.json(results);
  });
});
router.get("/:id", (req, res) => {
  const db = req.app.get("db");
  const { id } = req.params;
  console.log("Service ID from URL:", id);

  const query = `SELECT * FROM services WHERE id = ?`;

  db.query(query, [id], (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    if (results.length === 0) return res.status(404).json({ error: "Not found" });

    res.json(results[0]);
  });
});

module.exports = router;
