export default function Login() {
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
            padding: '12px 20px',
            borderRadius: 'var(--radius)',
            fontWeight: 700,
            fontSize: 14,
            textDecoration: 'none',
          }}
        >
          Sign in with GitHub
        </a>
      </div>

      <p style={{ color: 'var(--muted)', fontSize: 11, marginTop: 20 }}>
        Requires GitHub OAuth for repository synchronization, PR checks, and gate enforcement.
      </p>
    </div>
  );
}
