const express = require("express");
const router = express.Router();
const verifyToken = require("../middleware/verifyToken");
const isAdmin = require("../middleware/isAdmin");

module.exports = (upload) => {
  // GET /api/products — basic product list
  router.get("/", async (req, res) => {
    const conn = req.app.get("db");

    try {
      const [rows] = await conn.promise().query(`
        SELECT 
          p.id,
          p.name,
          p.description,
          p.price,
          p.old_price,
          p.rating,
          p.review_count,
          c.name AS category,
          (
            SELECT url 
            FROM product_images 
            WHERE product_id = p.id 
            ORDER BY id ASC 
            LIMIT 1
          ) AS image_url
        FROM products p
        JOIN categories c ON p.category_id = c.id
      `);

      res.json(rows);
    } catch (err) {
      console.error("Error fetching products:", err);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // GET /api/products/:id — detailed product info
  router.get("/:id", async (req, res) => {
    const productId = req.params.id;
    const conn = req.app.get("db");

    try {
      const [productRows] = await conn.promise().query(`
        SELECT 
          p.id AS product_id,
          p.name,
          p.description,
          p.long_description,
          p.price,
          p.old_price,
          p.rating,
          p.review_count,
          c.name AS category,
          s.name AS seller_name,
          s.rating AS seller_rating,
          s.follower_count,
          s.is_verified
        FROM products p
        JOIN categories c ON p.category_id = c.id
        JOIN sellers s ON p.seller_id = s.id
        WHERE p.id = ?
      `, [productId]);

      if (productRows.length === 0) {
        return res.status(404).json({ error: "Product not found" });
      }

      const product = productRows[0];

      const [images] = await conn.promise().query(
        "SELECT url FROM product_images WHERE product_id = ?",
        [productId]
      );

      const [reviews] = await conn.promise().query(
        `SELECT user_name, rating, comment, created_at 
         FROM product_reviews 
         WHERE product_id = ? 
         ORDER BY created_at DESC`,
        [productId]
      );

      res.json({
        ...product,
        images: images.map(i => i.url),
        reviews
      });
    } catch (err) {
      console.error("Error in GET /products/:id:", err.message);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // POST /api/products — add new product
  router.post("/", verifyToken, isAdmin, async (req, res) => {
    const db = req.app.get("db");
    const {
      name,
      description,
      long_description,
      price,
      old_price,
      rating,
      review_count,
      category_id,
      seller_id
    } = req.body;

    try {
      const [result] = await db.promise().query(
        `
        INSERT INTO products (name, description, long_description, price, old_price, rating, review_count, category_id, seller_id)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
        [name, description, long_description, price, old_price, rating, review_count, category_id, seller_id]
      );

      res.status(201).json({ message: "Product added", product_id: result.insertId });
    } catch (err) {
      console.error("Error adding product:", err.message);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // PUT /api/products/:id — update product
  router.put("/:id", verifyToken, isAdmin, async (req, res) => {
    const db = req.app.get("db");
    const { id } = req.params;
    const {
      name,
      description,
      long_description,
      price,
      old_price,
      rating,
      review_count,
      category_id,
      seller_id
    } = req.body;

    try {
      await db.promise().query(
        `
        UPDATE products
        SET name=?, description=?, long_description=?, price=?, old_price=?, rating=?, review_count=?, category_id=?, seller_id=?
        WHERE id=?
        `,
        [name, description, long_description, price, old_price, rating, review_count, category_id, seller_id, id]
      );

      res.json({ message: "Product updated" });
    } catch (err) {
      console.error("Error updating product:", err.message);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // DELETE /api/products/:id — delete product
  router.delete("/:id", verifyToken, isAdmin, async (req, res) => {
    const db = req.app.get("db");
    const { id } = req.params;

    try {
      await db.promise().query("DELETE FROM products WHERE id = ?", [id]);
      res.json({ message: "Product deleted" });
    } catch (err) {
      console.error("Error deleting product:", err.message);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // POST /api/products/:id/images — upload product image
router.post("/:id/images", verifyToken, isAdmin, upload.single("image"), (req, res) => {
  const db = req.app.get("db");
  const productId = req.params.id;

  if (!req.file || !req.file.path) {
    return res.status(400).json({ error: "No image uploaded" });
  }

  const imageUrl = req.file.path; // Cloudinary URL

  const query = "INSERT INTO product_images (product_id, url) VALUES (?, ?)";
  db.query(query, [productId, imageUrl], (err, result) => {
    if (err) return res.status(500).json({ error: err.message });

    res.status(201).json({ message: "Image uploaded", image_url: imageUrl });
  });
});


  return router;
};
