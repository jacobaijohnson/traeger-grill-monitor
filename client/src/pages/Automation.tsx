import { trpc } from "@/lib/trpc";
import { useTraegerStatus } from "@/hooks/useTraeger";
import { useSSETelemetry } from "@/hooks/useSSETelemetry";
import { useIsMobile } from "@/hooks/useMobile";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Workflow,
  Play,
  Square,
  Trash2,
  Copy,
  WifiOff,
  ChevronRight,
  ChevronDown,
  Flame,
  Timer,
  Thermometer,
  Bell,
  BellRing,
  AlertTriangle,
  SkipForward,
  CheckCircle2,
  BookOpen,
  Beef,
  ChefHat,
  Eye,
  Zap,
  Hand,
  ArrowDown,
  Shield,
  HelpCircle,
  Info,
} from "lucide-react";
import { useState, useMemo, useCallback, useEffect } from "react";
import { useLocation } from "wouter";
import { toast } from "sonner";
import type { CookProgram, ProgramStep, ProgramVariable, StepTrigger } from "@shared/cook-programs";

// ─── Helpers ──────────────────────────────────────────

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.round(seconds / 60)}min`;
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.round((seconds % 3600) / 60);
  return mins > 0 ? `${hrs}h ${mins}m` : `${hrs}h`;
}

function triggerLabel(type: string, value?: number | string): string {
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

function triggerIcon(type: string) {
  switch (type) {
    case "probe_temp":
    case "probe_temp_drop": return <Thermometer className="h-3.5 w-3.5" />;
    case "grill_temp":
    case "grill_temp_drop": return <Flame className="h-3.5 w-3.5" />;
    case "timer": return <Timer className="h-3.5 w-3.5" />;
    case "manual": return <Hand className="h-3.5 w-3.5" />;
    default: return <Zap className="h-3.5 w-3.5" />;
  }
}

function logicLabel(logic?: string): string {
  switch (logic) {
    case "or": return "OR";
    case "and": return "AND";
    case "fallback": return "fallback";
    case "priority": return "priority";
    default: return "";
  }
}

function logicDescription(logic?: string): string {
  switch (logic) {
    case "or": return "Whichever fires first";
    case "and": return "Both must be met";
    case "fallback": return "Safety net if primary stalls";
    case "priority": return "Primary takes precedence";
    default: return "";
  }
}

function difficultyColor(d: string) {
  switch (d) {
    case "beginner": return "bg-green-500/20 text-green-400 border-green-500/30";
    case "intermediate": return "bg-amber-500/20 text-amber-400 border-amber-500/30";
    case "advanced": return "bg-red-500/20 text-red-400 border-red-500/30";
    default: return "bg-muted text-muted-foreground";
  }
}

// ─── First-Use Hints ──────────────────────────────────

function useFirstUseHint(key: string): [boolean, () => void] {
  const storageKey = `traeger_hint_${key}`;
  const [dismissed, setDismissed] = useState(() => {
    try { return localStorage.getItem(storageKey) === "1"; } catch { return false; }
  });
  const dismiss = useCallback(() => {
    setDismissed(true);
    try { localStorage.setItem(storageKey, "1"); } catch { /* noop */ }
  }, [storageKey]);
  return [!dismissed, dismiss];
}

// ─── Compound Trigger Display ─────────────────────────

function TriggerDisplay({ trigger, compact = false }: { trigger: StepTrigger; compact?: boolean }) {
  const hasSec = !!trigger.secondary;

  if (compact) {
    return (
      <div className="flex items-center gap-1.5 text-xs font-mono">
        <span className="flex items-center gap-1 text-primary/80">
          {triggerIcon(trigger.type)}
          {triggerLabel(trigger.type, trigger.value)}
        </span>
        {hasSec && (
          <>
            <Badge variant="outline" className="text-[9px] px-1 py-0 font-mono uppercase">
              {logicLabel(trigger.logic)}
            </Badge>
            <span className="flex items-center gap-1 text-muted-foreground">
              {triggerIcon(trigger.secondary!.type)}
              {triggerLabel(trigger.secondary!.type, trigger.secondary!.value)}
            </span>
          </>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      {/* Primary trigger */}
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1.5 text-sm text-primary/90">
          {triggerIcon(trigger.type)}
          <span className="font-mono">{triggerLabel(trigger.type, trigger.value)}</span>
        </div>
        {!hasSec && <Badge variant="outline" className="text-[9px] font-mono">primary</Badge>}
      </div>
      {/* Secondary trigger */}
      {hasSec && (
        <div className="flex items-center gap-2 pl-1">
          <Badge
            variant="outline"
            className="text-[9px] px-1.5 py-0 font-mono uppercase shrink-0"
            title={logicDescription(trigger.logic)}
          >
            {logicLabel(trigger.logic)}
          </Badge>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            {triggerIcon(trigger.secondary!.type)}
            <span className="font-mono">{triggerLabel(trigger.secondary!.type, trigger.secondary!.value)}</span>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Alert/Alarm Badge ────────────────────────────────

function AlertBadge({ step }: { step: ProgramStep }) {
  if (!step.alertOnTrigger) {
    // Check actions for alarm types
    const hasAlarm = step.actions.some(a => a.type === "sound_alarm" || a.type === "escalating_alarm");
    const hasNotify = step.actions.some(a => a.type === "send_notification");
    if (!hasAlarm && !hasNotify) return null;
    if (hasAlarm) {
      const esc = step.actions.find(a => a.type === "escalating_alarm");
      return (
        <Badge className="bg-red-500/20 text-red-400 border-red-500/30 text-[10px] font-mono gap-1">
          <BellRing className="h-2.5 w-2.5" />
          {esc ? `Alarm +${esc.params?.intervalDegrees ?? 5}°F` : "Alarm"}
        </Badge>
      );
    }
    return (
      <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30 text-[10px] font-mono gap-1">
        <Bell className="h-2.5 w-2.5" />
        Notify
      </Badge>
    );
  }

  const { type, escalating } = step.alertOnTrigger;
  if (type === "alarm") {
    return (
      <Badge className="bg-red-500/20 text-red-400 border-red-500/30 text-[10px] font-mono gap-1">
        <BellRing className="h-2.5 w-2.5" />
        {escalating ? `Alarm +${escalating.intervalDegrees}°F` : "Alarm"}
      </Badge>
    );
  }
  return (
    <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30 text-[10px] font-mono gap-1">
      <Bell className="h-2.5 w-2.5" />
      Notify
    </Badge>
  );
}

// ─── Step Preview (Expandable) ────────────────────────

function StepCard({ step, index, defaultOpen = false }: { step: ProgramStep; index: number; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);

  // Entry actions summary
  const grillTemp = step.entryActions?.find(a => a.type === "set_grill_temp")?.params?.temp;
  const superSmoke = step.entryActions?.some(a => a.type === "super_smoke_on");
  const keepWarm = step.entryActions?.some(a => a.type === "keep_warm_on");
  const hasAutoActions = step.actions.some(a =>
    ["set_grill_temp", "shutdown", "keep_warm_on", "super_smoke_on", "super_smoke_off"].includes(a.type)
  );

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <div className="rounded-lg border border-border bg-card/50 overflow-hidden">
        {/* Layer 1: Glance — always visible */}
        <CollapsibleTrigger asChild>
          <button className="w-full flex items-start gap-3 p-3 sm:p-4 text-left hover:bg-accent/30 transition-colors min-h-[52px]">
            {/* Step number */}
            <div className="w-7 h-7 rounded-full bg-primary/20 text-primary flex items-center justify-center text-xs font-bold font-mono shrink-0 mt-0.5">
              {index + 1}
            </div>
            {/* Content */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-semibold text-foreground text-sm">{step.name}</span>
                <AlertBadge step={step} />
                {hasAutoActions && (
                  <Badge className="bg-blue-500/10 text-blue-400 border-blue-500/20 text-[10px] font-mono gap-0.5">
                    <Zap className="h-2.5 w-2.5" />
                    Auto
                  </Badge>
                )}
              </div>
              {/* Compact trigger + grill temp on same line */}
              <div className="flex items-center gap-3 mt-1 flex-wrap">
                {grillTemp && (
                  <span className="flex items-center gap-1 text-xs font-mono text-orange-400">
                    <Flame className="h-3 w-3" />
                    {String(grillTemp)}°F
                  </span>
                )}
                {superSmoke && (
                  <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30 text-[9px] font-mono">S.Smoke</Badge>
                )}
                <TriggerDisplay trigger={step.trigger} compact />
              </div>
            </div>
            {/* Expand chevron */}
            <div className="shrink-0 mt-1">
              {open ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
            </div>
          </button>
        </CollapsibleTrigger>

        {/* Layer 2: Tap — expanded detail */}
        <CollapsibleContent>
          <div className="px-3 sm:px-4 pb-3 sm:pb-4 pt-0 space-y-3 border-t border-border/50">
            {/* Description */}
            {step.description && (
              <p className="text-xs text-muted-foreground mt-2">{step.description}</p>
            )}

            {/* Full trigger detail */}
            <div className="bg-secondary/30 rounded-md p-2.5">
              <div className="text-[10px] text-muted-foreground/60 font-mono uppercase tracking-wider mb-1.5">Trigger</div>
              <TriggerDisplay trigger={step.trigger} />
            </div>

            {/* Entry actions */}
            {step.entryActions && step.entryActions.length > 0 && (
              <div>
                <div className="text-[10px] text-muted-foreground/60 font-mono uppercase tracking-wider mb-1">On Entry</div>
                <div className="flex flex-wrap gap-1.5">
                  {step.entryActions.map((a, j) => (
                    <Badge key={j} variant="outline" className="text-[10px] font-mono gap-1">
                      {a.type === "set_grill_temp" && <><Flame className="h-2.5 w-2.5 text-orange-400" />{String(a.params?.temp)}°F</>}
                      {a.type === "super_smoke_on" && "Super Smoke On"}
                      {a.type === "super_smoke_off" && "Super Smoke Off"}
                      {a.type === "keep_warm_on" && "Keep Warm On"}
                      {a.type === "keep_warm_off" && "Keep Warm Off"}
                      {a.type === "set_timer" && <><Timer className="h-2.5 w-2.5" />{formatDuration(Number(a.params?.seconds ?? 0))}</>}
                      {!["set_grill_temp", "super_smoke_on", "super_smoke_off", "keep_warm_on", "keep_warm_off", "set_timer"].includes(a.type) && a.type}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Actions on trigger */}
            {step.actions.length > 0 && (
              <div>
                <div className="text-[10px] text-muted-foreground/60 font-mono uppercase tracking-wider mb-1">On Trigger</div>
                <div className="flex flex-wrap gap-1.5">
                  {step.actions.map((a, j) => (
                    <Badge key={j} variant="outline" className="text-[10px] font-mono gap-1">
                      {a.type === "set_grill_temp" && <><Flame className="h-2.5 w-2.5 text-orange-400" />→ {String(a.params?.temp)}°F</>}
                      {a.type === "sound_alarm" && <><BellRing className="h-2.5 w-2.5 text-red-400" />Alarm</>}
                      {a.type === "escalating_alarm" && <><BellRing className="h-2.5 w-2.5 text-red-400" />Alarm +{String(a.params?.intervalDegrees ?? 5)}°F</>}
                      {a.type === "send_notification" && <><Bell className="h-2.5 w-2.5 text-blue-400" />Notify</>}
                      {a.type === "wait_for_ack" && <><Hand className="h-2.5 w-2.5" />Wait for ack</>}
                      {a.type === "shutdown" && <><Square className="h-2.5 w-2.5 text-red-400" />Shutdown</>}
                      {a.type === "keep_warm_on" && "Keep Warm"}
                      {a.type === "end_session" && "End Session"}
                      {a.type === "log_event" && "Log"}
                      {!["set_grill_temp", "sound_alarm", "escalating_alarm", "send_notification", "wait_for_ack", "shutdown", "keep_warm_on", "end_session", "log_event"].includes(a.type) && a.type}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Alert detail */}
            {step.alertOnTrigger && (
              <div className="bg-secondary/30 rounded-md p-2.5">
                <div className="text-[10px] text-muted-foreground/60 font-mono uppercase tracking-wider mb-1">Alert Configuration</div>
                <div className="flex items-center gap-2 text-xs">
                  {step.alertOnTrigger.type === "alarm" ? (
                    <BellRing className="h-3.5 w-3.5 text-red-400" />
                  ) : (
                    <Bell className="h-3.5 w-3.5 text-blue-400" />
                  )}
                  <span className="text-foreground font-mono">
                    {step.alertOnTrigger.type === "alarm" ? "Persistent alarm" : "Notification"}: {step.alertOnTrigger.message}
                  </span>
                </div>
                {step.alertOnTrigger.escalating && (
                  <div className="flex items-center gap-2 text-xs mt-1 text-amber-400">
                    <ArrowDown className="h-3 w-3 rotate-180" />
                    <span className="font-mono">
                      Re-alarms every {step.alertOnTrigger.escalating.intervalDegrees}°F
                      {step.alertOnTrigger.escalating.maxTemp && ` up to ${step.alertOnTrigger.escalating.maxTemp}°F`}
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}

function StepPreview({ steps }: { steps: ProgramStep[] }) {
  return (
    <div className="space-y-2">
      <h4 className="text-xs text-muted-foreground font-mono uppercase tracking-wider">
        Program Steps ({steps.length})
      </h4>
      {steps.map((step, i) => (
        <StepCard key={i} step={step} index={i} />
      ))}
    </div>
  );
}

// ─── Variable Configuration ───────────────────────────

function VariableConfig({
  variables,
  values,
  onChange,
}: {
  variables: ProgramVariable[];
  values: Record<string, string | number>;
  onChange: (values: Record<string, string | number>) => void;
}) {
  return (
    <div className="space-y-3">
      <h4 className="text-xs text-muted-foreground font-mono uppercase tracking-wider">Configure Variables</h4>
      {variables.map((v) => (
        <div key={v.name}>
          <Label className="text-xs text-muted-foreground font-mono">{v.label}</Label>
          {v.description && <p className="text-[10px] text-muted-foreground/60 mt-0.5">{v.description}</p>}
          {v.options ? (
            <div className="flex flex-wrap gap-2 mt-1.5">
              {v.options.map((opt) => (
                <Button
                  key={opt}
                  variant={(values[v.name] ?? v.default) === opt ? "default" : "outline"}
                  size="sm"
                  onClick={() => onChange({ ...values, [v.name]: opt })}
                  className="font-mono text-xs capitalize min-h-[40px]"
                >
                  {opt}
                </Button>
              ))}
            </div>
          ) : (
            <div className="flex items-center gap-2 mt-1.5">
              <Input
                type={v.type === "number" ? "number" : "text"}
                value={values[v.name] ?? v.default ?? ""}
                onChange={(e) => onChange({
                  ...values,
                  [v.name]: v.type === "number" ? Number(e.target.value) || 0 : e.target.value,
                })}
                min={v.min}
                max={v.max}
                className="bg-secondary text-foreground text-sm font-mono min-h-[40px]"
              />
              {v.unit && <span className="text-xs text-muted-foreground/60 font-mono shrink-0">{v.unit}</span>}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ─── Preset Library Browser ───────────────────────────

function PresetLibrary({
  onSelect,
}: {
  onSelect: (preset: CookProgram & { id: string }, index: number) => void;
}) {
  const { data: presets } = trpc.automation.presets.useQuery();
  const [filter, setFilter] = useState<string>("all");
  const isMobile = useIsMobile();

  const categories = useMemo(() => {
    if (!presets) return [];
    const cats = new Set(presets.map((p: any) => p.category));
    return ["all", ...Array.from(cats)];
  }, [presets]);

  const filtered = useMemo(() => {
    if (!presets) return [];
    if (filter === "all") return presets;
    return presets.filter((p: any) => p.category === filter);
  }, [presets, filter]);

  return (
    <div className="space-y-4">
      {/* Category filter — horizontal scroll on mobile */}
      <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-none">
        {categories.map((cat) => (
          <Button
            key={cat}
            variant={filter === cat ? "default" : "outline"}
            size="sm"
            onClick={() => setFilter(cat)}
            className="font-mono text-xs capitalize shrink-0 min-h-[40px]"
          >
            {cat}
          </Button>
        ))}
      </div>

      {/* Preset cards — single column on mobile, 2-col on desktop */}
      <div className={`grid gap-3 ${isMobile ? "grid-cols-1" : "grid-cols-1 md:grid-cols-2"}`}>
        {filtered.map((preset: any, i: number) => (
          <Card
            key={preset.id}
            className="bg-card border-border hover:border-primary/50 transition-colors cursor-pointer active:scale-[0.98]"
            onClick={() => onSelect(preset, i)}
          >
            <CardContent className="p-4">
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <h3 className="font-semibold text-foreground text-sm">{preset.name}</h3>
                    <Badge className={`${difficultyColor(preset.difficulty)} font-mono text-[10px] shrink-0`}>
                      {preset.difficulty}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground line-clamp-2">{preset.description}</p>
                  <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground font-mono flex-wrap">
                    {preset.estimatedTime && <span className="flex items-center gap-1"><Timer className="h-3 w-3" />{preset.estimatedTime}</span>}
                    {preset.method && <span className="capitalize">{preset.method}</span>}
                    <span>{preset.steps?.length || 0} steps</span>
                    {/* Show compound trigger indicator */}
                    {preset.steps?.some((s: ProgramStep) => s.trigger.secondary) && (
                      <span className="flex items-center gap-0.5 text-primary/60">
                        <Shield className="h-3 w-3" />
                        fallbacks
                      </span>
                    )}
                  </div>
                </div>
                <ChevronRight className="h-5 w-5 text-muted-foreground shrink-0 ml-2 mt-1" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-8 text-muted-foreground text-sm font-mono">
          No presets in this category.
        </div>
      )}
    </div>
  );
}

// ─── Live Execution Display (Mobile-First Hero) ──────

function LiveExecution({
  programId,
  program,
  viewers,
}: {
  programId: number;
  program: any;
  viewers?: number;
}) {
  const { data: liveState, refetch: refetchLive } = trpc.automation.getLiveState.useQuery(
    { grillId: undefined },
    { refetchInterval: 2000 }
  );
  const { telemetry: sseTelemetry } = useSSETelemetry({ enabled: true });
  const acknowledge = trpc.automation.acknowledge.useMutation({
    onSuccess: () => {
      refetchLive();
      toast.success("Alarm acknowledged");
    },
  });
  const skip = trpc.automation.skip.useMutation({
    onSuccess: () => {
      refetchLive();
      toast.info("Skipped to next phase");
    },
  });
  const isMobile = useIsMobile();
  const [showAllPhases, setShowAllPhases] = useState(false);

  if (!liveState?.active) return null;

  const steps: ProgramStep[] = program?.programJson?.steps || program?.steps || [];
  const currentStep = steps[liveState.phase];
  const needsAck = liveState.phaseAcknowledged === false;

  // Get live temps from SSE for real-time display
  const probeTemp = sseTelemetry?.telemetry?.probe ?? 0;
  const grillTemp = sseTelemetry?.telemetry?.grill ?? 0;
  const targetTemp = currentStep?.trigger.type === "probe_temp"
    ? Number(currentStep.trigger.value ?? 0)
    : 0;
  const tempProgress = targetTemp > 0 ? Math.min(100, (probeTemp / targetTemp) * 100) : 0;
  const isApproaching = targetTemp > 0 && probeTemp >= targetTemp - 10 && probeTemp < targetTemp;
  const isReached = targetTemp > 0 && probeTemp >= targetTemp;

  return (
    <Card className={`border-2 transition-colors ${needsAck ? "border-red-500/70 bg-red-950/10" : "border-primary/50 bg-card"}`}>
      <CardContent className="p-4 sm:p-6">
        {/* Layer 1: Glance — Status + Temps + Phase */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className={`w-2.5 h-2.5 rounded-full ${needsAck ? "bg-red-500 animate-pulse" : "bg-green-500 animate-pulse"}`} />
            <span className={`text-xs font-mono uppercase tracking-wider ${needsAck ? "text-red-400" : "text-green-400"}`}>
              {needsAck ? "Action Required" : "Live"}
            </span>
          </div>
          <div className="flex items-center gap-2">
            {(viewers ?? 0) > 1 && (
              <span className="flex items-center gap-1 text-xs text-muted-foreground font-mono">
                <Eye className="h-3 w-3" />
                {viewers}
              </span>
            )}
            <span className="text-xs text-muted-foreground font-mono">
              Phase {liveState.phase + 1}/{liveState.totalPhases}
            </span>
          </div>
        </div>

        {/* Big temp display — the hero of the glance */}
        {targetTemp > 0 && (
          <div className="mb-4">
            <div className="flex items-end justify-between mb-2">
              <div>
                <div className="text-[10px] text-muted-foreground/60 font-mono uppercase">Probe</div>
                <div className={`text-4xl sm:text-5xl font-bold font-mono tabular-nums ${
                  isReached ? "text-green-400" : isApproaching ? "text-amber-400" : "text-foreground"
                }`}>
                  {probeTemp}°
                </div>
              </div>
              <div className="text-right">
                <div className="text-[10px] text-muted-foreground/60 font-mono uppercase">Target</div>
                <div className="text-2xl sm:text-3xl font-bold font-mono tabular-nums text-primary/60">
                  {targetTemp}°
                </div>
              </div>
            </div>
            {/* Progress bar */}
            <div className="h-2 bg-secondary rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-1000 ${
                  isReached ? "bg-green-500" : isApproaching ? "bg-amber-500" : "bg-primary"
                }`}
                style={{ width: `${tempProgress}%` }}
              />
            </div>
          </div>
        )}

        {/* Phase stepper — horizontal */}
        <div className="flex gap-1 mb-4">
          {Array.from({ length: liveState.totalPhases }).map((_, i) => (
            <div
              key={i}
              className={`h-1.5 flex-1 rounded-full transition-colors ${
                i < liveState.phase
                  ? "bg-green-500"
                  : i === liveState.phase
                  ? needsAck ? "bg-red-500 animate-pulse" : "bg-primary animate-pulse"
                  : "bg-muted"
              }`}
              title={steps[i]?.name ?? `Phase ${i + 1}`}
            />
          ))}
        </div>

        {/* Current phase info */}
        {currentStep && (
          <div className={`rounded-lg p-3 mb-3 ${needsAck ? "bg-red-500/10 border border-red-500/30" : "bg-secondary/50"}`}>
            <div className="flex items-center gap-2 mb-1">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold font-mono ${
                needsAck ? "bg-red-500/20 text-red-400" : "bg-primary/20 text-primary"
              }`}>
                {liveState.phase + 1}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-foreground text-sm">{liveState.currentPhaseName || currentStep.name}</div>
                <TriggerDisplay trigger={currentStep.trigger} compact />
              </div>
              <AlertBadge step={currentStep} />
            </div>
          </div>
        )}

        {/* Auto commands log */}
        {liveState.autoCommandsSent.length > 0 && (
          <div className="text-xs text-muted-foreground font-mono mb-3 space-y-1">
            {liveState.autoCommandsSent.slice(-3).map((cmd: string, i: number) => (
              <div key={i} className="flex items-center gap-1.5">
                <CheckCircle2 className="h-3 w-3 text-blue-400" />
                <span>{cmd}</span>
              </div>
            ))}
          </div>
        )}

        {/* Action buttons — big touch targets */}
        <div className={`flex gap-2 ${isMobile ? "flex-col" : "flex-row"}`}>
          {needsAck && (
            <Button
              size={isMobile ? "lg" : "default"}
              className="bg-red-500 hover:bg-red-600 text-white font-mono text-sm animate-pulse flex-1 min-h-[48px]"
              onClick={() => acknowledge.mutate({ grillId: undefined })}
            >
              <BellRing className="h-4 w-4 mr-2" />
              Acknowledge Alarm
            </Button>
          )}
          <Button
            variant="outline"
            size={isMobile ? "lg" : "default"}
            className="font-mono text-sm min-h-[48px]"
            onClick={() => skip.mutate({ grillId: undefined })}
          >
            <SkipForward className="h-4 w-4 mr-2" />
            Skip Phase
          </Button>
        </div>

        {/* Layer 2: Tap — All phases (expandable) */}
        <Collapsible open={showAllPhases} onOpenChange={setShowAllPhases}>
          <CollapsibleTrigger asChild>
            <button className="w-full flex items-center justify-center gap-1.5 mt-3 pt-3 border-t border-border/50 text-xs text-muted-foreground hover:text-foreground transition-colors min-h-[36px]">
              {showAllPhases ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
              <span className="font-mono">{showAllPhases ? "Hide all phases" : "View all phases"}</span>
            </button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="space-y-2 mt-2">
              {steps.map((step, i) => (
                <div
                  key={i}
                  className={`flex items-center gap-2 p-2 rounded text-xs ${
                    i < liveState.phase
                      ? "bg-green-500/5 text-green-400/60"
                      : i === liveState.phase
                      ? "bg-primary/10 text-foreground border border-primary/30"
                      : "bg-secondary/30 text-muted-foreground"
                  }`}
                >
                  <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold font-mono ${
                    i < liveState.phase ? "bg-green-500/20" : i === liveState.phase ? "bg-primary/20" : "bg-muted"
                  }`}>
                    {i < liveState.phase ? <CheckCircle2 className="h-3 w-3" /> : i + 1}
                  </div>
                  <span className="font-mono flex-1 truncate">{step.name}</span>
                  <TriggerDisplay trigger={step.trigger} compact />
                </div>
              ))}
            </div>
          </CollapsibleContent>
        </Collapsible>
      </CardContent>
    </Card>
  );
}

