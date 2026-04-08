import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "..");

// ═══════════════════════════════════════════════════════════
// CI-1: Docker Build & Push Workflow — 3-Job Pipeline
// ═══════════════════════════════════════════════════════════

describe("CI-1: Docker Build Workflow Structure", () => {
  const workflow = fs.readFileSync(
    path.join(projectRoot, ".github/workflows/docker-build.yml"),
    "utf-8"
  );

  it("defines three separate jobs: build, smoke-test, tag-latest", () => {
    // Each job must be a top-level key under 'jobs:'
    expect(workflow).toContain("build:");
    expect(workflow).toContain("smoke-test:");
    expect(workflow).toContain("tag-latest:");
  });

  it("smoke-test depends on build job", () => {
    expect(workflow).toMatch(/smoke-test:[\s\S]*?needs:\s*build/);
  });

  it("tag-latest depends on both build and smoke-test", () => {
    // Should depend on both jobs
    expect(workflow).toMatch(/tag-latest:[\s\S]*?needs:.*build/);
    expect(workflow).toMatch(/tag-latest:[\s\S]*?needs:.*smoke-test/);
  });

  it("tag-latest only runs on main branch", () => {
    // Should have a conditional to only tag :latest from main
    expect(workflow).toMatch(/tag-latest:[\s\S]*?if:.*refs\/heads\/main/);
  });

  it("build job does NOT tag :latest directly", () => {
    // The build job's metadata tags should not include latest
    // The raw,value=latest line from the old workflow should be gone
    const buildSection = workflow.split("smoke-test:")[0];
    expect(buildSection).not.toContain("type=raw,value=latest");
  });
});

describe("CI-1: Build Job Configuration", () => {
  const workflow = fs.readFileSync(
    path.join(projectRoot, ".github/workflows/docker-build.yml"),
    "utf-8"
  );

  it("builds multi-arch images (amd64 + arm64)", () => {
    expect(workflow).toContain("linux/amd64");
    expect(workflow).toContain("linux/arm64");
  });

  it("pushes to GHCR", () => {
    expect(workflow).toContain("ghcr.io");
    expect(workflow).toContain("push: true");
  });

  it("uses GitHub Actions cache for Docker layers", () => {
    expect(workflow).toContain("cache-from: type=gha");
    expect(workflow).toContain("cache-to: type=gha,mode=max");
  });

  it("outputs an image tag for downstream jobs", () => {
    expect(workflow).toContain("outputs:");
    expect(workflow).toContain("image-tag:");
  });

  it("generates SHA-based tags", () => {
    expect(workflow).toContain("type=sha,prefix=sha-");
  });

  it("generates semver tags on version tag push", () => {
    expect(workflow).toContain("type=semver,pattern={{version}}");
    expect(workflow).toContain("type=semver,pattern={{major}}.{{minor}}");
  });
});

describe("CI-1: Smoke Test Job Configuration", () => {
  const workflow = fs.readFileSync(
    path.join(projectRoot, ".github/workflows/docker-build.yml"),
    "utf-8"
  );

  // Extract just the smoke-test section
  const smokeSection = workflow.split("smoke-test:")[1]?.split(/\n  \w+-?\w*:/)[0] || "";

  it("has contents: read permission for checkout", () => {
    expect(smokeSection).toContain("contents: read");
  });

  it("uses MySQL 8.0 service container", () => {
    expect(smokeSection).toContain("mysql:8.0");
  });

  it("configures MySQL with test credentials", () => {
    expect(smokeSection).toContain("MYSQL_DATABASE: traeger_dashboard");
    expect(smokeSection).toContain("MYSQL_USER: traeger");
    expect(smokeSection).toContain("MYSQL_PASSWORD: traeger_pass");
  });

  it("includes MySQL healthcheck in service options", () => {
    expect(smokeSection).toContain("health-cmd");
    expect(smokeSection).toContain("mysqladmin ping");
  });

  it("pulls the image built by the build job", () => {
    expect(smokeSection).toContain("docker pull");
    expect(smokeSection).toContain("needs.build.outputs.image-tag");
  });

  it("starts the container with test environment variables", () => {
    expect(smokeSection).toContain("DATABASE_URL=");
    expect(smokeSection).toContain("JWT_SECRET=");
    expect(smokeSection).toContain("ADMIN_EMAIL=");
    expect(smokeSection).toContain("ADMIN_PASSWORD=");
  });

  it("runs the smoke-test.sh script", () => {
    expect(smokeSection).toContain("smoke-test.sh");
  });

  it("dumps container logs on failure for debugging", () => {
    expect(smokeSection).toContain("docker logs");
    expect(smokeSection).toContain("if: failure()");
  });

  it("cleans up container regardless of outcome", () => {
    expect(smokeSection).toContain("if: always()");
    expect(smokeSection).toContain("docker rm -f");
  });
});

