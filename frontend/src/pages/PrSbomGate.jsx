import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { checkPrSbom, mergePr, getUserRepos, getRepoPullRequests } from '../api';

const DEFAULT_BASE_MANIFEST = JSON.stringify({
  name: "payment-service",
  version: "1.0.0",
  dependencies: {
    "dotenv": "17.3.1",
    "ms": "2.1.3"
  }
}, null, 2);

const SAFE_FEATURE_MANIFEST = JSON.stringify({
  name: "payment-service",
  version: "1.1.0",
  dependencies: {
    "dotenv": "17.3.1",
    "ms": "2.1.3",
    "dayjs": "1.11.13",
    "clsx": "2.1.1"
  }
}, null, 2);

const VULNERABLE_FEATURE_MANIFEST = JSON.stringify({
  name: "payment-service",
  version: "1.1.0",
  dependencies: {
    "dotenv": "17.3.1",
    "ms": "2.1.3",
    "jsonwebtoken": "9.0.0",      // CRITICAL CVE-2022-23529
    "axios": "0.21.1",             // HIGH CVE-2021-3749 ReDoS
    "lodash": "4.17.15"            // HIGH CVE-2020-8203 Prototype Pollution
  }
}, null, 2);

export default function PrSbomGate() {
  const [repoMode, setRepoMode] = useState('preset'); // 'preset' | 'custom' | 'github'
  const [testPreset, setTestPreset] = useState('safe'); // 'safe' | 'vulnerable'
  const [searchParams] = useSearchParams();

  useEffect(() => {
    const o = searchParams.get('owner');
    const r = searchParams.get('repo');
    if (o && r) {
      setOwner(o);
      setRepo(r);
      setRepoMode('github');
      setSelectedGithubRepo(o + '/' + r);
      handleSelectGithubRepo(o + '/' + r);
    }
  }, [searchParams]);

  // Custom inputs
  const [owner, setOwner] = useState('org');
  const [repo, setRepo] = useState('ecommerce-api');
  const [baseBranch, setBaseBranch] = useState('main');
  const [featureBranch, setFeatureBranch] = useState('feature/checkout-flow');
  const [prNumber, setPrNumber] = useState(42);
  const [prTitle, setPrTitle] = useState('feat: Add checkout payment & auth flow');
  const [policy, setPolicy] = useState('standard'); // 'standard' (High/Critical) | 'strict' (Any)

  const [baseManifest, setBaseManifest] = useState(DEFAULT_BASE_MANIFEST);
  const [featureManifest, setFeatureManifest] = useState(SAFE_FEATURE_MANIFEST);

  // GitHub integration state
  const [githubRepos, setGithubRepos] = useState([]);
  const [selectedGithubRepo, setSelectedGithubRepo] = useState('');
  const [openPrs, setOpenPrs] = useState([]);
  const [selectedPrNumber, setSelectedPrNumber] = useState('');

  // Execution & results state
  const [loading, setLoading] = useState(false);
  const [merging, setMerging] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [mergeMessage, setMergeMessage] = useState('');
  const [xmlTab, setXmlTab] = useState('feature'); // 'feature' | 'current'
  const [activeTab, setActiveTab] = useState('overview'); // 'overview' | 'xml' | 'vulnerabilities' | 'diff'
  const [copied, setCopied] = useState(false);

  // Load user repos if available
  useEffect(() => {
    getUserRepos()
      .then(res => {
        if (Array.isArray(res.data) && res.data.length > 0) {
          setGithubRepos(res.data);
        }
      })
      .catch(() => { });
  }, []);

  // Update preset manifests when preset selection changes
  const applyPreset = (preset) => {
    setTestPreset(preset);
    if (preset === 'safe') {
      setFeatureBranch('feature/secure-payments');
      setFeatureManifest(SAFE_FEATURE_MANIFEST);
    } else {
      setFeatureBranch('feature/legacy-deps-vulnerable');
      setFeatureManifest(VULNERABLE_FEATURE_MANIFEST);
    }
  };

  const handleSelectGithubRepo = async (fullName) => {
    setSelectedGithubRepo(fullName);
    const [o, r] = fullName.split('/');
    setOwner(o);
    setRepo(r);
    setSelectedPrNumber('');
    setOpenPrs([]);
    try {
      const res = await getRepoPullRequests(o, r);
      setOpenPrs(res.data || []);
      if (res.data?.length > 0) {
        const firstPr = res.data[0];
        setSelectedPrNumber(firstPr.number);
        setBaseBranch(firstPr.baseBranch);
        setFeatureBranch(firstPr.featureBranch);
        setPrNumber(firstPr.number);
        setPrTitle(firstPr.title);
      }
    } catch { }
  };

  const handleSelectPr = (num) => {
    setSelectedPrNumber(num);
    const found = openPrs.find(p => p.number === Number(num));
    if (found) {
      setBaseBranch(found.baseBranch);
      setFeatureBranch(found.featureBranch);
      setPrNumber(found.number);
      setPrTitle(found.title);
    }
  };

  const handleRunSecurityCheck = async () => {
    setLoading(true);
    setError('');
    setMergeMessage('');
    setResult(null);

    try {
      const payload = {
        owner,
        repo,
        prNumber: prNumber ? Number(prNumber) : null,
        prTitle,
        baseBranch,
        featureBranch,
        policy,
        baseManifest,
        featureManifest,
        manifestType: 'auto',
        testPreset: repoMode === 'preset' ? testPreset : null
      };

      const res = await checkPrSbom(payload);
      setResult(res.data);
      setActiveTab('overview');
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Error running SBOM security check');
    } finally {
      setLoading(false);
    }
  };

  const handleMergePullRequest = async () => {
    if (!result || !result.checkId) return;
    if (!result.canMerge) {
      setError('Cannot merge: Vulnerability checks have failed.');
      return;
    }

    setMerging(true);
    setError('');
    setMergeMessage('');

    try {
      const res = await mergePr({ checkId: result.checkId });
      setMergeMessage(res.data.message || 'Pull request merged successfully!');
      setResult(prev => ({ ...prev, status: 'MERGED' }));
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Merge failed');
    } finally {
      setMerging(false);
    }
  };

  const downloadXmlFile = (type) => {
    if (!result) return;
    const isFeature = type === 'feature';
    const content = isFeature ? result.featureXmlSbom : result.currentXmlSbom;
    const branch = isFeature ? result.featureBranch : result.baseBranch;
    const blob = new Blob([content], { type: 'application/xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `sbom-${result.repo}-${branch.replace(/[^a-zA-Z0-9_-]/g, '_')}.xml`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div style={{ maxWidth: 1040, margin: '32px auto', padding: '0 20px' }}>
      {/* Page Header */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 26 }}>🛡️</span>
          <h2 style={{ margin: 0, fontSize: 24, fontWeight: 700 }}>PR &amp; SBOM Vulnerability Gate</h2>
        </div>
        <p style={{ color: 'var(--muted)', fontSize: 13, marginTop: 6, lineHeight: 1.5 }}>
          Generate CycloneDX XML SBOMs for both the feature branch and current/base feature, inspect dependencies, run real-time CVE vulnerability checks, and enforce automated pull request merge gating.
        </p>
      </div>

      {/* Mode Selection */}
      <div className="card" style={{ marginBottom: 20, padding: 18 }}>
        <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
          <button
            className={repoMode === 'preset' ? 'primary' : ''}
            onClick={() => setRepoMode('preset')}
            style={{ fontSize: 13, padding: '7px 16px' }}
          >
            ⚡ Quick Interactive Test (Pass / Block Demos)
          </button>
          <button
            className={repoMode === 'custom' ? 'primary' : ''}
            onClick={() => setRepoMode('custom')}
            style={{ fontSize: 13, padding: '7px 16px' }}
          >
            ✏️ Custom Manifests / Branches
          </button>
          {githubRepos.length > 0 && (
            <button
              className={repoMode === 'github' ? 'primary' : ''}
              onClick={() => setRepoMode('github')}
              style={{ fontSize: 13, padding: '7px 16px' }}
            >
              🐙 Select from GitHub Repos ({githubRepos.length})
            </button>
          )}
        </div>

        {/* Preset Selector */}
        {repoMode === 'preset' && (
          <div style={{ background: 'var(--surface-hover)', padding: '14px 16px', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--muted)', marginBottom: 8, letterSpacing: 0.5 }}>
              SELECT TEST SCENARIO
            </div>
            <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13 }}>
                <input
                  type="radio"
                  name="preset"
                  checked={testPreset === 'safe'}
                  onChange={() => applyPreset('safe')}
                />
                <span style={{ color: 'var(--green)', fontWeight: 600 }}>🟢 Pass Scenario: Clean Feature Branch</span>
                <span style={{ color: 'var(--muted)', fontSize: 12 }}>(0 Critical/High CVEs → Merge Allowed)</span>
              </label>

              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13 }}>
                <input
                  type="radio"
                  name="preset"
                  checked={testPreset === 'vulnerable'}
                  onChange={() => applyPreset('vulnerable')}
                />
                <span style={{ color: 'var(--red)', fontWeight: 600 }}>🔴 Block Scenario: Insecure Feature Branch</span>
                <span style={{ color: 'var(--muted)', fontSize: 12 }}>(Contains CVEs in axios, lodash, jwt → Merge Blocked)</span>
              </label>
            </div>
          </div>
        )}

        {/* GitHub Repo Selector */}
        {repoMode === 'github' && (
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
            <div style={{ flex: 1, minWidth: 200 }}>
              <label>Select Repository</label>
              <select
                value={selectedGithubRepo}
                onChange={e => handleSelectGithubRepo(e.target.value)}
                style={{ width: '100%' }}
              >
                <option value="">-- Choose Repository --</option>
                {githubRepos.map(r => (
                  <option key={r.full_name} value={r.full_name}>{r.full_name}</option>
                ))}
              </select>
            </div>

            {openPrs.length > 0 && (
              <div style={{ flex: 1, minWidth: 200 }}>
                <label>Select Open Pull Request</label>
                <select
                  value={selectedPrNumber}
                  onChange={e => handleSelectPr(e.target.value)}
                  style={{ width: '100%' }}
                >
                  {openPrs.map(p => (
                    <option key={p.number} value={p.number}>
                      #{p.number}: {p.title} ({p.featureBranch} → {p.baseBranch})
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
        )}

        {/* Branch & PR Metadata Inputs */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12, marginTop: 14 }}>
          <div>
            <label>Current / Base Branch</label>
            <input
              value={baseBranch}
              onChange={e => setBaseBranch(e.target.value)}
              placeholder="main"
            />
          </div>
          <div>
            <label>Feature Branch</label>
            <input
              value={featureBranch}
              onChange={e => setFeatureBranch(e.target.value)}
              placeholder="feature/checkout-flow"
            />
          </div>
          <div>
            <label>Pull Request #</label>
            <input
              type="number"
              value={prNumber}
              onChange={e => setPrNumber(e.target.value)}
              placeholder="42"
            />
          </div>
          <div>
            <label>Merge Gate Policy</label>
            <select value={policy} onChange={e => setPolicy(e.target.value)} style={{ width: '100%' }}>
              <option value="standard">Block on Critical &amp; High CVEs (Standard)</option>
              <option value="strict">Block on Any Vulnerability (Strict Zero-CVE)</option>
            </select>
          </div>
        </div>

        {/* Custom Manifest Editors */}
        {repoMode === 'custom' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginTop: 16 }}>
            <div>
              <label>Current / Base Manifest (package.json or requirements.txt)</label>
              <textarea
                value={baseManifest}
                onChange={e => setBaseManifest(e.target.value)}
                rows={10}
                style={{ fontFamily: 'monospace', fontSize: 12 }}
              />
            </div>
            <div>
              <label>Feature Branch Manifest (package.json or requirements.txt)</label>
              <textarea
                value={featureManifest}
                onChange={e => setFeatureManifest(e.target.value)}
                rows={10}
                style={{ fontFamily: 'monospace', fontSize: 12 }}
              />
            </div>
          </div>
        )}

        {/* Action Button */}
        <div style={{ marginTop: 18, display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
          <button
            className="primary"
            onClick={handleRunSecurityCheck}
            disabled={loading}
            style={{ padding: '9px 24px', fontSize: 14, fontWeight: 700 }}
          >
            {loading ? (
              <>
                <span className="spinner" style={{ verticalAlign: 'middle', marginRight: 8 }} />
                Generating XML &amp; Scanning SBOM…
              </>
            ) : (
              '🛡️ Generate XML SBOMs & Check Vulnerabilities'
            )}
          </button>
        </div>
      </div>

      {/* Global Error Banner */}
      {error && <div className="error-box" style={{ marginBottom: 20 }}>{error}</div>}

      {/* Success Merge Message */}
      {mergeMessage && (
        <div style={{
          background: 'rgba(46, 160, 67, 0.15)',
          border: '1px solid var(--green)',
          color: 'var(--green)',
          padding: '14px 18px',
          borderRadius: 'var(--radius)',
          marginBottom: 20,
          fontWeight: 600,
          display: 'flex',
          alignItems: 'center',
          gap: 10
        }}>
          <span style={{ fontSize: 20 }}>🎉</span>
          <span>{mergeMessage}</span>
        </div>
      )}

      {/* Main Results Section */}
      {result && (
        <div>
          {/* PR MERGE GATE DECISION HERO CARD */}
          <div className="card" style={{
            marginBottom: 20,
            padding: '20px 24px',
            borderLeft: `6px solid ${result.canMerge ? 'var(--green)' : 'var(--red)'}`,
            background: result.canMerge ? 'rgba(46, 160, 67, 0.05)' : 'rgba(248, 81, 73, 0.05)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{
                    fontSize: 22,
                    padding: '6px 12px',
                    borderRadius: 20,
                    fontWeight: 800,
                    letterSpacing: 0.5,
                    background: result.canMerge ? 'rgba(46, 160, 67, 0.2)' : 'rgba(248, 81, 73, 0.2)',
                    color: result.canMerge ? 'var(--green)' : 'var(--red)'
                  }}>
                    {result.status === 'MERGED'
                      ? '✅ MERGED'
                      : result.canMerge
                        ? '🟢 ALLOWED TO MERGE'
                        : '🚫 MERGE BLOCKED'}
                  </span>
                  <span style={{ fontSize: 14, color: 'var(--muted)' }}>
                    PR #{result.prNumber || ''} ({result.featureBranch} → {result.baseBranch})
                  </span>
                </div>

                <p style={{ marginTop: 10, marginBottom: 0, fontSize: 14, fontWeight: 500, color: 'var(--text)' }}>
                  {result.gateReason}
                </p>
              </div>

              {/* THE PULL REQUEST MERGE BUTTON (Enabled only if passes checks) */}
              <div>
                {result.status === 'MERGED' ? (
                  <div style={{
                    padding: '8px 16px',
                    background: 'var(--surface-hover)',
                    borderRadius: 'var(--radius)',
                    color: 'var(--muted)',
                    fontSize: 13,
                    border: '1px solid var(--border)'
                  }}>
                    PR is already merged
                  </div>
                ) : (
                  <button
                    onClick={handleMergePullRequest}
                    disabled={!result.canMerge || merging}
                    title={result.canMerge ? 'Merge pull request now' : 'Merge is strictly blocked by SBOM security gate'}
                    style={{
                      background: result.canMerge ? 'var(--green)' : '#21262d',
                      color: result.canMerge ? '#ffffff' : 'var(--muted)',
                      border: result.canMerge ? 'none' : '1px solid var(--border)',
                      cursor: result.canMerge ? 'pointer' : 'not-allowed',
                      padding: '10px 22px',
                      borderRadius: 'var(--radius)',
                      fontSize: 14,
                      fontWeight: 700,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      boxShadow: result.canMerge ? '0 0 12px rgba(46, 160, 67, 0.4)' : 'none'
                    }}
                  >
                    {merging ? (
                      <>
                        <span className="spinner" />
                        Merging Pull Request…
                      </>
                    ) : result.canMerge ? (
                      <>
                        <span>🔀</span> Merge Pull Request
                      </>
                    ) : (
                      <>
                        <span>🔒</span> Merge Blocked (Fix Vulnerabilities)
                      </>
                    )}
                  </button>
                )}
              </div>
            </div>

            {/* Blocked reasons notice if merge is blocked */}
            {!result.canMerge && result.blockedReasons?.length > 0 && (
              <div style={{ marginTop: 16, paddingTop: 14, borderTop: '1px solid rgba(248, 81, 73, 0.2)' }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--red)', letterSpacing: 0.5, marginBottom: 6 }}>
                  BLOCKING SECURITY FINDINGS ({result.blockedReasons.length}):
                </div>
                <ul style={{ margin: 0, paddingLeft: 20, color: 'var(--red)', fontSize: 12 }}>
                  {result.blockedReasons.map((reason, idx) => (
                    <li key={idx} style={{ marginBottom: 4 }}>{reason}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {/* Quick Metrics Bar */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12, marginBottom: 20 }}>
            <div className="card" style={{ padding: '12px 16px', textAlign: 'center' }}>
              <div style={{ fontSize: 11, color: 'var(--muted)', letterSpacing: 0.5 }}>FEATURE COMPONENTS</div>
              <div style={{ fontSize: 20, fontWeight: 700, marginTop: 4 }}>{result.statistics?.totalComponentsFeature || 0}</div>
            </div>
            <div className="card" style={{ padding: '12px 16px', textAlign: 'center' }}>
              <div style={{ fontSize: 11, color: 'var(--muted)', letterSpacing: 0.5 }}>BASE COMPONENTS</div>
              <div style={{ fontSize: 20, fontWeight: 700, marginTop: 4 }}>{result.statistics?.totalComponentsCurrent || 0}</div>
            </div>
            <div className="card" style={{ padding: '12px 16px', textAlign: 'center' }}>
              <div style={{ fontSize: 11, color: 'var(--muted)', letterSpacing: 0.5 }}>CRITICAL CVES</div>
              <div style={{
                fontSize: 20,
                fontWeight: 700,
                marginTop: 4,
                color: (result.statistics?.critical || 0) > 0 ? 'var(--red)' : 'var(--text)'
              }}>
                {result.statistics?.critical || 0}
              </div>
            </div>
            <div className="card" style={{ padding: '12px 16px', textAlign: 'center' }}>
              <div style={{ fontSize: 11, color: 'var(--muted)', letterSpacing: 0.5 }}>HIGH CVES</div>
              <div style={{
                fontSize: 20,
                fontWeight: 700,
                marginTop: 4,
                color: (result.statistics?.high || 0) > 0 ? 'var(--yellow)' : 'var(--text)'
              }}>
                {result.statistics?.high || 0}
              </div>
            </div>
            <div className="card" style={{ padding: '12px 16px', textAlign: 'center' }}>
              <div style={{ fontSize: 11, color: 'var(--muted)', letterSpacing: 0.5 }}>NEW VULNS IN PR</div>
              <div style={{
                fontSize: 20,
                fontWeight: 700,
                marginTop: 4,
                color: (result.statistics?.newVulnerabilities || 0) > 0 ? 'var(--red)' : 'var(--green)'
              }}>
                {result.statistics?.newVulnerabilities || 0}
              </div>
            </div>
          </div>

          {/* Tab Navigation for Detailed Sections */}
          <div className="card" style={{ padding: '16px 20px' }}>
            <div className="tab-bar" style={{ marginBottom: 18 }}>
              <button
                className={activeTab === 'overview' ? 'active' : ''}
                onClick={() => setActiveTab('overview')}
              >
                📊 Vulnerabilities &amp; Audit ({result.vulnerabilities?.length || 0})
              </button>
              <button
                className={activeTab === 'xml' ? 'active' : ''}
                onClick={() => setActiveTab('xml')}
              >
                📄 CycloneDX XML SBOMs
              </button>
              <button
                className={activeTab === 'diff' ? 'active' : ''}
                onClick={() => setActiveTab('diff')}
              >
                🔄 Component Diff &amp; Packages
              </button>
            </div>

            {/* TAB 1: VULNERABILITY AUDIT */}
            {activeTab === 'overview' && (
              <div>
                {result.vulnerabilities?.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '36px 16px', color: 'var(--green)' }}>
                    <div style={{ fontSize: 32, marginBottom: 10 }}>✨</div>
                    <div style={{ fontWeight: 700, fontSize: 16 }}>No Known Vulnerabilities Found!</div>
                    <p style={{ color: 'var(--muted)', fontSize: 13, marginTop: 4 }}>
                      All {result.featureComponents?.length || 0} packages in the feature branch passed OSV and CVE database checks.
                    </p>
                  </div>
                ) : (
                  <div>
                    <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 12 }}>
                      Identified vulnerabilities across dependencies in the feature branch:
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                      {result.vulnerabilities.map((v, i) => {
                        const isCrit = v.severity === 'CRITICAL';
                        const isHigh = v.severity === 'HIGH';
                        const badgeColor = isCrit ? 'var(--red)' : isHigh ? '#ff8c00' : 'var(--yellow)';

                        return (
                          <div
                            key={i}
                            style={{
                              border: '1px solid var(--border)',
                              borderRadius: 'var(--radius)',
                              padding: '12px 16px',
                              background: isCrit ? 'rgba(248, 81, 73, 0.04)' : 'transparent'
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 6 }}>
                              <span style={{
                                background: badgeColor,
                                color: '#0d1117',
                                fontWeight: 800,
                                fontSize: 11,
                                padding: '2px 8px',
                                borderRadius: 4
                              }}>
                                {v.severity} {v.cvssScore ? `(CVSS ${v.cvssScore})` : ''}
                              </span>

                              <a
                                href={`https://osv.dev/vulnerability/${v.id}`}
                                target="_blank"
                                rel="noreferrer"
                                style={{ fontWeight: 700, fontSize: 13, color: 'var(--accent)', textDecoration: 'none' }}
                              >
                                {v.id}
                              </a>

                              <span style={{ fontSize: 13, fontWeight: 600 }}>
                                {v.package}@{v.version}
                              </span>

                              {v.isNewInBranch && (
                                <span style={{
                                  fontSize: 10,
                                  border: '1px solid var(--red)',
                                  color: 'var(--red)',
                                  padding: '1px 6px',
                                  borderRadius: 4
                                }}>
                                  NEW IN FEATURE BRANCH
                                </span>
                              )}
                            </div>

                            <p style={{ fontSize: 13, color: 'var(--text)', margin: '4px 0 8px 0', lineHeight: 1.4 }}>
                              {v.summary}
                            </p>

                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--green)' }}>
                              <span>💡 Recommended Fix:</span>
                              <strong>Upgrade {v.package} to {v.fixedVersion || 'latest secure version'}</strong>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* TAB 2: CYCLONEDX XML SBOM VIEWERS (FEATURE BRANCH & CURRENT FEATURE) */}
            {activeTab === 'xml' && (
              <div>
                {/* XML Selector Tabs */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, flexWrap: 'wrap', gap: 10 }}>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button
                      className={xmlTab === 'feature' ? 'primary' : ''}
                      onClick={() => setXmlTab('feature')}
                      style={{ fontSize: 12, padding: '5px 12px' }}
                    >
                      Feature Branch XML SBOM ({result.featureBranch})
                    </button>
                    <button
                      className={xmlTab === 'current' ? 'primary' : ''}
                      onClick={() => setXmlTab('current')}
                      style={{ fontSize: 12, padding: '5px 12px' }}
                    >
                      Current Feature XML SBOM ({result.baseBranch})
                    </button>
                  </div>

                  <div style={{ display: 'flex', gap: 8 }}>
                    <button
                      onClick={() => copyToClipboard(xmlTab === 'feature' ? result.featureXmlSbom : result.currentXmlSbom)}
                      style={{
                        background: 'transparent',
                        border: '1px solid var(--border)',
                        color: 'var(--text)',
                        padding: '5px 12px',
                        fontSize: 12,
                        borderRadius: 'var(--radius)',
                        cursor: 'pointer'
                      }}
                    >
                      {copied ? '✅ Copied!' : '📋 Copy XML'}
                    </button>

                    <button
                      onClick={() => downloadXmlFile(xmlTab)}
                      style={{
                        background: 'var(--accent)',
                        color: '#0d1117',
                        border: 'none',
                        padding: '5px 14px',
                        fontSize: 12,
                        fontWeight: 700,
                        borderRadius: 'var(--radius)',
                        cursor: 'pointer'
                      }}
                    >
                      ⬇ Download {xmlTab === 'feature' ? 'feature' : 'current'}.xml
                    </button>
                  </div>
                </div>

                {/* XML Content Display */}
                <div style={{ position: 'relative' }}>
                  <textarea
                    readOnly
                    value={xmlTab === 'feature' ? result.featureXmlSbom : result.currentXmlSbom}
                    rows={20}
                    style={{
                      width: '100%',
                      fontFamily: 'Consolas, Monaco, monospace',
                      fontSize: 12,
                      background: '#0d1117',
                      color: '#c9d1d9',
                      border: '1px solid var(--border)',
                      borderRadius: 'var(--radius)',
                      padding: 14,
                      lineHeight: 1.4,
                      whiteSpace: 'pre',
                      overflowX: 'auto'
                    }}
                  />
                </div>
              </div>
            )}

            {/* TAB 3: COMPONENT DIFF & PACKAGES */}
            {activeTab === 'diff' && (
              <div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
                  {/* Added dependencies */}
                  <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: 14 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--green)', marginBottom: 8 }}>
                      ADDED IN FEATURE BRANCH ({result.componentsDiff?.added?.length || 0})
                    </div>
                    {result.componentsDiff?.added?.length === 0 ? (
                      <div style={{ color: 'var(--muted)', fontSize: 12 }}>None</div>
                    ) : (
                      <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12 }}>
                        {result.componentsDiff?.added?.map((item, idx) => (
                          <li key={idx} style={{ color: 'var(--green)' }}>+{item}</li>
                        ))}
                      </ul>
                    )}
                  </div>

                  {/* Updated dependencies */}
                  <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: 14 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--yellow)', marginBottom: 8 }}>
                      UPDATED IN FEATURE BRANCH ({result.componentsDiff?.updated?.length || 0})
                    </div>
                    {result.componentsDiff?.updated?.length === 0 ? (
                      <div style={{ color: 'var(--muted)', fontSize: 12 }}>None</div>
                    ) : (
                      <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12 }}>
                        {result.componentsDiff?.updated?.map((item, idx) => (
                          <li key={idx} style={{ color: 'var(--yellow)' }}>~ {item}</li>
                        ))}
                      </ul>
                    )}
                  </div>

                  {/* Removed dependencies */}
                  <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: 14 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--red)', marginBottom: 8 }}>
                      REMOVED IN FEATURE BRANCH ({result.componentsDiff?.removed?.length || 0})
                    </div>
                    {result.componentsDiff?.removed?.length === 0 ? (
                      <div style={{ color: 'var(--muted)', fontSize: 12 }}>None</div>
                    ) : (
                      <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12 }}>
                        {result.componentsDiff?.removed?.map((item, idx) => (
                          <li key={idx} style={{ color: 'var(--red)' }}>- {item}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>

                {/* All Feature Components Table */}
                <div style={{ marginTop: 20 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--muted)', marginBottom: 8, letterSpacing: 0.5 }}>
                    ALL FEATURE BRANCH COMPONENTS ({result.featureComponents?.length || 0})
                  </div>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid var(--border)', textAlign: 'left', color: 'var(--muted)' }}>
                        <th style={{ padding: '8px 4px' }}>Package Name</th>
                        <th style={{ padding: '8px 4px' }}>Version</th>
                        <th style={{ padding: '8px 4px' }}>Ecosystem</th>
                        <th style={{ padding: '8px 4px' }}>PURL</th>
                      </tr>
                    </thead>
                    <tbody>
                      {result.featureComponents?.map((comp, idx) => (
                        <tr key={idx} style={{ borderBottom: '1px solid var(--border)' }}>
                          <td style={{ padding: '6px 4px', fontWeight: 600 }}>{comp.name}</td>
                          <td style={{ padding: '6px 4px', color: 'var(--muted)' }}>{comp.version}</td>
                          <td style={{ padding: '6px 4px', color: 'var(--muted)' }}>{comp.ecosystem || 'npm'}</td>
                          <td style={{ padding: '6px 4px', fontFamily: 'monospace', fontSize: 11, color: 'var(--muted)' }}>
                            {comp.purl}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}