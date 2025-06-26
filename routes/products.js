const express = require("express");
const router = express.Router();



// GET /api/products/:id — full product info
router.get("/:id", async (req, res) => {
  const productId = req.params.id;
  const conn = req.app.get("db"); // get db connection from app

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

    // Related info
    const [images] = await conn.promise().query(
      "SELECT url FROM product_images WHERE product_id = ?",
      [productId]
    );

    const [variants] = await conn.promise().query(
      "SELECT color, size, stock FROM product_variants WHERE product_id = ?",
      [productId]
    );

    const [tags] = await conn.promise().query(
      "SELECT tag FROM product_tags WHERE product_id = ?",
      [productId]
    );

    const [reviews] = await conn.promise().query(
      "SELECT user_name, rating, comment, created_at FROM reviews WHERE product_id = ? ORDER BY created_at DESC",
      [productId]
    );

    const [related] = await conn.promise().query(`
      SELECT p.id, p.name, p.price 
      FROM related_products r
      JOIN products p ON r.related_id = p.id
      WHERE r.product_id = ?
    `, [productId]);

    res.json({
      ...product,
      images: images.map(i => i.url),
      variants,
      tags: tags.map(t => t.tag),
      reviews,
      related_products: related
    });
  } catch (err) {
    console.error("Error in GET /products/:id:", err.message);
    res.status(500).json({ error: "Internal server error" });
  }
});

module.exports = router;
