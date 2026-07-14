const jwt = require('jsonwebtoken');

/**
 * Verifies the JWT on every protected request and attaches the decoded
 * payload to req.user. Does NOT trust any role/client_id claim the
 * client might try to pass in the request body — only what's signed
 * into the token at login time.
 */
function requireAuth(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or malformed Authorization header' });
  }

  const token = header.slice('Bearer '.length);
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.user = payload; // { userId, role, clientId, propertyId, email }
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

module.exports = { requireAuth };