// ─── Main Automation Page ─────────────────────────────

export default function Automation() {
  const [, setLocation] = useLocation();
  const { data: status } = useTraegerStatus();
  const { data: programs, refetch } = trpc.automation.list.useQuery(undefined, {
    enabled: !!status?.connected,
  });
  const { telemetry: sseTelemetry } = useSSETelemetry({ enabled: !!status?.connected });
  const isMobile = useIsMobile();

  const createFromPreset = trpc.automation.createFromPreset.useMutation({
    onSuccess: () => {
      refetch();
      setSelectedPreset(null);
      toast.success("Program created from preset!");
    },
  });
  const deleteProgram = trpc.automation.delete.useMutation({
    onSuccess: () => {
      refetch();
      toast.info("Program deleted");
    },
  });
  const startProgram = trpc.automation.start.useMutation({
    onSuccess: () => {
      refetch();
      toast.success("Program started!");
    },
  });
  const stopProgram = trpc.automation.stop.useMutation({
    onSuccess: () => {
      refetch();
      toast.info("Program stopped");
    },
  });
  const forkProgram = trpc.automation.fork.useMutation({
    onSuccess: () => {
      refetch();
      toast.success("Program duplicated!");
    },
  });

  const [selectedPreset, setSelectedPreset] = useState<{ preset: any; index: number } | null>(null);
  const [variableValues, setVariableValues] = useState<Record<string, string | number>>({});

  // First-use hints
  const [showWelcomeHint, dismissWelcomeHint] = useFirstUseHint("automation_welcome");
  const [showPresetHint, dismissPresetHint] = useFirstUseHint("automation_preset");

  // Find active program
  const activeProgram = programs?.find((p) => p.isActive);

  const handleSelectPreset = (preset: any, index: number) => {
    const defaults: Record<string, string | number> = {};
    for (const v of preset.variables || []) {
      if (v.default != null) defaults[v.name] = v.default;
    }
    setVariableValues(defaults);
    setSelectedPreset({ preset, index });
    if (showPresetHint) dismissPresetHint();
  };

  const handleCreateFromPreset = () => {
    if (!selectedPreset) return;
    createFromPreset.mutate({
      presetIndex: selectedPreset.index,
      variableValues,
    });
  };

  // Dismiss welcome hint after first program created
  useEffect(() => {
    if (programs && programs.length > 0 && showWelcomeHint) {
      dismissWelcomeHint();
    }
  }, [programs, showWelcomeHint, dismissWelcomeHint]);

  if (!status?.connected) {
    return (
      <div className="max-w-lg mx-auto mt-8 px-4">
        <Card className="bg-card border-border">
          <CardContent className="p-6 sm:p-8 text-center">
            <WifiOff className="h-10 w-10 text-muted-foreground mx-auto mb-4 opacity-50" />
            <h2 className="text-lg font-semibold text-foreground mb-2">No Grill Connected</h2>
            <p className="text-sm text-muted-foreground mb-6">
              Connect your grill account to create automation programs.
            </p>
            <Button onClick={() => setLocation("/settings")} className="bg-primary text-primary-foreground font-mono text-xs min-h-[44px]">
              go to settings
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-4 sm:space-y-6 px-0 sm:px-0">
      {/* Header */}
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-foreground tracking-tight">Cook Automation</h1>
        <p className="text-xs sm:text-sm text-muted-foreground mt-1">
          Multi-phase cook programs with smart triggers, auto temperature control, and persistent alarms.
        </p>
      </div>

      {/* Welcome hint — first use only */}
      {showWelcomeHint && !activeProgram && (
        <div className="flex items-start gap-3 p-3 rounded-lg bg-primary/5 border border-primary/20">
          <Info className="h-4 w-4 text-primary shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-xs text-foreground">
              Browse the <strong>Preset Library</strong> to get started with proven cook programs, or create a custom one.
              Each program has configurable variables you can adjust to match your cook.
            </p>
          </div>
          <button onClick={dismissWelcomeHint} className="text-muted-foreground hover:text-foreground text-xs shrink-0">
            dismiss
          </button>
        </div>
      )}

      {/* Live Execution Display — hero when active */}
      {activeProgram && (
        <LiveExecution
          programId={activeProgram.id}
          program={activeProgram}
          viewers={sseTelemetry?.viewers}
        />
      )}

      {/* Tabs: My Programs / Preset Library */}
      <Tabs defaultValue={programs && programs.length > 0 ? "programs" : "presets"} className="w-full">
        <TabsList className="bg-secondary w-full sm:w-auto">
          <TabsTrigger value="programs" className="font-mono text-xs flex-1 sm:flex-none min-h-[40px]">
            <ChefHat className="h-3.5 w-3.5 mr-1.5" />
            My Programs
            {programs && programs.length > 0 && (
              <Badge variant="outline" className="ml-1.5 text-[9px] font-mono">{programs.length}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="presets" className="font-mono text-xs flex-1 sm:flex-none min-h-[40px]">
            <BookOpen className="h-3.5 w-3.5 mr-1.5" />
            Preset Library
          </TabsTrigger>
        </TabsList>

        <TabsContent value="programs" className="mt-4 space-y-3">
          {programs && programs.length > 0 ? (
            programs.map((prog) => {
              const programData = prog.programJson as CookProgram | null;
              const steps = programData?.steps || [];
              return (
                <Card key={prog.id} className={`bg-card border-border ${prog.isActive ? "border-green-500/50" : ""}`}>
                  <CardContent className="p-3 sm:p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-semibold text-foreground text-sm">{prog.name}</h3>
                          {prog.isActive ? (
                            <Badge className="bg-green-500/20 text-green-400 border-green-500/30 font-mono text-xs">
                              running
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="font-mono text-[10px]">
                              {prog.status || "ready"}
                            </Badge>
                          )}
                        </div>
                        {prog.description && (
                          <p className="text-xs text-muted-foreground mt-1 line-clamp-1">{prog.description}</p>
                        )}
                        <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground font-mono flex-wrap">
                          <span>{steps.length} steps</span>
                          {prog.estimatedTime && <span>{prog.estimatedTime}</span>}
                          {prog.category && <span className="capitalize">{prog.category}</span>}
                        </div>
                      </div>
                      {/* Actions — stack on mobile */}
                      <div className={`flex items-center gap-1.5 shrink-0 ${isMobile ? "flex-col" : "flex-row"}`}>
                        {prog.isActive ? (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => stopProgram.mutate({ id: prog.id })}
                            className="font-mono text-xs min-h-[36px] min-w-[36px]"
                          >
                            <Square className="h-3.5 w-3.5" />
                            {!isMobile && <span className="ml-1.5">stop</span>}
                          </Button>
                        ) : (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => startProgram.mutate({ id: prog.id })}
                            className="font-mono text-xs min-h-[36px] min-w-[36px]"
                          >
                            <Play className="h-3.5 w-3.5" />
                            {!isMobile && <span className="ml-1.5">start</span>}
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => forkProgram.mutate({ sourceId: prog.id })}
                          className="h-9 w-9 p-0 text-muted-foreground"
                          title="Duplicate"
                        >
                          <Copy className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            if (confirm("Delete this program?")) {
                              deleteProgram.mutate({ id: prog.id });
                            }
                          }}
                          className="text-destructive h-9 w-9 p-0"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })
          ) : (
            <Card className="bg-card border-border">
              <CardContent className="p-6 sm:p-8 text-center">
                <Workflow className="h-8 w-8 text-muted-foreground mx-auto mb-3 opacity-30" />
                <p className="text-muted-foreground text-sm font-mono">
                  No automation programs yet.
                </p>
                <p className="text-xs text-muted-foreground/60 mt-1">
                  Browse the Preset Library to get started with proven cook programs.
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="presets" className="mt-4">
          <PresetLibrary onSelect={handleSelectPreset} />
        </TabsContent>
      </Tabs>

      {/* Preset Configuration Dialog — full screen on mobile */}
      <Dialog open={!!selectedPreset} onOpenChange={(open) => !open && setSelectedPreset(null)}>
        <DialogContent className={`bg-card border-border ${
          isMobile
            ? "max-w-[100vw] w-full h-[95vh] max-h-[95vh] rounded-t-2xl rounded-b-none fixed bottom-0 top-auto translate-y-0"
            : "max-w-2xl max-h-[85vh]"
        } overflow-y-auto`}>
          <DialogHeader>
            <DialogTitle className="text-foreground flex items-center gap-2">
              <Beef className="h-5 w-5 text-primary" />
              {selectedPreset?.preset.name}
            </DialogTitle>
            <DialogDescription>
              {selectedPreset?.preset.description}
            </DialogDescription>
          </DialogHeader>

          {selectedPreset && (
            <div className="space-y-4">
              {/* Variables */}
              {selectedPreset.preset.variables && selectedPreset.preset.variables.length > 0 && (
                <>
                  {showPresetHint && (
                    <div className="flex items-start gap-2 p-2 rounded bg-primary/5 border border-primary/20 text-xs text-foreground">
                      <Info className="h-3.5 w-3.5 text-primary shrink-0 mt-0.5" />
                      Adjust these to match your cook — weight, temps, and doneness all affect timing.
                    </div>
                  )}
                  <VariableConfig
                    variables={selectedPreset.preset.variables}
                    values={variableValues}
                    onChange={setVariableValues}
                  />
                </>
              )}

              {/* Step preview */}
              <StepPreview steps={selectedPreset.preset.steps || []} />

              {/* Tips */}
              {selectedPreset.preset.tips && selectedPreset.preset.tips.length > 0 && (
                <Collapsible>
                  <CollapsibleTrigger asChild>
                    <button className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors font-mono uppercase tracking-wider">
                      <HelpCircle className="h-3 w-3" />
                      Tips & Notes
                      <ChevronRight className="h-3 w-3" />
                    </button>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <div className="space-y-1 mt-2">
                      {selectedPreset.preset.tips.map((tip: string, i: number) => (
                        <p key={i} className="text-xs text-muted-foreground pl-3 border-l-2 border-primary/30">
                          {tip}
                        </p>
                      ))}
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              )}
            </div>
          )}

          <DialogFooter className={isMobile ? "flex-col gap-2" : ""}>
            <Button variant="outline" onClick={() => setSelectedPreset(null)} className="font-mono text-xs min-h-[44px]">
              cancel
            </Button>
            <Button
              className="bg-primary text-primary-foreground font-mono text-xs min-h-[44px]"
              onClick={handleCreateFromPreset}
              disabled={createFromPreset.isPending}
            >
              {createFromPreset.isPending ? "creating..." : "add to my programs"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
