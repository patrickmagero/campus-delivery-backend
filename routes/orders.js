const express = require("express");
const router = express.Router();
const verifyToken = require("../middleware/verifyToken");
const verifyAdmin = require("../middleware/verifyAdmin");
const verifyAgent = require("../middleware/verifyAgent");
const { notifyUserEmail } = require("../utils/notificationService");

// Helper function to fetch user email by order ID
function getUserEmailByOrder(db, orderId, callback) {
  const query = `
    SELECT u.email
    FROM users u
    JOIN orders o ON u.id = o.user_id
    WHERE o.id = ?
  `;
  db.query(query, [orderId], (err, rows) => {
    if (err || rows.length === 0) return callback(null);
    callback(rows[0].email);
  });
}

// Place an order and auto-assign a delivery agent
router.post("/", verifyToken, (req, res) => {
  const db = req.app.get("db");
  const userId = req.user.id;
  const { delivery_address } = req.body;

  db.query("SELECT * FROM cart_items WHERE user_id = ?", [userId], (err, cartItems) => {
    if (err) return res.status(500).json({ error: err.message });
    if (cartItems.length === 0) return res.status(400).json({ error: "Cart is empty" });

    let total = 0;
    const itemFetches = cartItems.map(item => {
      const table = item.item_type === "product" ? "products" : "services";
      return new Promise((resolve, reject) => {
        db.query(`SELECT price FROM ${table} WHERE id = ?`, [item.item_id], (err, rows) => {
          if (err || rows.length === 0) return reject(err || new Error("Item not found"));
          const price = parseFloat(rows[0].price);
          total += price * item.quantity;
          item.price = price;
          resolve(item);
        });
      });
    });

    Promise.all(itemFetches).then(itemsWithPrice => {
      const agentQuery = `
        SELECT da.id FROM delivery_agents da
        LEFT JOIN orders o ON da.id = o.agent_id AND o.delivery_status != 'delivered'
        GROUP BY da.id ORDER BY COUNT(o.id) ASC LIMIT 1
      `;
      db.query(agentQuery, (err, agents) => {
        if (err || agents.length === 0) return res.status(500).json({ error: "No available agents" });

        const assignedAgentId = agents[0].id;
        const orderQuery = `
          INSERT INTO orders (user_id, total_amount, delivery_address, agent_id)
          VALUES (?, ?, ?, ?)
        `;
        db.query(orderQuery, [userId, total, delivery_address, assignedAgentId], (err, result) => {
          if (err) return res.status(500).json({ error: err.message });

          const orderId = result.insertId;
          const itemValues = itemsWithPrice.map(i => [orderId, i.item_type, i.item_id, i.quantity, i.price]);
          db.query(`
            INSERT INTO order_items (order_id, item_type, item_id, quantity, price)
            VALUES ?
          `, [itemValues], (err) => {
            if (err) return res.status(500).json({ error: err.message });

            db.query("DELETE FROM cart_items WHERE user_id = ?", [userId], () => {
              getUserEmailByOrder(db, orderId, email => {
                if (email) {
                  notifyUserEmail(email, "Order Placed", `Your order #${orderId} has been placed successfully and assigned to a delivery agent.`);
                }
              });

              res.status(201).json({
                message: "Order placed and agent assigned",
                order_id: orderId,
                agent_id: assignedAgentId
              });
            });
          });
        });
      });
    }).catch(err => {
      res.status(500).json({ error: "Failed to calculate order total" });
    });
  });
});

// Get user's order history
router.get("/", verifyToken, (req, res) => {
  const db = req.app.get("db");
  const userId = req.user.id;

  db.query(`
    SELECT id, total_amount, status, delivery_address, tracking_number, delivery_status, created_at
    FROM orders WHERE user_id = ? ORDER BY created_at DESC
  `, [userId], (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(results);
  });
});

// Get a single order with items
router.get("/:id", verifyToken, (req, res) => {
  const db = req.app.get("db");
  const orderId = req.params.id;
  const userId = req.user.id;

  db.query("SELECT * FROM orders WHERE id = ? AND user_id = ?", [orderId, userId], (err, orders) => {
    if (err) return res.status(500).json({ error: err.message });
    if (orders.length === 0) return res.status(404).json({ error: "Order not found" });

    db.query("SELECT * FROM order_items WHERE order_id = ?", [orderId], (err, items) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ order: orders[0], items });
    });
  });
});

// Update delivery tracking info
router.put("/:id/tracking", verifyToken, (req, res) => {
  const db = req.app.get("db");
  const orderId = req.params.id;
  const { tracking_number, delivery_status } = req.body;

  const validStatuses = ["processing", "dispatched", "in_transit", "delivered", "cancelled"];
  if (!validStatuses.includes(delivery_status)) {
    return res.status(400).json({ error: "Invalid delivery status" });
  }

  db.query(`
    UPDATE orders SET tracking_number = ?, delivery_status = ? WHERE id = ?
  `, [tracking_number, delivery_status, orderId], (err) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ message: "Tracking info updated" });
  });
});

// Admin: Get all orders
router.get("/admin/all", verifyToken, verifyAdmin, (req, res) => {
  const db = req.app.get("db");
  db.query(`
    SELECT o.id, o.total_amount, o.status, o.delivery_address, o.tracking_number,
           o.delivery_status, o.created_at, u.name AS customer_name, u.email AS customer_email
    FROM orders o
    JOIN users u ON o.user_id = u.id
    ORDER BY o.created_at DESC
  `, (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(results);
  });
});

