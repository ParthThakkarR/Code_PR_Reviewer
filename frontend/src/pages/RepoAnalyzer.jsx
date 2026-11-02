import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { analyzeRepo, getRepoStatus, getRepoSummary, getContributors, getUserRepos } from '../api';

const LANG_COLORS = {
  JavaScript: '#f7df1e', TypeScript: '#3178c6', Python: '#3572A5',
  Java: '#b07219', Go: '#00ADD8', Rust: '#dea584', Ruby: '#701516',
  CSS: '#563d7c', HTML: '#e34c26', 'C++': '#f34b7d', C: '#555555',
  Shell: '#89e051', Swift: '#ffac45', Kotlin: '#A97BFF',
};

function timeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr);
  const days = Math.floor(diff / 86400000);
  if (days === 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 30) return `${days}d ago`;
  if (days < 365) return `${Math.floor(days / 30)}mo ago`;
  return `${Math.floor(days / 365)}y ago`;
}

export default function RepoAnalyzer() {
  const [repos, setRepos]               = useState([]);
  const [reposLoading, setReposLoading] = useState(true);
  const [reposError, setReposError]     = useState('');
  const [search, setSearch]             = useState('');
  const [langFilter, setLangFilter]     = useState('');

  // Per-repo analysis state keyed by repo full_name
  const [analyzing, setAnalyzing]       = useState({});   // fullName -> bool
  const [status, setStatus]             = useState({});   // fullName -> statusObj
  const [summary, setSummary]           = useState({});   // fullName -> summaryObj
  const [expanded, setExpanded]         = useState(null); // fullName currently expanded
  const [analyzeError, setAnalyzeError] = useState({});  // fullName -> err string

  const pollRefs = useRef({});

  // Load repo list on mount
  useEffect(() => {
    getUserRepos()
      .then(r => setRepos(r.data))
      .catch(e => setReposError(e.response?.data?.error || e.message))
      .finally(() => setReposLoading(false));
    return () => Object.values(pollRefs.current).forEach(clearInterval);
  }, []);

  const stopPoll = (key) => {
    if (pollRefs.current[key]) {
      clearInterval(pollRefs.current[key]);
      delete pollRefs.current[key];
    }
  };

  const startPoll = (key, repoId) => {
    pollRefs.current[key] = setInterval(async () => {
      try {
        const s = await getRepoStatus(repoId);
        setStatus(prev => ({ ...prev, [key]: s.data }));
        if (s.data.status === 'completed' || s.data.status === 'failed') {
          stopPoll(key);
          setAnalyzing(prev => ({ ...prev, [key]: false }));
          if (s.data.status === 'completed') {
            const sum = await getRepoSummary(repoId);
            setSummary(prev => ({ ...prev, [key]: sum.data.summary }));
          }
        }
      } catch {
        stopPoll(key);
        setAnalyzing(prev => ({ ...prev, [key]: false }));
      }
    }, 2500);
  };

  const handleAnalyze = async (repo) => {
    const key = repo.full_name;
    setAnalyzing(prev => ({ ...prev, [key]: true }));
    setStatus(prev => ({ ...prev, [key]: null }));
    setSummary(prev => ({ ...prev, [key]: null }));
    setAnalyzeError(prev => ({ ...prev, [key]: '' }));
    setExpanded(key);
    stopPoll(key);
    try {
      const res = await analyzeRepo(repo.owner, repo.name);
      startPoll(key, res.data.repoId);
    } catch (e) {
      setAnalyzeError(prev => ({ ...prev, [key]: e.response?.data?.error || e.message }));
      setAnalyzing(prev => ({ ...prev, [key]: false }));
    }
  };

  // Derived list
  const languages = [...new Set(repos.map(r => r.language).filter(Boolean))].sort();
  const filtered = repos.filter(r => {
    const matchSearch = r.name.toLowerCase().includes(search.toLowerCase()) ||
      (r.description || '').toLowerCase().includes(search.toLowerCase());
    const matchLang = !langFilter || r.language === langFilter;
    return matchSearch && matchLang;
  });

  return (
    <div style={{ maxWidth: 860, margin: '32px auto', padding: '0 16px' }}>
      <h2 style={{ marginBottom: 4 }}>Your Repositories</h2>
      <p style={{ color: 'var(--muted)', fontSize: 13, marginBottom: 20 }}>
        Select a repository to run an AI code review. Supports .py, .js, .ts files.
      </p>

      {/* Search + Filter bar */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="🔍  Search repositories…"
          style={{ flex: 1, minWidth: 200 }}
        />
        <select
          value={langFilter}
          onChange={e => setLangFilter(e.target.value)}
          style={{
            background: 'var(--surface)', color: 'var(--text)',
            border: '1px solid var(--border)', borderRadius: 'var(--radius)',
            padding: '8px 12px', fontSize: 13, cursor: 'pointer',
          }}
        >
          <option value="">All languages</option>
          {languages.map(l => <option key={l} value={l}>{l}</option>)}
        </select>
      </div>

      {/* States */}
      {reposLoading && (
        <div className="card" style={{ textAlign: 'center', padding: '32px', color: 'var(--muted)' }}>
          <span className="spinner" style={{ marginRight: 8, verticalAlign: 'middle' }} />
          Loading your repositories…
        </div>
      )}
      {reposError && <div className="error-box">{reposError}</div>}

      {/* Repo list */}
      {!reposLoading && filtered.length === 0 && !reposError && (
        <div className="card" style={{ textAlign: 'center', padding: 32, color: 'var(--muted)' }}>
          No repositories match your search.
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {filtered.map(repo => {
          const key = repo.full_name;
          const isAnalyzing = analyzing[key];
          const repoStatus = status[key];
          const repoSummary = summary[key];
          const isExpanded = expanded === key;
          const progress = repoStatus
            ? Math.round(((repoStatus.processedFiles || 0) / (repoStatus.totalFiles || 1)) * 100)
            : 0;
          const score = repoSummary?.overallScore;
          const scoreColor = score >= 70 ? 'var(--green)' : score >= 40 ? 'var(--yellow)' : 'var(--red)';
          const langColor = LANG_COLORS[repo.language] || 'var(--muted)';

          return (
            <div key={key} className="card" style={{ padding: '14px 18px' }}>
              {/* Repo header row */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                {/* Repo info */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <a
                      href={repo.html_url}
                      target="_blank"
                      rel="noreferrer"
                      style={{ fontWeight: 700, fontSize: 14, color: 'var(--accent)', textDecoration: 'none' }}
                    >
                      {repo.full_name}
                    </a>
                    {repo.private && (
                      <span style={{
                        fontSize: 10, padding: '2px 6px', borderRadius: 4,
                        border: '1px solid var(--border)', color: 'var(--muted)',
                      }}>private</span>
                    )}
                  </div>
                  {repo.description && (
                    <p style={{ fontSize: 12, color: 'var(--muted)', margin: '3px 0 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {repo.description}
                    </p>
                  )}
                  <div style={{ display: 'flex', gap: 14, marginTop: 5, fontSize: 11, color: 'var(--muted)', flexWrap: 'wrap' }}>
                    {repo.language && (
                      <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <span style={{ width: 8, height: 8, borderRadius: '50%', background: langColor, display: 'inline-block' }} />
                        {repo.language}
                      </span>
                    )}
                    {repo.stargazers_count > 0 && <span>⭐ {repo.stargazers_count}</span>}
                    <span>Updated {timeAgo(repo.updated_at)}</span>
                  </div>
                </div>

                {/* Score badge (if done) */}
                {score != null && (
                  <div style={{
                    width: 40, height: 40, borderRadius: '50%',
                    border: `2px solid ${scoreColor}`, color: scoreColor,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontWeight: 800, fontSize: 13, flexShrink: 0,
                  }}>
                    {score}
                  </div>
                )}

                {/* Analyze button */}
                <button
                  className="primary"
                  style={{ flexShrink: 0, fontSize: 13, padding: '7px 16px' }}
                  disabled={isAnalyzing}
                  onClick={() => handleAnalyze(repo)}
                >
                  {isAnalyzing
                    ? <><span className="spinner" style={{ verticalAlign: 'middle', marginRight: 6 }} />Analyzing…</>
                    : repoSummary ? '↻ Re-analyze' : 'Analyze'}
                </button>

                {/* Expand toggle if results exist */}
                {(repoSummary || repoStatus) && (
                  <button
                    onClick={() => setExpanded(isExpanded ? null : key)}
                    style={{
                      background: 'none', border: '1px solid var(--border)',
                      borderRadius: 'var(--radius)', color: 'var(--muted)',
                      padding: '6px 10px', cursor: 'pointer', fontSize: 13,
                    }}
                  >
                    {isExpanded ? '▲' : '▼'}
                  </button>
                )}
              </div>

              {/* Progress bar (while analyzing) */}
              {repoStatus && repoStatus.status === 'processing' && (
                <div style={{ marginTop: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--muted)', marginBottom: 4 }}>
                    <span>{repoStatus.processedFiles || 0} / {repoStatus.totalFiles || 0} files</span>
                    <span>{progress}%</span>
                  </div>
                  <div className="progress-bar">
                    <div className="progress-bar-fill" style={{ width: `${progress}%` }} />
                  </div>
                </div>
              )}

              {/* Error */}
              {analyzeError[key] && (
                <div className="error-box" style={{ marginTop: 10, fontSize: 12 }}>{analyzeError[key]}</div>
              )}

              {/* Results (expanded) */}
              {isExpanded && repoSummary && (
                <div style={{ marginTop: 14, borderTop: '1px solid var(--border)', paddingTop: 14 }}>
                  {repoSummary.summary && (
                    <p style={{ fontSize: 13, marginBottom: 12 }}>{repoSummary.summary}</p>
                  )}
                  <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
                    {repoSummary.top_issues?.length > 0 && (
                      <div style={{ flex: 1, minWidth: 200 }}>
                        <div style={{ fontSize: 10, color: 'var(--muted)', marginBottom: 6, letterSpacing: 1 }}>TOP ISSUES</div>
                        <ul className="issue-list">
                          {repoSummary.top_issues.map((i, idx) => <li key={idx}>{i}</li>)}
                        </ul>
                      </div>
                    )}
                    {repoSummary.recommendations?.length > 0 && (
                      <div style={{ flex: 1, minWidth: 200 }}>
                        <div style={{ fontSize: 10, color: 'var(--muted)', marginBottom: 6, letterSpacing: 1 }}>RECOMMENDATIONS</div>
                        <ul className="issue-list">
                          {repoSummary.recommendations.map((r, idx) => <li key={idx}>{r}</li>)}
                        </ul>
                      </div>
                    )}
                  </div>

                  {/* File scores table */}
                  {repoStatus?.results?.length > 0 && (
                    <div style={{ marginTop: 14 }}>
                      <div style={{ fontSize: 10, color: 'var(--muted)', marginBottom: 6, letterSpacing: 1 }}>FILE SCORES</div>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                        <tbody>
                          {repoStatus.results.map((r, i) => {
                            const c = r.score >= 70 ? 'var(--green)' : r.score >= 40 ? 'var(--yellow)' : 'var(--red)';
                            return (
                              <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}>
                                <td style={{ padding: '5px 0', color: 'var(--muted)' }}>{r.filename}</td>
                                <td style={{ padding: '5px 0', textAlign: 'right', color: c, fontWeight: 700 }}>
                                  {r.score ?? '—'}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
