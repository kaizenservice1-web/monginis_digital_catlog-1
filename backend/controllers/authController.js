const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const Admin = require('../models/Admin');

const getSecret = () => {
  if (!process.env.JWT_SECRET) {
    const error = new Error('Server misconfigured (missing JWT_SECRET)');
    error.statusCode = 500;
    throw error;
  }
  return process.env.JWT_SECRET;
};

const signToken = (admin) => jwt.sign(
  { email: admin.email },
  getSecret(),
  {
    subject: String(admin._id),
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  }
);

const getAdminEmail = () => String(process.env.ADMIN_EMAIL || '').toLowerCase().trim();

const validateSeedConfiguration = () => {
  const missing = [];
  if (!getAdminEmail()) missing.push('ADMIN_EMAIL');
  if (!process.env.ADMIN_PASSWORD_HASH && !process.env.ADMIN_PASSWORD) {
    missing.push('ADMIN_PASSWORD_HASH or ADMIN_PASSWORD');
  }
  if (missing.length) {
    console.warn(
      `Initial admin account seeding is incomplete. Missing configuration: ${missing.join(', ')}.`
    );
  }
  return missing;
};

const ensureInitialAdmin = async () => {
  validateSeedConfiguration();
  const email = getAdminEmail();
  if (!email) return;

  const existing = await Admin.findOne({ email });
  if (existing) return;

  const passwordHash = process.env.ADMIN_PASSWORD_HASH
    || await bcrypt.hash(String(process.env.ADMIN_PASSWORD), 10);
  await Admin.create({ email, passwordHash });
};

const login = async (req, res) => {
  const email = String(req.body?.email || '').toLowerCase().trim();
  const password = String(req.body?.password || '');
  if (!email || !password) {
    return res.status(400).json({ message: 'Email and password required' });
  }

  if (mongoose.connection.readyState !== 1) {
    return res.status(503).json({ message: 'Database not connected. Please try again later.' });
  }

  const admin = await Admin.findOne({ email });
  if (!admin || !(await bcrypt.compare(password, admin.passwordHash))) {
    return res.status(401).json({ message: 'Invalid email or password' });
  }

  return res.json({ token: signToken(admin) });
};

module.exports = {
  login,
  ensureInitialAdmin,
  validateSeedConfiguration,
};