// Admin: Update order status (paid, cancelled, etc.)
router.put("/:id/status", verifyToken, verifyAdmin, (req, res) => {
  const db = req.app.get("db");
  const orderId = req.params.id;
  const { status } = req.body;

  const validStatuses = ["pending", "paid", "cancelled", "failed"];
  if (!validStatuses.includes(status)) {
    return res.status(400).json({ error: "Invalid status" });
  }

  db.query("UPDATE orders SET status = ? WHERE id = ?", [status, orderId], (err) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ message: "Order status updated" });

    getUserEmailByOrder(db, orderId, email => {
      if (email) {
        notifyUserEmail(email, "Order Status Changed", `Your order #${orderId} status is now '${status}'.`);
      }
    });
  });
});

// Admin: Delete order
router.delete("/:id", verifyToken, verifyAdmin, (req, res) => {
  const db = req.app.get("db");
  const orderId = req.params.id;

  db.query("SELECT status FROM orders WHERE id = ?", [orderId], (err, rows) => {
    if (err || rows.length === 0) return res.status(404).json({ error: "Order not found" });

    const status = rows[0].status;
    if (!["pending", "cancelled"].includes(status)) {
      return res.status(403).json({ error: "Cannot delete order unless pending or cancelled" });
    }

    db.query("DELETE FROM orders WHERE id = ?", [orderId], (err) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ message: "Order deleted" });
    });
  });
});
// Admin: Soft-cancel an order (mark as "Canceled" but keep record)
router.put("/cancel/:id", verifyToken, verifyAdmin, async (req, res) => {
  const db = req.app.get("db");
  const orderId = req.params.id;
  const { reason } = req.body; // Optional reason for cancelation

  try {
    const [rows] = await db.query("SELECT * FROM orders WHERE id = ?", [orderId]);

    if (!rows.length) {
      return res.status(404).json({ message: "Order not found." });
    }

    const order = rows[0];

    if (order.status.toLowerCase() === "delivered") {
      return res.status(400).json({ message: "Delivered orders cannot be canceled." });
    }

    if (order.status.toLowerCase() === "canceled") {
      return res.status(400).json({ message: "Order is already canceled." });
    }

    // Optional: log cancellation reason in DB if you have a column
    await db.query(
      "UPDATE orders SET status = ?, cancellation_reason = ?, updated_at = NOW() WHERE id = ?",
      ["Canceled", reason || null, orderId]
    );

    // Optional: notify user via email
    await notifyUserEmail(order.user_id, "Your order has been canceled by an admin.");

    res.status(200).json({ message: "Order canceled successfully by admin." });
  } catch (err) {
    console.error("Error canceling order:", err);
    res.status(500).json({ message: "Server error while canceling order." });
  }
});


// Tracking info for user
router.get("/:id/tracking", verifyToken, (req, res) => {
  const db = req.app.get("db");
  const orderId = req.params.id;
  const userId = req.user.id;

  db.query(`
    SELECT tracking_number, delivery_status, updated_at FROM orders
    WHERE id = ? AND user_id = ?
  `, [orderId, userId], (err, rows) => {
    if (err || rows.length === 0) return res.status(404).json({ error: "Tracking not found" });
    res.json(rows[0]);
  });
});

// Public tracking by tracking number
router.get("/track/:tracking_number", (req, res) => {
  const db = req.app.get("db");
  const trackingNumber = req.params.tracking_number;

  db.query(`
    SELECT id AS order_id, delivery_status, updated_at
    FROM orders WHERE tracking_number = ?
  `, [trackingNumber], (err, rows) => {
    if (err || rows.length === 0) return res.status(404).json({ error: "Tracking not found" });
    res.json(rows[0]);
  });
});

// Agent: Assigned orders
router.get("/agents/me/orders", verifyAgent, (req, res) => {
  const db = req.app.get("db");
  const agentId = req.agent.id;

  db.query(`
    SELECT id, user_id, delivery_address, delivery_status, tracking_number, total_amount, updated_at
    FROM orders WHERE agent_id = ?
    ORDER BY updated_at DESC
  `, [agentId], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

// Agent: Update delivery status
router.put("/agents/me/orders/:orderId/status", verifyAgent, (req, res) => {
  const db = req.app.get("db");
  const agentId = req.agent.id;
  const orderId = req.params.orderId;
  const { delivery_status } = req.body;

  const validStatuses = ["processing", "dispatched", "in_transit", "delivered"];
  if (!validStatuses.includes(delivery_status)) {
    return res.status(400).json({ error: "Invalid delivery status" });
  }

  db.query(`
    UPDATE orders SET delivery_status = ? WHERE id = ? AND agent_id = ?
  `, [delivery_status, orderId, agentId], (err, result) => {
    if (err) return res.status(500).json({ error: err.message });
    if (result.affectedRows === 0) {
      return res.status(403).json({ error: "Order not found or unauthorized" });
    }

    res.json({ message: "Delivery status updated" });

    getUserEmailByOrder(db, orderId, email => {
      if (email) {
        notifyUserEmail(email, "Delivery Update", `Your order #${orderId} is now '${delivery_status}'.`);
      }
    });
  });
});

module.exports = router;
