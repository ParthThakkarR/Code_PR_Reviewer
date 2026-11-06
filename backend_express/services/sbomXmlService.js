import { randomUUID } from "crypto";

/**
 * Escapes characters for XML safety.
 */
function escapeXml(unsafe) {
    if (!unsafe) return "";
    return String(unsafe).replace(/[<>&'"]/g, (c) => {
        switch (c) {
            case "<": return "&lt;";
            case ">": return "&gt;";
            case "&": return "&amp;";
            case "'": return "&apos;";
            case '"': return "&quot;";
            default: return c;
        }
    });
}

/**
 * Clean dependency version string. Never invents default version (Req #30).
 */
export function cleanVersion(ver) {
    if (!ver || typeof ver !== "string") return null;
    const cleaned = ver.replace(/^[\^~>=< ]+/, "").trim();
    return cleaned.length > 0 ? cleaned : null;
}

/**
 * Parse package.json manifest.
 */
export function parsePackageJson(content) {
    try {
        const pkg = typeof content === "string" ? JSON.parse(content) : content;
        const components = [];
        const seen = new Set();

        const addDeps = (deps, scope) => {
            if (!deps || typeof deps !== "object") return;
            for (const [name, rawVer] of Object.entries(deps)) {
                if (seen.has(name)) continue;
                const version = cleanVersion(rawVer);
                if (!version) continue;
                seen.add(name);
                components.push({
                    name,
                    version,
                    type: "library",
                    ecosystem: "npm",
                    purl: `pkg:npm/${encodeURIComponent(name)}@${version}`,
                    scope: scope || "required",
                    license: null
                });
            }
        };

        addDeps(pkg.dependencies, "required");
        addDeps(pkg.devDependencies, "optional");

        return components;
    } catch {
        return [];
    }
}

/**
 * Parse npm package-lock.json (v2 / v3) format (Req #28).
 */
export function parsePackageLockJson(content) {
    try {
        const lock = typeof content === "string" ? JSON.parse(content) : content;
        const components = [];
        const seen = new Set();

        const packages = lock.packages || {};
        for (const [pkgPath, pkgData] of Object.entries(packages)) {
            if (pkgPath === "") continue; // skip root
            const name = pkgData.name || pkgPath.replace(/^node_modules\//, "").replace(/\/node_modules\//g, "/");
            const version = cleanVersion(pkgData.version);
            if (!name || !version) continue;
            if (seen.has(name)) continue;
            seen.add(name);

            components.push({
                name,
                version,
                type: "library",
                ecosystem: "npm",
                purl: `pkg:npm/${encodeURIComponent(name)}@${version}`,
                scope: pkgData.dev ? "optional" : "required",
                license: pkgData.license || null
            });
        }

        // Fallback for v1 package-lock format
        if (components.length === 0 && lock.dependencies) {
            for (const [name, depData] of Object.entries(lock.dependencies)) {
                const version = cleanVersion(depData.version);
                if (!name || !version || seen.has(name)) continue;
                seen.add(name);
                components.push({
                    name,
                    version,
                    type: "library",
                    ecosystem: "npm",
                    purl: `pkg:npm/${encodeURIComponent(name)}@${version}`,
                    scope: depData.dev ? "optional" : "required",
                    license: null
                });
            }
        }

        return components;
    } catch {
        return [];
    }
}

/**
 * Parse yarn.lock classic format (Req #28).
 */
export function parseYarnLock(content) {
    if (typeof content !== "string") return [];
    const components = [];
    const seen = new Set();
    const blocks = content.split(/\n(?=\S)/);

    for (const block of blocks) {
        if (block.startsWith("#") || !block.includes("version")) continue;
        const nameMatch = block.match(/^"?([^@"\n\r]+)@/);
        const versionMatch = block.match(/\n\s+version "([^"]+)"/);
        if (nameMatch && versionMatch) {
            const name = nameMatch[1].trim();
            const version = cleanVersion(versionMatch[1]);
            if (!name || !version || seen.has(name)) continue;
            seen.add(name);
            components.push({
                name,
                version,
                type: "library",
                ecosystem: "npm",
                purl: `pkg:npm/${encodeURIComponent(name)}@${version}`,
                scope: "required",
                license: null
            });
        }
    }
    return components;
}

/**
 * Parse pnpm-lock.yaml format (Req #28).
 */
export function parsePnpmLock(content) {
    if (typeof content !== "string") return [];
    const components = [];
    const seen = new Set();
    const lines = content.split(/\r?\n/);

    for (const line of lines) {
        // Matches /package@version: or package@version:
        const match = line.match(/^\s+\/?([^@\s:]+)@([^\s:\/]+):/);
        if (match) {
            const name = match[1];
            const version = cleanVersion(match[2]);
            if (!name || !version || seen.has(name)) continue;
            seen.add(name);
            components.push({
                name,
                version,
                type: "library",
                ecosystem: "npm",
                purl: `pkg:npm/${encodeURIComponent(name)}@${version}`,
                scope: "required",
                license: null
            });
        }
    }
    return components;
}

