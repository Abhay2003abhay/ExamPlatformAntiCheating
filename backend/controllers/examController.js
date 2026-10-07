const Test = require('../models/testModel');
const Question = require('../models/questionModel');
const UserProgress = require('../models/userProgressModel');
const { generateQuestions } = require('../services/groqService');

// Create a new test using agent (user-facing)
exports.generateAgentTest = async (req, res) => {
	try {
		const { topic, title } = req.body;
		if (!topic || !title) {
			return res.status(400).json({ success: false, message: 'Topic and title are required.' });
		}

		// 1. Generate questions using Groq
		const questions = await generateQuestions(topic, 5);
		const totalMarks = questions.reduce((sum, q) => sum + q.marks, 0);

		// 2. Create a new Test
		const newTest = new Test({
			title,
			description: `An AI-generated test on ${topic}.`,
			duration: 10, // Default duration
			totalMarks,
			passingMarks: Math.ceil(totalMarks * 0.6), // Default passing marks (60%)
			isActive: true,
			allowedAttempts: 1,
			instructions: 'This is an AI-generated test. Answer all questions to the best of your ability.',
			createdBy: req.user.userId, // Associate test with the user who created it
		});

		const savedTest = await newTest.save();

		// 3. Create and link questions to the new test
		const questionDocs = questions.map((q) => ({
			...q,
			testId: savedTest._id,
		}));

		const savedQuestions = await Question.insertMany(questionDocs);

		// 4. Respond with the new test and questions (without answers)
		const questionsForStudent = savedQuestions.map(({ correctAnswer, ...rest }) => rest);

		res.status(201).json({
			success: true,
			message: 'Agent-generated test created successfully',
			test: savedTest,
			questions: questionsForStudent,
		});
	} catch (error) {
		console.error('Error generating agent test:', error);
		res.status(500).json({ success: false, message: 'Failed to generate agent test', error: error.message });
	}
};

// Create a new test (Admin only)
exports.createTest = async (req, res) => {
	try {
		const { title, description, duration, totalMarks, passingMarks, startTime, endTime, instructions, allowedAttempts } = req.body;

		const newTest = new Test({
			title,
			description,
			duration,
			totalMarks,
			passingMarks,
			startTime,
			endTime,
			instructions,
			allowedAttempts,
			createdBy: req.user.userId,
		});

		const savedTest = await newTest.save();
		res.status(201).json({
			success: true,
			message: 'Test created successfully',
			test: savedTest,
		});
	} catch (error) {
		console.error(error);
		res.status(500).json({ success: false, message: 'Failed to create test', error: error.message });
	}
};

// Get all active tests
exports.getAllTests = async (req, res) => {
	try {
		const tests = await Test.find({ isActive: true }).select('-__v');
		res.status(200).json({
			success: true,
			tests,
		});
	} catch (error) {
		console.error(error);
		res.status(500).json({ success: false, message: 'Failed to fetch tests', error: error.message });
	}
};

// Get test details by ID
exports.getTestById = async (req, res) => {
	try {
		const { testId } = req.params;
		const test = await Test.findById(testId);

		if (!test) {
			return res.status(404).json({ success: false, message: 'Test not found' });
		}

		res.status(200).json({
			success: true,
			test,
		});
	} catch (error) {
		console.error(error);
		res.status(500).json({ success: false, message: 'Failed to fetch test', error: error.message });
	}
};

// Get questions for a test (without correct answers)
exports.getTestQuestions = async (req, res) => {
	try {
		const { testId } = req.params;

		// Check if test exists
		const test = await Test.findById(testId);
		if (!test) {
			return res.status(404).json({ success: false, message: 'Test not found' });
		}

		// Get questions without correct answers
		const questions = await Question.find({ testId }).select('-correctAnswer -__v').sort({ questionNumber: 1 });

		res.status(200).json({
			success: true,
			questions,
		});
	} catch (error) {
		console.error(error);
		res.status(500).json({ success: false, message: 'Failed to fetch questions', error: error.message });
	}
};

// Add questions to a test (Admin only)
exports.addQuestions = async (req, res) => {
	try {
		const { testId, questions } = req.body;

		// Validate test exists
		const test = await Test.findById(testId);
		if (!test) {
			return res.status(404).json({ success: false, message: 'Test not found' });
		}

		// Create questions
		const questionDocs = questions.map((q, index) => ({
			testId,
			questionText: q.questionText,
			options: q.options,
			correctAnswer: q.correctAnswer,
			marks: q.marks || 1,
			questionNumber: q.questionNumber || index + 1,
		}));

		const savedQuestions = await Question.insertMany(questionDocs);

		res.status(201).json({
			success: true,
			message: 'Questions added successfully',
			questions: savedQuestions,
		});
	} catch (error) {
		console.error(error);
		res.status(500).json({ success: false, message: 'Failed to add questions', error: error.message });
	}
};

// ---- Server-side timer helpers ----
const GRACE_MS = 5000; // allowance for network delay

function getDeadline(progress, test) {
  return new Date(progress.startedAt).getTime() + test.duration * 60 * 1000;
}

function getRemainingSeconds(progress, test) {
  return Math.max(0, Math.floor((getDeadline(progress, test) - Date.now()) / 1000));
}

function isExpired(progress, test) {
  return Date.now() > getDeadline(progress, test) + GRACE_MS;
}

