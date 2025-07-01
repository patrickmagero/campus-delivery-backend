const express = require("express");
const router = express.Router();
const verifyToken = require("../middleware/verifyToken");
const isAdmin = require("../middleware/isAdmin");
const upload = require("../middleware/upload");


router.get("/", (req, res) => {
  const db = req.app.get("db");

  const query = `
    SELECT 
      s.id, 
      s.name, 
      s.description, 
      s.price, 
      s.rating, 
      s.category,
      (
        SELECT url 
        FROM service_images 
        WHERE service_id = s.id 
        ORDER BY id ASC 
        LIMIT 1
      ) AS image_url
    FROM services s
  `;

  db.query(query, (err, results) => {
    if (err) {
      console.error("Error fetching services:", err);
      return res.status(500).json({ error: err.message });
    }

    res.json(results);
  });
});


// GET /api/services/:id — detailed service info with all images & reviews
router.get("/:id", (req, res) => {
  const db = req.app.get("db");
  const { id } = req.params;

  const serviceQuery = `SELECT * FROM services WHERE id = ?`;
  const imagesQuery = `SELECT url FROM service_images WHERE service_id = ?`;
  const reviewsQuery = `
    SELECT user_name, rating, comment, created_at 
    FROM service_reviews 
    WHERE service_id = ? 
    ORDER BY created_at DESC
  `;

  db.query(serviceQuery, [id], (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    if (results.length === 0) return res.status(404).json({ error: "Service not found" });

    const service = results[0];

    db.query(imagesQuery, [id], (imgErr, imageResults) => {
      if (imgErr) return res.status(500).json({ error: imgErr.message });

      db.query(reviewsQuery, [id], (revErr, reviewResults) => {
        if (revErr) return res.status(500).json({ error: revErr.message });

        res.json({
          ...service,
          images: imageResults.map(i => i.url),
          reviews: reviewResults
        });
      });
    });
  });
});


// Create a new service
router.post("/", verifyToken, isAdmin, (req, res) => {
  const db = req.app.get("db");
  const { name, description, price, rating, category } = req.body;

  const query = `
    INSERT INTO services (name, description, price, rating, category)
    VALUES (?, ?, ?, ?, ?)
  `;

  db.query(query, [name, description, price, rating, category], (err, result) => {
    if (err) return res.status(500).json({ error: err.message });
    res.status(201).json({ message: "Service added", service_id: result.insertId });
  });
});

// Update a service
router.put("/:id", verifyToken, isAdmin, (req, res) => {
  const db = req.app.get("db");
  const { id } = req.params;
  const { name, description, price, rating, category } = req.body;

  const query = `
    UPDATE services
    SET name=?, description=?, price=?, rating=?, category=?
    WHERE id=?
  `;

  db.query(query, [name, description, price, rating, category, id], (err) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ message: "Service updated" });
  });
});

// Delete a service
router.delete("/:id", verifyToken, isAdmin, (req, res) => {
  const db = req.app.get("db");
  const { id } = req.params;

  db.query("DELETE FROM services WHERE id = ?", [id], (err) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ message: "Service deleted" });
  });
});
// POST /api/services/:id/images — upload service image
router.post("/:id/images", verifyToken, isAdmin, upload.single("image"), (req, res) => {
  const db = req.app.get("db");
  const serviceId = req.params.id;

  if (!req.file) return res.status(400).json({ error: "No image uploaded" });

  const imageUrl = `${req.protocol}://${req.get("host")}/uploads/${req.file.filename}`;

  const query = "INSERT INTO service_images (service_id, url) VALUES (?, ?)";
  db.query(query, [serviceId, imageUrl], (err, result) => {
    if (err) return res.status(500).json({ error: err.message });

    res.status(201).json({ message: "Image uploaded", image_url: imageUrl });
  });
});

module.exports = router;
