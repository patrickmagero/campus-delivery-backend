const express = require("express");
const cors = require("cors");
const mysql = require("mysql2");
const multer = require("multer");
const path = require("path");
require("dotenv").config();
const productRoutes = require("./routes/products");


const app = express();
app.use(cors());
app.use(express.json()); // Parses JSON body

// 👇 Serve static images from /uploads
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// 💾 Multer config for saving uploaded files to /uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, "uploads/"),
  filename: (req, file, cb) => {
    const uniqueName = Date.now() + "-" + file.originalname;
    cb(null, uniqueName);
  },
});
const upload = multer({ storage });

// 📦 MySQL connection
const db = mysql.createConnection({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
});

// 💡 Make db accessible in route files using req.app.get("db")
app.set("db", db);
app.use("/api/products", productRoutes);


// 🔍 GET all products
app.get("/api/products", (req, res) => {
  db.query("SELECT * FROM products", (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(results);
  });
});

// 🛠️ GET all services
app.get("/api/services", (req, res) => {
  db.query("SELECT * FROM services", (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(results);
  });
});

// 📤 POST new product with images
app.post("/api/products", upload.array("images", 5), (req, res) => {
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
  const imageUrls = files.map(f => `http://localhost:5000/uploads/${f.filename}`);

  console.log("Uploading product:", { name, price, seller_id });
  console.log("Files uploaded:", files.map(f => f.originalname));

  // 1. Insert product
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

      // 2. Insert image URLs
      const values = imageUrls.map(url => [productId, url]);
      db.query(
        "INSERT INTO product_images (product_id, url) VALUES ?",
        [values],
        (err2) => {
          if (err2) return res.status(500).json({ error: err2.message });

          // 3. Fetch and return full product
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

// 🚀 Start server
app.listen(5000, () => {
  console.log("API running at http://localhost:5000");
});
