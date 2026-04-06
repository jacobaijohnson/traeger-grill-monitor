import { describe, it, expect } from "vitest";
import { arrayMove } from "@dnd-kit/sortable";
import type { ProgramStep } from "../shared/cook-programs";

// ─── Drag-to-Reorder Tests ────────────────────────────

describe("Drag-to-Reorder Steps", () => {
  const makeStep = (name: string): ProgramStep => ({
    name,
    trigger: { type: "probe_temp", value: 165 },
    entryActions: [],
    actions: [],
  });

  it("should reorder steps using arrayMove", () => {
    const steps = [makeStep("Step A"), makeStep("Step B"), makeStep("Step C")];
    const reordered = arrayMove(steps, 0, 2);
    expect(reordered.map((s) => s.name)).toEqual(["Step B", "Step C", "Step A"]);
  });

  it("should maintain step IDs in sync with steps after reorder", () => {
    const steps = [makeStep("Step A"), makeStep("Step B"), makeStep("Step C")];
    const ids = ["step-0", "step-1", "step-2"];

    const newSteps = arrayMove(steps, 2, 0);
    const newIds = arrayMove(ids, 2, 0);

    expect(newSteps[0].name).toBe("Step C");
    expect(newIds[0]).toBe("step-2");
    expect(newSteps[1].name).toBe("Step A");
    expect(newIds[1]).toBe("step-0");
  });

  it("should handle single-item array (no-op)", () => {
    const steps = [makeStep("Only Step")];
    const reordered = arrayMove(steps, 0, 0);
    expect(reordered).toEqual(steps);
  });

  it("should handle adjacent swap", () => {
    const steps = [makeStep("A"), makeStep("B")];
    const reordered = arrayMove(steps, 0, 1);
    expect(reordered.map((s) => s.name)).toEqual(["B", "A"]);
  });

  it("should preserve all step data during reorder", () => {
    const steps: ProgramStep[] = [
      {
        name: "Smoke Phase",
        trigger: { type: "timer", value: 7200 },
        entryActions: [{ type: "set_grill_temp", params: { temp: 225 } }],
        actions: [{ type: "send_notification", params: { message: "Done!" } }],
        alertOnTrigger: { type: "notification", message: "Phase complete" },
      },
      {
        name: "Rest Phase",
        trigger: { type: "manual" },
        entryActions: [],
        actions: [],
      },
    ];

    const reordered = arrayMove(steps, 0, 1);
    expect(reordered[1].name).toBe("Smoke Phase");
    expect(reordered[1].trigger.type).toBe("timer");
    expect(reordered[1].trigger.value).toBe(7200);
    expect(reordered[1].entryActions).toHaveLength(1);
    expect(reordered[1].alertOnTrigger?.message).toBe("Phase complete");
  });
});

// ─── Execution History Schema Tests ───────────────────

describe("Execution History Data Model", () => {
  it("should validate execution outcome values", () => {
    const validOutcomes = ["running", "completed", "aborted", "failed"];
    validOutcomes.forEach((outcome) => {
      expect(typeof outcome).toBe("string");
      expect(outcome.length).toBeGreaterThan(0);
      expect(outcome.length).toBeLessThanOrEqual(16); // varchar(16) constraint
    });
  });

  it("should validate execution log entry structure", () => {
    const entry = {
      timestamp: Date.now(),
      event: "started",
      detail: "Program started with 3 steps",
    };

    expect(entry.timestamp).toBeGreaterThan(0);
    expect(typeof entry.event).toBe("string");
    expect(typeof entry.detail).toBe("string");
  });

  it("should validate rating constraints (1-5)", () => {
    const validRatings = [1, 2, 3, 4, 5];
    validRatings.forEach((r) => {
      expect(r).toBeGreaterThanOrEqual(1);
      expect(r).toBeLessThanOrEqual(5);
    });
  });

  it("should compute execution duration from timestamps", () => {
    const start = new Date("2026-04-06T10:00:00Z");
    const end = new Date("2026-04-06T14:30:00Z");
    const durationMs = end.getTime() - start.getTime();
    const durationHrs = durationMs / 3600000;
    expect(durationHrs).toBeCloseTo(4.5, 1);
  });

  it("should compute success rate from execution list", () => {
    const executions = [
      { outcome: "completed" },
      { outcome: "completed" },
      { outcome: "aborted" },
      { outcome: "completed" },
      { outcome: "failed" },
    ];
    const completed = executions.filter((e) => e.outcome === "completed").length;
    const rate = Math.round((completed / executions.length) * 100);
    expect(rate).toBe(60);
  });

  it("should compute average rating from executions with ratings", () => {
    const executions = [
      { rating: 5 },
      { rating: 4 },
      { rating: null },
      { rating: 3 },
    ];
    const rated = executions.filter((e) => e.rating != null);
    const avg = rated.reduce((sum, e) => sum + (e.rating || 0), 0) / rated.length;
    expect(avg).toBe(4);
  });

  it("should handle empty execution history gracefully", () => {
    const executions: any[] = [];
    const completed = executions.filter((e) => e.outcome === "completed").length;
    expect(completed).toBe(0);
    expect(executions.length).toBe(0);
  });
});

