const express = require("express");
const router = express.Router();
const verifyToken = require("../middleware/verifyToken");

// Place an order
router.post("/", verifyToken, (req, res) => {
  const db = req.app.get("db");
  const userId = req.user.id;
  const { delivery_address } = req.body;

  const getCartQuery = "SELECT * FROM cart_items WHERE user_id = ?";
  db.query(getCartQuery, [userId], (err, cartItems) => {
    if (err) return res.status(500).json({ error: err.message });
    if (cartItems.length === 0) return res.status(400).json({ error: "Cart is empty" });

    let total = 0;

    const itemFetches = cartItems.map(item => {
      const table = item.item_type === "product" ? "products" : "services";
      return new Promise((resolve, reject) => {
        db.query(`SELECT price FROM ${table} WHERE id = ?`, [item.item_id], (err2, rows) => {
          if (err2 || rows.length === 0) return reject(err2 || new Error("Item not found"));
          const price = parseFloat(rows[0].price);
          total += price * item.quantity;
          item.price = price;
          resolve(item);
        });
      });
    });

    Promise.all(itemFetches)
      .then(itemsWithPrice => {
        const orderQuery = "INSERT INTO orders (user_id, total_amount, delivery_address) VALUES (?, ?, ?)";
        db.query(orderQuery, [userId, total, delivery_address], (err3, result) => {
          if (err3) return res.status(500).json({ error: err3.message });

          const orderId = result.insertId;
          const values = itemsWithPrice.map(i => [orderId, i.item_type, i.item_id, i.quantity, i.price]);
          const orderItemsQuery = `
            INSERT INTO order_items (order_id, item_type, item_id, quantity, price)
            VALUES ?
          `;
          db.query(orderItemsQuery, [values], (err4) => {
            if (err4) return res.status(500).json({ error: err4.message });

            db.query("DELETE FROM cart_items WHERE user_id = ?", [userId], (err5) => {
              if (err5) return res.status(500).json({ error: err5.message });
              res.status(201).json({ message: "Order placed successfully", order_id: orderId });
            });
          });
        });
      })
      .catch(err => {
        console.error("Item price fetch error:", err);
        res.status(500).json({ error: "Failed to calculate order total" });
      });
  });
});

// Order history
router.get("/", verifyToken, (req, res) => {
  const db = req.app.get("db");
  const userId = req.user.id;

  const query = `
    SELECT id, total_amount, status, delivery_address, tracking_number, delivery_status, created_at
    FROM orders
    WHERE user_id = ?
    ORDER BY created_at DESC
  `;

  db.query(query, [userId], (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(results);
  });
});

// Single order with items
router.get("/:id", verifyToken, (req, res) => {
  const db = req.app.get("db");
  const userId = req.user.id;
  const orderId = req.params.id;

  const orderQuery = "SELECT * FROM orders WHERE id = ? AND user_id = ?";
  db.query(orderQuery, [orderId, userId], (err, orderResults) => {
    if (err) return res.status(500).json({ error: err.message });
    if (orderResults.length === 0) return res.status(404).json({ error: "Order not found" });

    const order = orderResults[0];
    const itemsQuery = "SELECT * FROM order_items WHERE order_id = ?";
    db.query(itemsQuery, [orderId], (err2, items) => {
      if (err2) return res.status(500).json({ error: err2.message });
      res.json({ order, items });
    });
  });
});

// Update tracking info
router.put("/:id/tracking", verifyToken, (req, res) => {
  const db = req.app.get("db");
  const { tracking_number, delivery_status } = req.body;
  const orderId = req.params.id;

  const validStatuses = ["processing", "dispatched", "in_transit", "delivered", "cancelled"];
  if (!validStatuses.includes(delivery_status)) {
    return res.status(400).json({ error: "Invalid delivery status" });
  }

  const query = `
    UPDATE orders 
    SET tracking_number = ?, delivery_status = ?
    WHERE id = ?
  `;

  db.query(query, [tracking_number, delivery_status, orderId], (err) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ message: "Order tracking updated" });
  });
});

module.exports = router;
