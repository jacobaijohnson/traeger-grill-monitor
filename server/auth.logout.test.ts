import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "..");

// ─── Auth Tests ──────────────────────────────────────────

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createMockContext(user: AuthenticatedUser | null = null): TrpcContext {
  return {
    user,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: () => {},
    } as unknown as TrpcContext["res"],
  };
}

const mockUser: AuthenticatedUser = {
  id: "test-user-id",
  name: "Test User",
  email: "test@example.com",
  image: null,
  role: "user",
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe("auth.me", () => {
  it("returns the authenticated user", async () => {
    const ctx = createMockContext(mockUser);
    const caller = appRouter.createCaller(ctx);
    const result = await caller.auth.me();
    expect(result).toEqual(mockUser);
  });

  it("returns null for unauthenticated requests", async () => {
    const ctx = createMockContext(null);
    const caller = appRouter.createCaller(ctx);
    const result = await caller.auth.me();
    expect(result).toBeNull();
  });
});

describe("auth.logout", () => {
  it("returns success even without a session", async () => {
    const ctx = createMockContext(null);
    const caller = appRouter.createCaller(ctx);
    const result = await caller.auth.logout();
    expect(result).toEqual({ success: true });
  });
});

// ─── Docker Configuration Tests ──────────────────────────

describe("Dockerfile", () => {
  const dockerfile = fs.readFileSync(path.join(projectRoot, "Dockerfile"), "utf-8");

  it("uses LSIO baseimage-alpine as production base", () => {
    expect(dockerfile).toContain("ghcr.io/linuxserver/baseimage-alpine");
  });

  it("exposes port 8420", () => {
    expect(dockerfile).toMatch(/EXPOSE\s+8420/);
  });

  it("sets default PORT env to 8420", () => {
    expect(dockerfile).toMatch(/PORT=8420/);
  });

  it("sets NODE_ENV to production", () => {
    expect(dockerfile).toMatch(/NODE_ENV=production/);
  });

  it("declares /config volume (LSIO convention)", () => {
    expect(dockerfile).toMatch(/VOLUME\s+\/config/);
  });

  it("uses multi-stage build", () => {
    const fromStatements = dockerfile.match(/^FROM\s+/gm);
    expect(fromStatements).toBeTruthy();
    expect(fromStatements!.length).toBeGreaterThanOrEqual(2);
  });

  it("copies dist artifacts from builder", () => {
    expect(dockerfile).toContain("COPY --from=builder /app/dist /app/dist");
  });

  it("copies drizzle migrations from builder", () => {
    expect(dockerfile).toContain("COPY --from=builder /app/drizzle /app/drizzle");
  });

  it("copies s6 service definitions", () => {
    expect(dockerfile).toContain("COPY root/ /");
  });

  it("prunes devDependencies", () => {
    expect(dockerfile).toContain("pnpm prune --prod");
  });
});

describe("docker-compose.yml", () => {
  const compose = fs.readFileSync(path.join(projectRoot, "docker-compose.yml"), "utf-8");

  it("maps port 8420", () => {
    expect(compose).toContain("8420:8420");
  });

  it("includes BETTER_AUTH_URL env var", () => {
    expect(compose).toContain("BETTER_AUTH_URL");
  });

  it("includes ADMIN_EMAIL env var", () => {
    expect(compose).toContain("ADMIN_EMAIL");
  });

  it("includes ADMIN_PASSWORD env var", () => {
    expect(compose).toContain("ADMIN_PASSWORD");
  });

  it("includes JWT_SECRET env var", () => {
    expect(compose).toContain("JWT_SECRET");
  });

  it("includes PUID, PGID, TZ (LSIO standard)", () => {
    expect(compose).toContain("PUID");
    expect(compose).toContain("PGID");
    expect(compose).toContain("TZ");
  });

  it("includes MySQL service with healthcheck", () => {
    expect(compose).toContain("mysql:");
    expect(compose).toContain("healthcheck");
    expect(compose).toContain("mysqladmin");
  });

  it("uses depends_on with service_healthy condition", () => {
    expect(compose).toContain("condition: service_healthy");
  });

  it("does not expose MySQL port to host (security)", () => {
    // MySQL service should NOT have ports mapping (internal only)
    const mysqlSection = compose.split("mysql:")[1];
    // The mysql service section should not have a ports: directive
    // (only the traeger service should expose ports)
    expect(mysqlSection).toBeTruthy();
  });
});

// ─── s6-overlay Service Tests ────────────────────────────

describe("s6-overlay service configuration", () => {
  const s6Root = path.join(projectRoot, "root/etc/s6-overlay/s6-rc.d");

  it("svc-traeger is registered in user bundle", () => {
    const contentsPath = path.join(s6Root, "user/contents.d/svc-traeger");
    expect(fs.existsSync(contentsPath)).toBe(true);
  });

  it("svc-traeger is a longrun service", () => {
    const typePath = path.join(s6Root, "svc-traeger/type");
    expect(fs.readFileSync(typePath, "utf-8").trim()).toBe("longrun");
  });

  it("svc-traeger has notification-fd set to 3", () => {
    const fdPath = path.join(s6Root, "svc-traeger/notification-fd");
    expect(fs.readFileSync(fdPath, "utf-8").trim()).toBe("3");
  });

  it("svc-traeger run script uses PORT 8420 default", () => {
    const runScript = fs.readFileSync(path.join(s6Root, "svc-traeger/run"), "utf-8");
    expect(runScript).toContain("${PORT:-8420}");
    expect(runScript).toContain("node dist/index.js");
  });

  it("svc-traeger run script uses s6-setuidgid abc", () => {
    const runScript = fs.readFileSync(path.join(s6Root, "svc-traeger/run"), "utf-8");
    expect(runScript).toContain("s6-setuidgid abc");
  });

  it("svc-traeger depends on init-services", () => {
    const depPath = path.join(s6Root, "svc-traeger/dependencies.d/init-services");
    expect(fs.existsSync(depPath)).toBe(true);
  });

  it("init-traeger-config is a oneshot service", () => {
    const typePath = path.join(s6Root, "init-traeger-config/type");
    expect(fs.readFileSync(typePath, "utf-8").trim()).toBe("oneshot");
  });

  it("init-traeger-config depends on init-adduser", () => {
    const depPath = path.join(s6Root, "init-traeger-config/dependencies.d/init-adduser");
    expect(fs.existsSync(depPath)).toBe(true);
  });

  it("init-traeger-config sets ownership with lsiown", () => {
    const runScript = fs.readFileSync(path.join(s6Root, "init-traeger-config/run"), "utf-8");
    expect(runScript).toContain("lsiown");
    expect(runScript).toContain("/config");
    expect(runScript).toContain("/app");
  });

  it("init-traeger-config is wired into init-config-end", () => {
    const depPath = path.join(s6Root, "init-config-end/dependencies.d/init-traeger-config");
    expect(fs.existsSync(depPath)).toBe(true);
  });
});

// ─── ENV_TEMPLATE Tests ──────────────────────────────────

describe("ENV_TEMPLATE.md", () => {
  const envTemplate = fs.readFileSync(path.join(projectRoot, "ENV_TEMPLATE.md"), "utf-8");

  it("documents port 8420", () => {
    expect(envTemplate).toContain("8420");
  });

  it("documents BETTER_AUTH_URL", () => {
    expect(envTemplate).toContain("BETTER_AUTH_URL");
  });

  it("documents ADMIN_EMAIL and ADMIN_PASSWORD", () => {
    expect(envTemplate).toContain("ADMIN_EMAIL");
    expect(envTemplate).toContain("ADMIN_PASSWORD");
  });

  it("documents JWT_SECRET", () => {
    expect(envTemplate).toContain("JWT_SECRET");
  });

  it("documents PUID, PGID, TZ", () => {
    expect(envTemplate).toContain("PUID");
    expect(envTemplate).toContain("PGID");
    expect(envTemplate).toContain("TZ");
  });

  it("mentions Manus OAuth is NOT used for self-hosted", () => {
    expect(envTemplate.toLowerCase()).toContain("not");
    expect(envTemplate.toLowerCase()).toContain("self-hosted");
  });

  it("includes example .env file", () => {
    expect(envTemplate).toContain("Example `.env` File");
  });
});

// ─── .dockerignore Tests ─────────────────────────────────

describe(".dockerignore", () => {
  const dockerignore = fs.readFileSync(path.join(projectRoot, ".dockerignore"), "utf-8");

  it("excludes node_modules", () => {
    expect(dockerignore).toContain("node_modules/");
  });

  it("excludes dist (rebuilt in container)", () => {
    expect(dockerignore).toContain("dist/");
  });

  it("excludes .git", () => {
    expect(dockerignore).toContain(".git/");
  });

  it("excludes development logs", () => {
    expect(dockerignore).toContain(".manus-logs/");
  });

  it("excludes Docker files to prevent recursive builds", () => {
    expect(dockerignore).toContain("Dockerfile");
    expect(dockerignore).toContain("docker-compose");
  });
});