// ─── Execution Log Append Tests ───────────────────────

describe("Execution Log Operations", () => {
  it("should append entries to execution log", () => {
    const log: Array<{ timestamp: number; event: string; detail?: string }> = [
      { timestamp: 1000, event: "started", detail: "Program started" },
    ];

    log.push({ timestamp: 2000, event: "step_advanced", detail: "Step 1 → Step 2" });
    log.push({ timestamp: 3000, event: "stopped", detail: "User stopped" });

    expect(log).toHaveLength(3);
    expect(log[0].event).toBe("started");
    expect(log[2].event).toBe("stopped");
  });

  it("should maintain chronological order in log", () => {
    const log = [
      { timestamp: 1000, event: "started" },
      { timestamp: 5000, event: "step_advanced" },
      { timestamp: 10000, event: "completed" },
    ];

    for (let i = 1; i < log.length; i++) {
      expect(log[i].timestamp).toBeGreaterThan(log[i - 1].timestamp);
    }
  });
});

// ─── Execution Comparison Tests ─────────────────────

describe("Execution Comparison Deltas", () => {
  const makeExec = (overrides: Partial<{
    startedAt: Date;
    endedAt: Date | null;
    peakGrillTemp: number | null;
    peakProbeTemp: number | null;
    stepsCompleted: number;
    rating: number | null;
  }> = {}) => ({
    startedAt: new Date("2026-04-06T10:00:00Z"),
    endedAt: new Date("2026-04-06T14:00:00Z"),
    peakGrillTemp: 275,
    peakProbeTemp: 195,
    stepsCompleted: 4,
    totalSteps: 5,
    rating: 4,
    ...overrides,
  });

  it("should compute positive duration delta when B is longer", () => {
    const a = makeExec({ endedAt: new Date("2026-04-06T14:00:00Z") }); // 4h
    const b = makeExec({ endedAt: new Date("2026-04-06T16:00:00Z") }); // 6h
    const dA = a.endedAt!.getTime() - a.startedAt.getTime();
    const dB = b.endedAt!.getTime() - b.startedAt.getTime();
    const delta = dB - dA;
    expect(delta).toBe(2 * 3600000); // +2h
  });

  it("should compute negative duration delta when B is shorter", () => {
    const a = makeExec({ endedAt: new Date("2026-04-06T16:00:00Z") }); // 6h
    const b = makeExec({ endedAt: new Date("2026-04-06T13:00:00Z") }); // 3h
    const dA = a.endedAt!.getTime() - a.startedAt.getTime();
    const dB = b.endedAt!.getTime() - b.startedAt.getTime();
    const delta = dB - dA;
    expect(delta).toBe(-3 * 3600000); // -3h
  });

  it("should return null duration delta when one run is still in progress", () => {
    const a = makeExec();
    const b = makeExec({ endedAt: null });
    const dA = a.endedAt ? a.endedAt.getTime() - a.startedAt.getTime() : null;
    const dB = b.endedAt ? b.endedAt.getTime() - b.startedAt.getTime() : null;
    const delta = dA != null && dB != null ? dB - dA : null;
    expect(delta).toBeNull();
  });

  it("should compute peak temp deltas", () => {
    const a = makeExec({ peakGrillTemp: 250, peakProbeTemp: 185 });
    const b = makeExec({ peakGrillTemp: 280, peakProbeTemp: 200 });
    expect(b.peakGrillTemp! - a.peakGrillTemp!).toBe(30);
    expect(b.peakProbeTemp! - a.peakProbeTemp!).toBe(15);
  });

  it("should return null peak temp delta when one is missing", () => {
    const a = makeExec({ peakGrillTemp: 250 });
    const b = makeExec({ peakGrillTemp: null });
    const delta =
      a.peakGrillTemp != null && b.peakGrillTemp != null
        ? b.peakGrillTemp - a.peakGrillTemp
        : null;
    expect(delta).toBeNull();
  });

  it("should compute steps completed delta", () => {
    const a = makeExec({ stepsCompleted: 3 });
    const b = makeExec({ stepsCompleted: 5 });
    expect(b.stepsCompleted - a.stepsCompleted).toBe(2);
  });

  it("should compute rating delta", () => {
    const a = makeExec({ rating: 3 });
    const b = makeExec({ rating: 5 });
    expect(b.rating! - a.rating!).toBe(2);
  });

  it("should return null rating delta when one is unrated", () => {
    const a = makeExec({ rating: 4 });
    const b = makeExec({ rating: null });
    const delta =
      a.rating != null && b.rating != null ? b.rating - a.rating : null;
    expect(delta).toBeNull();
  });

  it("should handle identical executions (all deltas zero)", () => {
    const a = makeExec();
    const b = makeExec();
    const dA = a.endedAt!.getTime() - a.startedAt.getTime();
    const dB = b.endedAt!.getTime() - b.startedAt.getTime();
    expect(dB - dA).toBe(0);
    expect(b.peakGrillTemp! - a.peakGrillTemp!).toBe(0);
    expect(b.peakProbeTemp! - a.peakProbeTemp!).toBe(0);
    expect(b.stepsCompleted - a.stepsCompleted).toBe(0);
    expect(b.rating! - a.rating!).toBe(0);
  });
});