describe("CI-1: Tag Latest Job Configuration", () => {
  const workflow = fs.readFileSync(
    path.join(projectRoot, ".github/workflows/docker-build.yml"),
    "utf-8"
  );

  const tagSection = workflow.split("tag-latest:")[1] || "";

  it("uses crane to copy/promote the image tag", () => {
    expect(tagSection).toContain("crane copy");
    expect(tagSection).toContain(":latest");
  });

  it("has write packages permission for tagging", () => {
    expect(tagSection).toContain("packages: write");
  });
});

// ═══════════════════════════════════════════════════════════
// CI-2: Smoke Test Script — Structure & Sections
// ═══════════════════════════════════════════════════════════

describe("CI-2: Smoke Test Script — Basics", () => {
  const scriptPath = path.join(projectRoot, "tests/smoke-test.sh");

  it("exists and is executable", () => {
    expect(fs.existsSync(scriptPath)).toBe(true);
    const stat = fs.statSync(scriptPath);
    // Check executable bit (owner execute = 0o100)
    expect(stat.mode & 0o111).toBeGreaterThan(0);
  });

  const script = fs.readFileSync(scriptPath, "utf-8");

  it("has a bash shebang", () => {
    expect(script.startsWith("#!/usr/bin/env bash")).toBe(true);
  });

  it("uses strict mode (set -euo pipefail)", () => {
    expect(script).toContain("set -euo pipefail");
  });

  it("accepts BASE_URL as first argument with default", () => {
    expect(script).toContain('BASE_URL="${1:-http://localhost:8420}"');
  });

  it("waits for app health before running tests", () => {
    expect(script).toContain("/api/health");
    expect(script).toContain("MAX_RETRIES");
  });

  it("prints summary with PASS/FAIL/WARN counts", () => {
    expect(script).toContain("PASS");
    expect(script).toContain("FAIL");
    expect(script).toContain("WARN");
    expect(script).toContain("Smoke Test Results");
  });

  it("exits with code 1 on any failure", () => {
    expect(script).toContain("exit 1");
  });

  it("exits with code 0 on success", () => {
    expect(script).toContain("exit 0");
  });

  it("cleans up temp files on exit", () => {
    expect(script).toContain("trap");
    expect(script).toContain("rm -f");
  });
});

describe("CI-2: Smoke Test Script — REST Endpoints (Section 1)", () => {
  const script = fs.readFileSync(
    path.join(projectRoot, "tests/smoke-test.sh"),
    "utf-8"
  );

  it("tests /api/health, /api/auth/ok, /api/version", () => {
    expect(script).toContain("/api/health");
    expect(script).toContain("/api/auth/ok");
    expect(script).toContain("/api/version");
  });

  it("verifies frontend serves HTML with #root", () => {
    expect(script).toContain('<div id="root"');
  });
});

describe("CI-2: Smoke Test Script — Public tRPC (Section 2)", () => {
  const script = fs.readFileSync(
    path.join(projectRoot, "tests/smoke-test.sh"),
    "utf-8"
  );

  it("tests public tRPC endpoints", () => {
    const publicEndpoints = [
      "setup.status",
      "auth.me",
      "meatProfiles.list",
      "templates.list",
      "customTemplates.community",
    ];
    for (const ep of publicEndpoints) {
      expect(script).toContain(ep);
    }
  });
});

describe("CI-2: Smoke Test Script — Protected tRPC (Section 3)", () => {
  const script = fs.readFileSync(
    path.join(projectRoot, "tests/smoke-test.sh"),
    "utf-8"
  );

  it("tests protected tRPC endpoints for UNAUTHORIZED", () => {
    const protectedEndpoints = [
      "grill.telemetry",
      "traeger.status",
      "liveCook.active",
      "cookSession.list",
      "automation.list",
      "push.getVapidKey",
    ];
    for (const ep of protectedEndpoints) {
      expect(script).toContain(ep);
    }
    expect(script).toContain("UNAUTHORIZED");
  });
});

