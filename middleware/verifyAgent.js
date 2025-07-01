const jwt = require("jsonwebtoken");
const JWT_SECRET = process.env.JWT_SECRET || "agentSecretKey";

function verifyAgent(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ error: "Missing token" });

  const token = authHeader.split(" ")[1];
  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err || decoded.role !== "agent") {
      return res.status(403).json({ error: "Unauthorized" });
    }

    req.agent = decoded;
    next();
  });
}

module.exports = verifyAgent;
