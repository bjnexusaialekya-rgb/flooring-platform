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

/**
 * For client-role requests, forces every downstream query to scope to
 * the caller's own client_id — a client user can never pass a
 * different clientId in params/body and read another company's data.
 */
function scopeToOwnClient(req, res, next) {
  if (req.user.role === 'client') {
    req.effectiveClientId = req.user.clientId;
  } else {
    // staff/admin may act across clients; allow explicit clientId from query/body
    req.effectiveClientId = req.query.clientId || req.body.clientId || null;
  }
  next();
}

module.exports = { requireRole, scopeToOwnClient };
