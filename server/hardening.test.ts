import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "..");

// ═══════════════════════════════════════════════════════════
// OBS-1: Structured Logging
// ═══════════════════════════════════════════════════════════

describe("OBS-1: Structured Logger", () => {
  it("exports a base logger with pino interface", async () => {
    const { logger } = await import("./logger");
    expect(logger).toBeDefined();
    expect(typeof logger.info).toBe("function");
    expect(typeof logger.warn).toBe("function");
    expect(typeof logger.error).toBe("function");
    expect(typeof logger.debug).toBe("function");
    expect(typeof logger.child).toBe("function");
  });

  it("exports child loggers for all subsystems", async () => {
    const mod = await import("./logger");
    const expectedLoggers = [
      "mqttLog", "dbLog", "authLog", "pushLog",
      "sseLog", "cookLog", "autoLog", "alarmLog", "apiLog",
    ];
    for (const name of expectedLoggers) {
      expect((mod as any)[name]).toBeDefined();
      expect(typeof (mod as any)[name].info).toBe("function");
    }
  });

  it("configures redaction for sensitive fields", async () => {
    const loggerSource = fs.readFileSync(
      path.join(projectRoot, "server/logger.ts"),
      "utf-8"
    );
    const sensitiveFields = [
      "password", "accessToken", "refreshToken",
      "p256dh", "keys.auth", "keys.p256dh",
    ];
    for (const field of sensitiveFields) {
      expect(loggerSource).toContain(field);
    }
    expect(loggerSource).toContain("[REDACTED]");
  });

  it("no console.log/warn/error in non-core server files", () => {
    const serverDir = path.join(projectRoot, "server");
    const files = getAllTsFiles(serverDir).filter(
      (f) => !f.includes("_core/") && !f.includes(".test.") && !f.includes("logger.ts")
    );
    const violations: string[] = [];
    for (const file of files) {
      const content = fs.readFileSync(file, "utf-8");
      const lines = content.split("\n");
      for (let i = 0; i < lines.length; i++) {
        if (/console\.(log|warn|error)\s*\(/.test(lines[i])) {
          violations.push(`${path.relative(projectRoot, file)}:${i + 1}`);
        }
      }
    }
    expect(violations).toEqual([]);
  });
});

// ═══════════════════════════════════════════════════════════
// OBS-2/3: Health & Metrics Endpoints
// ═══════════════════════════════════════════════════════════

describe("OBS-2: Health Endpoint", () => {
  const healthSource = fs.readFileSync(
    path.join(projectRoot, "server/health.ts"),
    "utf-8"
  );

  it("registers GET /api/health route", () => {
    expect(healthSource).toContain('"/api/health"');
    expect(healthSource).toContain("app.get");
  });

  it("performs a DB ping (SELECT 1)", () => {
    expect(healthSource).toContain("SELECT 1");
  });

  it("checks VAPID readiness", () => {
    expect(healthSource).toContain("isVapidReady");
  });

  it("returns memory usage metrics", () => {
    expect(healthSource).toContain("process.memoryUsage()");
    expect(healthSource).toContain("heapUsedMB");
    expect(healthSource).toContain("rssMB");
  });

  it("returns 200 for ok, 503 for degraded", () => {
    expect(healthSource).toContain("200");
    expect(healthSource).toContain("503");
  });

  it("has proper error handling for health check failure", () => {
    expect(healthSource).toContain("Health check failed");
    expect(healthSource).toContain('status: "down"');
  });
});

describe("OBS-3: Metrics Endpoint", () => {
  const healthSource = fs.readFileSync(
    path.join(projectRoot, "server/health.ts"),
    "utf-8"
  );

  it("registers GET /api/metrics route", () => {
    expect(healthSource).toContain('"/api/metrics"');
  });

  it("exposes MQTT session count", () => {
    expect(healthSource).toContain("mqttSessions");
    expect(healthSource).toContain("getActiveSessionUserIds");
  });

  it("exposes SSE client count", () => {
    expect(healthSource).toContain("sseClients");
    expect(healthSource).toContain("getSSEClientCount");
  });

  it("exposes active alarm count", () => {
    expect(healthSource).toContain("activeAlarms");
    expect(healthSource).toContain("getActiveAlarmCount");
  });
});

describe("DPL-2: Version Endpoint", () => {
  const healthSource = fs.readFileSync(
    path.join(projectRoot, "server/health.ts"),
    "utf-8"
  );

  it("registers GET /api/version route", () => {
    expect(healthSource).toContain('"/api/version"');
  });

  it("includes version, node, startedAt, pid", () => {
    expect(healthSource).toContain("version:");
    expect(healthSource).toContain("node:");
    expect(healthSource).toContain("startedAt:");
    expect(healthSource).toContain("pid:");
  });
});

// ═══════════════════════════════════════════════════════════
// DPL-1: Docker HEALTHCHECK
// ═══════════════════════════════════════════════════════════

describe("DPL-1: Docker HEALTHCHECK", () => {
  const dockerfile = fs.readFileSync(
    path.join(projectRoot, "Dockerfile"),
    "utf-8"
  );

  it("includes HEALTHCHECK instruction", () => {
    expect(dockerfile).toContain("HEALTHCHECK");
  });

  it("uses /api/health endpoint for health check", () => {
    expect(dockerfile).toContain("/api/health");
  });

  it("has reasonable timing parameters", () => {
    expect(dockerfile).toContain("--interval=30s");
    expect(dockerfile).toContain("--timeout=5s");
    expect(dockerfile).toContain("--start-period=15s");
    expect(dockerfile).toContain("--retries=3");
  });
});

describe("s6 readiness uses /api/health", () => {
  const runScript = fs.readFileSync(
    path.join(projectRoot, "root/etc/s6-overlay/s6-rc.d/svc-traeger/run"),
    "utf-8"
  );

  it("uses HTTP health check instead of TCP port check", () => {
    expect(runScript).toContain("/api/health");
    // Should NOT use bare nc -z anymore
    expect(runScript).not.toContain("nc -z");
  });
});

// ═══════════════════════════════════════════════════════════
// SEC-1: Input Validation Bounds
// ═══════════════════════════════════════════════════════════

describe("SEC-1: Input Validation Bounds", () => {
  const routerDir = path.join(projectRoot, "server/routers");

  it("all z.string() inputs have .max() bounds", () => {
    const files = fs.readdirSync(routerDir).filter(
      (f) => f.endsWith(".ts") && !f.endsWith(".test.ts")
    );
    const violations: string[] = [];

    for (const file of files) {
      const content = fs.readFileSync(path.join(routerDir, file), "utf-8");
      const lines = content.split("\n");
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        // Skip lines that already have .max(), .email(), .url(), .uuid()
        if (
          line.includes(".max(") ||
          line.includes(".email()") ||
          line.includes(".url()") ||
          line.includes(".uuid()")
        ) {
          continue;
        }
        // Check for bare z.string() without bounds
        if (/z\.string\(\)/.test(line)) {
          violations.push(`${file}:${i + 1}: ${line.trim()}`);
        }
      }
    }
    expect(violations).toEqual([]);
  });

  it("temperature inputs have min/max bounds (0-1200)", () => {
    const files = fs.readdirSync(routerDir).filter(
      (f) => f.endsWith(".ts") && !f.endsWith(".test.ts")
    );
    const tempFields = ["grillTemp", "triggerTemp", "triggerValue"];
    const violations: string[] = [];

    for (const file of files) {
      const content = fs.readFileSync(path.join(routerDir, file), "utf-8");
      for (const field of tempFields) {
        const regex = new RegExp(`${field}:\\s*z\\.number\\(\\)`, "g");
        let match;
        while ((match = regex.exec(content)) !== null) {
          const lineStart = content.lastIndexOf("\n", match.index) + 1;
          const lineEnd = content.indexOf("\n", match.index);
          const line = content.slice(lineStart, lineEnd);
          if (!line.includes(".min(") || !line.includes(".max(")) {
            violations.push(`${file}: ${field} missing min/max bounds`);
          }
        }
      }
    }
    expect(violations).toEqual([]);
  });

  it("DB ID inputs have .int().min(1) bounds", () => {
    const files = fs.readdirSync(routerDir).filter(
      (f) => f.endsWith(".ts") && !f.endsWith(".test.ts")
    );
    const idFields = ["id", "cookSessionId"];
    const violations: string[] = [];

    for (const file of files) {
      const content = fs.readFileSync(path.join(routerDir, file), "utf-8");
      for (const field of idFields) {
        // Match "field: z.number()" pattern
        const regex = new RegExp(`${field}:\\s*z\\.number\\(\\)(?!\\.int)`, "g");
        let match;
        while ((match = regex.exec(content)) !== null) {
          violations.push(`${file}: ${field} missing .int() bound`);
        }
      }
    }
    expect(violations).toEqual([]);
  });
});

