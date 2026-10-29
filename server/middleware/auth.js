import { createHash } from 'node:crypto';
import db from '../db/init.js';

const hashToken = (token) => createHash('sha256').update(token).digest('hex');

export const authenticate = (req, res, next) => {
  const token = req.headers.authorization?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!token) return res.status(401).json({ success: false, message: 'Sign in required' });
  const session = db.prepare(`
    SELECT u.id, u.username, u.role FROM UserSessions s
    JOIN Users u ON u.id = s.user_id
    WHERE s.token_hash = ? AND s.expires_at > ? AND u.is_active = 1
  `).get(hashToken(token), new Date().toISOString());
  if (!session) return res.status(401).json({ success: false, message: 'Session expired. Sign in again.' });
  req.user = session;
  next();
};

const permissionsByRole = {
  OWNER: new Set(['inventory:read', 'inventory:write', 'purchases:read', 'purchases:write', 'sales:read', 'sales:write', 'dashboard:read']),
  MANAGER: new Set(['inventory:read', 'inventory:write', 'purchases:read', 'purchases:write', 'sales:read', 'sales:write', 'dashboard:read']),
};

export const requirePermission = (permission) => (req, res, next) => {
  const permissions = permissionsByRole[req.user?.role] || new Set();
  if (!permissions.has(permission)) return res.status(403).json({ success: false, message: 'You do not have permission to perform this action.' });
  next();
};
