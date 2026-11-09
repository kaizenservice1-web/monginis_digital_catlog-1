const express = require('express');
const multer = require('multer');

const { authMiddleware, requireRole } = require('../middleware/authMiddleware');
const {
  listCakes,
  getCake,
  createCake,
  updateCake,
  deleteCake,
  likeCake,
  dislikeCake,
  uploadImages,
  bulkUploadCakes,
  deleteImage,
} = require('../controllers/cakeController');

const router = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 8 * 1024 * 1024,
    files: 30,
  },
});

const bulkUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 8 * 1024 * 1024,
    files: 30,
  },
});

// /api/cakes
router.get('/cakes', listCakes);
router.get('/cakes/:id', getCake);
router.post('/cakes', authMiddleware, requireRole('owner'), createCake);
router.patch('/cakes/:id', authMiddleware, requireRole('owner'), updateCake);
router.delete('/cakes/:id', authMiddleware, requireRole('owner'), deleteCake);

// /api/upload
router.post('/upload', authMiddleware, requireRole('owner'), upload.array('images', 30), uploadImages);

// /api/cakes/bulk
router.post('/cakes/bulk', authMiddleware, requireRole('owner'), bulkUpload.array('images', 30), bulkUploadCakes);

// /api/delete
router.post('/delete', authMiddleware, requireRole('owner'), deleteImage);

// /api/like
router.post('/like', likeCake);

// /api/dislike
router.post('/dislike', dislikeCake);

module.exports = router;