// Grade the saved answers and close the attempt
async function finalizeAttempt(progress, test, status) {
  const questions = await Question.find({ testId: progress.testId }).select('+correctAnswer');
  let totalScore = 0;
  progress.answers.forEach((answer) => {
    const question = questions.find((q) => q._id.toString() === answer.questionId.toString());
    if (question && question.correctAnswer === answer.selectedAnswer) {
      answer.isCorrect = true;
      answer.marksObtained = question.marks;
      totalScore += question.marks;
    } else {
      answer.isCorrect = false;
      answer.marksObtained = 0;
    }
  });
  progress.totalScore = totalScore;
  progress.isPassed = totalScore >= test.passingMarks;
  progress.status = status;
  progress.timeRemaining = 0;
  progress.submittedAt = status === 'auto-submitted' ? new Date(getDeadline(progress, test)) : new Date();
  await progress.save();
  return progress;
}

// Start a test (creates UserProgress record)
exports.startTest = async (req, res) => {
  try {
    const { testId } = req.body;
    const userId = req.user.userId;

    const test = await Test.findById(testId);
    if (!test || !test.isActive) {
      return res.status(404).json({ success: false, message: 'Test not found or inactive' });
    }

    // Resume an in-progress attempt first, so a page refresh is not a new attempt
    const inProgress = await UserProgress.findOne({ userId, testId, status: 'in-progress' });
    if (inProgress) {
      if (isExpired(inProgress, test)) {
        await finalizeAttempt(inProgress, test, 'auto-submitted');
        return res.status(400).json({
          success: false,
          message: 'Your time for this test has ended. It was submitted automatically.',
        });
      }
      inProgress.timeRemaining = getRemainingSeconds(inProgress, test);
      await inProgress.save();
      return res.status(200).json({
        success: true,
        message: 'Resuming existing attempt',
        progress: inProgress,
      });
    }

    const existingAttempts = await UserProgress.countDocuments({ userId, testId });
    if (existingAttempts >= test.allowedAttempts) {
      return res.status(400).json({ success: false, message: 'Maximum attempts reached' });
    }

    const newProgress = new UserProgress({
      userId,
      testId,
      attemptNumber: existingAttempts + 1,
      timeRemaining: test.duration * 60,
    });
    const savedProgress = await newProgress.save();

    res.status(201).json({
      success: true,
      message: 'Test started successfully',
      progress: savedProgress,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Failed to start test', error: error.message });
  }
};

// Save answer for a question (rejected after the deadline)
exports.saveAnswer = async (req, res) => {
  try {
    const { progressId, questionId, selectedAnswer } = req.body;
    const userId = req.user.userId;

    const progress = await UserProgress.findOne({ _id: progressId, userId });
    if (!progress) {
      return res.status(404).json({ success: false, message: 'Progress not found' });
    }
    if (progress.status !== 'in-progress') {
      return res.status(400).json({ success: false, message: 'Test already submitted' });
    }

    const test = await Test.findById(progress.testId);
    if (isExpired(progress, test)) {
      return res.status(403).json({ success: false, message: 'Time is up. Answers can no longer be saved.' });
    }

    const answerIndex = progress.answers.findIndex((a) => a.questionId.toString() === questionId);
    if (answerIndex > -1) {
      progress.answers[answerIndex].selectedAnswer = selectedAnswer;
    } else {
      progress.answers.push({ questionId, selectedAnswer });
    }
    await progress.save();

    res.status(200).json({
      success: true,
      message: 'Answer saved successfully',
      progress,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Failed to save answer', error: error.message });
  }
};

// Submit test (marked auto-submitted if the deadline already passed)
exports.submitTest = async (req, res) => {
  try {
    const { progressId } = req.body;
    const userId = req.user.userId;

    const progress = await UserProgress.findOne({ _id: progressId, userId });
    if (!progress) {
      return res.status(404).json({ success: false, message: 'Progress not found' });
    }
    if (progress.status !== 'in-progress') {
      return res.status(400).json({ success: false, message: 'Test already submitted' });
    }

    const test = await Test.findById(progress.testId);
    const status = isExpired(progress, test) ? 'auto-submitted' : 'submitted';
    await finalizeAttempt(progress, test, status);

    res.status(200).json({
      success: true,
      message: status === 'auto-submitted' ? 'Time was up. Test submitted automatically.' : 'Test submitted successfully',
      progress,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Failed to submit test', error: error.message });
  }
};

// Get user's progress for a test
exports.getUserProgress = async (req, res) => {
  try {
    const { progressId } = req.params;
    const userId = req.user.userId;

    const progress = await UserProgress.findOne({ _id: progressId, userId })
      .populate('testId', 'title duration totalMarks passingMarks')
      .populate('answers.questionId', 'questionText options');

    if (!progress) {
      return res.status(404).json({ success: false, message: 'Progress not found' });
    }

    res.status(200).json({
      success: true,
      progress,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Failed to fetch progress', error: error.message });
  }
};

// Update time remaining: the server calculates it, the client value is ignored
exports.updateTimeRemaining = async (req, res) => {
  try {
    const { progressId } = req.body;
    const userId = req.user.userId;

    const progress = await UserProgress.findOne({ _id: progressId, userId });
    if (!progress) {
      return res.status(404).json({ success: false, message: 'Progress not found' });
    }
    if (progress.status !== 'in-progress') {
      return res.status(400).json({ success: false, message: 'Test already submitted' });
    }

    const test = await Test.findById(progress.testId);
    const remaining = getRemainingSeconds(progress, test);
    progress.timeRemaining = remaining;
    await progress.save();

    res.status(200).json({
      success: true,
      message: 'Time updated',
      timeRemaining: remaining,
      expired: remaining === 0,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Failed to update time', error: error.message });
  }
};
