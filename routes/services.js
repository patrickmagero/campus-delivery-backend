const express = require("express");
const router = express.Router();
const verifyToken = require("../middleware/verifyToken");
const isAdmin = require("../middleware/isAdmin");

module.exports = (upload) => {
  // GET /api/services — list all services
  router.get("/", async (req, res) => {
    const db = req.app.get("db");

    try {
      const [results] = await db.promise().query(`
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
      `);
      res.json(results);
    } catch (err) {
      console.error("Error fetching services:", err.message);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // GET /api/services/:id — detailed service info
  router.get("/:id", async (req, res) => {
    const db = req.app.get("db");
    const { id } = req.params;

    try {
      const [[service]] = await db.promise().query("SELECT * FROM services WHERE id = ?", [id]);

      if (!service) return res.status(404).json({ error: "Service not found" });

      const [images] = await db.promise().query("SELECT url FROM service_images WHERE service_id = ?", [id]);
      const [reviews] = await db.promise().query(
        `SELECT user_name, rating, comment, created_at 
         FROM service_reviews 
         WHERE service_id = ? 
         ORDER BY created_at DESC`,
        [id]
      );

      res.json({
        ...service,
        images: images.map(img => img.url),
        reviews
      });
    } catch (err) {
      console.error("Error fetching service:", err.message);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // POST /api/services — create new service
  router.post("/", verifyToken, isAdmin, async (req, res) => {
    const db = req.app.get("db");
    const { name, description, price, rating, category } = req.body;

    try {
      const [result] = await db.promise().query(
        `INSERT INTO services (name, description, price, rating, category) VALUES (?, ?, ?, ?, ?)`,
        [name, description, price, rating, category]
      );
      res.status(201).json({ message: "Service added", service_id: result.insertId });
    } catch (err) {
      console.error("Error adding service:", err.message);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // PUT /api/services/:id — update service
  router.put("/:id", verifyToken, isAdmin, async (req, res) => {
    const db = req.app.get("db");
    const { id } = req.params;
    const { name, description, price, rating, category } = req.body;

    try {
      await db.promise().query(
        `UPDATE services SET name=?, description=?, price=?, rating=?, category=? WHERE id=?`,
        [name, description, price, rating, category, id]
      );
      res.json({ message: "Service updated" });
    } catch (err) {
      console.error("Error updating service:", err.message);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // DELETE /api/services/:id — delete service
  router.delete("/:id", verifyToken, isAdmin, async (req, res) => {
    const db = req.app.get("db");
    const { id } = req.params;

    try {
      await db.promise().query("DELETE FROM services WHERE id = ?", [id]);
      res.json({ message: "Service deleted" });
    } catch (err) {
      console.error("Error deleting service:", err.message);
      res.status(500).json({ error: "Internal server error" });
    }
  });

 // POST /api/services/:id/images — upload service image
router.post("/:id/images", verifyToken, isAdmin, upload.single("image"), (req, res) => {
  const db = req.app.get("db");
  const serviceId = req.params.id;

  if (!req.file || !req.file.path) {
    return res.status(400).json({ error: "No image uploaded" });
  }

  const imageUrl = req.file.path; // Cloudinary URL

  const query = "INSERT INTO service_images (service_id, url) VALUES (?, ?)";
  db.query(query, [serviceId, imageUrl], (err, result) => {
    if (err) return res.status(500).json({ error: err.message });

    res.status(201).json({ message: "Image uploaded", image_url: imageUrl });
  });
});


  return router;
};
