const express = require('express');
const {
  login,
  ownerLogin,
  employeeLogin,
  listActiveEmployees,
  selectEmployeeProfile,
} = require('../controllers/authController');
const { authMiddleware, requireRole } = require('../middleware/authMiddleware');

const router = express.Router();

// /api/admin/login
router.post('/login', ownerLogin);
router.post('/owner/login', ownerLogin);
router.post('/employee/login', employeeLogin);
router.get('/employee/profiles', authMiddleware, requireRole('employee'), listActiveEmployees);
router.post('/employee/select-profile', authMiddleware, requireRole('employee'), selectEmployeeProfile);

module.exports = router;
