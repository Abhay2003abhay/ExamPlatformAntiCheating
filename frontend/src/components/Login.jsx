import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store';

export default function Login() {
	const [isSignup, setIsSignup] = useState(false);
	const [email, setEmail] = useState('');
	const [password, setPassword] = useState('');
	const [type, setType] = useState('candidate');
	
	const { signin, signup, loading, error } = useAuthStore();
	const navigate = useNavigate();

	const handleSubmit = async (e) => {
		e.preventDefault();
		try {
			if (isSignup) {
				await signup(email, password, type);
				alert('Signup successful! Please login.');
				setIsSignup(false);
			} else {
				await signin(email, password);
				navigate('/dashboard');
			}
		} catch (error) {
			console.error('Auth error:', error);
		}
	};

	return (
		<div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-amber-500 to-pink-500">
			<div className="bg-white p-8 rounded-lg shadow-2xl w-full max-w-md">
				<h1 className="text-3xl font-bold text-center mb-6 text-gray-800">
					{isSignup ? 'Create Account' : 'Login'}
				</h1>
				
				{error && (
					<div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
						{error}
					</div>
				)}

				<form onSubmit={handleSubmit} className="space-y-4">
					<div>
						<label className="block text-gray-700 font-medium mb-2">Email</label>
						<input
							type="email"
							value={email}
							onChange={(e) => setEmail(e.target.value)}
							required
							className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
							placeholder="your.email@example.com"
						/>
					</div>

					<div>
						<label className="block text-gray-700 font-medium mb-2">Password</label>
						<input
							type="password"
							value={password}
							onChange={(e) => setPassword(e.target.value)}
							required
							className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
							placeholder="••••••••"
						/>
					</div>

					{isSignup && (
						<div>
							<label className="block text-gray-700 font-medium mb-2">Account Type</label>
							<select
								value={type}
								onChange={(e) => setType(e.target.value)}
								className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
							>
								<option value="candidate">Candidate</option>
							</select>
						</div>
					)}

					<button
						type="submit"
						disabled={loading}
						className="w-full bg-orange-600 hover:bg-red-700 text-white font-bold py-3 rounded-lg transition duration-200 disabled:opacity-50"
					>
						{loading ? 'Processing...' : isSignup ? 'Sign Up' : 'Login'}
					</button>
				</form>

				<div className="mt-6 text-center">
					<button
						onClick={() => setIsSignup(!isSignup)}
						className="text-blue-600 hover:underline"
					>
						{isSignup ? 'Already have an account? Login' : "Don't have an account? Sign Up"}
					</button>
				</div>
			</div>
		</div>
	);
}
