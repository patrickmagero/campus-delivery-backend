const express = require("express");
const cors = require("cors");
const mysql = require("mysql2");
const multer = require("multer");
const path = require("path");
require("dotenv").config();

const productRoutes = require("./routes/products");
const serviceRoutes = require("./routes/services");
const userRoutes = require("./routes/users");
const cartRoutes = require("./routes/cart");
const orderRoutes = require("./routes/orders");
const adminRoutes = require("./routes/admin");
const categoriesRoute = require("./routes/categories");
const serviceReviewRoutes = require("./routes/serviceReviews");
const productReviewRoutes = require("./routes/productReviews");
const agentAuthRoutes = require("./routes/agentAuth");

const app = express();
app.use(cors());
app.use(express.json());

// Serve static images from /uploads
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// Multer config for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, "uploads/"),
  filename: (req, file, cb) => {
    const uniqueName = Date.now() + "-" + file.originalname;
    cb(null, uniqueName);
  },
});
const upload = multer({ storage });

// MySQL connection pool for TiDB
const pool = mysql.createPool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT || 4000,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  ssl: { rejectUnauthorized: true }
});

// Make DB accessible in routes via req.app.get("db")
app.set("db", pool);

// Register routes
app.use("/api/products", productRoutes);
app.use("/api/services", serviceRoutes);
app.use("/api/users", userRoutes);
app.use("/api/cart", cartRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/categories", categoriesRoute);
app.use("/api/services/:id/reviews", serviceReviewRoutes);
app.use("/api/product-reviews", productReviewRoutes);
app.use("/api/agents", agentAuthRoutes);

// POST new product with image upload
app.post("/api/products", upload.array("images", 5), (req, res) => {
  const db = req.app.get("db");
  const {
    name,
    price,
    old_price,
    description,
    long_description,
    seller_id,
    category_id,
  } = req.body;

  const files = req.files;
  if (!files || files.length === 0) {
    return res.status(400).json({ error: "No image files uploaded" });
  }

  const parsedPrice = parseFloat(price);
  const parsedOldPrice = parseFloat(old_price || 0);

  const serverUrl = process.env.SERVER_URL || `http://localhost:${PORT}`;
  const imageUrls = files.map(f => `${serverUrl}/uploads/${f.filename}`);

  const insertProductQuery = `
    INSERT INTO products 
    (name, price, old_price, description, long_description, seller_id, category_id) 
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `;

  db.query(
    insertProductQuery,
    [name, parsedPrice, parsedOldPrice, description, long_description, seller_id, category_id],
    (err, result) => {
      if (err) return res.status(500).json({ error: err.message });

      const productId = result.insertId;
      const values = imageUrls.map(url => [productId, url]);

      db.query(
        "INSERT INTO product_images (product_id, url) VALUES ?",
        [values],
        (err2) => {
          if (err2) return res.status(500).json({ error: err2.message });

          db.query("SELECT * FROM products WHERE id = ?", [productId], (err3, rows) => {
            if (err3) return res.status(500).json({ error: err3.message });

            res.status(201).json({
              message: "Product uploaded successfully",
              product: rows[0],
              images: imageUrls
            });
          });
        }
      );
    }
  );
});

// GET all products with category and seller info
app.get("/api/products", (req, res) => {
  const db = req.app.get("db");
  const query = `
    SELECT 
      p.*, 
      c.name AS category,
      s.name AS seller_name,
      s.rating AS seller_rating
    FROM products p
    JOIN categories c ON p.category_id = c.id
    JOIN sellers s ON p.seller_id = s.id
  `;

  db.query(query, (err, results) => {
    if (err) {
      console.error("Error fetching products with category:", err);
      return res.status(500).json({ error: err.message });
    }
    res.json(results);
  });
});

// Start the server on correct port for Render
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`✅ API running on port ${PORT}`);
});