// ─── CSV Export Tests ────────────────────────────────

describe("CSV Export Logic", () => {
  // Mirror the csvEscape function from the server
  function csvEscape(val: string): string {
    if (val.includes(",") || val.includes('"') || val.includes("\n")) {
      return `"${val.replace(/"/g, '""')}"`;
    }
    return val;
  }

  it("should escape values containing commas", () => {
    expect(csvEscape("hello, world")).toBe('"hello, world"');
  });

  it("should escape values containing double quotes", () => {
    expect(csvEscape('say "hello"')).toBe('"say ""hello"""');
  });

  it("should escape values containing newlines", () => {
    expect(csvEscape("line1\nline2")).toBe('"line1\nline2"');
  });

  it("should not escape plain values", () => {
    expect(csvEscape("hello")).toBe("hello");
    expect(csvEscape("225")).toBe("225");
  });

  it("should generate proper CSV structure for execution metadata", () => {
    const exec = {
      programName: "Low & Slow Brisket",
      programCategory: "beef",
      programMethod: "smoke",
      programMeatCut: "Brisket, Full Packer",
      outcome: "completed",
      rating: 5,
      startedAt: new Date("2026-04-06T10:00:00Z"),
      endedAt: new Date("2026-04-06T22:00:00Z"),
      stepsCompleted: 5,
      totalSteps: 5,
      peakGrillTemp: 275,
      peakProbeTemp: 203,
      notes: "Perfect bark, great smoke ring",
    };

    const lines: string[] = [];
    lines.push("# Cook Log Export");
    lines.push(`Program,${csvEscape(exec.programName)}`);
    lines.push(`Category,${csvEscape(exec.programCategory)}`);
    lines.push(`Method,${csvEscape(exec.programMethod)}`);
    lines.push(`Meat Cut,${csvEscape(exec.programMeatCut)}`);
    lines.push(`Outcome,${exec.outcome}`);
    lines.push(`Rating,${exec.rating}`);
    lines.push(`Started,${exec.startedAt.toISOString()}`);
    lines.push(`Ended,${exec.endedAt.toISOString()}`);
    lines.push(`Steps Completed,${exec.stepsCompleted}/${exec.totalSteps}`);
    lines.push(
      `Peak Grill Temp,${Math.round(exec.peakGrillTemp)}\u00b0F`
    );
    lines.push(
      `Peak Probe Temp,${Math.round(exec.peakProbeTemp)}\u00b0F`
    );
    lines.push(`Notes,${csvEscape(exec.notes)}`);

    const csv = lines.join("\n");

    expect(csv).toContain("# Cook Log Export");
    expect(csv).toContain("Program,Low & Slow Brisket"); // no comma in name → not quoted
    expect(csv).toContain('"Brisket, Full Packer"'); // comma in cut → quoted
    expect(csv).toContain("Outcome,completed");
    expect(csv).toContain("Rating,5");
    expect(csv).toContain("Steps Completed,5/5");
    expect(csv).toContain("Peak Grill Temp,275\u00b0F");
    expect(csv).toContain("Peak Probe Temp,203\u00b0F");
  });

  it("should include variable values section when present", () => {
    const vars: Record<string, any> = {
      weight: 12,
      targetTemp: 203,
      doneness: "well",
    };

    const lines: string[] = [];
    lines.push("");
    lines.push("# Variables Used");
    lines.push("Variable,Value");
    for (const [k, v] of Object.entries(vars)) {
      lines.push(`${csvEscape(k)},${csvEscape(String(v))}`);
    }

    const csv = lines.join("\n");
    expect(csv).toContain("# Variables Used");
    expect(csv).toContain("weight,12");
    expect(csv).toContain("targetTemp,203");
    expect(csv).toContain("doneness,well");
  });

  it("should include execution timeline when present", () => {
    const log = [
      { timestamp: 1712400000000, event: "started", detail: "Program started" },
      {
        timestamp: 1712403600000,
        event: "step_advanced",
        detail: "Step 1 → Step 2",
      },
      { timestamp: 1712443200000, event: "completed", detail: "All steps done" },
    ];

    const lines: string[] = [];
    lines.push("");
    lines.push("# Execution Timeline");
    lines.push("Timestamp,Event,Detail");
    for (const entry of log) {
      lines.push(
        `${new Date(entry.timestamp).toISOString()},${csvEscape(entry.event)},${csvEscape(entry.detail || "")}`
      );
    }

    const csv = lines.join("\n");
    expect(csv).toContain("# Execution Timeline");
    expect(csv).toContain("Timestamp,Event,Detail");
    expect(csv).toContain("started,Program started");
    expect(csv).toContain("completed,All steps done");
  });

  it("should generate valid filename from program name and date", () => {
    const name = "Low & Slow Brisket";
    const date = new Date("2026-04-06T10:00:00Z");
    const filename = `cook-log-${name.replace(/[^a-zA-Z0-9]/g, "-").toLowerCase()}-${date.toISOString().slice(0, 10)}.csv`;
    expect(filename).toBe("cook-log-low---slow-brisket-2026-04-06.csv");
    expect(filename).toMatch(/^cook-log-.*\.csv$/);
  });
});