/**
 * Parse Poetry lockfile (poetry.lock) (Req #28).
 */
export function parsePoetryLock(content) {
    if (typeof content !== "string") return [];
    const components = [];
    const seen = new Set();
    const blocks = content.split(/\[\[package\]\]/);

    for (const block of blocks.slice(1)) {
        const nameMatch = block.match(/name = "([^"]+)"/);
        const versionMatch = block.match(/version = "([^"]+)"/);
        if (nameMatch && versionMatch) {
            const name = nameMatch[1].toLowerCase();
            const version = cleanVersion(versionMatch[1]);
            if (!name || !version || seen.has(name)) continue;
            seen.add(name);
            components.push({
                name,
                version,
                type: "library",
                ecosystem: "PyPI",
                purl: `pkg:pypi/${name}@${version}`,
                scope: "required",
                license: null
            });
        }
    }
    return components;
}

/**
 * Parse Pipfile.lock (Req #28).
 */
export function parsePipfileLock(content) {
    try {
        const lock = typeof content === "string" ? JSON.parse(content) : content;
        const components = [];
        const seen = new Set();

        const addDeps = (deps, scope) => {
            if (!deps || typeof deps !== "object") return;
            for (const [name, data] of Object.entries(deps)) {
                const rawVer = typeof data === "object" ? data.version : data;
                const version = cleanVersion(rawVer);
                if (!name || !version || seen.has(name.toLowerCase())) continue;
                seen.add(name.toLowerCase());
                components.push({
                    name: name.toLowerCase(),
                    version,
                    type: "library",
                    ecosystem: "PyPI",
                    purl: `pkg:pypi/${name.toLowerCase()}@${version}`,
                    scope,
                    license: null
                });
            }
        };

        addDeps(lock.default, "required");
        addDeps(lock.develop, "optional");
        return components;
    } catch {
        return [];
    }
}

/**
 * Parse Python requirements.txt manifest.
 */
