const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');

const Admin = require('../models/Admin');
const Employee = require('../models/Employee');

const getSecret = () => {
  if (!process.env.JWT_SECRET) {
    const error = new Error('Server misconfigured (missing JWT_SECRET)');
    error.statusCode = 500;
    throw error;
  }
  return process.env.JWT_SECRET;
};

const signToken = ({ id, email, role, selectedEmployeeId = null }) => jwt.sign(
  { email, role, selectedEmployeeId },
  getSecret(),
  {
    subject: String(id),
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  }
);

const configuredAccounts = [
  {
    emailEnv: 'OWNER_EMAIL',
    passwordEnv: 'OWNER_PASSWORD',
    passwordHashEnv: 'OWNER_PASSWORD_HASH',
    legacyEmailEnv: 'ADMIN_EMAIL',
    legacyPasswordEnv: 'ADMIN_PASSWORD',
    legacyPasswordHashEnv: 'ADMIN_PASSWORD_HASH',
    defaultEmail: 'monginis96@gmail.com',
    role: 'owner',
  },
  {
    emailEnv: 'EMPLOYEE_LOGIN_EMAIL',
    passwordEnv: 'EMPLOYEE_LOGIN_PASSWORD',
    passwordHashEnv: 'EMPLOYEE_LOGIN_PASSWORD_HASH',
    defaultEmail: 'employee2121@mail.com',
    role: 'employee',
  },
];

const ensureInitialAdmin = async () => {
  for (const account of configuredAccounts) {
    const configuredEmail = process.env[account.emailEnv] || process.env[account.legacyEmailEnv];
    const email = String(configuredEmail || account.defaultEmail).toLowerCase().trim();
    const configuredHash = process.env[account.passwordHashEnv]
      || process.env[account.legacyPasswordHashEnv]
      || '';
    const password = process.env[account.passwordEnv] || process.env[account.legacyPasswordEnv];
    const existing = await Admin.findOne({ email });

    if (existing) {
      const forceReset = ['1', 'true', 'yes', 'on'].includes(
        String(process.env.AUTH_FORCE_RESET || '').toLowerCase()
      );
      if (existing.role !== account.role || (forceReset && (configuredHash || password))) {
        existing.role = account.role;
        if (forceReset) {
          existing.passwordHash = configuredHash || await bcrypt.hash(String(password), 10);
        }
        await existing.save();
      }
      continue;
    }

    if (!configuredHash && !password) {
      console.warn(`${account.passwordEnv} is not set; skipping ${account.role} account seed.`);
      continue;
    }

    await Admin.create({
      email,
      passwordHash: configuredHash || await bcrypt.hash(String(password), 10),
      role: account.role,
    });
  }
};

const login = async (req, res, expectedRole = null) => {
  const { email, password } = req.body || {};
  const normalizedEmail = String(email || '').toLowerCase().trim();
  const pw = String(password || '');

  if (!normalizedEmail || !pw) {
    return res.status(400).json({ message: 'Email and password required' });
  }

  const accountConfig = configuredAccounts.find((account) => account.role === expectedRole);
  const envEmail = accountConfig
    ? String(process.env[accountConfig.emailEnv] || process.env[accountConfig.legacyEmailEnv] || accountConfig.defaultEmail || '').toLowerCase().trim()
    : '';
  const envHash = accountConfig
    ? String(process.env[accountConfig.passwordHashEnv] || process.env[accountConfig.legacyPasswordHashEnv] || '').trim()
    : '';

  if (mongoose.connection.readyState === 1) {
    const admin = await Admin.findOne({ email: normalizedEmail });
    if (admin && (!expectedRole || admin.role === expectedRole)) {
      const ok = await bcrypt.compare(pw, admin.passwordHash);
      if (!ok) {
        return res.status(401).json({ message: 'Invalid credentials' });
      }

      return res.json({ token: signToken({ id: admin._id, email: admin.email, role: admin.role }) });
    }
  }

  if (!envEmail || !envHash) {
    return res.status(503).json({ message: 'Account is not configured. Contact the site owner.' });
  }

  if (normalizedEmail !== envEmail) {
    return res.status(401).json({ message: 'Invalid email or password' });
  }

  const ok = await bcrypt.compare(pw, envHash);
  if (!ok) {
    return res.status(401).json({ message: 'Invalid email or password' });
  }

  return res.json({
    token: signToken({ id: `env-${expectedRole}`, email: normalizedEmail, role: expectedRole }),
  });
};

const ownerLogin = (req, res) => login(req, res, 'owner');
const employeeLogin = (req, res) => login(req, res, 'employee');

const listActiveEmployees = async (req, res) => {
  const employees = await Employee.find({ isActive: true })
    .select('fullName designation profileImage')
    .sort({ fullName: 1 })
    .lean();
  return res.json({ employees });
};

const selectEmployeeProfile = async (req, res) => {
  const employeeId = String(req.body?.employeeId || '').trim();
  if (!mongoose.isValidObjectId(employeeId)) {
    return res.status(400).json({ message: 'Valid employeeId required' });
  }

  const employee = await Employee.findOne({ _id: employeeId, isActive: true })
    .select('fullName designation profileImage')
    .lean();
  if (!employee) {
    return res.status(404).json({ message: 'Active employee profile not found' });
  }

  return res.json({
    token: signToken({
      id: req.auth.id,
      email: req.auth.email,
      role: 'employee',
      selectedEmployeeId: employee._id,
    }),
    employee,
  });
};

module.exports = {
  login,
  ownerLogin,
  employeeLogin,
  ensureInitialAdmin,
  listActiveEmployees,
  selectEmployeeProfile,
};
