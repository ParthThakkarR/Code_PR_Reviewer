---
phase: 6
plan: 2
wave: 2
depends_on: [6.1]
files_modified:
  - backend_express/services/sbomXmlService.js
  - backend_express/services/spdxJsonService.js
autonomous: true

must_haves:
  truths:
    - "Multi-manifest / monorepo manifest aggregation supported"
    - "SPDX 2.3 JSON export format supported alongside CycloneDX XML"
    - "Components carry purl, license, and resolved versions across ecosystems"
  artifacts:
    - "backend_express/services/spdxJsonService.js exists and exports generateSpdxJson"
    - "sbomXmlService.js supports multi-manifest parsing aggregation"
---

# Plan 6.2: Multi-Manifest Aggregation & SPDX Export

<objective>
Support scanning multiple manifests across monorepo subfolders and add SPDX 2.3 JSON export alongside CycloneDX XML.

Purpose: Requirements #29, #33 — comprehensive ecosystem coverage and standard compliance.
Output: Monorepo multi-manifest collector in sbomXmlService.js and spdxJsonService.js.
</objective>

<context>
Load for context:
- backend_express/services/sbomXmlService.js
</context>

<tasks>

<task type="auto">
  <name>Implement multi-manifest aggregation in sbomXmlService</name>
  <files>backend_express/services/sbomXmlService.js</files>
  <action>
    Add `aggregateManifests(manifestFiles)` to sbomXmlService.js:
    Accept an array of `{ path, content }` objects representing all detected manifests in a repo.
    Iterate over each, calling `parseManifestContent(content, detectedType)` based on the file name/path.
    Deduplicate components by `purl` or `name@version`.
    Return unified component list with location metadata where available.
  </action>
  <verify>
    node -e "import('./backend_express/services/sbomXmlService.js').then(m => console.log(typeof m.aggregateManifests))"
  </verify>
  <done>
    aggregateManifests is exported and merges multiple lockfiles/manifests without duplicates.
  </done>
</task>

<task type="auto">
  <name>Create SPDX 2.3 JSON serializer service</name>
  <files>backend_express/services/spdxJsonService.js</files>
  <action>
    Create backend_express/services/spdxJsonService.js exporting `generateSpdxJson({ projectName, version, components, vulnerabilities })`.
    Build schema-valid SPDX 2.3 JSON structure:
    - spdxVersion: "SPDX-2.3"
    - dataLicense: "CC0-1.0"
    - SPDXID: "SPDXRef-DOCUMENT"
    - name: projectName
    - documentNamespace: `http://spdx.org/spdxdocs/${projectName}-${Date.now()}`
    - creationInfo with created timestamp and CodeReviewer tool creators
    - packages array with SPDXID, name, versionInfo, downloadLocation: "NOASSERTION", filesAnalyzed: false, externalRefs (purl).
  </action>
  <verify>
    node -e "import('./backend_express/services/spdxJsonService.js').then(m => console.log(typeof m.generateSpdxJson))"
  </verify>
  <done>
    generateSpdxJson produces valid SPDX 2.3 JSON documents.
  </done>
</task>

</tasks>

<verification>
After all tasks, verify:
- [ ] aggregateManifests correctly parses an array of package.json and requirements.txt
- [ ] generateSpdxJson produces valid JSON with spdxVersion "SPDX-2.3"
</verification>

<success_criteria>
- [ ] All tasks verified
- [ ] SPDX JSON service created and tested
</success_criteria>
