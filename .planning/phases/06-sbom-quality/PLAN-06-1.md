---
phase: 6
plan: 1
wave: 1
depends_on: []
files_modified:
  - backend_express/services/sbomXmlService.js
autonomous: true

must_haves:
  truths:
    - "Lockfile parsing supported: package-lock.json, yarn.lock, pnpm-lock.yaml"
    - "Python lockfiles supported: poetry.lock, Pipfile.lock"
    - "No hardcoded MIT or Apache-2.0 license labels"
    - "No default version 1.0.0 for missing versions"
    - "Each component has a unique bom-ref in generated XML"
    - "Version ranges stripped to resolved version"
  artifacts:
    - "sbomXmlService.js exports parsePackageLockJson, parseYarnLock, parsePnpmLock"
    - "sbomXmlService.js exports parsePoetryLock, parsePipfileLock"
    - "generateCycloneDxXml adds bom-ref to each component"
    - "No string 'MIT' or 'Apache-2.0' hardcoded as default license"
---

# Plan 6.1: Lockfile Parsing, Remove Hardcoded Licenses & Default Versions

<objective>
Add lockfile parsing for npm/Python, remove hardcoded licenses and version defaults, add bom-ref to XML.

Purpose: Requirements #28, #30, #31, #32 — SBOM accuracy and schema validity.
Output: sbomXmlService.js with lockfile parsers, no hardcoded licenses, bom-refs in XML.
</objective>

<context>
Load for context:
- backend_express/services/sbomXmlService.js (full file)
</context>

<tasks>

<task type="auto">
  <name>Add npm and Python lockfile parsers to sbomXmlService</name>
  <files>backend_express/services/sbomXmlService.js</files>
  <action>
    Add the following parsers to sbomXmlService.js AFTER the existing parsePackageJson and parseRequirementsTxt functions:
    
    1. parsePackageLockJson (npm package-lock.json v2/v3):
       ```js
       export function parsePackageLockJson(content) {
         try {
           const lock = typeof content === "string" ? JSON.parse(content) : content;
           const components = [];
           const seen = new Set();
           // v2/v3 format uses packages object
           const packages = lock.packages || {};
           for (const [pkgPath, pkgData] of Object.entries(packages)) {
             if (pkgPath === "") continue; // skip root
             const name = pkgData.name || pkgPath.replace(/^node_modules\//, "").replace(/\/node_modules\//g, "/");
             if (seen.has(name)) continue;
             seen.add(name);
             const version = pkgData.version;
             if (!version) continue; // skip entries without resolved version
             components.push({
               name, version, type: "library", ecosystem: "npm",
               purl: `pkg:npm/${encodeURIComponent(name)}@${version}`,
               scope: pkgData.dev ? "optional" : "required",
               license: null  // no hardcoded license
             });
           }
           return components;
         } catch { return []; }
       }
       ```
    
    2. parseYarnLock (yarn.lock classic format):
       ```js
       export function parseYarnLock(content) {
         const components = [];
         const seen = new Set();
         // Yarn classic: lines like `"package@^version": ` then `  version "resolved-version"`
         const blocks = content.split(/\n(?=\S)/);
         for (const block of blocks) {
           if (block.startsWith("#") || !block.includes("version")) continue;
           const nameMatch = block.match(/^"?([^@"]+)@/);
           const versionMatch = block.match(/\n\s+version "([^"]+)"/);
           if (nameMatch && versionMatch) {
             const name = nameMatch[1].trim();
             const version = versionMatch[1];
             if (seen.has(name)) continue;
             seen.add(name);
             components.push({ name, version, type: "library", ecosystem: "npm",
               purl: `pkg:npm/${encodeURIComponent(name)}@${version}`, scope: "required", license: null });
           }
         }
         return components;
       }
       ```
    
    3. parsePnpmLock (pnpm-lock.yaml simplified):
       ```js
       export function parsePnpmLock(content) {
         const components = [];
         const seen = new Set();
         // YAML-lite: look for lines like "  /package@version:" or "  package@version:"
         const lines = content.split("\n");
         for (const line of lines) {
           const match = line.match(/^\s+\/?([^@\s]+)@([^\s:\/]+):/);
           if (match) {
             const name = match[1];
             const version = match[2];
             if (seen.has(name)) continue;
             seen.add(name);
             components.push({ name, version, type: "library", ecosystem: "npm",
               purl: `pkg:npm/${encodeURIComponent(name)}@${version}`, scope: "required", license: null });
           }
         }
         return components;
       }
       ```
    
    4. parsePoetryLock (poetry.lock):
       ```js
       export function parsePoetryLock(content) {
         const components = [];
         const blocks = content.split(/\[\[package\]\]/);
         for (const block of blocks.slice(1)) {
           const nameMatch = block.match(/name = "([^"]+)"/);
           const versionMatch = block.match(/version = "([^"]+)"/);
           if (nameMatch && versionMatch) {
             const name = nameMatch[1].toLowerCase();
             const version = versionMatch[1];
             components.push({ name, version, type: "library", ecosystem: "PyPI",
               purl: `pkg:pypi/${name}@${version}`, scope: "required", license: null });
           }
         }
         return components;
       }
       ```
    
    5. parsePipfileLock (Pipfile.lock):
       ```js
       export function parsePipfileLock(content) {
         try {
           const lock = typeof content === "string" ? JSON.parse(content) : content;
           const components = [];
           const addDeps = (deps, scope) => {
             for (const [name, data] of Object.entries(deps || {})) {
               const version = data.version?.replace(/^==/, "");
               if (version) components.push({ name: name.toLowerCase(), version, type: "library",
                 ecosystem: "PyPI", purl: `pkg:pypi/${name.toLowerCase()}@${version}`, scope, license: null });
             }
           };
           addDeps(lock.default, "required");
           addDeps(lock.develop, "optional");
           return components;
         } catch { return []; }
       }
       ```
    
    6. Update parseManifestContent to detect lockfiles:
       ```js
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
       ```
    
    AVOID: Defaulting license to "MIT" or "Apache-2.0" — set to null, let the XML generator handle null.
  </action>
  <verify>
    grep "MIT\|Apache-2.0" backend_express/services/sbomXmlService.js → should only appear in comments, not as default values
    grep "parsePackageLockJson\|parseYarnLock\|parsePnpmLock\|parsePoetryLock\|parsePipfileLock" backend_express/services/sbomXmlService.js → must show all 5
  </verify>
  <done>
    5 lockfile parsers added. No hardcoded license defaults. parseManifestContent detects all formats.
  </done>
