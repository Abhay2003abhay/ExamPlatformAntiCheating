const express = require('express');
const router = express.Router();
const examController = require('../controllers/examController');
const { identifier } = require('../middlewares/identification');
const authorizeRoles = require('../middlewares/authorizeRoles');

const TEST_TAKERS = ['candidate', 'intern', 'developer'];

router.post('/create', identifier, authorizeRoles('admin'), examController.createTest);
router.post('/add-questions', identifier, authorizeRoles('admin'), examController.addQuestions);

router.post('/agent-test', identifier, authorizeRoles('admin'), examController.generateAgentTest);
router.get('/all', identifier, examController.getAllTests);
router.get('/progress/:progressId', identifier, authorizeRoles(...TEST_TAKERS), examController.getUserProgress);
router.get('/:testId', identifier, examController.getTestById);
router.get('/:testId/questions', identifier, examController.getTestQuestions);

router.post('/start', identifier, authorizeRoles(...TEST_TAKERS), examController.startTest);
router.post('/save-answer', identifier, authorizeRoles(...TEST_TAKERS), examController.saveAnswer);
router.post('/submit', identifier, authorizeRoles(...TEST_TAKERS), examController.submitTest);
router.post('/update-time', identifier, authorizeRoles(...TEST_TAKERS), examController.updateTimeRemaining);

module.exports = router;
