const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
const { pool } = require('../db/pool');
const { requireAuth } = require('../middleware/auth');
const { requireRole } = require('../middleware/role');

const router = express.Router();

// Brute-force protection on login specifically, not the whole API.
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many login attempts. Try again later.' },
});

router.post('/login', loginLimiter, async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'email and password are required' });
  }

  try {
    const result = await pool.query(
      `SELECT id, email, password_hash, role, client_id, display_name, is_active
       FROM users WHERE email = $1`,
      [email.toLowerCase().trim()]
    );

    // Same response shape whether the user doesn't exist or the
    // password is wrong — don't leak which case it was.
    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const user = result.rows[0];
    if (!user.is_active) {
      return res.status(403).json({ error: 'Account is disabled' });
    }

    const passwordMatches = await bcrypt.compare(password, user.password_hash);
    if (!passwordMatches) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const token = jwt.sign(
      {
        userId: user.id,
        role: user.role,
        clientId: user.client_id,
        email: user.email,
      },
      process.env.JWT_SECRET,
      { expiresIn: '8h' }
    );

    return res.status(200).json({
      token,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        displayName: user.display_name,
      },
    });
  } catch (err) {
    console.error('Login error:', err.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * Registration is intentionally NOT self-service — an admin creates
 * accounts for staff and client users. requireAuth + requireRole
 * guard this inline (not in server.js) so ordering can never
 * accidentally let this fall through unprotected.
 */
router.post('/register', requireAuth, requireRole('admin'), async (req, res) => {
  const { email, password, role, clientId, displayName } = req.body;

  if (!email || !password || !role || !displayName) {
    return res.status(400).json({ error: 'email, password, role, displayName are required' });
  }
  if (!['client', 'staff', 'admin'].includes(role)) {
    return res.status(400).json({ error: 'role must be client, staff, or admin' });
  }
  if (role === 'client' && !clientId) {
    return res.status(400).json({ error: 'clientId is required for role=client' });
  }

  try {
    const passwordHash = await bcrypt.hash(password, 12);
    const result = await pool.query(
      `INSERT INTO users (email, password_hash, role, client_id, display_name)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, email, role, display_name`,
      [email.toLowerCase().trim(), passwordHash, role, clientId || null, displayName]
    );
    return res.status(201).json({ user: result.rows[0] });
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'A user with that email already exists' });
    }
    console.error('Register error:', err.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
