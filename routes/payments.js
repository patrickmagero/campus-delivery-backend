const express = require("express");
const router = express.Router();
const { notifyUserEmail } = require("../utils/notificationService");

// Existing MPESA callback route
router.post("/stk-callback", express.json(), async (req, res) => {
  const db = req.app.get("db");
  const callback = req.body;

  try {
    const stkCallback = callback?.Body?.stkCallback;

    const checkoutRequestID = stkCallback?.CheckoutRequestID;
    const resultCode = stkCallback?.ResultCode;
    const resultDesc = stkCallback?.ResultDesc;

    const metadataItems = stkCallback?.CallbackMetadata?.Item || [];

    const amount = metadataItems.find(item => item.Name === "Amount")?.Value || 0;
    const mpesaReceipt = metadataItems.find(item => item.Name === "MpesaReceiptNumber")?.Value || "N/A";
    const phoneNumber = metadataItems.find(item => item.Name === "PhoneNumber")?.Value || "N/A";

    console.log("MPESA CALLBACK:", JSON.stringify(stkCallback, null, 2));

    // Find payment by transaction_id (assuming you saved checkoutRequestID here)
    const [payments] = await db.query(
      "SELECT * FROM payments WHERE transaction_id = ?",
      [checkoutRequestID]
    );

    if (payments.length === 0) {
      return res.status(404).json({ error: "Payment record not found." });
    }

    const payment = payments[0];

    if (resultCode === 0) {
      // Success case
      await db.query(
        `UPDATE payments 
         SET status = ?, transaction_id = ?, amount = ?, paid_at = NOW() 
         WHERE id = ?`,
        ["COMPLETED", mpesaReceipt, amount, payment.id]
      );

      await db.query(
        `UPDATE orders SET payment_status = ? WHERE id = ?`,
        ["PAID", payment.order_id]
      );

      await notifyUserEmail(payment.user_id, "Payment Successful", `
        Your payment of KES ${amount} was successful.
        Order ID: ${payment.order_id}. Transaction: ${mpesaReceipt}.
      `);

    } else {
      // Failure case
      await db.query(
        `UPDATE payments 
         SET status = ?, paid_at = NOW() 
         WHERE id = ?`,
        ["FAILED", payment.id]
      );

      await notifyUserEmail(payment.user_id, "Payment Failed", `
        Your payment attempt failed: "${resultDesc}".
        Please try again later or use a different method.
      `);
    }

    res.json({ message: "Callback processed successfully." });

  } catch (error) {
    console.error("STK Callback Error:", error.message);
    res.status(500).json({ error: "Callback processing failed." });
  }
});

// POST /initiate-payment - initiate a payment request
router.post("/initiate-payment", express.json(), async (req, res) => {
  const db = req.app.get("db");
  const { user_id, order_id, amount, payment_method } = req.body;

  if (!user_id || !order_id || !amount || !payment_method) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  try {
    // Insert a new payment record with status 'PENDING'
    const [result] = await db.query(
      `INSERT INTO payments (user_id, order_id, amount, payment_method, status, created_at)
       VALUES (?, ?, ?, ?, 'PENDING', NOW())`,
      [user_id, order_id, amount, payment_method]
    );

    // Here you would integrate with payment gateway to initiate payment
    // For now, just return the payment ID and status
    res.status(201).json({
      message: "Payment initiated",
      payment_id: result.insertId,
      status: "PENDING"
    });
  } catch (error) {
    console.error("Error initiating payment:", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /status/:paymentId - check payment status
router.get("/status/:paymentId", async (req, res) => {
  const db = req.app.get("db");
  const { paymentId } = req.params;

  try {
    const [payments] = await db.query(
      "SELECT id, user_id, order_id, amount, payment_method, status, created_at, paid_at FROM payments WHERE id = ?",
      [paymentId]
    );

    if (payments.length === 0) {
      return res.status(404).json({ error: "Payment not found" });
    }

    res.json(payments[0]);
  } catch (error) {
    console.error("Error fetching payment status:", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /refund/:paymentId - refund a payment
router.post("/refund/:paymentId", async (req, res) => {
  const db = req.app.get("db");
  const { paymentId } = req.params;

  try {
    // Check if payment exists and is completed
    const [payments] = await db.query(
      "SELECT * FROM payments WHERE id = ? AND status = 'COMPLETED'",
      [paymentId]
    );

    if (payments.length === 0) {
      return res.status(404).json({ error: "Payment not found or not completed" });
    }

    // Update payment status to REFUNDED
    await db.query(
      "UPDATE payments SET status = 'REFUNDED', refunded_at = NOW() WHERE id = ?",
      [paymentId]
    );

    // Optionally, update order payment status or other related tables here

    res.json({ message: "Payment refunded successfully" });
  } catch (error) {
    console.error("Error processing refund:", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
});

module.exports = router;
