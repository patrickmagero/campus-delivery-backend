// utils/notificationService.js
const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

function notifyUserEmail(to, subject, message) {
  const mailOptions = {
    from: `"Campus Delivery" <${process.env.EMAIL_USER}>`,
    to,
    subject,
    text: message,
  };

  transporter.sendMail(mailOptions, (error, info) => {
    if (error) console.error("Email error:", error);
    else console.log(`✅ Email sent to ${to}: ${info.response}`);
  });
}

module.exports = { notifyUserEmail };
