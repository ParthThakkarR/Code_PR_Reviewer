import test from "node:test";
import assert from "node:assert/strict";
import {
    parsePackageJson,
    parsePackageLockJson,
    parseYarnLock,
    parseRequirementsTxt,
    cleanVersion,
    diffComponents,
    generateCycloneDxXml
} from "../services/sbomXmlService.js";
import { generateSpdxJson } from "../services/spdxJsonService.js";

test("cleanVersion: Strips range symbols and returns clean version without inventing default", () => {
    assert.equal(cleanVersion("^1.2.3"), "1.2.3");
    assert.equal(cleanVersion("~4.5.6"), "4.5.6");
    assert.equal(cleanVersion(">=2.0.0"), "2.0.0");
    assert.equal(cleanVersion(""), null);
    assert.equal(cleanVersion(null), null);
    assert.equal(cleanVersion(undefined), null);
});

test("parsePackageJson: Correctly extracts npm dependencies without hardcoding license", () => {
    const pkg = JSON.stringify({
        name: "test-app",
        dependencies: {
            "dotenv": "17.3.1",
            "express": "^4.19.2"
        },
        devDependencies: {
            "eslint": "^10.0.0"
        }
    });

    const components = parsePackageJson(pkg);
    assert.equal(components.length, 3);
    const dotenv = components.find(c => c.name === "dotenv");
    assert.ok(dotenv);
    assert.equal(dotenv.version, "17.3.1");
    assert.equal(dotenv.ecosystem, "npm");
    assert.equal(dotenv.license, null); // never hardcoded
    assert.equal(dotenv.purl, "pkg:npm/dotenv@17.3.1");
});

test("parsePackageLockJson: Parses npm v2/v3 lockfile packages object", () => {
    const lock = JSON.stringify({
        name: "test-app",
        lockfileVersion: 3,
        packages: {
            "": { name: "test-app", version: "1.0.0" },
            "node_modules/ms": { version: "2.1.3", license: "MIT" },
            "node_modules/axios": { version: "1.7.2", license: "Apache-2.0" }
        }
    });

    const components = parsePackageLockJson(lock);
    assert.equal(components.length, 2);
    const msComp = components.find(c => c.name === "ms");
    assert.ok(msComp);
    assert.equal(msComp.version, "2.1.3");
    assert.equal(msComp.license, "MIT"); // reads real license from lockfile metadata
});

test("parseYarnLock: Parses classic yarn.lock file", () => {
    const yarnLock = `# yarn lockfile v1
ms@^2.1.3:
  version "2.1.3"
  resolved "https://registry.yarnpkg.com/ms/-/ms-2.1.3.tgz"

dayjs@^1.11.13:
  version "1.11.13"
  resolved "https://registry.yarnpkg.com/dayjs/-/dayjs-1.11.13.tgz"
`;

    const components = parseYarnLock(yarnLock);
    assert.equal(components.length, 2);
    assert.equal(components[0].name, "ms");
    assert.equal(components[0].version, "2.1.3");
    assert.equal(components[1].name, "dayjs");
    assert.equal(components[1].version, "1.11.13");
});

test("parseRequirementsTxt: Correctly parses Python requirements with version specifiers", () => {
    const reqs = `
# Core dependencies
flask==2.2.5
requests>=2.31.0; python_version > '3.8'
urllib3~=1.26.5
# Invalid line should be skipped
# -r other-requirements.txt
`;

    const components = parseRequirementsTxt(reqs);
    assert.equal(components.length, 3);
    const flask = components.find(c => c.name === "flask");
    assert.ok(flask);
    assert.equal(flask.version, "2.2.5");
    assert.equal(flask.ecosystem, "PyPI");
});

test("diffComponents: Computes added, removed, and updated libraries accurately", () => {
    const base = [
        { name: "ms", version: "2.0.0" },
        { name: "dotenv", version: "16.0.0" },
        { name: "removed-lib", version: "1.0.0" }
    ];

    const feature = [
        { name: "ms", version: "2.1.3" }, // updated
        { name: "dotenv", version: "16.0.0" }, // unchanged
        { name: "axios", version: "1.7.2" } // added
    ];

    const diff = diffComponents(base, feature);
    assert.deepEqual(diff.added, ["axios@1.7.2"]);
    assert.deepEqual(diff.removed, ["removed-lib@1.0.0"]);
    assert.deepEqual(diff.updated, ["ms: 2.0.0 → 2.1.3"]);
    assert.deepEqual(diff.unchanged, ["dotenv@16.0.0"]);
});

test("generateCycloneDxXml: Produces schema-compliant CycloneDX 1.4 XML with unique bom-refs", () => {
    const components = [
        { name: "dotenv", version: "17.3.1", ecosystem: "npm", purl: "pkg:npm/dotenv@17.3.1", license: "BSD-2-Clause" }
    ];
    const vulnerabilities = [
        {
            id: "CVE-2021-3749",
            package: "dotenv",
            version: "17.3.1",
            severity: "HIGH",
            cvssScore: 7.5,
            summary: "ReDoS vulnerability"
        }
    ];

    const xml = generateCycloneDxXml({
        projectName: "payment-service",
        version: "1.1.0",
        branch: "feature/pay",
        commit: "a1b2c3d4",
        components,
        vulnerabilities
    });

    assert.match(xml, /<\?xml version="1.0" encoding="UTF-8"\?>/);
    assert.match(xml, /<bom xmlns="http:\/\/cyclonedx.org\/schema\/bom\/1.4"/);
    assert.match(xml, /bom-ref="dotenv-17.3.1"/);
    assert.match(xml, /<property name="commit">a1b2c3d4<\/property>/);
    assert.match(xml, /<id>CVE-2021-3749<\/id>/);
    assert.match(xml, /<score>7.5<\/score>/);
    assert.match(xml, /<ref>dotenv-17.3.1<\/ref>/);
});

test("generateSpdxJson: Produces valid SPDX 2.3 JSON specification", () => {
    const components = [
        { name: "dotenv", version: "17.3.1", purl: "pkg:npm/dotenv@17.3.1", license: "BSD-2-Clause" }
    ];

    const spdx = generateSpdxJson({
        projectName: "payment-service",
        version: "1.1.0",
        components
    });

    assert.equal(spdx.spdxVersion, "SPDX-2.3");
    assert.equal(spdx.dataLicense, "CC0-1.0");
    assert.equal(spdx.name, "payment-service");
    assert.equal(spdx.packages.length, 1);
    assert.equal(spdx.packages[0].name, "dotenv");
    assert.equal(spdx.packages[0].versionInfo, "17.3.1");
    assert.equal(spdx.packages[0].externalRefs[0].referenceLocator, "pkg:npm/dotenv@17.3.1");
});

