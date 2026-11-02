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
 * Clean dependency version string.
 */
function cleanVersion(ver) {
    if (!ver) return "1.0.0";
    return ver.replace(/^[\^~>=< ]+/, "").trim() || "1.0.0";
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
                seen.add(name);
                const version = cleanVersion(rawVer);
                components.push({
                    name,
                    version,
                    type: "library",
                    ecosystem: "npm",
                    purl: `pkg:npm/${name}@${version}`,
                    scope: scope || "required",
                    license: "MIT"
                });
            }
        };

        addDeps(pkg.dependencies, "required");
        addDeps(pkg.devDependencies, "optional");

        return components;
    } catch (err) {
        console.error("Failed to parse package.json:", err.message);
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

        // Matches package==1.2.3, package>=1.2.3, package~=1.2.3, package
        const match = line.match(/^([a-zA-Z0-9_\-.]+)(?:(?:==|>=|<=|~=|>|<)([^;#\s]+))?/);
        if (match) {
            const name = match[1].toLowerCase();
            if (seen.has(name)) continue;
            seen.add(name);
            const version = match[2] ? cleanVersion(match[2]) : "1.0.0";
            components.push({
                name,
                version,
                type: "library",
                ecosystem: "PyPI",
                purl: `pkg:pypi/${name}@${version}`,
                scope: "required",
                license: "Apache-2.0"
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

    if (manifestType === "npm" || manifestType === "package.json" || trimmed.startsWith("{")) {
        const parsed = parsePackageJson(trimmed);
        if (parsed.length > 0) return parsed;
    }

    return parseRequirementsTxt(trimmed);
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
 * Generates standard CycloneDX 1.4 XML representation of an SBOM.
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

    // Components
    xml += `  <components>\n`;
    for (const comp of components) {
        xml += `    <component type="${escapeXml(comp.type || 'library')}">\n`;
        xml += `      <name>${escapeXml(comp.name)}</name>\n`;
        xml += `      <version>${escapeXml(comp.version)}</version>\n`;
        if (comp.purl) {
            xml += `      <purl>${escapeXml(comp.purl)}</purl>\n`;
        }
        if (comp.scope) {
            xml += `      <scope>${escapeXml(comp.scope)}</scope>\n`;
        }
        xml += `      <licenses>\n`;
        xml += `        <license>\n`;
        xml += `          <id>${escapeXml(comp.license || 'MIT')}</id>\n`;
        xml += `        </license>\n`;
        xml += `      </licenses>\n`;
        xml += `    </component>\n`;
    }
    xml += `  </components>\n`;

    // Vulnerabilities
    if (vulnerabilities && vulnerabilities.length > 0) {
        xml += `  <vulnerabilities>\n`;
        for (const vul of vulnerabilities) {
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
            xml += `          <ref>pkg:${escapeXml(vul.ecosystem || 'npm')}/${escapeXml(vul.package)}@${escapeXml(vul.version)}</ref>\n`;
            xml += `        </target>\n`;
            xml += `      </affects>\n`;
            xml += `    </vulnerability>\n`;
        }
        xml += `  </vulnerabilities>\n`;
    }

    xml += `</bom>\n`;
    return xml;
}

