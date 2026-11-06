import { randomUUID } from "crypto";

const esc = s => (s ? String(s).replace(/[<>&'"]/g, c => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", '"': "&quot;" }[c])) : "");

export const cleanVersion = v => (typeof v === "string" ? v.replace(/^[\^~>=< ]+/, "").trim() || null : null);

const mkComp = (name, version, ecosystem = "npm", scope = "required", license = null) => ({
    name,
    version,
    type: "library",
    ecosystem,
    purl: `pkg:${ecosystem.toLowerCase()}/${encodeURIComponent(name)}@${version}`,
    scope,
    license
});

export function parsePackageJson(content) {
    try {
        const pkg = typeof content === "string" ? JSON.parse(content) : content;
        const seen = new Set();
        return ["dependencies", "devDependencies"].flatMap(scope =>
            Object.entries(pkg[scope] || {}).map(([n, v]) => {
                const ver = cleanVersion(v);
                if (!ver || seen.has(n)) return null;
                seen.add(n);
                return mkComp(n, ver, "npm", scope === "devDependencies" ? "optional" : "required");
            })
        ).filter(Boolean);
    } catch { return []; }
}

export function parsePackageLockJson(content) {
    try {
        const lock = typeof content === "string" ? JSON.parse(content) : content;
        const seen = new Set();
        const pkgs = Object.entries(lock.packages || {}).filter(([p]) => p !== "");
        if (pkgs.length) {
            return pkgs.map(([p, d]) => {
                const name = d.name || p.replace(/^(?:node_modules\/)+/, "");
                const ver = cleanVersion(d.version);
                if (!name || !ver || seen.has(name)) return null;
                seen.add(name);
                return mkComp(name, ver, "npm", d.dev ? "optional" : "required", d.license || null);
            }).filter(Boolean);
        }
        return Object.entries(lock.dependencies || {}).map(([n, d]) => {
            const ver = cleanVersion(d.version);
            if (!ver || seen.has(n)) return null;
            seen.add(n);
            return mkComp(n, ver, "npm", d.dev ? "optional" : "required");
        }).filter(Boolean);
    } catch { return []; }
}

export function parseYarnLock(content) {
    if (typeof content !== "string") return [];
    const seen = new Set();
    return content.split(/\n(?=\S)/).map(block => {
        if (block.startsWith("#") || !block.includes("version")) return null;
        const name = block.match(/^"?([^@"\n\r]+)@/)?.[1]?.trim();
        const ver = cleanVersion(block.match(/\n\s+version "([^"]+)"/)?.[1]);
        if (!name || !ver || seen.has(name)) return null;
        seen.add(name);
        return mkComp(name, ver);
    }).filter(Boolean);
}

export function parsePnpmLock(content) {
    if (typeof content !== "string") return [];
    const seen = new Set();
    return content.split(/\r?\n/).map(line => {
        const m = line.match(/^\s+\/?([^@\s:]+)@([^\s:\/]+):/);
        const ver = cleanVersion(m?.[2]);
        if (!m || !ver || seen.has(m[1])) return null;
        seen.add(m[1]);
        return mkComp(m[1], ver);
    }).filter(Boolean);
}

export function parsePoetryLock(content) {
    if (typeof content !== "string") return [];
    const seen = new Set();
    return content.split(/\[\[package\]\]/).slice(1).map(block => {
        const name = block.match(/name = "([^"]+)"/)?.[1]?.toLowerCase();
        const ver = cleanVersion(block.match(/version = "([^"]+)"/)?.[1]);
        if (!name || !ver || seen.has(name)) return null;
        seen.add(name);
        return mkComp(name, ver, "PyPI");
    }).filter(Boolean);
}

export function parsePipfileLock(content) {
    try {
        const lock = typeof content === "string" ? JSON.parse(content) : content;
        const seen = new Set();
        return ["default", "develop"].flatMap(scope =>
            Object.entries(lock[scope] || {}).map(([n, d]) => {
                const name = n.toLowerCase();
                const ver = cleanVersion(typeof d === "object" ? d.version : d);
                if (!ver || seen.has(name)) return null;
                seen.add(name);
                return mkComp(name, ver, "PyPI", scope === "develop" ? "optional" : "required");
            })
        ).filter(Boolean);
    } catch { return []; }
}

