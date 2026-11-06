import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5001',
  withCredentials: true,
});

export default api;

// Auth
export const getProfile = () => api.get('/api/auth/profile');
export const logoutUser = () => api.post('/api/auth/logout');

// Review (single snippet)
export const reviewCode = (code, language) =>
  api.post('/api/review/review', { code, language });

export const getJobStatus = (id) =>
  api.get(`/api/review/job/${id}/status`);

// Repo
export const analyzeRepo = (owner, repo) =>
  api.post('/api/repo/analyze-repo', { owner, repo });

export const getRepoStatus = (id) =>
  api.get(`/api/repo/${id}/status`);

export const getRepoSummary = (id) =>
  api.get(`/api/repo/${id}/summary`);

export const getContributors = (owner, repo) =>
  api.get(`/api/repo/${owner}/${repo}/contributors`);

export const getUserRepos = () =>
  api.get('/api/repo/user/repos');

// SBOM & PR Merge Gate
export const checkPrSbom = (payload) =>
  api.post('/api/sbom/check', payload);

export const mergePr = (payload) =>
  api.post('/api/sbom/merge', payload);

export const getPrCheck = (id) =>
  api.get(`/api/sbom/check/${id}`);

export const getRepoPullRequests = (owner, repo) =>
  api.get(`/api/sbom/prs/${owner}/${repo}`);
