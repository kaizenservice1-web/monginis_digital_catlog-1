const express = require('express');
const { authMiddleware, requireRole } = require('../middleware/authMiddleware');
const {
  listCategories,
  createCategory,
  updateCategory,
  deleteCategory,
} = require('../controllers/categoryController');

const router = express.Router();

// /api/categories
router.get('/categories', listCategories);
router.post('/categories', authMiddleware, requireRole('owner'), createCategory);
router.put('/categories/:id', authMiddleware, requireRole('owner'), updateCategory);
router.delete('/categories/:id', authMiddleware, requireRole('owner'), deleteCategory);

module.exports = router;
