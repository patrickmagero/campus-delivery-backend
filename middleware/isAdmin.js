module.exports = function (req, res, next) {
  if (req.user && req.user.is_admin) {
    next();
  } else {
    return res.status(403).json({ error: "Access denied. Admins only." });
  }
};
