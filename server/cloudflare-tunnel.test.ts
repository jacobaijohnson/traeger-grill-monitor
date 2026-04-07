import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "..");

// ═══════════════════════════════════════════════════════════
// Cloudflare Tunnel — Embedded s6-overlay Service
// ═══════════════════════════════════════════════════════════

describe("Cloudflare Tunnel: Dockerfile", () => {
  const dockerfile = fs.readFileSync(
    path.join(projectRoot, "Dockerfile"),
    "utf-8"
  );

  it("installs cloudflared binary in Stage 2", () => {
    expect(dockerfile).toContain("install cloudflared");
    expect(dockerfile).toContain("/usr/local/bin/cloudflared");
    expect(dockerfile).toContain("chmod +x /usr/local/bin/cloudflared");
  });

  it("downloads cloudflared from official GitHub releases", () => {
    expect(dockerfile).toContain(
      "github.com/cloudflare/cloudflared/releases/latest/download"
    );
  });

  it("supports multi-architecture builds (amd64, arm64)", () => {
    expect(dockerfile).toContain("x86_64");
    expect(dockerfile).toContain("aarch64");
    expect(dockerfile).toContain("amd64");
    expect(dockerfile).toContain("arm64");
  });

  it("sets TUNNEL_TOKEN env var with empty default", () => {
    expect(dockerfile).toMatch(/TUNNEL_TOKEN\s*=\s*""/);
  });
});

describe("Cloudflare Tunnel: s6 Service Definition", () => {
  const svcDir = path.join(
    projectRoot,
    "root/etc/s6-overlay/s6-rc.d/svc-cloudflared"
  );

  it("service directory exists", () => {
    expect(fs.existsSync(svcDir)).toBe(true);
  });

  it("is registered as a longrun service", () => {
    const typeFile = fs.readFileSync(path.join(svcDir, "type"), "utf-8");
    expect(typeFile.trim()).toBe("longrun");
  });

  it("has a run script", () => {
    const runPath = path.join(svcDir, "run");
    expect(fs.existsSync(runPath)).toBe(true);
    const stat = fs.statSync(runPath);
    // Check executable bit (owner execute = 0o100)
    expect(stat.mode & 0o111).toBeGreaterThan(0);
  });

  it("depends on init-services", () => {
    const depPath = path.join(svcDir, "dependencies.d/init-services");
    expect(fs.existsSync(depPath)).toBe(true);
  });

  it("is registered in user/contents.d", () => {
    const contentsPath = path.join(
      projectRoot,
      "root/etc/s6-overlay/s6-rc.d/user/contents.d/svc-cloudflared"
    );
    expect(fs.existsSync(contentsPath)).toBe(true);
  });
});

describe("Cloudflare Tunnel: Run Script Behavior", () => {
  const runScript = fs.readFileSync(
    path.join(
      projectRoot,
      "root/etc/s6-overlay/s6-rc.d/svc-cloudflared/run"
    ),
    "utf-8"
  );

  it("checks for Docker secret file first (/run/secrets/tunnel_token)", () => {
    expect(runScript).toContain("/run/secrets/tunnel_token");
  });

  it("falls back to TUNNEL_TOKEN env var", () => {
    expect(runScript).toContain("TUNNEL_TOKEN");
  });

  it("sleeps when no token is provided (does not exit)", () => {
    expect(runScript).toContain("sleep infinity");
  });

  it("waits for app health check before connecting", () => {
    expect(runScript).toContain("/api/health");
    expect(runScript).toContain("MAX_RETRIES");
  });

  it("warns when DATABASE_URL is missing (auth may not work)", () => {
    expect(runScript).toContain("DATABASE_URL");
    expect(runScript).toMatch(/WARNING|WARN/i);
  });

  it("runs cloudflared with --no-autoupdate flag", () => {
    expect(runScript).toContain("--no-autoupdate");
  });

  it("prefers QUIC protocol for lower latency", () => {
    expect(runScript).toContain("--protocol quic");
  });

  it("drops privileges to abc user via s6-setuidgid", () => {
    expect(runScript).toContain("s6-setuidgid abc");
  });

  it("passes token via --token flag (not env var) for security", () => {
    expect(runScript).toMatch(/--token\s+.*TOKEN/);
  });
});

describe("Cloudflare Tunnel: Documentation", () => {
  const readme = fs.readFileSync(
    path.join(projectRoot, "README.md"),
    "utf-8"
  );
  const envTemplate = fs.readFileSync(
    path.join(projectRoot, "ENV_TEMPLATE.md"),
    "utf-8"
  );

  it("README has a Cloudflare Tunnel section", () => {
    expect(readme).toContain("## Cloudflare Tunnel");
  });

  it("README documents both env var and Docker secret setup", () => {
    expect(readme).toContain("TUNNEL_TOKEN");
    expect(readme).toContain("Docker secret");
    expect(readme).toContain("/run/secrets/tunnel_token");
  });

  it("README includes security considerations for tunnel token", () => {
    expect(readme).toMatch(/sensitive credential/i);
    expect(readme).toContain("Rotate the token");
  });

  it("README documents how to disable the tunnel", () => {
    expect(readme).toMatch(/[Dd]isabl(e|ing) the [Tt]unnel/);
  });

  it("README Parameters table includes TUNNEL_TOKEN", () => {
    // The parameters table should have a row for TUNNEL_TOKEN
    expect(readme).toMatch(/TUNNEL_TOKEN.*Cloudflare Tunnel/);
  });

  it("README Architecture diagram includes cloudflared", () => {
    expect(readme).toContain("cloudflared (optional)");
    expect(readme).toContain("TUNNEL_TOKEN");
  });

  it("ENV_TEMPLATE.md documents TUNNEL_TOKEN", () => {
    expect(envTemplate).toContain("TUNNEL_TOKEN");
  });

  it("ENV_TEMPLATE.md warns about token sensitivity", () => {
    expect(envTemplate).toMatch(/sensitive credential/i);
  });
});
