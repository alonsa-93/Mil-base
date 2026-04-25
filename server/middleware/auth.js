import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'milbase-secret-2024';

export function requireAuth(req, res, next) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) return res.status(401).json({ error: 'לא מורשה' });
  try {
    req.user = jwt.verify(header.slice(7), JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'טוקן לא תקין' });
  }
}

const ROLE_LEVELS = { lohem: 1, samal: 2, rasap: 3, mefaked: 4, magad: 5 };

export function requireRole(minRole) {
  return (req, res, next) => {
    const userLevel = ROLE_LEVELS[req.user?.role] ?? 0;
    const minLevel = ROLE_LEVELS[minRole] ?? 99;
    if (userLevel < minLevel) return res.status(403).json({ error: 'אין הרשאה' });
    next();
  };
}
