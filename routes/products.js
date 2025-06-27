const express = require("express");
const router = express.Router();

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

// GET /api/products/:id — detailed product page (without missing tables)
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

    // Fetch product images
    const [images] = await conn.promise().query(
      "SELECT url FROM product_images WHERE product_id = ?",
      [productId]
    );

    // Fetch product reviews
    const [reviews] = await conn.promise().query(
      "SELECT user_name, rating, comment, created_at FROM reviews WHERE product_id = ? ORDER BY created_at DESC",
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

module.exports = router;
