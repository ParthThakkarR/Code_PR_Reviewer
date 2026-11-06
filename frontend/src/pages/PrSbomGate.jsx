import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { checkPrSbom, mergePr, getUserRepos, getRepoPullRequests } from '../api';

export default function PrSbomGate() {
  const [searchParams] = useSearchParams();
  const [form, setForm] = useState({ owner: 'org', repo: 'service-api', baseBranch: 'main', featureBranch: 'feature/payment', prNumber: '', prTitle: '' });
  const [githubRepos, setGithubRepos] = useState([]);
  const [openPrs, setOpenPrs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [merging, setMerging] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [mergeMessage, setMergeMessage] = useState('');
  const [tab, setTab] = useState('overview'); // 'overview' | 'xml' | 'diff'
  const [xmlTab, setXmlTab] = useState('feature');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const [o, r] = [searchParams.get('owner'), searchParams.get('repo')];
    if (o && r) { setForm(prev => ({ ...prev, owner: o, repo: r })); loadPrs(o, r); }
    getUserRepos().then(res => Array.isArray(res.data) && setGithubRepos(res.data)).catch(() => {});
  }, [searchParams]);

  const loadPrs = async (o, r) => {
    try {
      const res = await getRepoPullRequests(o, r);
      setOpenPrs(res.data || []);
      if (res.data?.[0]) selectPr(res.data[0]);
    } catch {}
  };

  const selectPr = p => setForm(prev => ({ ...prev, baseBranch: p.baseBranch, featureBranch: p.featureBranch, prNumber: p.number, prTitle: p.title }));

  const handleCheck = async () => {
    setLoading(true); setError(''); setMergeMessage(''); setResult(null);
    try {
      const res = await checkPrSbom({ ...form, prNumber: form.prNumber ? Number(form.prNumber) : null });
      setResult(res.data);
      setTab('overview');
    } catch (err) {
      setError(err.response?.data?.message || err.response?.data?.error || err.message);
    } finally { setLoading(false); }
  };

  const handleMerge = async () => {
    if (!result?.canMerge) return;
    setMerging(true); setError('');
    try {
      const res = await mergePr({ checkId: result.checkId });
      setMergeMessage(res.data.message || 'PR merged successfully!');
      setResult(prev => ({ ...prev, status: 'MERGED' }));
    } catch (err) {
      setError(err.response?.data?.message || err.message);
    } finally { setMerging(false); }
  };

  const downloadXml = type => {
    const isF = type === 'feature';
    const blob = new Blob([isF ? result.featureXmlSbom : result.currentXmlSbom], { type: 'application/xml' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `sbom-${result.repo}-${(isF ? result.featureBranch : result.baseBranch).replace(/[^a-zA-Z0-9_-]/g, '_')}.xml`;
    a.click();
  };

  const copyXml = text => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const metrics = result ? [
    { label: 'FEATURE PACKAGES', value: result.statistics?.totalComponentsFeature || 0 },
    { label: 'BASE PACKAGES', value: result.statistics?.totalComponentsCurrent || 0 },
    { label: 'CRITICAL CVES', value: result.statistics?.critical || 0, alert: (result.statistics?.critical || 0) > 0 },
    { label: 'HIGH CVES', value: result.statistics?.high || 0, warn: (result.statistics?.high || 0) > 0 },
    { label: 'NEW IN PR', value: result.statistics?.newVulnerabilities || 0, alert: (result.statistics?.newVulnerabilities || 0) > 0 }
  ] : [];

  return (
    <div style={{ maxWidth: 1040, margin: '28px auto', padding: '0 20px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
        <span style={{ fontSize: 32 }}>🛡️</span>
        <div>
          <h2 style={{ margin: 0, fontSize: 22 }}>PR &amp; SBOM Vulnerability Gate</h2>
          <p style={{ margin: 0, color: 'var(--muted)', fontSize: 13 }}>CycloneDX XML SBOM Generation, Google OSV scanning, and PR merge enforcement.</p>
        </div>
      </div>

      <div className="card" style={{ padding: 18, marginBottom: 20 }}>
        {githubRepos.length > 0 && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
            <div>
              <label>Synced GitHub Repository</label>
              <select value={`${form.owner}/${form.repo}`} onChange={e => {
                const [o, r] = e.target.value.split('/');
                setForm(prev => ({ ...prev, owner: o, repo: r }));
                loadPrs(o, r);
              }} style={{ width: '100%' }}>
                {githubRepos.map(r => <option key={r.full_name} value={r.full_name}>{r.full_name}</option>)}
              </select>
            </div>
            <div>
              <label>Open Pull Request</label>
              <select value={form.prNumber} onChange={e => {
                const found = openPrs.find(p => p.number === Number(e.target.value));
                if (found) selectPr(found);
              }} style={{ width: '100%' }}>
                <option value="">-- Manual or Select PR --</option>
                {openPrs.map(p => <option key={p.number} value={p.number}>#{p.number}: {p.title}</option>)}
              </select>
            </div>
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10 }}>
          {['owner', 'repo', 'baseBranch', 'featureBranch', 'prNumber'].map(field => (
            <div key={field}>
              <label style={{ textTransform: 'capitalize' }}>{field.replace(/([A-Z])/g, ' $1')}</label>
              <input value={form[field]} onChange={e => setForm(prev => ({ ...prev, [field]: e.target.value }))} />
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 14 }}>
          <button className="primary" onClick={handleCheck} disabled={loading} style={{ fontWeight: 700 }}>
            {loading ? 'Scanning SBOM & OSV CVEs…' : '🛡️ Run SBOM Security Gate Check'}
          </button>
        </div>
      </div>

      {error && <div className="error-box" style={{ marginBottom: 16 }}>{error}</div>}
      {mergeMessage && <div style={{ background: 'rgba(46,160,67,0.15)', border: '1px solid var(--green)', color: 'var(--green)', padding: 12, borderRadius: 6, marginBottom: 16 }}>🎉 {mergeMessage}</div>}

      {result && (
        <>
          <div className="card" style={{ padding: 20, marginBottom: 16, borderLeft: `6px solid ${result.canMerge ? 'var(--green)' : 'var(--red)'}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 14 }}>
            <div>
              <span style={{ fontSize: 16, padding: '4px 12px', borderRadius: 16, fontWeight: 800, background: result.canMerge ? 'rgba(46,160,67,0.2)' : 'rgba(248,81,73,0.2)', color: result.canMerge ? 'var(--green)' : 'var(--red)' }}>
                {result.status === 'MERGED' ? '✅ MERGED' : result.canMerge ? '🟢 ALLOWED TO MERGE' : '🚫 MERGE BLOCKED'}
              </span>
              <p style={{ margin: '8px 0 0 0', fontWeight: 500 }}>{result.gateReason}</p>
              {result.headSha && <small style={{ color: 'var(--muted)', fontFamily: 'monospace' }}>SHA: {result.headSha.slice(0, 8)}</small>}
            </div>
            {result.status !== 'MERGED' && (
              <button onClick={handleMerge} disabled={!result.canMerge || merging} style={{ background: result.canMerge ? 'var(--green)' : '#21262d', color: '#fff', border: 'none', padding: '10px 20px', borderRadius: 6, fontWeight: 700, cursor: result.canMerge ? 'pointer' : 'not-allowed' }}>
                {merging ? 'Merging…' : result.canMerge ? '🔀 Merge Pull Request' : '🔒 Merge Blocked'}
              </button>
            )}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 10, marginBottom: 16 }}>
            {metrics.map(m => (
              <div key={m.label} className="card" style={{ padding: 12, textAlign: 'center' }}>
                <div style={{ fontSize: 10, color: 'var(--muted)' }}>{m.label}</div>
                <div style={{ fontSize: 20, fontWeight: 800, color: m.alert ? 'var(--red)' : m.warn ? 'var(--yellow)' : 'var(--text)' }}>{m.value}</div>
              </div>
            ))}
          </div>

          <div className="card" style={{ padding: 16 }}>
            <div className="tab-bar" style={{ marginBottom: 14 }}>
              {['overview', 'xml', 'diff'].map(t => (
                <button key={t} className={tab === t ? 'active' : ''} onClick={() => setTab(t)}>
                  {t === 'overview' ? `📊 CVE Audit (${result.vulnerabilities?.length || 0})` : t === 'xml' ? '📄 CycloneDX XML' : '🔄 Component Diff'}
                </button>
              ))}
            </div>

            {tab === 'overview' && (
              result.vulnerabilities?.length === 0 ? (
                <div style={{ textAlign: 'center', padding: 28, color: 'var(--green)' }}>✨ Zero blocking vulnerabilities detected across all components!</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {result.vulnerabilities.map((v, i) => (
                    <div key={i} style={{ border: '1px solid var(--border)', borderRadius: 6, padding: 12 }}>
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                        <span style={{ fontSize: 11, fontWeight: 800, padding: '2px 6px', borderRadius: 4, background: v.severity === 'CRITICAL' ? 'var(--red)' : 'var(--yellow)', color: '#000' }}>{v.severity} {v.cvssScore ? `(CVSS ${v.cvssScore})` : ''}</span>
                        <a href={`https://osv.dev/vulnerability/${v.id}`} target="_blank" rel="noreferrer" style={{ fontWeight: 700, color: 'var(--accent)' }}>{v.id}</a>
                        <strong>{v.package}@{v.version}</strong>
                        {v.isNewInBranch && <span style={{ color: 'var(--red)', fontSize: 11, border: '1px solid var(--red)', padding: '1px 4px', borderRadius: 4 }}>NEW IN PR</span>}
                      </div>
                      <p style={{ margin: '6px 0', fontSize: 13 }}>{v.summary}</p>
                      <small style={{ color: 'var(--green)' }}>💡 Fix: Upgrade to {v.fixedVersion || 'latest secure version'}</small>
                    </div>
                  ))}
                </div>
              )
            )}

            {tab === 'xml' && (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button className={xmlTab === 'feature' ? 'primary' : ''} onClick={() => setXmlTab('feature')} style={{ fontSize: 12 }}>Feature XML</button>
                    <button className={xmlTab === 'current' ? 'primary' : ''} onClick={() => setXmlTab('current')} style={{ fontSize: 12 }}>Base XML</button>
                  </div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button onClick={() => copyXml(xmlTab === 'feature' ? result.featureXmlSbom : result.currentXmlSbom)} style={{ fontSize: 12 }}>{copied ? 'Copied!' : 'Copy'}</button>
                    <button className="primary" onClick={() => downloadXml(xmlTab)} style={{ fontSize: 12 }}>Download XML</button>
                  </div>
                </div>
                <textarea readOnly value={xmlTab === 'feature' ? result.featureXmlSbom : result.currentXmlSbom} rows={16} style={{ width: '100%', fontFamily: 'monospace', fontSize: 12, background: '#0d1117', color: '#c9d1d9', borderRadius: 6, padding: 10 }} />
              </div>
            )}

            {tab === 'diff' && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
                {[['ADDED', result.componentsDiff?.added, 'var(--green)'], ['UPDATED', result.componentsDiff?.updated, 'var(--yellow)'], ['REMOVED', result.componentsDiff?.removed, 'var(--red)']].map(([title, list, color]) => (
                  <div key={title} style={{ border: '1px solid var(--border)', borderRadius: 6, padding: 12 }}>
                    <h4 style={{ margin: '0 0 8px 0', fontSize: 12, color }}>{title} ({list?.length || 0})</h4>
                    <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12, color }}>{(list?.length ? list : ['None']).map((item, idx) => <li key={idx}>{item}</li>)}</ul>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
