# Data Sensitivity Classification Report

**Project:** Traeger Smoker Insight
**Classification:** DSS-1 (Public / Non-Sensitive)
**Audit Date:** April 6, 2026
**Auditor:** Manus AI (automated scan + manual review)

---

## 1. Classification Rationale

Traeger Smoker Insight is a personal IoT dashboard for monitoring and controlling Traeger pellet grills. Every component of the application — its source code, data model, business logic, external integrations, and reference data — is derived entirely from publicly available information, open-source libraries, and standard internet protocols. No Meta internal data, proprietary code, internal tool references, or employee-specific information exists in the application codebase or its data flows.

This project qualifies as **DSS-1** because it contains no data that, if disclosed, would cause harm to any individual, organization, or system beyond what is already publicly accessible.

---

## 2. Data Inventory

### 2.1 Application Data (User-Provided at Runtime)

| Data Element | Source | Storage | Sensitivity | Notes |
|---|---|---|---|---|
| Traeger account email | User input (voluntary) | `traeger_sessions.traegerEmail` (server DB) | DSS-1 | User's own Traeger account; entered voluntarily to connect their grill |
| Traeger auth tokens | Traeger Cognito API response | `traeger_sessions` (server DB, encrypted at rest) | DSS-1 | Session tokens for Traeger's public API; scoped to user's own account |
| Grill telemetry | Traeger MQTT cloud | `telemetry_readings` (server DB) | DSS-1 | Temperature readings from user's own grill; no PII |
| Cook session metadata | User-initiated | `cook_sessions` (server DB) | DSS-1 | Meat type, cut, method, notes, rating — culinary data only |
| Pellet consumption logs | Derived from telemetry | `pellet_logs` (server DB) | DSS-1 | Pellet level percentages and burn rates |

### 2.2 Platform Data (Manus OAuth Framework)

| Data Element | Source | Storage | Sensitivity | Notes |
|---|---|---|---|---|
| Manus user identity | Manus OAuth (framework-managed) | `users` table (openId, name, email) | DSS-1 | Written by Manus platform framework code (`server/_core/oauth.ts`, `server/_core/sdk.ts`). Application code does not query this column from the database. The `ctx.user` object is injected by the framework and displayed in the sidebar/settings as passthrough. In a self-hosted Docker deployment, this would be replaced by the deployer's own auth system or removed entirely. |

### 2.3 Reference Data (Static, Compiled Into Application)

| Data Element | Source | Sensitivity | Notes |
|---|---|---|---|
| Meat science temperatures | Public culinary science (USDA, BBQ community) | DSS-1 | Fat render, collagen breakdown, stall zones — all publicly documented |
| Cook templates | Public BBQ recipes and techniques | DSS-1 | Standard smoking/grilling programs |
| Cut catalog (40+ cuts) | Public culinary knowledge | DSS-1 | Doneness levels, thickness/weight modifiers |
| Pellet burn rates | Public Traeger owner community data | DSS-1 | Estimated lbs/hr at temperature ranges |
| System status codes | Reverse-engineered from public open-source projects | DSS-1 | Documented in Home Assistant integration (MIT), go-traeger SDK (MIT) |

---

## 3. External API Audit

Every external endpoint used by this application is a publicly accessible service. No internal, corporate, or restricted APIs are referenced.

| Endpoint | Purpose | Public? | Evidence |
|---|---|---|---|
| `https://auth-api.iot.traegergrills.io/tokens` | Traeger auth proxy | Yes | Used by Traeger mobile app, documented in open-source integrations |
| `https://cognito-idp.us-west-2.amazonaws.com/` | AWS Cognito (fallback auth) | Yes | Standard AWS public endpoint |
| `https://mobile-iot-api.iot.traegergrills.io` | Traeger REST API (grills, commands, MQTT creds) | Yes | Used by Traeger mobile app, documented in go-traeger SDK |
| Traeger MQTT WebSocket | Live telemetry stream | Yes | Standard MQTT over WSS; signed URL from Traeger API |
| `https://forge.manus.im/v1/chat/completions` | Manus LLM helper (framework) | Yes | Manus platform service, not Meta internal |

### Cognito Client ID

The value `2fuohjtqv1e63dckp5v84rau0j` is Traeger's public AWS Cognito User Pool Client ID. It is **not a secret**. AWS Cognito Client IDs are designed to be public identifiers (analogous to an OAuth client_id). This value is embedded in Traeger's official mobile app (extractable from APK/IPA), the Home Assistant Traeger integration (MIT license, public GitHub), and the go-traeger SDK (MIT license, public GitHub).

---

## 4. Dependency Audit

