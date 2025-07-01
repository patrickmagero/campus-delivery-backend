const express = require("express");
const router = express.Router();

// GET all reviews for a product
router.get("/:productId", (req, res) => {
  const db = req.app.get("db");
  const { productId } = req.params;

  const query = `
    SELECT user_name, rating, comment, created_at 
    FROM product_reviews 
    WHERE product_id = ? 
    ORDER BY created_at DESC
  `;

  db.query(query, [productId], (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(results);
  });
});

// POST a review for a product
router.post("/:productId", (req, res) => {
  const db = req.app.get("db");
  const { productId } = req.params;
  const { user_name, rating, comment } = req.body;

  if (!user_name || !rating) {
    return res.status(400).json({ error: "Username and rating are required" });
  }

  const query = `
    INSERT INTO product_reviews (product_id, user_name, rating, comment)
    VALUES (?, ?, ?, ?)
  `;

  db.query(query, [productId, user_name, rating, comment], (err, result) => {
    if (err) return res.status(500).json({ error: err.message });

    res.status(201).json({ message: "Review submitted", review_id: result.insertId });
  });
});

module.exports = router;