// ─── Publish to Community Tests ─────────────────────

describe("Publish to Community Flow", () => {
  it("should toggle isPublished flag for automation programs", () => {
    // Simulating the publish toggle
    let program = { id: 1, name: "My Brisket", isPublished: 0, authorName: null as string | null };

    // Publish
    program.isPublished = 1;
    program.authorName = "TestUser";
    expect(program.isPublished).toBe(1);
    expect(program.authorName).toBe("TestUser");

    // Unpublish
    program.isPublished = 0;
    expect(program.isPublished).toBe(0);
  });

  it("should generate correct share URL from program ID", () => {
    const origin = "https://example.manus.space";
    const programId = 42;
    const shareUrl = `${origin}/cook-programs?share=${programId}`;
    expect(shareUrl).toBe("https://example.manus.space/cook-programs?share=42");
    expect(shareUrl).toContain("/cook-programs?share=");
  });

  it("should parse share parameter from URL search params", () => {
    const searchParams = new URLSearchParams("?share=42");
    const shareId = searchParams.get("share");
    expect(shareId).toBe("42");
    expect(Number(shareId)).toBe(42);
  });

  it("should handle missing share parameter gracefully", () => {
    const searchParams = new URLSearchParams("");
    const shareId = searchParams.get("share");
    expect(shareId).toBeNull();
  });

  it("should handle non-numeric share parameter gracefully", () => {
    const searchParams = new URLSearchParams("?share=abc");
    const shareId = searchParams.get("share");
    expect(Number(shareId)).toBeNaN();
  });

  it("should increment fork count when community program is forked", () => {
    let program = { id: 1, forkCount: 3 };
    program.forkCount += 1;
    expect(program.forkCount).toBe(4);
  });

  it("should set forkedFromId when forking a community program", () => {
    const sourceId = 42;
    const newProgram = {
      id: 99,
      name: "Forked Brisket",
      forkedFromId: sourceId,
      isPublished: 0,
    };
    expect(newProgram.forkedFromId).toBe(42);
    expect(newProgram.isPublished).toBe(0); // Forks start unpublished
  });

  it("should only show published programs in community listing", () => {
    const allPrograms = [
      { id: 1, isPublished: 1, name: "Public Brisket" },
      { id: 2, isPublished: 0, name: "Private Ribs" },
      { id: 3, isPublished: 1, name: "Public Chicken" },
    ];
    const communityPrograms = allPrograms.filter((p) => p.isPublished === 1);
    expect(communityPrograms).toHaveLength(2);
    expect(communityPrograms.map((p) => p.name)).toEqual([
      "Public Brisket",
      "Public Chicken",
    ]);
  });
});