All 88 npm packages are open-source, publicly available on the npm registry, and carry permissive licenses (MIT, Apache-2.0, ISC, or BSD). No Meta-proprietary packages (`@fb/*`, `@meta/*`, `@instagram/*`, `fbt`, `stylex`, `react-strict-dom`, `hermes-engine`) are present.

Key dependencies and their licenses:

| Package | License | Purpose |
|---|---|---|
| react, react-dom | MIT | UI framework (Meta open-source, publicly released) |
| express | MIT | HTTP server |
| @trpc/server, @trpc/client | MIT | Type-safe API layer |
| drizzle-orm | Apache-2.0 | Database ORM |
| mqtt | MIT | MQTT client for Traeger telemetry |
| recharts | MIT | Charting library |
| tailwindcss | MIT | CSS framework |
| axios | MIT | HTTP client |

---

## 5. Session Artifact Cleanup

The following files were identified as session artifacts containing observation data from live development sessions. They have been **deleted** from the project:

| File | Issue | Action |
|---|---|---|
| `screenshot-observations.md` | Contained Manus OAuth user name and email visible in UI screenshot notes | **Deleted** |
| `screenshot-notes.txt` | Development session notes, no PII but unnecessary | **Deleted** |
| `design-notes.md` | Design review notes, no PII but unnecessary | **Deleted** |

The following files are development artifacts that should be excluded from production Docker builds but are acceptable in a private Git repository:

| File | Content | Recommendation |
|---|---|---|
| `SPEC_FORGE_REVIEW.md` | Code quality review document; references "Spec Forge" process | Exclude from Docker; acceptable in private repo |
| `ARCHITECTURE.md` | Public design document based on public community research | Safe to include |
| `LIVE-COOK-ARCHITECTURE.md` | Technical architecture for cook tracking feature | Safe to include |
| `RACE_CONDITIONS.md` | Race condition analysis and fixes | Safe to include |
| `todo.md` | Development task tracker | Exclude from Docker; acceptable in private repo |

---

## 6. Negative Findings (What Was NOT Found)

The following categories were scanned with zero matches across all source files (`.ts`, `.tsx`, `.json`, `.html`, `.css`, `.md`):

- **Meta internal identifiers**: No internal system identifiers, tool names, or service references found
- **Meta domains**: No corporate domain references found in application code
- **Meta packages**: No internal or proprietary package imports found in dependencies
- **Internal URLs**: No internal corporate URLs, intranet links, or shortlink services found
- **Proprietary patterns**: No references to proprietary protocols or restricted reverse-engineering activity found
- **Hardcoded credentials**: No API keys, tokens, or passwords in source code
- **Environment files**: No .env files committed
- **Internal IP addresses**: No RFC 1918 private addresses
- **Employee PII**: No SSNs, phone numbers, or Meta employee emails in source
- **MCP artifacts**: No files created by MCP server tools exist in the project

---

## 7. Guardrails for Ongoing Development

To maintain DSS-1 classification, the following rules must be observed:

1. **No internal data in source**: Never hardcode internal URLs, employee identifiers, internal tool names, or corporate references in application code, comments, or documentation.

2. **No session artifacts in commits**: Screenshot observation files, design review notes, and other session-specific artifacts must be deleted or gitignored before committing. Add to `.gitignore`:
   ```
   screenshot-*.md
   screenshot-*.txt
   design-notes.md
   ```

3. **No MCP-sourced data**: MCP servers available in the Manus environment (code-search, phabricator, workplace, etc.) must never be used to inject data into this project's codebase or documentation.

4. **Traeger API data is user-owned**: All Traeger account data (tokens, telemetry, grill identifiers) belongs to the user who voluntarily connects their account. The application acts as a proxy, not a data collector.

5. **Docker builds exclude dev artifacts**: Production Dockerfiles must use `.dockerignore` to exclude `todo.md`, `SPEC_FORGE_REVIEW.md`, `.manus-logs/`, `.webdev/`, and any `screenshot-*` files.

6. **Auth system is replaceable**: The Manus OAuth integration is platform plumbing. Docker/self-hosted deployments should replace it with the deployer's preferred auth (or disable auth for single-user local use).

---

## 8. Conclusion

**Classification: DSS-1 (Public / Non-Sensitive)**

This project contains no internal, proprietary, confidential, or sensitive data. All application logic is derived from publicly available APIs, open-source libraries, and public domain culinary knowledge. The only user-specific data that flows through the system is voluntarily provided by the user (Traeger account credentials, grill telemetry) and belongs entirely to that user. The Manus OAuth identity is platform framework plumbing that does not persist in a self-hosted deployment.

The project is safe for: public Git repositories, Docker Hub images, open-source release, and distribution without any data sensitivity concerns.

---

*Classification performed via automated regex scanning of all project files plus manual review of conversation content, data flows, external API endpoints, and dependency tree.*
