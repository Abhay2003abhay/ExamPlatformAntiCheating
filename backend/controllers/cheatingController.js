const CheatingLog = require('../models/cheatingLogModel');
const axios = require('axios');
const FormData = require('form-data');

// Log cheating event (tab switch, window blur, etc.)
exports.logCheatingEvent = async (req, res) => {
	try {
		const { testId, progressId, eventType, severity, description, questionNumber } = req.body;
		const userId = req.user.userId;

		const cheatingLog = new CheatingLog({
			userId,
			testId,
			progressId,
			eventType,
			severity: severity || 'low',
			description,
			questionNumber,
		});

		await cheatingLog.save();

		res.status(201).json({
			success: true,
			message: 'Cheating event logged',
			log: cheatingLog,
		});
	} catch (error) {
		console.error(error);
		res.status(500).json({ success: false, message: 'Failed to log event', error: error.message });
	}
};

// Process webcam image through ML API
exports.checkWebcamImage = async (req, res) => {
	try {
		if (!req.file) {
			return res.status(400).json({ success: false, message: 'No image provided' });
		}

		const { testId, progressId, questionNumber } = req.body;
		const userId = req.user.userId;

		// Create form data for FastAPI
		const formData = new FormData();
		formData.append('image', req.file.buffer, {
			filename: req.file.originalname,
			contentType: req.file.mimetype,
		});

		// Call FastAPI ML service
		const mlResponse = await axios.post(
			process.env.FASTAPI_URL + '/ml/check_face',
			formData,
			{
				headers: formData.getHeaders(),
				timeout: 10000,
			}
		);

		const mlData = mlResponse.data;

		// Determine severity based on cheating score
		let severity = 'low';
		if (mlData.cheating_score >= 80) severity = 'critical';
		else if (mlData.cheating_score >= 60) severity = 'high';
		else if (mlData.cheating_score >= 40) severity = 'medium';

		const eventType = mlData.mobile_detected ? 'mobile-detection' : 'face-detection';
		const description = mlData.mobile_detected
			? mlData.message || 'Mobile device detected during monitoring'
			: mlData.message || 'Face detection check';

		// Log the result
		const cheatingLog = new CheatingLog({
			userId,
			testId,
			progressId,
			eventType,
			severity,
			cheatingScore: mlData.cheating_score,
			mlResponse: mlData,
			description,
			questionNumber,
		});

		await cheatingLog.save();

		res.status(200).json({
			success: true,
			message: 'Image processed',
			cheatingScore: mlData.cheating_score,
			severity,
			details: mlData,
		});
	} catch (error) {
		console.error('ML API Error:', error.message);
		res.status(500).json({ 
			success: false, 
			message: 'Failed to process image', 
			error: error.message 
		});
	}
};

// Get cheating logs for a test attempt
exports.getCheatingLogs = async (req, res) => {
	try {
		const { progressId } = req.params;
		const userId = req.user.userId;

		const logs = await CheatingLog.find({ progressId, userId }).sort({ timestamp: -1 });

		res.status(200).json({
			success: true,
			logs,
		});
	} catch (error) {
		console.error(error);
		res.status(500).json({ success: false, message: 'Failed to fetch logs', error: error.message });
	}
};

// Admin: Get all cheating logs for a test
exports.getAllCheatingLogs = async (req, res) => {
	try {
		const { testId } = req.params;

		const logs = await CheatingLog.find({ testId })
			.populate('userId', 'email')
			.populate('testId', 'title')
			.sort({ timestamp: -1 });

		res.status(200).json({
			success: true,
			logs,
		});
	} catch (error) {
		console.error(error);
		res.status(500).json({ success: false, message: 'Failed to fetch logs', error: error.message });
	}
};

// Admin: Get cheating summary
exports.getCheatingStats = async (req, res) => {
	try {
		const { testId } = req.params;

		const stats = await CheatingLog.aggregate([
			{ $match: { testId: new (require('mongoose').Types.ObjectId)(testId) } },
			{
				$group: {
					_id: '$userId',
					totalViolations: { $sum: 1 },
					avgCheatingScore: { $avg: '$cheatingScore' },
					criticalCount: {
						$sum: { $cond: [{ $eq: ['$severity', 'critical'] }, 1, 0] },
					},
					highCount: {
						$sum: { $cond: [{ $eq: ['$severity', 'high'] }, 1, 0] },
					},
				},
			},
			{
				$lookup: {
					from: 'users',
					localField: '_id',
					foreignField: '_id',
					as: 'userInfo',
				},
			},
		]);

		res.status(200).json({
			success: true,
			stats,
		});
	} catch (error) {
		console.error(error);
		res.status(500).json({ success: false, message: 'Failed to fetch stats', error: error.message });
	}
};
