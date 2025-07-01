const express = require("express");
const router = express.Router();
const verifyToken = require("../middleware/verifyToken");

// Get all items in the user's cart
router.get("/", verifyToken, (req, res) => {
  const db = req.app.get("db");
  const userId = req.user.id;

  const query = "SELECT * FROM cart_items WHERE user_id = ?";
  db.query(query, [userId], (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(results);
  });
});

// Add an item to the cart
router.post("/add", verifyToken, (req, res) => {
  const db = req.app.get("db");
  const { item_type, item_id, quantity } = req.body;
  const userId = req.user.id;

  if (!["product", "service"].includes(item_type)) {
    return res.status(400).json({ error: "Invalid item type" });
  }

  const query = `
    INSERT INTO cart_items (user_id, item_type, item_id, quantity)
    VALUES (?, ?, ?, ?)
    ON DUPLICATE KEY UPDATE quantity = quantity + VALUES(quantity)
  `;

  db.query(query, [userId, item_type, item_id, quantity], (err) => {
    if (err) return res.status(500).json({ error: err.message });
    res.status(201).json({ message: "Item added to cart" });
  });
});

// Update quantity of a cart item
router.put("/update/:id", verifyToken, (req, res) => {
  const db = req.app.get("db");
  const userId = req.user.id;
  const { quantity } = req.body;

  const query = "UPDATE cart_items SET quantity = ? WHERE id = ? AND user_id = ?";
  db.query(query, [quantity, req.params.id, userId], (err) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ message: "Cart item updated" });
  });
});

// Remove an item from cart
router.delete("/remove/:id", verifyToken, (req, res) => {
  const db = req.app.get("db");
  const userId = req.user.id;

  const query = "DELETE FROM cart_items WHERE id = ? AND user_id = ?";
  db.query(query, [req.params.id, userId], (err) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ message: "Item removed from cart" });
  });
});

module.exports = router;
