# Security Policy

## Supported Versions

| Version | Supported |
|---------|-----------|
| latest  | Yes       |
| < latest | No (upgrade to latest) |

## Reporting a Vulnerability

If you discover a security vulnerability in Traeger Smoker Insight, please report it responsibly.

**Do not open a public GitHub issue for security vulnerabilities.**

Instead, please:

1. Email the maintainer directly (see GitHub profile for contact info)
2. Or use [GitHub's private vulnerability reporting](https://github.com/jacobj/traeger-smoker-insight/security/advisories/new)

### What to Include

- Description of the vulnerability
- Steps to reproduce
- Potential impact
- Suggested fix (if you have one)

### Response Timeline

- **Acknowledgment**: Within 48 hours
- **Assessment**: Within 1 week
- **Fix**: Depends on severity, typically within 2 weeks for critical issues

### Scope

The following are in scope:

- Authentication bypass
- SQL injection
- Cross-site scripting (XSS)
- Credential exposure
- MQTT credential leakage
- Rate limiting bypass
- Unauthorized data access between users

The following are out of scope:

- Denial of service (self-hosted, single-user context)
- Issues requiring physical access to the host machine
- Social engineering
- Vulnerabilities in upstream dependencies (report to the upstream project)

## Security Architecture

For details on the security measures implemented in this project, see the [Security section](README.md#security) of the README.