export function parseRequirementsTxt(content) {
    if (typeof content !== "string") return [];
    const components = [];
    const seen = new Set();

    const lines = content.split(/\r?\n/);
    for (const rawLine of lines) {
        const line = rawLine.trim();
        if (!line || line.startsWith("#") || line.startsWith("-")) continue;

        // Matches package==1.2.3, package>=1.2.3, etc.
        const match = line.match(/^([a-zA-Z0-9_\-.]+)(?:(?:==|>=|<=|~=|>|<)([^;#\s]+))?/);
        if (match) {
            const name = match[1].toLowerCase();
            const version = cleanVersion(match[2]);
            if (!version || seen.has(name)) continue;
            seen.add(name);
            components.push({
                name,
                version,
                type: "library",
                ecosystem: "PyPI",
                purl: `pkg:pypi/${name}@${version}`,
                scope: "required",
                license: null
            });
        }
    }
    return components;
}

/**
 * Automatically detects manifest format and parses components.
 */
export function parseManifestContent(content, manifestType = "auto") {
    if (!content) return [];
    const trimmed = content.trim();

    if (manifestType === "package-lock" || (manifestType === "auto" && trimmed.includes('"lockfileVersion"'))) {
        return parsePackageLockJson(trimmed);
    }
    if (manifestType === "yarn" || (manifestType === "auto" && trimmed.startsWith("# yarn lockfile"))) {
        return parseYarnLock(trimmed);
    }
    if (manifestType === "pnpm" || (manifestType === "auto" && trimmed.startsWith("lockfileVersion:"))) {
        return parsePnpmLock(trimmed);
    }
    if (manifestType === "poetry" || (manifestType === "auto" && trimmed.includes("[[package]]"))) {
        return parsePoetryLock(trimmed);
    }
    if (manifestType === "pipfile-lock" || (manifestType === "auto" && trimmed.includes('"_meta"') && trimmed.includes('"default"'))) {
        return parsePipfileLock(trimmed);
    }
    if (manifestType === "npm" || manifestType === "package.json" || trimmed.startsWith("{")) {
        const parsed = parsePackageJson(trimmed);
        if (parsed.length > 0) return parsed;
    }

    return parseRequirementsTxt(trimmed);
}

/**
 * Multi-manifest aggregation across monorepo subfolders (Req #29).
 */
export function aggregateManifests(manifestFiles = []) {
    const combined = [];
    const seen = new Set();

    for (const file of manifestFiles) {
        const comps = parseManifestContent(file.content, file.type || "auto");
        for (const comp of comps) {
            const key = comp.purl || `${comp.name}@${comp.version}`;
            if (!seen.has(key)) {
                seen.add(key);
                combined.push({
                    ...comp,
                    manifestPath: file.path || "root"
                });
            }
        }
    }

    return combined;
}

/**
 * Compare base and feature branch components.
 */
export function diffComponents(baseComponents = [], featureComponents = []) {
    const baseMap = new Map(baseComponents.map(c => [c.name, c.version]));
    const featureMap = new Map(featureComponents.map(c => [c.name, c.version]));

    const added = [];
    const removed = [];
    const updated = [];
    const unchanged = [];

    for (const [name, version] of featureMap.entries()) {
        if (!baseMap.has(name)) {
            added.push(`${name}@${version}`);
        } else if (baseMap.get(name) !== version) {
            updated.push(`${name}: ${baseMap.get(name)} → ${version}`);
        } else {
            unchanged.push(`${name}@${version}`);
        }
    }

    for (const [name, version] of baseMap.entries()) {
        if (!featureMap.has(name)) {
            removed.push(`${name}@${version}`);
        }
    }

    return { added, removed, updated, unchanged };
}

/**
 * Generates standard CycloneDX 1.4 XML representation of an SBOM (Req #32).
 */
export function generateCycloneDxXml({
    projectName = "Application",
    version = "1.0.0",
    branch = "main",
    commit = "HEAD",
    components = [],
    vulnerabilities = []
}) {
    const serialNumber = `urn:uuid:${randomUUID()}`;
    const timestamp = new Date().toISOString();

    let xml = `<?xml version="1.0" encoding="UTF-8"?>\n`;
    xml += `<bom xmlns="http://cyclonedx.org/schema/bom/1.4" serialNumber="${serialNumber}" version="1">\n`;

    // Metadata
    xml += `  <metadata>\n`;
    xml += `    <timestamp>${timestamp}</timestamp>\n`;
    xml += `    <tools>\n`;
    xml += `      <tool>\n`;
    xml += `        <vendor>CodeReviewer</vendor>\n`;
    xml += `        <name>CycloneDX-SBOM-Engine</name>\n`;
    xml += `        <version>1.4.0</version>\n`;
    xml += `      </tool>\n`;
    xml += `    </tools>\n`;
    xml += `    <component type="application">\n`;
    xml += `      <name>${escapeXml(projectName)}</name>\n`;
    xml += `      <version>${escapeXml(version)}</version>\n`;
    xml += `      <properties>\n`;
    xml += `        <property name="branch">${escapeXml(branch)}</property>\n`;
    xml += `        <property name="commit">${escapeXml(commit)}</property>\n`;
    xml += `        <property name="generator">CodeReviewer-DevSecOps-Gate</property>\n`;
    xml += `      </properties>\n`;
    xml += `    </component>\n`;
    xml += `  </metadata>\n`;

    // Components with unique bom-ref
    xml += `  <components>\n`;
    for (const comp of components) {
        const bomRef = `${escapeXml(comp.name)}-${escapeXml(comp.version || "unknown")}`;
        xml += `    <component type="${escapeXml(comp.type || 'library')}" bom-ref="${bomRef}">\n`;
        xml += `      <name>${escapeXml(comp.name)}</name>\n`;
        xml += `      <version>${escapeXml(comp.version)}</version>\n`;
        if (comp.purl) {
            xml += `      <purl>${escapeXml(comp.purl)}</purl>\n`;
        }
        if (comp.scope) {
            xml += `      <scope>${escapeXml(comp.scope)}</scope>\n`;
        }
        if (comp.license) {
            xml += `      <licenses>\n`;
            xml += `        <license>\n`;
            xml += `          <id>${escapeXml(comp.license)}</id>\n`;
            xml += `        </license>\n`;
            xml += `      </licenses>\n`;
        }
        xml += `    </component>\n`;
    }
    xml += `  </components>\n`;

    // Vulnerabilities linked to components via affects ref
    if (vulnerabilities && vulnerabilities.length > 0) {
        xml += `  <vulnerabilities>\n`;
        for (const vul of vulnerabilities) {
            const affectedRef = `${escapeXml(vul.package)}-${escapeXml(vul.version || "unknown")}`;
            xml += `    <vulnerability>\n`;
            xml += `      <id>${escapeXml(vul.id)}</id>\n`;
            xml += `      <source>\n`;
            xml += `        <name>${escapeXml(vul.source || 'OSV / CVE')}</name>\n`;
            xml += `      </source>\n`;
            xml += `      <ratings>\n`;
            xml += `        <rating>\n`;
            xml += `          <severity>${escapeXml(vul.severity || 'HIGH')}</severity>\n`;
            if (vul.cvssScore != null) {
                xml += `          <score>${vul.cvssScore}</score>\n`;
            }
            xml += `        </rating>\n`;
            xml += `      </ratings>\n`;
            xml += `      <description>${escapeXml(vul.summary || vul.details || 'Known vulnerability')}</description>\n`;
            xml += `      <recommendation>${escapeXml(vul.fixedVersion ? `Upgrade to ${vul.fixedVersion}` : 'Upgrade to latest patched release')}</recommendation>\n`;
            xml += `      <affects>\n`;
            xml += `        <target>\n`;
            xml += `          <ref>${affectedRef}</ref>\n`;
            xml += `        </target>\n`;
            xml += `      </affects>\n`;
            xml += `    </vulnerability>\n`;
        }
        xml += `  </vulnerabilities>\n`;
    }

    xml += `</bom>\n`;
    return xml;
}
