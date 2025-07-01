const express = require("express");
const router = express.Router();
const verifyToken = require("../middleware/verifyToken");
const isAdmin = require("../middleware/isAdmin");

// GET /api/categories — fetch all categories
router.get("/", (req, res) => {
  const db = req.app.get("db");

  const query = "SELECT id, name FROM categories ORDER BY name ASC";

  db.query(query, (err, results) => {
    if (err) {
      console.error("Error fetching categories:", err);
      return res.status(500).json({ error: err.message });
    }

    res.json(results);
  });
});

// POST /api/categories — add a new category (admin only)
router.post("/", verifyToken, isAdmin, (req, res) => {
  const db = req.app.get("db");
  const { name } = req.body;

  if (!name) return res.status(400).json({ error: "Category name is required" });

  const query = "INSERT INTO categories (name) VALUES (?)";

  db.query(query, [name], (err, result) => {
    if (err) return res.status(500).json({ error: err.message });
    res.status(201).json({ message: "Category added", category_id: result.insertId });
  });
});

// PUT /api/categories/:id — update a category (admin only)
router.put("/:id", verifyToken, isAdmin, (req, res) => {
  const db = req.app.get("db");
  const { name } = req.body;
  const { id } = req.params;

  const query = "UPDATE categories SET name = ? WHERE id = ?";

  db.query(query, [name, id], (err) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ message: "Category updated" });
  });
});

// DELETE /api/categories/:id — delete a category (admin only)
router.delete("/:id", verifyToken, isAdmin, (req, res) => {
  const db = req.app.get("db");
  const { id } = req.params;

  const query = "DELETE FROM categories WHERE id = ?";

  db.query(query, [id], (err) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ message: "Category deleted" });
  });
});

module.exports = router;
