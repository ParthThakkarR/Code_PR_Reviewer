import { useState } from 'react';
import { useAuth } from '../useAuth';

export default function Login() {
  const { loginDevUser } = useAuth();
  const [loading, setLoading] = useState(false);

  const handleDevLogin = async () => {
    setLoading(true);
    await loginDevUser();
    setLoading(false);
  };

  return (
    <div style={{
      maxWidth: 420,
      margin: '80px auto',
      padding: '24px 20px',
      textAlign: 'center',
      background: 'var(--surface)',
      border: '1px solid var(--border)',
      borderRadius: 'var(--radius)'
    }}>
      <div style={{ fontSize: 36, marginBottom: 12 }}>⚙</div>
      <h2 style={{ marginBottom: 6 }}>CodeReview</h2>
        <p style={{ color: 'var(--muted)', fontSize: 13, marginBottom: 24, lineHeight: 1.5 }}>
          AI-powered code review and DevSecOps SBOM vulnerability merge gating.
        </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <a
              href={`${import.meta.env.VITE_BACKEND_URL || 'http://localhost:5001'}/api/auth/github`}
              style={{
                display: 'block',
                background: 'var(--accent)',
                color: '#0d1117',
                padding: '10px 20px',
                borderRadius: 'var(--radius)',
                fontWeight: 700,
                fontSize: 14,
                textDecoration: 'none',
              }}
            >
              Login with GitHub
            </a>

            <button
              onClick={handleDevLogin}
              disabled={loading}
              style={{
                background: 'transparent',
                border: '1px solid var(--border)',
                color: 'var(--text)',
                padding: '10px 20px',
                borderRadius: 'var(--radius)',
                fontWeight: 600,
                fontSize: 13,
                cursor: 'pointer'
              }}
            >
              {loading ? 'Logging in…' : '⚡ Quick Dev / Demo Login'}
            </button>
          </div>

          <p style={{ color: 'var(--muted)', fontSize: 11, marginTop: 20 }}>
            Requires GitHub OAuth for live repository sync, or use Quick Dev Login to explore all features instantly.
          </p>
        </div>
        );
}
