# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 1.x     | :white_check_mark: |
| < 1.0   | :x:                |

## Reporting a Vulnerability

The Code_PR_Reviewer team takes security and supply-chain vulnerabilities seriously.

If you believe you have discovered a vulnerability in this project:

1. **Do not disclose publicly** in GitHub issues or public forums.
2. Send an email with reproduction steps and impact to `errorfoundes@gmail.com` or create a private GitHub Security Advisory in the repository.
3. You will receive an initial response within 48 hours.
4. Coordinated disclosure will follow once a patch or remediation is verified.

## Production Security Gates

All PRs submitted to this repository are automatically evaluated by our own SBOM gate and Google OSV scanner. Vulnerabilities with CVSS >= 7.5 (High/Critical) strictly fail closed and block merging.