</task>

<task type="auto">
  <name>Fix cleanVersion to not invent defaults, add bom-ref to XML components</name>
  <files>backend_express/services/sbomXmlService.js</files>
  <action>
    1. Fix cleanVersion function:
       ```js
       function cleanVersion(ver) {
         if (!ver) return null;  // Return null not "1.0.0" — callers must handle
         return ver.replace(/^[\^~>=< ]+/, "").trim() || null;
       }
       ```
    
    2. In parsePackageJson, after cleanVersion call:
       ```js
       const version = cleanVersion(rawVer);
       if (!version) continue;  // skip entries with no resolvable version
       ```
       (Same for parseRequirementsTxt)
    
    3. In generateCycloneDxXml, add bom-ref attribute to each component:
       ```js
       const bomRef = `${escapeXml(comp.name)}-${escapeXml(comp.version || "unknown")}`;
       xml += `    <component type="${escapeXml(comp.type || 'library')}" bom-ref="${bomRef}">\n`;
       ```
    
    4. In the license section, handle null license:
       ```js
       if (comp.license) {
         xml += `      <licenses>\n        <license>\n          <id>${escapeXml(comp.license)}</id>\n        </license>\n      </licenses>\n`;
       }
       ```
       (Skip the entire licenses block if no license data — don't invent one)
    
    5. In the vulnerabilities section, add affects/@ref that matches the component bom-ref:
       ```js
       const affectedRef = `${escapeXml(vul.package)}-${escapeXml(vul.version || "unknown")}`;
       xml += `      <affects>\n        <target>\n          <ref>${affectedRef}</ref>\n        </target>\n      </affects>\n`;
       ```
    
    AVOID: Using "1.0.0" as a default version anywhere.
    AVOID: Adding MIT or Apache-2.0 when no license data is available.
  </action>
  <verify>
    grep '"1.0.0"\|"MIT"\|"Apache-2.0"' backend_express/services/sbomXmlService.js → must return nothing (defaults)
    grep "bom-ref" backend_express/services/sbomXmlService.js → must show bom-ref in component XML
  </verify>
  <done>
    cleanVersion returns null for missing versions. bom-ref on components. Null licenses omitted. Vulnerability affects ref matches component bom-ref.
  </done>
</task>

</tasks>

<verification>
After all tasks, verify:
- [ ] 5 lockfile parsers exported from sbomXmlService.js
- [ ] No hardcoded "MIT" or "Apache-2.0" as default license
- [ ] No "1.0.0" as default version
- [ ] bom-ref attribute on components in generated XML
- [ ] Vulnerability affects/@ref links to component bom-ref
</verification>

<success_criteria>
- [ ] All tasks verified
- [ ] Must-haves confirmed
- [ ] Changes committed: "sbom: lockfile parsers, remove hardcoded licenses/versions, add bom-ref (#28,#30,#31,#32)"
</success_criteria>

