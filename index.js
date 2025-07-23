const express = require("express");
const cors = require("cors");
const mysql = require("mysql2");
const multer = require("multer");
const path = require("path");
require("dotenv").config();

// Routes
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
const paymentRoutes = require("./routes/payments");

// Cloudinary Config
const { storage } = require("./utils/cloudinary");
const upload = multer({ storage });

const app = express();
app.use(cors());
app.use(express.json());

// Database connection pool for TiDB (MySQL-compatible)
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

app.set("db", pool);

// Register routes
app.use("/api/products", productRoutes(upload)); // Pass multer upload for use in route
app.use("/api/services", serviceRoutes);
app.use("/api/users", userRoutes);
app.use("/api/cart", cartRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/categories", categoriesRoute);
app.use("/api/services/:id/reviews", serviceReviewRoutes);
app.use("/api/product-reviews", productReviewRoutes);
app.use("/api/agents", agentAuthRoutes);
app.use("/api/payments", paymentRoutes);

// Start server
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`✅ API running on port ${PORT}`);
});