describe("CI-2: Smoke Test Script — Admin Endpoints (Section 4)", () => {
  const script = fs.readFileSync(
    path.join(projectRoot, "tests/smoke-test.sh"),
    "utf-8"
  );

  it("tests admin endpoints for auth gate", () => {
    expect(script).toContain("admin.getRegistrationConfig");
    expect(script).toContain("admin.listUsers");
  });
});

describe("CI-2: Smoke Test Script — Mutations (Section 5)", () => {
  const script = fs.readFileSync(
    path.join(projectRoot, "tests/smoke-test.sh"),
    "utf-8"
  );

  it("tests mutation endpoints for METHOD_NOT_SUPPORTED", () => {
    const mutations = [
      "grill.shutdown",
      "grill.requestStatus",
      "traeger.refreshGrills",
      "password.changeOwn",
    ];
    for (const ep of mutations) {
      expect(script).toContain(ep);
    }
    expect(script).toContain("METHOD_NOT_SUPPORTED");
  });
});

// ═══════════════════════════════════════════════════════════
// CI-2: Smoke Test Script — NEW: SSE Endpoint (Section 6)
// ═══════════════════════════════════════════════════════════

describe("CI-2: Smoke Test Script — SSE Endpoint (Section 6)", () => {
  const script = fs.readFileSync(
    path.join(projectRoot, "tests/smoke-test.sh"),
    "utf-8"
  );

  it("tests /api/sse/telemetry without auth returns 401", () => {
    expect(script).toContain("/api/sse/telemetry");
    // The unauthenticated SSE test should check for 401
    expect(script).toMatch(/sse\/telemetry[\s\S]*?401[\s\S]*?SSE route registered/);
  });
});

// ═══════════════════════════════════════════════════════════
// CI-2: Smoke Test Script — NEW: Authentication Flow (Section 7)
// ═══════════════════════════════════════════════════════════

describe("CI-2: Smoke Test Script — Authentication Flow (Section 7)", () => {
  const script = fs.readFileSync(
    path.join(projectRoot, "tests/smoke-test.sh"),
    "utf-8"
  );

  it("uses a cookie jar for session management", () => {
    expect(script).toContain("COOKIE_JAR");
    expect(script).toContain("-c \"$COOKIE_JAR\"");
    expect(script).toContain("-b \"$COOKIE_JAR\"");
  });

  it("logs in via Better Auth email/password sign-in", () => {
    expect(script).toContain("/api/auth/sign-in/email");
    expect(script).toContain("smoke@test.dev");
    expect(script).toContain("SmokeTest123!");
  });

  it("verifies session with auth.me after login", () => {
    // After login, should call auth.me with cookie to verify session
    expect(script).toContain("http_get_auth");
    expect(script).toContain("auth.me");
    expect(script).toContain("session valid");
  });

  it("tracks AUTH_OK flag to skip dependent tests on login failure", () => {
    expect(script).toContain("AUTH_OK=true");
    expect(script).toContain("AUTH_OK=false");
    expect(script).toContain('AUTH_OK" = true');
  });
});

// ═══════════════════════════════════════════════════════════
// CI-2: Smoke Test Script — NEW: Traeger Integration (Section 8)
// ═══════════════════════════════════════════════════════════

describe("CI-2: Smoke Test Script — Traeger Integration (Section 8)", () => {
  const script = fs.readFileSync(
    path.join(projectRoot, "tests/smoke-test.sh"),
    "utf-8"
  );

  it("tests traeger.status returns connected:false when no account linked", () => {
    expect(script).toContain("traeger.status");
    expect(script).toContain('"connected":false');
    expect(script).toContain("no Traeger account linked");
  });

  it("tests traeger.mqttCredentials returns PRECONDITION_FAILED", () => {
    expect(script).toContain("traeger.mqttCredentials");
    expect(script).toContain("PRECONDITION_FAILED");
  });

  it("tests liveCook.active returns PRECONDITION_FAILED (no MQTT)", () => {
    // Should test liveCook.active with auth and expect PRECONDITION_FAILED
    expect(script).toMatch(/liveCook\.active[\s\S]*?PRECONDITION_FAILED[\s\S]*?no MQTT/);
  });

  it("tests liveCook.stallInfo returns PRECONDITION_FAILED (no MQTT)", () => {
    expect(script).toContain("liveCook.stallInfo");
    expect(script).toMatch(/stallInfo[\s\S]*?PRECONDITION_FAILED/);
  });

  it("uses authenticated requests for Traeger integration tests", () => {
    // Traeger tests should use http_get_auth (cookie-based)
    expect(script).toContain("http_get_auth");
  });
});

