import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore, useExamStore } from '../store';

export default function Dashboard() {
	const { user, signout } = useAuthStore();
	const { tests, fetchTests, loading, generateAgentTest } = useExamStore();
	const navigate = useNavigate();

	const [topic, setTopic] = useState('');
	const [isGenerating, setIsGenerating] = useState(false);

	useEffect(() => {
		fetchTests();
	}, []);

	const handleStartTest = (testId) => {
		navigate(`/exam/${testId}`);
	};

	const handleLogout = () => {
		signout();
		navigate('/');
	};

	const handleGenerateTest = async (e) => {
		e.preventDefault();
		if (!topic.trim()) {
			alert('Please enter a topic.');
			return;
		}
		setIsGenerating(true);
		try {
			const newTest = await generateAgentTest(topic);
			if (newTest) {
				navigate(`/exam/${newTest._id}`);
			}
		} catch (error) {
			alert('Failed to generate test. Please try again.');
		} finally {
			setIsGenerating(false);
			setTopic('');
		}
	};

	return (
		<div className="min-h-screen bg-gray-100">
			{/* Header */}
			<header className="bg-white shadow-md">
				<div className="container mx-auto px-4 py-4 flex justify-between items-center">
					<h1 className="text-2xl font-bold text-gray-800">Exam Platform</h1>
					<div className="flex items-center gap-4">
						<span className="text-gray-600">{user?.email}</span>
						<button
							onClick={handleLogout}
							className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-lg transition"
						>
							Logout
						</button>
					</div>
				</div>
			</header>

			{/* Main Content */}
			<main className="container mx-auto px-4 py-8">
				<h2 className="text-3xl font-bold text-gray-800 mb-6">Available Tests</h2>

				{loading ? (
					<div className="text-center py-12">
						<div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
						<p className="text-gray-600 mt-4">Loading tests...</p>
					</div>
				) : tests.length === 0 ? (
					<div className="bg-white rounded-lg shadow-md p-8 text-center">
						<p className="text-gray-600 text-lg">No tests available at the moment.</p>
					</div>
				) : (
					<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
						{tests.map((test) => (
							<div key={test._id} className="bg-white rounded-lg shadow-md p-6 hover:shadow-xl transition">
								<h3 className="text-xl font-bold text-gray-800 mb-2">{test.title}</h3>
								<p className="text-gray-600 mb-4">{test.description}</p>
								
								<div className="space-y-2 mb-4 text-sm text-gray-700">
									<div className="flex justify-between">
										<span>Duration:</span>
										<span className="font-semibold">{test.duration} minutes</span>
									</div>
									<div className="flex justify-between">
										<span>Total Marks:</span>
										<span className="font-semibold">{test.totalMarks}</span>
									</div>
									<div className="flex justify-between">
										<span>Passing Marks:</span>
										<span className="font-semibold">{test.passingMarks}</span>
									</div>
									<div className="flex justify-between">
										<span>Attempts Allowed:</span>
										<span className="font-semibold">{test.allowedAttempts}</span>
									</div>
								</div>

								<button
									onClick={() => handleStartTest(test._id)}
									className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 rounded-lg transition"
								>
									Start Test
								</button>
							</div>
						))}
					</div>
				)}
			</main>
		</div>
	);
}
