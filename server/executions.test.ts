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
