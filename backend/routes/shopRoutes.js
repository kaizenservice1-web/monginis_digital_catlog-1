const express = require('express');
const { authMiddleware, requireRole } = require('../middleware/authMiddleware');
const { getShopInfo, updateShopInfo } = require('../controllers/shopController');

const router = express.Router();

// /api/shop-info
router.get('/shop-info', getShopInfo);
router.put('/shop-info', authMiddleware, requireRole('owner'), updateShopInfo);

module.exports = router;
