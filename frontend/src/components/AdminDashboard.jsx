import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { useAuthStore, useExamStore } from '../store';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api';

const severityStyle = {
  low: 'bg-gray-100 text-gray-700',
  medium: 'bg-yellow-100 text-yellow-800',
  high: 'bg-orange-100 text-orange-800',
  critical: 'bg-red-100 text-red-800',
};

export default function AdminDashboard() {
  const navigate = useNavigate();
  const { user, signout } = useAuthStore();
  const { tests, fetchTests, generateAgentTest } = useExamStore();
  const [selected, setSelected] = useState(null);
  const [logs, setLogs] = useState([]);
  const [stats, setStats] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [topic, setTopic] = useState('');
const [generating, setGenerating] = useState(false);

const handleGenerate = async () => {
  if (!topic.trim()) return;
  setGenerating(true);
  setError('');
  try {
    await generateAgentTest(topic.trim());
    setTopic('');
  } catch (e) {
    setError(e.response?.data?.message || 'Failed to generate test');
  }
  setGenerating(false);
};

  useEffect(() => {
    fetchTests();
  }, []);

  const openTest = async (test) => {
    setSelected(test);
    setLoading(true);
    setError('');
    try {
      const [l, s] = await Promise.all([
        axios.get(`${API_URL}/cheating/admin/logs/${test._id}`),
        axios.get(`${API_URL}/cheating/admin/stats/${test._id}`),
      ]);
      setLogs(l.data.logs);
      setStats(s.data.stats);
    } catch (e) {
      setError(e.response?.data?.message || 'Failed to load data');
    }
    setLoading(false);
  };

  const handleLogout = async () => {
    await signout();
    navigate('/');
  };

  return (
    <div className="min-h-screen bg-gray-100">
      <header className="bg-white shadow">
        <div className="max-w-6xl mx-auto px-6 py-4 flex justify-between items-center">
          <h1 className="text-2xl font-bold text-gray-900">Admin Dashboard</h1>
          <div className="flex items-center gap-4">
            <span className="text-gray-600">{user?.email}</span>
            <button
              onClick={handleLogout}
              className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-lg"
            >
              Logout
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8">
      <div className="bg-white rounded-lg shadow p-6 mb-8">
  <h2 className="text-xl font-bold text-gray-900 mb-2">Generate a test with AI</h2>
  <p className="text-gray-600 mb-4">Enter a topic and the AI will create a 5-question exam for students.</p>
  <div className="flex gap-3">
    <input
      value={topic}
      onChange={(e) => setTopic(e.target.value)}
      placeholder="e.g., React Hooks, Quantum Physics"
      className="flex-1 border rounded-lg px-4 py-2"
    />
    <button
      onClick={handleGenerate}
      disabled={generating}
      className="bg-green-600 hover:bg-green-700 text-white px-6 py-2 rounded-lg disabled:opacity-50"
    >
      {generating ? 'Generating...' : 'Generate Test'}
    </button>
  </div>
</div>
        <h2 className="text-xl font-bold text-gray-900 mb-4">Tests</h2>
        {tests.length === 0 && (
          <div className="bg-white rounded-lg shadow p-6 text-gray-500">No tests yet.</div>
        )}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-8">
          {tests.map((t) => (
            <button
              key={t._id}
              onClick={() => openTest(t)}
              className={`text-left bg-white rounded-lg shadow p-4 border-2 ${
                selected?._id === t._id ? 'border-green-500' : 'border-transparent'
              } hover:border-green-300`}
            >
              <div className="font-semibold text-gray-900">{t.title}</div>
              <div className="text-sm text-gray-500">
                {t.duration} min · {t.totalMarks} marks
              </div>
            </button>
          ))}
        </div>

        {selected && (
          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-4">Results: {selected.title}</h2>
            {loading && <p className="text-gray-500">Loading...</p>}
            {error && <p className="text-red-600">{error}</p>}

            <h3 className="text-lg font-semibold text-gray-800 mb-2">Violations per student</h3>
            {stats.length === 0 ? (
              <div className="bg-white rounded-lg shadow p-6 text-gray-500 mb-8">
                No violations recorded.
              </div>
            ) : (
              <div className="bg-white rounded-lg shadow overflow-x-auto mb-8">
                <table className="w-full text-left">
                  <thead className="bg-gray-50 text-gray-600 text-sm">
                    <tr>
                      <th className="px-4 py-3">Student</th>
                      <th className="px-4 py-3">Total</th>
                      <th className="px-4 py-3">Avg score</th>
                      <th className="px-4 py-3">Critical</th>
                      <th className="px-4 py-3">High</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stats.map((s) => (
                      <tr key={s._id} className="border-t">
                        <td className="px-4 py-3">{s.userInfo?.[0]?.email || s._id}</td>
                        <td className="px-4 py-3">{s.totalViolations}</td>
                        <td className="px-4 py-3">
                          {s.avgCheatingScore != null ? Math.round(s.avgCheatingScore) : '-'}
                        </td>
                        <td className="px-4 py-3">{s.criticalCount}</td>
                        <td className="px-4 py-3">{s.highCount}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <h3 className="text-lg font-semibold text-gray-800 mb-2">Event log</h3>
            {logs.length === 0 ? (
              <div className="bg-white rounded-lg shadow p-6 text-gray-500">
                No events recorded.
              </div>
            ) : (
              <div className="bg-white rounded-lg shadow overflow-x-auto">
                <table className="w-full text-left">
                  <thead className="bg-gray-50 text-gray-600 text-sm">
                    <tr>
                      <th className="px-4 py-3">Time</th>
                      <th className="px-4 py-3">Student</th>
                      <th className="px-4 py-3">Event</th>
                      <th className="px-4 py-3">Severity</th>
                      <th className="px-4 py-3">Score</th>
                      <th className="px-4 py-3">Details</th>
                    </tr>
                  </thead>
                  <tbody>
                    {logs.map((log) => (
                      <tr key={log._id} className="border-t text-sm">
                        <td className="px-4 py-3 whitespace-nowrap">
                          {new Date(log.timestamp).toLocaleString()}
                        </td>
                        <td className="px-4 py-3">{log.userId?.email}</td>
                        <td className="px-4 py-3">{log.eventType}</td>
                        <td className="px-4 py-3">
                          <span
                            className={`px-2 py-1 rounded text-xs font-medium ${
                              severityStyle[log.severity] || severityStyle.low
                            }`}
                          >
                            {log.severity}
                          </span>
                        </td>
                        <td className="px-4 py-3">{log.cheatingScore ?? '-'}</td>
                        <td className="px-4 py-3">{log.description}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        )}
      </main>
    </div>
  );
}
