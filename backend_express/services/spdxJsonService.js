import { randomUUID } from "crypto";

/**
 * Generates an SPDX 2.3 JSON specification document (Req #33).
 */
export function generateSpdxJson({
    projectName = "Application",
    version = "1.0.0",
    components = [],
    vulnerabilities = []
}) {
    const documentNamespace = `http://spdx.org/spdxdocs/${projectName.replace(/[^a-zA-Z0-9_-]/g, "_")}-${randomUUID()}`;
    const timestamp = new Date().toISOString();

    const spdxDocument = {
        spdxVersion: "SPDX-2.3",
        dataLicense: "CC0-1.0",
        SPDXID: "SPDXRef-DOCUMENT",
        name: projectName,
        documentNamespace,
        creationInfo: {
            created: timestamp,
            creators: [
                "Tool: CodeReviewer-DevSecOps-Gate-1.4",
                "Organization: CodeReviewer"
            ]
        },
        packages: components.map((c, idx) => {
            const spdxId = `SPDXRef-Package-${c.name.replace(/[^a-zA-Z0-9_-]/g, "-")}-${idx}`;
            const pkg = {
                SPDXID: spdxId,
                name: c.name,
                versionInfo: c.version || "NOASSERTION",
                downloadLocation: "NOASSERTION",
                filesAnalyzed: false,
                licenseConcluded: c.license || "NOASSERTION",
                licenseDeclared: c.license || "NOASSERTION",
                copyrightText: "NOASSERTION"
            };

            if (c.purl) {
                pkg.externalRefs = [
                    {
                        referenceCategory: "PACKAGE-MANAGER",
                        referenceType: "purl",
                        referenceLocator: c.purl
                    }
                ];
            }

            return pkg;
        }),
        relationships: [
            {
                spdxElementId: "SPDXRef-DOCUMENT",
                relationshipType: "DESCRIBES",
                relatedSpdxElement: components.length > 0 ? "SPDXRef-Package-0" : "SPDXRef-DOCUMENT"
            }
        ]
    };

    return spdxDocument;
}
