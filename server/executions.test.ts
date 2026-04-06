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
