/**
 * Shared utility functions for Cook Programs components.
 * Extracted from CookPrograms.tsx for maintainability.
 */

export function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.round(seconds / 60)}min`;
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.round((seconds % 3600) / 60);
  return mins > 0 ? `${hrs}h ${mins}m` : `${hrs}h`;
}

export function triggerLabel(type: string, value?: number | string): string {
  const v = value != null ? String(value) : "?";
  switch (type) {
    case "probe_temp": return `Probe → ${v}°F`;
    case "probe_temp_drop": return `Probe ↓ ${v}°F`;
    case "grill_temp": return `Grill → ${v}°F`;
    case "grill_temp_drop": return `Grill ↓ ${v}°F`;
    case "timer": return `Timer: ${formatDuration(Number(v) || 0)}`;
    case "pellet_low": return `Pellets < ${v}%`;
    case "manual": return "Manual advance";
    case "immediate": return "Immediate";
    default: return type;
  }
}

export function logicLabel(logic?: string): string {
  switch (logic) {
    case "or": return "OR";
    case "and": return "AND";
    case "fallback": return "fallback";
    case "priority": return "priority";
    default: return "";
  }
}

export function logicDescription(logic?: string): string {
  switch (logic) {
    case "or": return "Whichever fires first";
    case "and": return "Both must be met";
    case "fallback": return "Safety net if primary stalls";
    case "priority": return "Primary takes precedence";
    default: return "";
  }
}

export function difficultyColor(d: string) {
  switch (d) {
    case "beginner": return "bg-green-500/20 text-green-400 border-green-500/30";
    case "intermediate": return "bg-amber-500/20 text-amber-400 border-amber-500/30";
    case "advanced": return "bg-red-500/20 text-red-400 border-red-500/30";
    default: return "bg-muted text-muted-foreground";
  }
}

export function methodColor(method: string) {
  const colors: Record<string, string> = {
    smoke: "bg-purple-500/20 text-purple-400 border-purple-500/30",
    grill: "bg-primary/20 text-primary border-primary/30",
    reverse_sear: "bg-red-500/20 text-red-400 border-red-500/30",
    roast: "bg-amber-500/20 text-amber-400 border-amber-500/30",
    bake: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  };
  return colors[method] || "";
}

export function methodLabel(method: string) {
  const labels: Record<string, string> = {
    smoke: "Smoke",
    grill: "Grill",
    reverse_sear: "Reverse Sear",
    roast: "Roast",
    bake: "Bake",
  };
  return labels[method] || method;
}

/** Format a date for display in execution history */
export function formatDate(date: string | Date | null): string {
  if (!date) return "—";
  const d = new Date(date);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

/** Format duration from two timestamps in ms */
export function formatDurationMs(start: string | Date, end: string | Date | null): string {
  if (!end) return "ongoing";
  const ms = new Date(end).getTime() - new Date(start).getTime();
  if (ms < 0) return "—";
  const mins = Math.floor(ms / 60000);
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  const remMins = mins % 60;
  return remMins > 0 ? `${hrs}h ${remMins}m` : `${hrs}h`;
}

/** Format a raw ms duration value */
export function formatDurationFromMs(ms: number | null): string {
  if (ms == null || ms < 0) return "—";
  const mins = Math.floor(ms / 60000);
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  const remMins = mins % 60;
  return remMins > 0 ? `${hrs}h ${remMins}m` : `${hrs}h`;
}

/** Outcome badge color classes */
export function outcomeBadge(outcome: string) {
  switch (outcome) {
    case "completed": return "border-green-500/50 text-green-400";
    case "aborted": return "border-red-500/50 text-red-400";
    case "running": return "border-blue-500/50 text-blue-400";
    default: return "border-muted-foreground/50 text-muted-foreground";
  }
}

/** Unified program type used across all Cook Programs tabs */
export interface UnifiedProgram {
  program: import("@shared/cook-programs").CookProgram;
  id: string;
  source: "preset" | "guide" | "custom" | "community" | "saved";
  authorName?: string;
  customId?: number;
  isPublished?: boolean;
  forkCount?: number;
  // For saved programs from DB
  dbId?: number;
  dbStatus?: string;
  isActive?: boolean;
}
