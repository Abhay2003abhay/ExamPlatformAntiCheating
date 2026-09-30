const express = require('express');
const router = express.Router();
const multer = require('multer');
const cheatingController = require('../controllers/cheatingController');
const { identifier } = require('../middlewares/identification');
const authorizeRoles = require('../middlewares/authorizeRoles');

const TEST_TAKERS = ['candidate', 'intern', 'developer'];

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
});

router.post('/log', identifier, authorizeRoles(...TEST_TAKERS), cheatingController.logCheatingEvent);
router.post('/check-webcam', identifier, authorizeRoles(...TEST_TAKERS), upload.single('image'), cheatingController.checkWebcamImage);
router.get('/logs/:progressId', identifier, authorizeRoles('admin', ...TEST_TAKERS), cheatingController.getCheatingLogs);

router.get('/admin/logs/:testId', identifier, authorizeRoles('admin'), cheatingController.getAllCheatingLogs);
router.get('/admin/stats/:testId', identifier, authorizeRoles('admin'), cheatingController.getCheatingStats);

module.exports = router;
