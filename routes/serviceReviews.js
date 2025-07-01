// routes/serviceReviews.js
const express = require("express");
const router = express.Router({ mergeParams: true });

router.get("/", (req, res) => {
  const db = req.app.get("db");
  const { id: serviceId } = req.params;

  const query = `
    SELECT user_name, rating, comment, created_at 
    FROM service_reviews 
    WHERE service_id = ?
    ORDER BY created_at DESC
  `;

  db.query(query, [serviceId], (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(results);
  });
});

router.post("/", (req, res) => {
  const db = req.app.get("db");
  const { id: serviceId } = req.params;
  const { user_name, rating, comment } = req.body;

  if (!user_name || !rating || !comment) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  const query = `
    INSERT INTO service_reviews (service_id, user_name, rating, comment)
    VALUES (?, ?, ?, ?)
  `;

  db.query(query, [serviceId, user_name, rating, comment], (err, result) => {
    if (err) return res.status(500).json({ error: err.message });

    res.status(201).json({
      message: "Review added",
      review_id: result.insertId
    });
  });
});

module.exports = router;