// ═══════════════════════════════════════════════════════════
// SEC-2: CSP Headers
// ═══════════════════════════════════════════════════════════

describe("SEC-2: Security Headers", () => {
  const indexSource = fs.readFileSync(
    path.join(projectRoot, "server/_core/index.ts"),
    "utf-8"
  );

  it("uses helmet for security headers", () => {
    expect(indexSource).toContain("helmet");
  });

  it("configures Content-Security-Policy", () => {
    expect(indexSource).toContain("contentSecurityPolicy");
  });
});

// ═══════════════════════════════════════════════════════════
// SEC-5: Body Size Limits
// ═══════════════════════════════════════════════════════════

describe("SEC-5: Body Size Limits", () => {
  const indexSource = fs.readFileSync(
    path.join(projectRoot, "server/_core/index.ts"),
    "utf-8"
  );

  it("sets JSON body limit to 5MB or less", () => {
    // Should contain a json body limit configuration
    const limitMatch = indexSource.match(/limit:\s*["'](\d+)([km]b)["']/i);
    if (limitMatch) {
      const size = parseInt(limitMatch[1]);
      const unit = limitMatch[2].toLowerCase();
      const mb = unit === "kb" ? size / 1024 : size;
      expect(mb).toBeLessThanOrEqual(5);
    } else {
      // If no explicit limit found, check for express.json with limit
      expect(indexSource).toMatch(/json\(.*limit/);
    }
  });
});

// ═══════════════════════════════════════════════════════════
// STB-1: Graceful Shutdown
// ═══════════════════════════════════════════════════════════

describe("STB-1: Graceful Shutdown", () => {
  const indexSource = fs.readFileSync(
    path.join(projectRoot, "server/_core/index.ts"),
    "utf-8"
  );

  it("handles SIGTERM signal", () => {
    expect(indexSource).toContain("SIGTERM");
  });

  it("handles SIGINT signal", () => {
    expect(indexSource).toContain("SIGINT");
  });

  it("closes HTTP server during shutdown", () => {
    expect(indexSource).toContain("server.close");
  });

  it("disconnects MQTT sessions during shutdown", () => {
    expect(indexSource).toContain("disconnectMqtt");
  });
});

// ═══════════════════════════════════════════════════════════
// STB-2: Stale Session Reaper
// ═══════════════════════════════════════════════════════════

describe("STB-2: Stale Session Reaper", () => {
  const indexSource = fs.readFileSync(
    path.join(projectRoot, "server/_core/index.ts"),
    "utf-8"
  );

  it("implements periodic stale session cleanup", () => {
    expect(indexSource).toContain("stale");
  });

  it("runs on a timer interval", () => {
    expect(indexSource).toContain("setInterval");
  });
});

// ═══════════════════════════════════════════════════════════
// STB-4: Telemetry Purge
// ═══════════════════════════════════════════════════════════

describe("STB-4: Telemetry Purge", () => {
  const indexSource = fs.readFileSync(
    path.join(projectRoot, "server/_core/index.ts"),
    "utf-8"
  );

  it("implements periodic telemetry purge", () => {
    expect(indexSource).toContain("purgeStaleTelemetry");
  });

  it("uses 90-day retention period", () => {
    // 90 days = 90 * 24 * 60 * 60 * 1000 = 7776000000
    expect(indexSource).toContain("90");
  });
});

// ═══════════════════════════════════════════════════════════
// PERF-1: Lazy Loading
// ═══════════════════════════════════════════════════════════

describe("PERF-1: Lazy Loading", () => {
  const appSource = fs.readFileSync(
    path.join(projectRoot, "client/src/App.tsx"),
    "utf-8"
  );

  it("uses React.lazy for page imports", () => {
    expect(appSource).toContain("lazy(");
    expect(appSource).toContain("import(");
  });

  it("wraps routes in Suspense", () => {
    expect(appSource).toContain("Suspense");
  });

  it("provides a loading fallback", () => {
    expect(appSource).toContain("fallback=");
    expect(appSource).toContain("PageLoader");
  });

  it("lazy-loads all major page components", () => {
    const lazyPages = [
      "Home", "Dashboard", "Controls", "CookPrograms",
      "LiveCook", "History", "Analytics", "Settings", "AdminSettings",
    ];
    for (const page of lazyPages) {
      expect(appSource).toContain(`const ${page} = lazy(`);
    }
  });

  it("does NOT eagerly import page components", () => {
    // Should not have direct import statements for pages
    expect(appSource).not.toMatch(/^import\s+\w+\s+from\s+["']\.\/pages\//m);
  });
});

// ═══════════════════════════════════════════════════════════
// PERF-3/4/5: Database Indexes
// ═══════════════════════════════════════════════════════════

describe("PERF-3/4/5: Database Indexes", () => {
  const migration = fs.readFileSync(
    path.join(projectRoot, "drizzle/0009_hardening_indexes.sql"),
    "utf-8"
  );

  it("adds index on telemetry_readings(cookSessionId)", () => {
    expect(migration).toContain("telemetry_readings");
    expect(migration).toContain("cookSessionId");
  });

  it("adds composite index on cook_sessions(userId, status)", () => {
    expect(migration).toContain("cook_sessions");
    expect(migration).toContain("userId, status");
  });

  it("adds index on telemetry_readings(recordedAt) for purge queries", () => {
    expect(migration).toContain("recordedAt");
  });

  it("uses CREATE INDEX IF NOT EXISTS for idempotency", () => {
    const createStatements = migration.match(/CREATE INDEX/g);
    const ifNotExists = migration.match(/IF NOT EXISTS/g);
    expect(createStatements?.length).toBe(ifNotExists?.length);
  });
});

// ═══════════════════════════════════════════════════════════
// OBS-4: Production ErrorBoundary
// ═══════════════════════════════════════════════════════════

describe("OBS-4: Production-safe ErrorBoundary", () => {
  const errorBoundary = fs.readFileSync(
    path.join(projectRoot, "client/src/components/ErrorBoundary.tsx"),
    "utf-8"
  );

  it("checks for development mode", () => {
    expect(errorBoundary).toContain("import.meta.env.DEV");
  });

  it("only shows stack traces in development", () => {
    // Stack trace rendering should be conditional on isDev
    expect(errorBoundary).toContain("isDev");
    expect(errorBoundary).toContain("error?.stack");
  });

  it("shows user-friendly message in production", () => {
    expect(errorBoundary).toContain("contact your administrator");
  });
});

// ═══════════════════════════════════════════════════════════
// Regression: Existing tests still pass
// ═══════════════════════════════════════════════════════════

describe("Regression: Critical file integrity", () => {
  it("all router files exist and are non-empty", () => {
    const routerDir = path.join(projectRoot, "server/routers");
    const expectedRouters = [
      "traeger.ts", "grill.ts", "live-cook.ts", "cook-session.ts",
      "templates.ts", "automation.ts", "analytics.ts", "push.ts",
      "admin.ts", "executions.ts", "helpers.ts",
    ];
    for (const router of expectedRouters) {
      const filePath = path.join(routerDir, router);
      expect(fs.existsSync(filePath)).toBe(true);
      const stat = fs.statSync(filePath);
      expect(stat.size).toBeGreaterThan(100);
    }
  });

  it("drizzle schema exports all expected tables", () => {
    const schema = fs.readFileSync(
      path.join(projectRoot, "drizzle/schema.ts"),
      "utf-8"
    );
    const expectedTables = [
      "traegerSessions", "telemetryReadings", "cookSessions",
      "cookAlerts", "pelletLogs", "automationPrograms",
      "customTemplates", "programExecutions", "inviteCodes",
      "emailAllowlist", "appSettings",
    ];
    for (const table of expectedTables) {
      expect(schema).toContain(`export const ${table}`);
    }
  });

  it("all migration files exist in order", () => {
    const drizzleDir = path.join(projectRoot, "drizzle");
    for (let i = 0; i <= 9; i++) {
      const files = fs.readdirSync(drizzleDir).filter(
        (f) => f.startsWith(`000${i}`)
      );
      expect(files.length).toBeGreaterThanOrEqual(1);
    }
  });
});

// ═══════════════════════════════════════════════════════════
// SEC-4: Rate Limiting
// ═══════════════════════════════════════════════════════════

describe("SEC-4: Rate Limiting Module", () => {
  const rateLimitSource = fs.readFileSync(
    path.join(projectRoot, "server/rate-limit.ts"),
    "utf-8"
  );

  it("exports authLimiter for /api/auth/* routes", () => {
    expect(rateLimitSource).toContain("export const authLimiter");
  });

  it("exports loginLimiter for traeger.connect (5 req/min)", () => {
    expect(rateLimitSource).toContain("export const loginLimiter");
    // Should be very strict — 5 requests per minute
    expect(rateLimitSource).toMatch(/max:\s*5/);
  });

  it("exports apiLimiter for general API (200 req/min)", () => {
    expect(rateLimitSource).toContain("export const apiLimiter");
    expect(rateLimitSource).toMatch(/max:\s*200/);
  });

  it("exports adminLimiter for admin endpoints (30 req/min)", () => {
    expect(rateLimitSource).toContain("export const adminLimiter");
    expect(rateLimitSource).toMatch(/max:\s*30/);
  });

  it("exports trpcLoginLimiter middleware for path-based routing", () => {
    expect(rateLimitSource).toContain("export function trpcLoginLimiter");
    expect(rateLimitSource).toContain("traeger.connect");
    expect(rateLimitSource).toContain("admin.");
  });

  it("logs rate limit violations", () => {
    expect(rateLimitSource).toContain("rate limit exceeded");
  });

  it("returns 429 status code on limit exceeded", () => {
    expect(rateLimitSource).toContain("429");
  });

  it("uses standard rate limit headers (not legacy)", () => {
    expect(rateLimitSource).toContain("standardHeaders: true");
    expect(rateLimitSource).toContain("legacyHeaders: false");
  });
});

describe("SEC-4: Rate Limiting Wiring in index.ts", () => {
  const indexSource = fs.readFileSync(
    path.join(projectRoot, "server/_core/index.ts"),
    "utf-8"
  );

  it("imports rate limiters from rate-limit module", () => {
    expect(indexSource).toContain('from "../rate-limit"');
  });

  it("applies authLimiter to /api/auth", () => {
    expect(indexSource).toContain('app.use("/api/auth", authLimiter)');
  });

  it("applies trpcLoginLimiter to /api/trpc", () => {
    expect(indexSource).toContain('app.use("/api/trpc", trpcLoginLimiter)');
  });

  it("applies apiLimiter to /api/trpc", () => {
    expect(indexSource).toContain('app.use("/api/trpc", apiLimiter)');
  });
});

// ═══════════════════════════════════════════════════════════
// Log Aggregation Stack
// ═══════════════════════════════════════════════════════════

describe("Log Aggregation: Docker Compose Overlay", () => {
  it("docker-compose.logging.yml exists", () => {
    expect(
      fs.existsSync(path.join(projectRoot, "docker-compose.logging.yml"))
    ).toBe(true);
  });

  it("includes Loki, Promtail, and Grafana services", () => {
    const compose = fs.readFileSync(
      path.join(projectRoot, "docker-compose.logging.yml"),
      "utf-8"
    );
    expect(compose).toContain("loki:");
    expect(compose).toContain("promtail:");
    expect(compose).toContain("grafana:");
  });

  it("Grafana datasource provisioning exists", () => {
    expect(
      fs.existsSync(path.join(projectRoot, "grafana-datasources.yml"))
    ).toBe(true);
    const ds = fs.readFileSync(
      path.join(projectRoot, "grafana-datasources.yml"),
      "utf-8"
    );
    expect(ds).toContain("loki");
    expect(ds).toContain("http://loki:3100");
  });

  it("Promtail config exists and targets Docker containers", () => {
    expect(
      fs.existsSync(path.join(projectRoot, "promtail-config.yml"))
    ).toBe(true);
    const config = fs.readFileSync(
      path.join(projectRoot, "promtail-config.yml"),
      "utf-8"
    );
    expect(config).toContain("docker_sd_configs");
    expect(config).toContain("traeger");
  });

  it("Promtail parses JSON logs from traeger container", () => {
    const config = fs.readFileSync(
      path.join(projectRoot, "promtail-config.yml"),
      "utf-8"
    );
    expect(config).toContain("json");
    expect(config).toContain("level");
    expect(config).toContain("module");
  });
});

describe("Log Aggregation: README Documentation", () => {
  const readme = fs.readFileSync(path.join(projectRoot, "README.md"), "utf-8");

  it("documents health monitoring endpoints", () => {
    expect(readme).toContain("## Health Monitoring");
    expect(readme).toContain("/api/health");
    expect(readme).toContain("/api/metrics");
    expect(readme).toContain("/api/version");
  });

  it("documents rate limiting", () => {
    expect(readme).toContain("## Rate Limiting");
    expect(readme).toContain("429");
  });

  it("documents log aggregation with Loki/Grafana", () => {
    expect(readme).toContain("## Log Aggregation");
    expect(readme).toContain("docker-compose.logging.yml");
    expect(readme).toContain("LogQL");
  });
});

// ═══════════════════════════════════════════════════════════
// Helper: Recursively get all .ts files
// ═══════════════════════════════════════════════════════════

function getAllTsFiles(dir: string): string[] {
  const results: string[] = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory() && entry.name !== "node_modules") {
      results.push(...getAllTsFiles(fullPath));
    } else if (entry.name.endsWith(".ts") && !entry.name.endsWith(".d.ts")) {
      results.push(fullPath);
    }
  }
  return results;
}
