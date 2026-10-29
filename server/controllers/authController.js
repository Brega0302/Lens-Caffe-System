import bcrypt from 'bcrypt';
import { createHash, randomBytes } from 'node:crypto';
import db from '../db/init.js';

const hashToken = (token) => createHash('sha256').update(token).digest('hex');
const loginAttempts = new Map();

export const login = async (req, res) => {
  const { username, password } = req.body || {};

  if (typeof username !== 'string' || typeof password !== 'string' || !username.trim() || !password || username.length > 120 || password.length > 200) {
    return res.status(400).json({ success: false, message: 'Username and password are required' });
  }

  try {
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    const now = Date.now();
    const previous = loginAttempts.get(ip);
    if (previous && previous.resetAt > now && previous.count >= 10) {
      return res.status(429).json({ success: false, message: 'Too many sign-in attempts. Try again in 15 minutes.' });
    }
    if (!previous || previous.resetAt <= now) loginAttempts.set(ip, { count: 0, resetAt: now + 15 * 60 * 1000 });
    const user = db.prepare('SELECT * FROM Users WHERE username = ?').get(username.trim());

    if (!user || !user.is_active) {
      const attempts = loginAttempts.get(ip);
      loginAttempts.set(ip, { ...attempts, count: attempts.count + 1 });
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    const isMatch = await bcrypt.compare(password, user.password_hash);

    if (!isMatch) {
      const attempts = loginAttempts.get(ip);
      loginAttempts.set(ip, { ...attempts, count: attempts.count + 1 });
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    loginAttempts.delete(ip);
    const token = randomBytes(32).toString('base64url');
    const expiresAt = new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString();
    db.prepare('DELETE FROM UserSessions WHERE expires_at <= ?').run(new Date().toISOString());
    db.prepare('INSERT INTO UserSessions (user_id, token_hash, expires_at) VALUES (?, ?, ?)')
      .run(user.id, hashToken(token), expiresAt);
    res.json({
      success: true,
      user: {
        id: user.id,
        username: user.username,
        role: user.role || 'OWNER'
      },
      token,
      expiresAt
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

export const logout = (req, res) => {
  const token = req.headers.authorization?.replace(/^Bearer\s+/i, '');
  if (token) db.prepare('DELETE FROM UserSessions WHERE token_hash = ?').run(hashToken(token));
  res.status(204).end();
};
