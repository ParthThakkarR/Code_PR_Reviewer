import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../useAuth';

export default function Navbar() {
  const { user, loading, logout } = useAuth();
  const loc = useLocation();

  const active = (path) => loc.pathname === path ? { color: 'var(--text)', fontWeight: 600 } : {};

  return (
    <nav style={{
      borderBottom: '1px solid var(--border)',
      padding: '0 24px',
      display: 'flex',
      alignItems: 'center',
      gap: 20,
      height: 52,
      background: 'var(--surface)',
      position: 'sticky',
      top: 0,
      zIndex: 100
    }}>
      <Link to="/" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ color: 'var(--accent)', fontWeight: 800, fontSize: 16 }}>
          ⚙ CodeReview
        </span>
      </Link>

      {user && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginLeft: 12 }}>
              <Link to="/" style={{ color: 'var(--muted)', fontSize: 13, textDecoration: 'none', ...active('/') }}>
                Code Review
              </Link>
                <Link to="/repo" style={{ color: 'var(--muted)', fontSize: 13, textDecoration: 'none', ...active('/repo') }}>
                  Repo Analyzer
                </Link>
              <Link to="/sbom-pr" style={{ color: 'var(--muted)', fontSize: 13, textDecoration: 'none', ...active('/sbom-pr') }}>
                🛡️ PR &amp; SBOM Gate
              </Link>
            </div>
      )}

            <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 12 }}>
              {loading ? (
                <span style={{ color: 'var(--muted)', fontSize: 12 }}>...</span>
              ) : user ? (
                <>
                  <img
                    src={user.profile?.photos?.[0]?.value || `https://github.com/${user.profile?.login || 'github'}.png`}
                    alt="avatar"
                    style={{ width: 26, height: 26, borderRadius: '50%', border: '1px solid var(--border)' }}
                  />
                    <span style={{ color: 'var(--text)', fontSize: 12, fontWeight: 500 }}>
                      {user.profile?.displayName || user.profile?.login}
                    </span>
                    <button
                      onClick={logout}
                      style={{
                        background: 'transparent',
                        border: '1px solid var(--border)',
                        borderRadius: '4px',
                        color: 'var(--muted)',
                        fontSize: 11,
                        padding: '4px 8px',
                        cursor: 'pointer'
                      }}
                    >
                      Logout
                    </button>
                  </>
                  ) : (
          <Link
                    to="/login"
                    style={{
                      color: 'var(--accent)',
                      fontSize: 13,
                      textDecoration: 'none',
                      fontWeight: 600
                    }}
                  >
                  Login
                </Link>
        )}
            </div>
          </nav>
          );
}
