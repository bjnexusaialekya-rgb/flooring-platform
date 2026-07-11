/**
 * requireRole('staff', 'admin') -> only those roles pass.
 * Must run AFTER requireAuth so req.user is populated.
 */
function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Insufficient role for this action' });
    }
    next();
  };
}

module.exports = { requireRole };
