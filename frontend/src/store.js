import { create } from 'zustand';
import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api';

// Configure axios defaults
axios.defaults.withCredentials = true;

export const useAuthStore = create((set) => ({
	user: null,
	token: localStorage.getItem('token') || null,
	isAuthenticated: false,
	loading: false,
	error: null,

	signup: async (email, password, type = 'candidate') => {
		set({ loading: true, error: null });
		try {
			const response = await axios.post(`${API_URL}/auth/signup`, {
				email,
				password,
				type,
			});
			set({ loading: false });
			return response.data;
		} catch (error) {
			set({ loading: false, error: error.response?.data?.message || 'Signup failed' });
			throw error;
		}
	},

	signin: async (email, password) => {
		set({ loading: true, error: null });
		try {
			const response = await axios.post(`${API_URL}/auth/signin`, {
				email,
				password,
			});
			const { token, type } = response.data;
			localStorage.setItem('token', token);
			axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
			set({
				token,
				user: { email, type },
				isAuthenticated: true,
				loading: false,
			});
			return response.data;
		} catch (error) {
			set({ loading: false, error: error.response?.data?.message || 'Signin failed' });
			throw error;
		}
	},

	signout: async () => {
		try {
			await axios.post(`${API_URL}/auth/signout`);
		} catch (error) {
			console.error('Signout error:', error);
		} finally {
			localStorage.removeItem('token');
			delete axios.defaults.headers.common['Authorization'];
			set({ user: null, token: null, isAuthenticated: false });
		}
	},

		checkAuth: () => {
		const token = localStorage.getItem('token');
		if (!token) return;
		try {
			const base64 = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
			const payload = JSON.parse(atob(base64));
			if (payload.exp * 1000 < Date.now()) {
				localStorage.removeItem('token');
				return;
			}
			axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
			set({
				token,
				user: { email: payload.email, type: payload.type },
				isAuthenticated: true,
			});
		} catch (error) {
			localStorage.removeItem('token');
		}
	},
}));
useAuthStore.getState().checkAuth();
export const useExamStore = create((set, get) => ({
	tests: [],
	currentTest: null,
	questions: [],
	progress: null,
	currentQuestionIndex: 0,
	answers: {},
	timeRemaining: 0,
	loading: false,
	error: null,

	fetchTests: async () => {
		set({ loading: true, error: null });
		try {
			const response = await axios.get(`${API_URL}/exam/all`);
			set({ tests: response.data.tests, loading: false });
		} catch (error) {
			set({ loading: false, error: error.response?.data?.message || 'Failed to fetch tests' });
		}
	},

	generateAgentTest: async (topic) => {
		set({ loading: true, error: null });
		try {
			const response = await axios.post(`${API_URL}/exam/agent-test`, {
				topic,
				title: `AI Test: ${topic}`,
			});
			const { test: newTest } = response.data;

			// Add the new test to the existing list of tests
			set((state) => ({
				tests: [newTest, ...state.tests],
				loading: false,
			}));

			return newTest; // Return the new test to allow navigation
		} catch (error) {
			set({ loading: false, error: error.response?.data?.message || 'Failed to generate test' });
			throw error;
		}
	},

	fetchTestDetails: async (testId) => {
		set({ loading: true, error: null });
		try {
			const [testResponse, questionsResponse] = await Promise.all([
				axios.get(`${API_URL}/exam/${testId}`),
				axios.get(`${API_URL}/exam/${testId}/questions`),
			]);
			set({
				currentTest: testResponse.data.test,
				questions: questionsResponse.data.questions,
				loading: false,
			});
		} catch (error) {
			set({ loading: false, error: error.response?.data?.message || 'Failed to fetch test' });
		}
	},

	startTest: async (testId) => {
		set({ loading: true, error: null });
		try {
			const response = await axios.post(`${API_URL}/exam/start`, { testId });
			const progress = response.data.progress;
			
			// Initialize answers from progress
			const answers = {};
			progress.answers.forEach((ans) => {
				answers[ans.questionId] = ans.selectedAnswer;
			});

			set({
				progress,
				answers,
				timeRemaining: progress.timeRemaining,
				loading: false,
			});
			return progress;
		} catch (error) {
			set({ loading: false, error: error.response?.data?.message || 'Failed to start test' });
			throw error;
		}
	},

	saveAnswer: async (questionId, selectedAnswer) => {
		const { progress, answers } = get();
		
		// Update local state immediately
		set({ answers: { ...answers, [questionId]: selectedAnswer } });

		try {
			await axios.post(`${API_URL}/exam/save-answer`, {
				progressId: progress._id,
				questionId,
				selectedAnswer,
			});
		} catch (error) {
			console.error('Failed to save answer:', error);
		}
	},

	submitTest: async () => {
		const { progress } = get();
		set({ loading: true, error: null });
		try {
			const response = await axios.post(`${API_URL}/exam/submit`, {
				progressId: progress._id,
			});
			set({ loading: false });
			return response.data.progress;
		} catch (error) {
			set({ loading: false, error: error.response?.data?.message || 'Failed to submit test' });
			throw error;
		}
	},

	updateTimeRemaining: async (timeRemaining) => {
		const { progress } = get();
		set({ timeRemaining });
		
		try {
			await axios.post(`${API_URL}/exam/update-time`, {
				progressId: progress._id,
				timeRemaining,
			});
		} catch (error) {
			console.error('Failed to update time:', error);
		}
	},

	setCurrentQuestionIndex: (index) => {
		set({ currentQuestionIndex: index });
	},

	resetExam: () => {
		set({
			currentTest: null,
			questions: [],
			progress: null,
			currentQuestionIndex: 0,
			answers: {},
			timeRemaining: 0,
		});
	},
}));

export const useCheatingStore = create((set, get) => ({
	logs: [],
	tabSwitchCount: 0,
	isWebcamActive: false,

	logEvent: async (eventType, severity, description, questionNumber) => {
		const examStore = useExamStore.getState();
		const { progress, currentTest } = examStore;

		if (!progress || !currentTest) return;

		try {
			await axios.post(`${API_URL}/cheating/log`, {
				testId: currentTest._id,
				progressId: progress._id,
				eventType,
				severity,
				description,
				questionNumber,
			});

			// Update local count
			if (eventType === 'tab-switch') {
				set({ tabSwitchCount: get().tabSwitchCount + 1 });
			}
		} catch (error) {
			console.error('Failed to log cheating event:', error);
		}
	},

	checkWebcamImage: async (imageBlob, questionNumber) => {
		const examStore = useExamStore.getState();
		const { progress, currentTest } = examStore;

		if (!progress || !currentTest) return;

		try {
			const formData = new FormData();
			formData.append('image', imageBlob, 'webcam-capture.jpg');
			formData.append('testId', currentTest._id);
			formData.append('progressId', progress._id);
			formData.append('questionNumber', questionNumber);

			const response = await axios.post(`${API_URL}/cheating/check-webcam`, formData, {
				headers: { 'Content-Type': 'multipart/form-data' },
			});

			return response.data;
		} catch (error) {
			console.error('Failed to check webcam image:', error);
			return null;
		}
	},

	setWebcamActive: (active) => {
		set({ isWebcamActive: active });
	},

	reset: () => {
		set({ logs: [], tabSwitchCount: 0, isWebcamActive: false });
	},
}));
