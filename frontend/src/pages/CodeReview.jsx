import { useState } from 'react';
import { reviewCode } from '../api';

const LANGS = ['python', 'javascript', 'typescript'];

function SeverityBadges({ summary }) {
  if (!summary) return null;
  return (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
      {summary.high > 0 && <span className="badge high">High: {summary.high}</span>}
      {summary.medium > 0 && <span className="badge medium">Medium: {summary.medium}</span>}
      {summary.low > 0 && <span className="badge low">Low: {summary.low}</span>}
    </div>
  );
}

function IssueSection({ title, items }) {
  if (!items || items.length === 0) return null;
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ color: 'var(--muted)', fontSize: 12, marginBottom: 6 }}>{title}</div>
      <ul className="issue-list">
        {items.map((item, i) => <li key={i}>{item}</li>)}
      </ul>
    </div>
  );
}

export default function CodeReview() {
  const [code, setCode] = useState('');
  const [lang, setLang] = useState('python');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [tab, setTab] = useState('ai');

  const handleSubmit = async () => {
    if (!code.trim()) return;
    setLoading(true);
    setResult(null);
    setError('');
    try {
      const res = await reviewCode(code, lang);
      setResult(res.data);
    } catch (e) {
      setError(e.response?.data?.error || e.message);
    } finally {
      setLoading(false);
    }
  };

  const ai = result?.ai_analysis;
  const st = result?.static_analysis;

  return (
    <div style={{ maxWidth: 860, margin: '32px auto', padding: '0 16px' }}>
      <h2 style={{ marginBottom: 4 }}>Code Review</h2>
      <p style={{ color: 'var(--muted)', fontSize: 13, marginBottom: 20 }}>
        Paste a snippet and get AI + static analysis.
      </p>

      <div className="card" style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', gap: 10, marginBottom: 10, alignItems: 'flex-end' }}>
          <div style={{ flex: 1 }}>
            <label>Language</label>
            <select value={lang} onChange={e => setLang(e.target.value)} style={{ width: 'auto' }}>
              {LANGS.map(l => <option key={l} value={l}>{l}</option>)}
            </select>
          </div>
          <button
            className="primary"
            onClick={handleSubmit}
            disabled={loading || !code.trim()}
            style={{ flexShrink: 0 }}
          >
            {loading ? <><span className="spinner" style={{ verticalAlign: 'middle', marginRight: 6 }} />Analyzing…</> : 'Analyze'}
          </button>
        </div>

        <label>Code</label>
        <textarea
          value={code}
          onChange={e => setCode(e.target.value)}
          placeholder={`# paste your ${lang} code here`}
          style={{ minHeight: 220, fontFamily: 'monospace', fontSize: 13 }}
        />
      </div>

      {error && <div className="error-box" style={{ marginBottom: 16 }}>{error}</div>}

      {result && (
        <div className="card">
          <div className="tab-bar">
            <button className={tab === 'ai' ? 'active' : ''} onClick={() => setTab('ai')}>AI Analysis</button>
            <button className={tab === 'static' ? 'active' : ''} onClick={() => setTab('static')}>Static Analysis</button>
          </div>

          {tab === 'ai' && ai && (
            <div>
              <SeverityBadges summary={ai.severity_summary} />
              <IssueSection title="BUGS" items={ai.bugs} />
              <IssueSection title="SECURITY" items={ai.security} />
              <IssueSection title="PERFORMANCE" items={ai.performance} />
              <IssueSection title="BEST PRACTICES" items={ai.best_practices} />
            </div>
          )}

          {tab === 'static' && st && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {Object.entries(st).map(([tool, output]) => (
                <div key={tool}>
                  <div style={{ color: 'var(--muted)', fontSize: 11, marginBottom: 4, textTransform: 'uppercase' }}>{tool}</div>
                  <pre style={{
                    background: 'var(--bg)',
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--radius)',
                    padding: 10,
                    fontSize: 12,
                    overflow: 'auto',
                    maxHeight: 180,
                    color: 'var(--text)',
                    whiteSpace: 'pre-wrap',
                  }}>
                    {output || '(no output)'}
                  </pre>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
