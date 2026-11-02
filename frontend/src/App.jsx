import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './AuthContext';
import { useAuth } from './useAuth';
import Navbar from './components/Navbar';
import Login from './pages/Login';
import CodeReview from './pages/CodeReview';
import RepoAnalyzer from './pages/RepoAnalyzer';
import PrSbomGate from './pages/PrSbomGate';

function Protected({ children }) {
  const { user, loading } = useAuth();
  if (loading) return (
    <div style={{ textAlign: 'center', padding: 60, color: 'var(--muted)' }}>
      <span className="spinner" />
    </div>
  );
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

function AppRoutes() {
  const { user, loading } = useAuth();
  return (
    <>
      <Navbar />
      <Routes>
        <Route path="/login" element={
          loading ? null : user ? <Navigate to="/" replace /> : <Login />
        } />
        <Route path="/" element={<Protected><CodeReview /></Protected>} />
        <Route path="/repo" element={<Protected><RepoAnalyzer /></Protected>} />
        <Route path="/sbom-pr" element={<Protected><PrSbomGate /></Protected>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}