export function parseRequirementsTxt(content) {
    if (typeof content !== "string") return [];
    const seen = new Set();
    return content.split(/\r?\n/).map(line => {
        const clean = line.replace(/#.*$/, "").trim();
        if (!clean || clean.startsWith("-")) return null;
        const m = clean.match(/^([a-zA-Z0-9_\-.]+)(?:(?:==|>=|<=|~=|>|<)([^;#\s]+))?/);
        const name = m?.[1]?.toLowerCase();
        const ver = cleanVersion(m?.[2]);
        if (!name || !ver || seen.has(name)) return null;
        seen.add(name);
        return mkComp(name, ver, "PyPI");
    }).filter(Boolean);
}

export function parseManifestContent(content, type = "auto") {
    if (!content) return [];
    const t = content.trim();
    if (type === "package-lock" || (type === "auto" && t.includes('"lockfileVersion"'))) return parsePackageLockJson(t);
    if (type === "yarn" || (type === "auto" && t.startsWith("# yarn lockfile"))) return parseYarnLock(t);
    if (type === "pnpm" || (type === "auto" && t.startsWith("lockfileVersion:"))) return parsePnpmLock(t);
    if (type === "poetry" || (type === "auto" && t.includes("[[package]]"))) return parsePoetryLock(t);
    if (type === "pipfile-lock" || (type === "auto" && t.includes('"_meta"') && t.includes('"default"'))) return parsePipfileLock(t);
    if (type === "npm" || type === "package.json" || t.startsWith("{")) {
        const res = parsePackageJson(t);
        if (res.length) return res;
    }
    return parseRequirementsTxt(t);
}

export function aggregateManifests(files = []) {
    const seen = new Set();
    return files.flatMap(f => parseManifestContent(f.content, f.type).map(c => ({ ...c, manifestPath: f.path || "root" })))
        .filter(c => !seen.has(c.purl) && seen.add(c.purl));
}

export function diffComponents(base = [], feature = []) {
    const bMap = new Map(base.map(c => [c.name, c.version]));
    const fMap = new Map(feature.map(c => [c.name, c.version]));
    return {
        added: feature.filter(c => !bMap.has(c.name)).map(c => `${c.name}@${c.version}`),
        removed: base.filter(c => !fMap.has(c.name)).map(c => `${c.name}@${c.version}`),
        updated: feature.filter(c => bMap.has(c.name) && bMap.get(c.name) !== c.version).map(c => `${c.name}: ${bMap.get(c.name)} → ${c.version}`),
        unchanged: feature.filter(c => bMap.get(c.name) === c.version).map(c => `${c.name}@${c.version}`)
    };
}

export function generateCycloneDxXml({ projectName = "Application", version = "1.0.0", branch = "main", commit = "HEAD", components = [], vulnerabilities = [] }) {
    return `<?xml version="1.0" encoding="UTF-8"?>
<bom xmlns="http://cyclonedx.org/schema/bom/1.4" serialNumber="urn:uuid:${randomUUID()}" version="1">
  <metadata>
    <timestamp>${new Date().toISOString()}</timestamp>
    <tools><tool><vendor>CodeReviewer</vendor><name>CycloneDX-SBOM-Engine</name><version>1.4.0</version></tool></tools>
    <component type="application">
      <name>${esc(projectName)}</name>
      <version>${esc(version)}</version>
      <properties>
        <property name="branch">${esc(branch)}</property>
        <property name="commit">${esc(commit)}</property>
        <property name="generator">CodeReviewer-DevSecOps-Gate</property>
      </properties>
    </component>
  </metadata>
  <components>
${components.map(c => `    <component type="${esc(c.type || 'library')}" bom-ref="${esc(c.name)}-${esc(c.version || 'unknown')}">
      <name>${esc(c.name)}</name>
      <version>${esc(c.version)}</version>
      ${c.purl ? `<purl>${esc(c.purl)}</purl>` : ''}
      ${c.scope ? `<scope>${esc(c.scope)}</scope>` : ''}
      ${c.license ? `<licenses><license><id>${esc(c.license)}</id></license></licenses>` : ''}
    </component>`).join('\n')}
  </components>
  ${vulnerabilities.length ? `<vulnerabilities>
${vulnerabilities.map(v => `    <vulnerability>
      <id>${esc(v.id)}</id>
      <source><name>${esc(v.source || 'OSV / CVE')}</name></source>
      <ratings><rating><severity>${esc(v.severity || 'HIGH')}</severity>${v.cvssScore != null ? `<score>${v.cvssScore}</score>` : ''}</rating></ratings>
      <description>${esc(v.summary || 'Security vulnerability')}</description>
      <recommendation>${esc(v.fixedVersion ? `Upgrade to ${v.fixedVersion}` : 'Upgrade to latest release')}</recommendation>
      <affects><target><ref>${esc(v.package)}-${esc(v.version || 'unknown')}</ref></target></affects>
    </vulnerability>`).join('\n')}
  </vulnerabilities>` : ''}
</bom>
`;
}