// ═══════════════════════════════════════════════════════════
// CI-2: Smoke Test Script — NEW: Authenticated Endpoints (Section 9)
// ═══════════════════════════════════════════════════════════

describe("CI-2: Smoke Test Script — Authenticated Endpoints (Section 9)", () => {
  const script = fs.readFileSync(
    path.join(projectRoot, "tests/smoke-test.sh"),
    "utf-8"
  );

  it("tests cookSession.list with authentication", () => {
    expect(script).toContain("cookSession.list (authenticated)");
  });

  it("tests automation.list with authentication", () => {
    expect(script).toContain("automation.list (authenticated)");
  });

  it("tests analytics.summary with authentication", () => {
    expect(script).toContain("analytics.summary (authenticated)");
  });

  it("tests push.getVapidKey with authentication and checks vapidPublicKey field", () => {
    expect(script).toContain("push.getVapidKey (authenticated)");
    expect(script).toContain("vapidPublicKey");
  });

  it("tests customTemplates.mine with authentication", () => {
    expect(script).toContain("customTemplates.mine (authenticated)");
  });

  it("tests executions.history with authentication", () => {
    expect(script).toContain("executions.history (authenticated)");
  });
});

// ═══════════════════════════════════════════════════════════
// CI-2: Smoke Test Script — NEW: Admin Authenticated (Section 10)
// ═══════════════════════════════════════════════════════════

describe("CI-2: Smoke Test Script — Admin Authenticated (Section 10)", () => {
  const script = fs.readFileSync(
    path.join(projectRoot, "tests/smoke-test.sh"),
    "utf-8"
  );

  it("tests admin.getRegistrationConfig with admin session", () => {
    expect(script).toContain("admin.getRegistrationConfig (admin)");
    expect(script).toContain('"mode"');
  });

  it("tests admin.listUsers with admin session", () => {
    expect(script).toContain("admin.listUsers (admin)");
    expect(script).toContain('"users"');
  });
});

// ═══════════════════════════════════════════════════════════
// CI-2: Smoke Test Script — NEW: SSE Authenticated (Section 11)
// ═══════════════════════════════════════════════════════════

describe("CI-2: Smoke Test Script — SSE Authenticated (Section 11)", () => {
  const script = fs.readFileSync(
    path.join(projectRoot, "tests/smoke-test.sh"),
    "utf-8"
  );

  it("tests /api/sse/telemetry with auth checks event-stream headers", () => {
    expect(script).toContain("text/event-stream");
    expect(script).toContain("header_contains");
  });

  it("handles SSE timeout gracefully (long-lived connection)", () => {
    // SSE connections stay open, curl will timeout — script should handle this
    expect(script).toContain("max-time");
    expect(script).toContain("connection held open");
  });
});

// ═══════════════════════════════════════════════════════════
// CI-2: Smoke Test Script — Section Count
// ═══════════════════════════════════════════════════════════

describe("CI-2: Smoke Test Script — Coverage Completeness", () => {
  const script = fs.readFileSync(
    path.join(projectRoot, "tests/smoke-test.sh"),
    "utf-8"
  );

  it("has 11 test sections", () => {
    // Count section headers (numbered 1-11)
    const sectionHeaders = script.match(/─── \d+\./g) || [];
    expect(sectionHeaders.length).toBe(11);
  });

  it("includes both unauthenticated and authenticated test paths", () => {
    expect(script).toContain("http_get");
    expect(script).toContain("http_get_auth");
    expect(script).toContain("http_post_auth");
  });

  it("cleans up cookie jar, body file, and header file on exit", () => {
    expect(script).toContain("COOKIE_JAR");
    expect(script).toContain("HEADER_FILE");
    expect(script).toContain("BODY_FILE");
    // All three should be in the trap cleanup
    expect(script).toMatch(/trap.*BODY_FILE.*HEADER_FILE.*COOKIE_JAR/);
  });
});

// ═══════════════════════════════════════════════════════════
// CI-3: .dockerignore excludes test files
// ═══════════════════════════════════════════════════════════

describe("CI-3: Docker Build Context Exclusions", () => {
  const dockerignore = fs.readFileSync(
    path.join(projectRoot, ".dockerignore"),
    "utf-8"
  );

  it("excludes tests/ directory from Docker build context", () => {
    expect(dockerignore).toContain("tests/");
  });

  it("excludes .github/ from Docker build context", () => {
    expect(dockerignore).toContain(".github/");
  });

  it("excludes vitest config from Docker build context", () => {
    expect(dockerignore).toContain("vitest.config.*");
  });
});