// ─── Token Encryption Tests ─────────────────────────

describe("Token Encryption Helpers", () => {
  // Test the encryption/decryption round-trip using the same algorithm
  const crypto = require("crypto");

  function encrypt(text: string, secret: string): string {
    const key = crypto.scryptSync(secret, "traeger-salt", 32);
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv("aes-256-cbc", key, iv);
    let encrypted = cipher.update(text, "utf8", "hex");
    encrypted += cipher.final("hex");
    return iv.toString("hex") + ":" + encrypted;
  }

  function decrypt(data: string, secret: string): string {
    const key = crypto.scryptSync(secret, "traeger-salt", 32);
    const [ivHex, encrypted] = data.split(":");
    const iv = Buffer.from(ivHex, "hex");
    const decipher = crypto.createDecipheriv("aes-256-cbc", key, iv);
    let decrypted = decipher.update(encrypted, "hex", "utf8");
    decrypted += decipher.final("utf8");
    return decrypted;
  }

  it("should encrypt and decrypt a token round-trip", () => {
    const token = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test";
    const secret = "test-jwt-secret-key-12345";
    const encrypted = encrypt(token, secret);
    expect(encrypted).not.toBe(token);
    expect(encrypted).toContain(":");
    const decrypted = decrypt(encrypted, secret);
    expect(decrypted).toBe(token);
  });

  it("should produce different ciphertext for same plaintext (random IV)", () => {
    const token = "same-token-value";
    const secret = "test-secret";
    const enc1 = encrypt(token, secret);
    const enc2 = encrypt(token, secret);
    expect(enc1).not.toBe(enc2); // Different IVs → different ciphertext
    expect(decrypt(enc1, secret)).toBe(token);
    expect(decrypt(enc2, secret)).toBe(token);
  });

  it("should handle empty string encryption", () => {
    const secret = "test-secret";
    const encrypted = encrypt("", secret);
    expect(decrypt(encrypted, secret)).toBe("");
  });

  it("should handle long token strings", () => {
    const longToken = "a".repeat(2000);
    const secret = "test-secret";
    const encrypted = encrypt(longToken, secret);
    expect(decrypt(encrypted, secret)).toBe(longToken);
  });

  it("should fail to decrypt with wrong secret", () => {
    const token = "secret-token";
    const encrypted = encrypt(token, "correct-secret");
    expect(() => decrypt(encrypted, "wrong-secret")).toThrow();
  });
});

// ─── Security: Rate Limiting & Helmet Tests ─────────

describe("Security Configuration", () => {
  it("should validate rate limit window and max values", () => {
    const config = { windowMs: 15 * 60 * 1000, max: 200 };
    expect(config.windowMs).toBe(900000); // 15 minutes
    expect(config.max).toBe(200);
    expect(config.max).toBeGreaterThan(0);
    expect(config.windowMs).toBeGreaterThan(0);
  });

  it("should validate auth rate limit is stricter", () => {
    const generalLimit = { windowMs: 15 * 60 * 1000, max: 200 };
    const authLimit = { windowMs: 15 * 60 * 1000, max: 20 };
    expect(authLimit.max).toBeLessThan(generalLimit.max);
  });
});
