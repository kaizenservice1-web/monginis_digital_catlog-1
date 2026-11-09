const jwt = require('jsonwebtoken');

const authMiddleware = (req, res, next) => {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;

  if (!token) {
    return res.status(401).json({ message: 'Missing token' });
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.auth = {
      id: payload.sub,
      email: payload.email,
      role: payload.role,
      selectedEmployeeId: payload.selectedEmployeeId || null,
    };
    return next();
  } catch {
    return res.status(401).json({ message: 'Invalid token' });
  }
};

const requireRole = (...roles) => (req, res, next) => {
  if (!req.auth || !roles.includes(req.auth.role)) {
    return res.status(403).json({ message: 'Insufficient permissions' });
  }
  return next();
};

const requireSelectedEmployee = (req, res, next) => {
  if (req.auth?.role !== 'employee' || !req.auth.selectedEmployeeId) {
    return res.status(403).json({ message: 'Select an employee profile first' });
  }
  return next();
};

module.exports = { authMiddleware, requireRole, requireSelectedEmployee };
