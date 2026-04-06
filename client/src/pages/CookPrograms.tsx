import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { useTraegerStatus } from "@/hooks/useTraeger";
import { useSSETelemetry } from "@/hooks/useSSETelemetry";
import { useIsMobile } from "@/hooks/useMobile";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  Plus,
  Users,
  Pencil,
  X,
  Search,
  Share2,
  GitFork,
  Lightbulb,
  Clock,
  Wind,
  Wrench,
  GripVertical,
  ArrowRight,
  Layers,
  History,
  Star,
  StarOff,
  CalendarDays,
  TrendingUp,
  ExternalLink,
} from "lucide-react";
import { useState, useMemo, useCallback, useEffect, Fragment, useId } from "react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useLocation } from "wouter";
import { toast } from "sonner";
import type {
  CookProgram,
  ProgramStep,
  ProgramVariable,
  StepTrigger,
  StepAction,
  TriggerType,
  ActionType,
  ActionMeta,
} from "@shared/cook-programs";
import {
  ACTION_CATALOG,
  TRIGGER_CATALOG,
  COMPOUND_LOGIC_OPTIONS,
  PRESET_PROGRAMS,
} from "@shared/cook-programs";
import { CATEGORIES, COOKING_METHODS, COOK_TEMPLATES } from "@shared/cook-templates";
import { templateToProgram } from "@shared/template-bridge";
import type { CookTemplate } from "@shared/traeger-types";

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

function methodColor(method: string) {
  const colors: Record<string, string> = {
    smoke: "bg-purple-500/20 text-purple-400 border-purple-500/30",
    grill: "bg-primary/20 text-primary border-primary/30",
    reverse_sear: "bg-red-500/20 text-red-400 border-red-500/30",
    roast: "bg-amber-500/20 text-amber-400 border-amber-500/30",
    bake: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  };
  return colors[method] || "";
}

function methodLabel(method: string) {
  const labels: Record<string, string> = {
    smoke: "Smoke",
    grill: "Grill",
    reverse_sear: "Reverse Sear",
    roast: "Roast",
    bake: "Bake",
  };
  return labels[method] || method;
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
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1.5 text-sm text-primary/90">
          {triggerIcon(trigger.type)}
          <span className="font-mono">{triggerLabel(trigger.type, trigger.value)}</span>
        </div>
        {!hasSec && <Badge variant="outline" className="text-[9px] font-mono">primary</Badge>}
      </div>
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

// ─── Step Card (Expandable) ──────────────────────────

function StepCard({ step, index, defaultOpen = false }: { step: ProgramStep; index: number; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);

  const grillTemp = step.entryActions?.find(a => a.type === "set_grill_temp")?.params?.temp;
  const superSmoke = step.entryActions?.some(a => a.type === "super_smoke_on");
  const hasAutoActions = step.actions.some(a =>
    ["set_grill_temp", "shutdown", "keep_warm_on", "super_smoke_on", "super_smoke_off"].includes(a.type)
  );

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <div className="rounded-lg border border-border bg-card/50 overflow-hidden">
        <CollapsibleTrigger asChild>
          <button className="w-full flex items-start gap-3 p-3 sm:p-4 text-left hover:bg-accent/30 transition-colors min-h-[52px]">
            <div className="w-7 h-7 rounded-full bg-primary/20 text-primary flex items-center justify-center text-xs font-bold font-mono shrink-0 mt-0.5">
              {index + 1}
            </div>
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
            <div className="shrink-0 mt-1">
              {open ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
            </div>
          </button>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <div className="px-3 sm:px-4 pb-3 sm:pb-4 pt-0 space-y-3 border-t border-border/50">
            {step.description && (
              <p className="text-xs text-muted-foreground mt-2">{step.description}</p>
            )}

            <div className="bg-secondary/30 rounded-md p-2.5">
              <div className="text-[10px] text-muted-foreground/60 font-mono uppercase tracking-wider mb-1.5">Trigger</div>
              <TriggerDisplay trigger={step.trigger} />
            </div>

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

// ─── Program Card (Unified) ──────────────────────────

interface UnifiedProgram {
  id: string;
  source: "preset" | "guide" | "custom" | "community" | "saved";
  program: CookProgram;
  presetIndex?: number;
  customId?: number;
  isPublished?: boolean;
  authorName?: string;
  forkCount?: number;
  // For saved programs from DB
  dbId?: number;
  isActive?: number;
  status?: string;
}

function ProgramCard({ item, onSelect }: { item: UnifiedProgram; onSelect: () => void }) {
  const p = item.program;
  const hasCompound = p.steps.some(s => s.trigger.secondary);

  return (
    <Card
      className="bg-card border-border hover:border-primary/50 transition-colors cursor-pointer active:scale-[0.98] group"
      onClick={onSelect}
    >
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <h3 className="font-semibold text-foreground text-sm group-hover:text-primary transition-colors">
                {p.name}
              </h3>
              <Badge variant="outline" className={`text-xs font-mono ${methodColor(p.method)}`}>
                {methodLabel(p.method)}
              </Badge>
              <Badge className={`${difficultyColor(p.difficulty)} font-mono text-[10px] shrink-0`}>
                {p.difficulty}
              </Badge>
              {item.source === "guide" && (
                <Badge variant="outline" className="text-[9px] font-mono bg-cyan-500/10 text-cyan-400 border-cyan-500/20">
                  guide
                </Badge>
              )}
              {item.isPublished && (
                <Badge variant="outline" className="text-[9px] font-mono bg-green-500/10 text-green-400 border-green-500/20">
                  shared
                </Badge>
              )}
              {item.isActive === 1 && (
                <Badge className="bg-green-500/20 text-green-400 border-green-500/30 font-mono text-xs">
                  running
                </Badge>
              )}
            </div>
            {p.meatCut && <p className="text-xs text-muted-foreground mb-1">{p.meatCut}</p>}
            <p className="text-xs text-muted-foreground/80 line-clamp-2">{p.description}</p>
            <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground font-mono flex-wrap">
              {p.estimatedTime && (
                <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{p.estimatedTime}</span>
              )}
              <span>{p.steps.length} step{p.steps.length !== 1 ? "s" : ""}</span>
              {hasCompound && (
                <span className="flex items-center gap-0.5 text-primary/60">
                  <Shield className="h-3 w-3" />
                  fallbacks
                </span>
              )}
              {item.authorName && (
                <span className="text-muted-foreground/60">by {item.authorName}</span>
              )}
              {(item.forkCount ?? 0) > 0 && (
                <span className="flex items-center gap-1"><GitFork className="h-3 w-3" />{item.forkCount}</span>
              )}
            </div>
          </div>
          <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors shrink-0 ml-2 mt-1" />
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Live Execution Display ──────────────────────────

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
    onSuccess: () => { refetchLive(); toast.success("Alarm acknowledged"); },
  });
  const skip = trpc.automation.skip.useMutation({
    onSuccess: () => { refetchLive(); toast.info("Skipped to next phase"); },
  });
  const isMobile = useIsMobile();
  const [showAllPhases, setShowAllPhases] = useState(false);

  if (!liveState?.active) return null;

  const steps: ProgramStep[] = program?.programJson?.steps || program?.steps || [];
  const currentStep = steps[liveState.phase];
  const needsAck = liveState.phaseAcknowledged === false;

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
        {/* Status bar */}
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

        {/* Big temp display */}
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

        {/* Phase stepper */}
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

        {/* Action buttons */}
        <div className={`flex gap-2 ${useIsMobile() ? "flex-col" : "flex-row"}`}>
          {needsAck && (
            <Button
              size="lg"
              className="bg-red-500 hover:bg-red-600 text-white font-mono text-sm animate-pulse flex-1 min-h-[48px]"
              onClick={() => acknowledge.mutate({ grillId: undefined })}
            >
              <BellRing className="h-4 w-4 mr-2" />
              Acknowledge Alarm
            </Button>
          )}
          <Button
            variant="outline"
            size="lg"
            className="font-mono text-sm min-h-[48px]"
            onClick={() => skip.mutate({ grillId: undefined })}
          >
            <SkipForward className="h-4 w-4 mr-2" />
            Skip Phase
          </Button>
        </div>

        {/* All phases expandable */}
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

// ─── Program Detail Dialog ───────────────────────────

function ProgramDetailDialog({
  item,
  open,
  onClose,
  onStartPreset,
  onStartSaved,
  onFork,
  onDelete,
  onPublish,
  variableValues,
  onVariableChange,
}: {
  item: UnifiedProgram | null;
  open: boolean;
  onClose: () => void;
  onStartPreset: () => void;
  onStartSaved?: () => void;
  onFork?: () => void;
  onDelete?: () => void;
  onPublish?: (publish: boolean) => void;
  variableValues: Record<string, string | number>;
  onVariableChange: (values: Record<string, string | number>) => void;
}) {
  const isMobile = useIsMobile();
  if (!item) return null;

  const p = item.program;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className={`bg-card border-border ${
        isMobile
          ? "max-w-[100vw] w-full h-[95vh] max-h-[95vh] rounded-t-2xl rounded-b-none fixed bottom-0 top-auto translate-y-0"
          : "max-w-2xl max-h-[85vh]"
      } overflow-y-auto`}>
        <DialogHeader>
          <DialogTitle className="text-foreground flex items-center gap-2 flex-wrap">
            <Beef className="h-5 w-5 text-primary shrink-0" />
            <span>{p.name}</span>
            <Badge variant="outline" className={`text-xs font-mono ${methodColor(p.method)}`}>
              {methodLabel(p.method)}
            </Badge>
            <Badge className={`${difficultyColor(p.difficulty)} font-mono text-[10px]`}>
              {p.difficulty}
            </Badge>
          </DialogTitle>
          <DialogDescription>
            {p.meatCut && <span className="font-mono">{p.meatCut} · </span>}
            {p.estimatedTime || "No time estimate"}
            {item.authorName && ` · by ${item.authorName}`}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Description */}
          <p className="text-sm text-foreground/80">{p.description}</p>

          {/* Variables */}
          {p.variables && p.variables.length > 0 && (
            <VariableConfig
              variables={p.variables}
              values={variableValues}
              onChange={onVariableChange}
            />
          )}

          {/* Steps */}
          <div className="space-y-2">
            <h4 className="text-xs text-muted-foreground font-mono uppercase tracking-wider">
              Program Steps ({p.steps.length})
            </h4>
            {p.steps.map((step, i) => (
              <StepCard key={i} step={step} index={i} />
            ))}
          </div>

          {/* Tips */}
          {p.tips && p.tips.length > 0 && (
            <Collapsible>
              <CollapsibleTrigger asChild>
                <button className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors font-mono uppercase tracking-wider">
                  <Lightbulb className="h-3.5 w-3.5 text-amber-400" />
                  Tips & Notes ({p.tips.length})
                  <ChevronRight className="h-3 w-3" />
                </button>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="space-y-1.5 mt-2">
                  {p.tips.map((tip, i) => (
                    <p key={i} className="text-xs text-muted-foreground pl-3 border-l-2 border-primary/30">
                      {tip}
                    </p>
                  ))}
                </div>
              </CollapsibleContent>
            </Collapsible>
          )}
        </div>

        <DialogFooter className={isMobile ? "flex-col gap-2" : ""}>
          <div className="flex flex-wrap gap-2 w-full">
            <Button variant="outline" onClick={onClose} className="font-mono text-xs min-h-[44px]">
              close
            </Button>
            {onFork && (
              <Button variant="outline" className="font-mono text-xs min-h-[44px]" onClick={onFork}>
                <GitFork className="h-3.5 w-3.5 mr-1.5" />fork
              </Button>
            )}
            {onPublish && (
              <Button variant="outline" className="font-mono text-xs min-h-[44px]" onClick={() => onPublish(!item.isPublished)}>
                <Share2 className="h-3.5 w-3.5 mr-1.5" />{item.isPublished ? "unshare" : "share"}
              </Button>
            )}
            {onDelete && (
              <Button variant="outline" className="font-mono text-xs min-h-[44px] text-destructive hover:text-destructive" onClick={onDelete}>
                <Trash2 className="h-3.5 w-3.5 mr-1.5" />delete
              </Button>
            )}
            {item.source === "saved" && item.dbId && onStartSaved ? (
              <Button className="flex-1 bg-primary text-primary-foreground font-mono text-xs min-h-[44px]" onClick={onStartSaved}>
                <Play className="h-3.5 w-3.5 mr-1.5" />
                start program
              </Button>
            ) : (
              <Button className="flex-1 bg-primary text-primary-foreground font-mono text-xs min-h-[44px]" onClick={onStartPreset}>
                <Plus className="h-3.5 w-3.5 mr-1.5" />
                add to my programs
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ═══════════════════════════════════════════════════════
// ─── VISUAL PROGRAM BUILDER ──────────────────────────
// ═══════════════════════════════════════════════════════

function TriggerEditor({
  trigger,
  onChange,
}: {
  trigger: StepTrigger;
  onChange: (t: StepTrigger) => void;
}) {
  const needsValue = (type: TriggerType) => !["manual", "immediate"].includes(type);
  const meta = TRIGGER_CATALOG.find(t => t.type === trigger.type);
  const secMeta = trigger.secondary ? TRIGGER_CATALOG.find(t => t.type === trigger.secondary!.type) : null;

  return (
    <div className="space-y-3">
      {/* Primary trigger */}
      <div className="space-y-2">
        <Label className="text-xs font-mono text-muted-foreground">Primary Trigger</Label>
        <Select value={trigger.type} onValueChange={(v) => onChange({ ...trigger, type: v as TriggerType, value: needsValue(v as TriggerType) ? trigger.value : undefined })}>
          <SelectTrigger className="bg-secondary text-sm"><SelectValue /></SelectTrigger>
          <SelectContent>
            {TRIGGER_CATALOG.map(t => (
              <SelectItem key={t.type} value={t.type}>
                <span className="font-mono text-xs">{t.label}</span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {needsValue(trigger.type) && meta && (
          <div className="flex items-center gap-2">
            <Input
              type="number"
              value={trigger.value ?? ""}
              onChange={(e) => onChange({ ...trigger, value: Number(e.target.value) || 0 })}
              min={meta.valueMin}
              max={meta.valueMax}
              placeholder={meta.valueLabel}
              className="bg-secondary text-sm font-mono"
            />
            {meta.valueUnit && <span className="text-xs text-muted-foreground font-mono">{meta.valueUnit}</span>}
          </div>
        )}
      </div>

      {/* Add secondary trigger toggle */}
      <div className="flex items-center gap-2">
        <Switch
          checked={!!trigger.secondary}
          onCheckedChange={(checked) => {
            if (checked) {
              onChange({
                ...trigger,
                secondary: { type: "timer", value: 3600 },
                logic: "or",
              });
            } else {
              const { secondary, logic, ...rest } = trigger;
              onChange(rest as StepTrigger);
            }
          }}
        />
        <Label className="text-xs font-mono text-muted-foreground">Add compound trigger</Label>
      </div>

      {/* Secondary trigger */}
      {trigger.secondary && (
        <div className="pl-4 border-l-2 border-primary/30 space-y-2">
          <div className="flex items-center gap-2">
            <Label className="text-xs font-mono text-muted-foreground">Logic</Label>
            <Select value={trigger.logic || "or"} onValueChange={(v) => onChange({ ...trigger, logic: v as StepTrigger["logic"] })}>
              <SelectTrigger className="bg-secondary text-sm w-[180px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                {COMPOUND_LOGIC_OPTIONS.map(opt => (
                  <SelectItem key={opt.value} value={opt.value!}>
                    <span className="font-mono text-xs">{opt.label}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <p className="text-[10px] text-muted-foreground/60">
            {COMPOUND_LOGIC_OPTIONS.find(o => o.value === (trigger.logic || "or"))?.description}
          </p>

          <Label className="text-xs font-mono text-muted-foreground">Secondary Trigger</Label>
          <Select
            value={trigger.secondary.type}
            onValueChange={(v) => onChange({
              ...trigger,
              secondary: {
                ...trigger.secondary!,
                type: v as TriggerType,
                value: needsValue(v as TriggerType) ? trigger.secondary!.value : undefined,
              },
            })}
          >
            <SelectTrigger className="bg-secondary text-sm"><SelectValue /></SelectTrigger>
            <SelectContent>
              {TRIGGER_CATALOG.map(t => (
                <SelectItem key={t.type} value={t.type}>
                  <span className="font-mono text-xs">{t.label}</span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {needsValue(trigger.secondary.type) && secMeta && (
            <div className="flex items-center gap-2">
              <Input
                type="number"
                value={trigger.secondary.value ?? ""}
                onChange={(e) => onChange({
                  ...trigger,
                  secondary: { ...trigger.secondary!, value: Number(e.target.value) || 0 },
                })}
                min={secMeta.valueMin}
                max={secMeta.valueMax}
                placeholder={secMeta.valueLabel}
                className="bg-secondary text-sm font-mono"
              />
              {secMeta.valueUnit && <span className="text-xs text-muted-foreground font-mono">{secMeta.valueUnit}</span>}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ActionEditor({
  actions,
  onChange,
  label = "Actions",
}: {
  actions: StepAction[];
  onChange: (a: StepAction[]) => void;
  label?: string;
}) {
  const addAction = (type: ActionType) => {
    const meta = ACTION_CATALOG.find(a => a.type === type);
    const params: Record<string, number | string | boolean> = {};
    if (meta?.params) {
      for (const p of meta.params) {
        if (p.type === "number") params[p.name] = p.min ?? 0;
        else if (p.type === "boolean") params[p.name] = false;
        else params[p.name] = "";
      }
    }
    onChange([...actions, { type, params: Object.keys(params).length > 0 ? params : undefined }]);
  };

  const updateAction = (index: number, updates: Partial<StepAction>) => {
    const newActions = [...actions];
    newActions[index] = { ...newActions[index], ...updates };
    onChange(newActions);
  };

  const removeAction = (index: number) => {
    onChange(actions.filter((_, i) => i !== index));
  };

  // Group action catalog by category
  const grouped = useMemo(() => {
    const groups: Record<string, ActionMeta[]> = {};
    for (const a of ACTION_CATALOG) {
      if (!groups[a.category]) groups[a.category] = [];
      groups[a.category].push(a);
    }
    return groups;
  }, []);

  return (
    <div className="space-y-2">
      <Label className="text-xs font-mono text-muted-foreground uppercase tracking-wider">{label}</Label>

      {actions.map((action, i) => {
        const meta = ACTION_CATALOG.find(a => a.type === action.type);
        return (
          <div key={i} className="flex items-start gap-2 p-2 rounded bg-secondary/30 border border-border">
            <div className="flex-1 space-y-1.5">
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-[10px] font-mono">{meta?.label || action.type}</Badge>
                <span className="text-[10px] text-muted-foreground/50">{meta?.description}</span>
              </div>
              {meta?.params && (
                <div className="flex flex-wrap gap-2">
                  {meta.params.map(param => (
                    <div key={param.name} className="flex items-center gap-1">
                      <Label className="text-[10px] font-mono text-muted-foreground">{param.label}:</Label>
                      <Input
                        type={param.type === "number" ? "number" : "text"}
                        value={String(action.params?.[param.name] ?? "")}
                        onChange={(e) => {
                          const val = param.type === "number" ? Number(e.target.value) || 0 : e.target.value;
                          updateAction(i, { params: { ...action.params, [param.name]: val } });
                        }}
                        min={param.min}
                        max={param.max}
                        className="bg-background text-xs font-mono h-7 w-24"
                      />
                      {param.unit && <span className="text-[10px] text-muted-foreground/50">{param.unit}</span>}
                    </div>
                  ))}
                </div>
              )}
            </div>
            <Button variant="ghost" size="sm" onClick={() => removeAction(i)} className="h-6 w-6 p-0 shrink-0">
              <X className="h-3 w-3" />
            </Button>
          </div>
        );
      })}

      {/* Add action dropdown */}
      <Select onValueChange={(v) => addAction(v as ActionType)} value="">
        <SelectTrigger className="bg-secondary text-xs font-mono h-8">
          <span className="text-muted-foreground">+ Add action...</span>
        </SelectTrigger>
        <SelectContent>
          {Object.entries(grouped).map(([cat, items]) => (
            <Fragment key={cat}>
              <div className="px-2 py-1 text-[10px] font-mono uppercase text-muted-foreground/50 tracking-wider">{cat}</div>
              {items.map(a => (
                <SelectItem key={a.type} value={a.type}>
                  <span className="font-mono text-xs">{a.label}</span>
                  <span className="text-[10px] text-muted-foreground/50 ml-2">{a.description}</span>
                </SelectItem>
              ))}
            </Fragment>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function SortableStepBuilder({
  step,
  index,
  stepId,
  onChange,
  onRemove,
}: {
  step: ProgramStep;
  index: number;
  stepId: string;
  onChange: (s: ProgramStep) => void;
  onRemove: () => void;
}) {
  const [expanded, setExpanded] = useState(true);
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: stepId });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 50 : undefined,
  };

  return (
    <div ref={setNodeRef} style={style}>
    <Collapsible open={expanded && !isDragging} onOpenChange={setExpanded}>
      <div className={`rounded-lg border bg-card overflow-hidden ${isDragging ? "border-primary shadow-lg" : "border-border"}`}>
        <CollapsibleTrigger asChild>
          <div className="flex items-center gap-3 p-3 cursor-pointer hover:bg-accent/30 transition-colors">
            <button
              {...attributes}
              {...listeners}
              className="touch-none cursor-grab active:cursor-grabbing p-0.5 rounded hover:bg-accent/50 transition-colors"
              onClick={(e) => e.stopPropagation()}
              aria-label="Drag to reorder step"
            >
              <GripVertical className="h-4 w-4 text-muted-foreground/60 hover:text-primary shrink-0" />
            </button>
            <div className="w-7 h-7 rounded-full bg-primary/20 text-primary flex items-center justify-center text-xs font-bold font-mono shrink-0">
              {index + 1}
            </div>
            <span className="font-semibold text-foreground text-sm flex-1 truncate">
              {step.name || `Step ${index + 1}`}
            </span>
            <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); onRemove(); }} className="h-7 w-7 p-0 text-destructive/60 hover:text-destructive shrink-0">
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
            {expanded ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
          </div>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <div className="px-3 pb-4 space-y-4 border-t border-border/50 pt-3">
            {/* Name & Description */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-mono text-muted-foreground">Step Name *</Label>
                <Input
                  value={step.name}
                  onChange={(e) => onChange({ ...step, name: e.target.value })}
                  placeholder="e.g., Low & Slow"
                  className="bg-secondary text-sm"
                />
              </div>
              <div>
                <Label className="text-xs font-mono text-muted-foreground">Description</Label>
                <Input
                  value={step.description || ""}
                  onChange={(e) => onChange({ ...step, description: e.target.value || undefined })}
                  placeholder="What happens in this step"
                  className="bg-secondary text-sm"
                />
              </div>
            </div>

            {/* Trigger */}
            <div className="bg-secondary/20 rounded-lg p-3 border border-border/50">
              <div className="text-xs font-mono text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <Zap className="h-3 w-3 text-primary" />
                When to advance (Trigger)
              </div>
              <TriggerEditor
                trigger={step.trigger}
                onChange={(t) => onChange({ ...step, trigger: t })}
              />
            </div>

            {/* Entry Actions */}
            <div className="bg-secondary/20 rounded-lg p-3 border border-border/50">
              <div className="text-xs font-mono text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <ArrowRight className="h-3 w-3 text-green-400" />
                On Step Entry (runs when this step begins)
              </div>
              <ActionEditor
                actions={step.entryActions || []}
                onChange={(a) => onChange({ ...step, entryActions: a.length > 0 ? a : undefined })}
                label="Entry Actions"
              />
            </div>

            {/* Trigger Actions */}
            <div className="bg-secondary/20 rounded-lg p-3 border border-border/50">
              <div className="text-xs font-mono text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <Bell className="h-3 w-3 text-amber-400" />
                On Trigger Fire (runs when trigger condition is met)
              </div>
              <ActionEditor
                actions={step.actions}
                onChange={(a) => onChange({ ...step, actions: a })}
                label="Trigger Actions"
              />
            </div>

            {/* Alert Configuration */}
            <div className="bg-secondary/20 rounded-lg p-3 border border-border/50">
              <div className="text-xs font-mono text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <BellRing className="h-3 w-3 text-red-400" />
                Alert on Trigger
              </div>
              <div className="flex items-center gap-2 mb-2">
                <Switch
                  checked={!!step.alertOnTrigger}
                  onCheckedChange={(checked) => {
                    if (checked) {
                      onChange({
                        ...step,
                        alertOnTrigger: { type: "notification", message: "Step complete!" },
                      });
                    } else {
                      onChange({ ...step, alertOnTrigger: undefined });
                    }
                  }}
                />
                <Label className="text-xs font-mono text-muted-foreground">Enable alert when trigger fires</Label>
              </div>
              {step.alertOnTrigger && (
                <div className="space-y-2 pl-2">
                  <div className="flex gap-2">
                    <Button
                      variant={step.alertOnTrigger.type === "notification" ? "default" : "outline"}
                      size="sm"
                      onClick={() => onChange({ ...step, alertOnTrigger: { ...step.alertOnTrigger!, type: "notification" } })}
                      className="font-mono text-xs min-h-[36px]"
                    >
                      <Bell className="h-3 w-3 mr-1" />Notification
                    </Button>
                    <Button
                      variant={step.alertOnTrigger.type === "alarm" ? "default" : "outline"}
                      size="sm"
                      onClick={() => onChange({ ...step, alertOnTrigger: { ...step.alertOnTrigger!, type: "alarm" } })}
                      className="font-mono text-xs min-h-[36px]"
                    >
                      <BellRing className="h-3 w-3 mr-1" />Alarm (persistent)
                    </Button>
                  </div>
                  <Input
                    value={step.alertOnTrigger.message}
                    onChange={(e) => onChange({ ...step, alertOnTrigger: { ...step.alertOnTrigger!, message: e.target.value } })}
                    placeholder="Alert message..."
                    className="bg-secondary text-sm"
                  />
                  {step.alertOnTrigger.type === "alarm" && (
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={!!step.alertOnTrigger.escalating}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            onChange({
                              ...step,
                              alertOnTrigger: {
                                ...step.alertOnTrigger!,
                                escalating: { intervalDegrees: 5 },
                              },
                            });
                          } else {
                            const { escalating, ...rest } = step.alertOnTrigger!;
                            onChange({ ...step, alertOnTrigger: rest });
                          }
                        }}
                      />
                      <Label className="text-xs font-mono text-muted-foreground">Escalating (re-alarm every N°F)</Label>
                      {step.alertOnTrigger.escalating && (
                        <Input
                          type="number"
                          value={step.alertOnTrigger.escalating.intervalDegrees}
                          onChange={(e) => onChange({
                            ...step,
                            alertOnTrigger: {
                              ...step.alertOnTrigger!,
                              escalating: { ...step.alertOnTrigger!.escalating!, intervalDegrees: Number(e.target.value) || 5 },
                            },
                          })}
                          min={1}
                          max={50}
                          className="bg-secondary text-xs font-mono h-7 w-16"
                        />
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
    </div>
  );
}

function VariableBuilder({
  variables,
  onChange,
}: {
  variables: ProgramVariable[];
  onChange: (v: ProgramVariable[]) => void;
}) {
  const addVariable = () => {
    onChange([
      ...variables,
      {
        name: `var_${variables.length + 1}`,
        label: `Variable ${variables.length + 1}`,
        type: "number",
        default: 0,
      },
    ]);
  };

  const updateVariable = (index: number, updates: Partial<ProgramVariable>) => {
    const newVars = [...variables];
    newVars[index] = { ...newVars[index], ...updates };
    onChange(newVars);
  };

  const removeVariable = (index: number) => {
    onChange(variables.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label className="text-xs font-mono text-muted-foreground uppercase tracking-wider">
          Variables ({variables.length})
        </Label>
        <Button variant="outline" size="sm" onClick={addVariable} className="font-mono text-xs h-7">
          <Plus className="h-3 w-3 mr-1" />Add Variable
        </Button>
      </div>
      <p className="text-[10px] text-muted-foreground/60">
        Variables let users customize your program. Reference them in trigger values and action params with {"{{variable_name}}"}.
      </p>

      {variables.map((v, i) => (
        <div key={i} className="p-3 rounded-lg border border-border bg-secondary/20 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono text-primary">{`{{${v.name}}}`}</span>
            <Button variant="ghost" size="sm" onClick={() => removeVariable(i)} className="h-6 w-6 p-0">
              <X className="h-3 w-3" />
            </Button>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-[10px] font-mono">Name (code)</Label>
              <Input
                value={v.name}
                onChange={(e) => updateVariable(i, { name: e.target.value.replace(/\s/g, "_").toLowerCase() })}
                className="bg-background text-xs h-7"
              />
            </div>
            <div>
              <Label className="text-[10px] font-mono">Label (display)</Label>
              <Input
                value={v.label}
                onChange={(e) => updateVariable(i, { label: e.target.value })}
                className="bg-background text-xs h-7"
              />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div>
              <Label className="text-[10px] font-mono">Type</Label>
              <Select value={v.type} onValueChange={(val) => updateVariable(i, { type: val as ProgramVariable["type"] })}>
                <SelectTrigger className="bg-background text-xs h-7"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="number">Number</SelectItem>
                  <SelectItem value="enum">Choice</SelectItem>
                  <SelectItem value="text">Text</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-[10px] font-mono">Default</Label>
              <Input
                type={v.type === "number" ? "number" : "text"}
                value={v.default}
                onChange={(e) => updateVariable(i, { default: v.type === "number" ? Number(e.target.value) || 0 : e.target.value })}
                className="bg-background text-xs h-7"
              />
            </div>
            <div>
              <Label className="text-[10px] font-mono">Unit</Label>
              <Input
                value={v.unit || ""}
                onChange={(e) => updateVariable(i, { unit: e.target.value || undefined })}
                placeholder="°F, lbs..."
                className="bg-background text-xs h-7"
              />
            </div>
          </div>
          {v.type === "number" && (
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-[10px] font-mono">Min</Label>
                <Input type="number" value={v.min ?? ""} onChange={(e) => updateVariable(i, { min: Number(e.target.value) || undefined })} className="bg-background text-xs h-7" />
              </div>
              <div>
                <Label className="text-[10px] font-mono">Max</Label>
                <Input type="number" value={v.max ?? ""} onChange={(e) => updateVariable(i, { max: Number(e.target.value) || undefined })} className="bg-background text-xs h-7" />
              </div>
            </div>
          )}
          {v.type === "enum" && (
            <div>
              <Label className="text-[10px] font-mono">Options (comma-separated)</Label>
              <Input
                value={(v.options || []).join(", ")}
                onChange={(e) => updateVariable(i, { options: e.target.value.split(",").map(s => s.trim()).filter(Boolean) })}
                placeholder="rare, medium_rare, medium, well_done"
                className="bg-background text-xs h-7"
              />
            </div>
          )}
          <div>
            <Label className="text-[10px] font-mono">Description</Label>
            <Input
              value={v.description || ""}
              onChange={(e) => updateVariable(i, { description: e.target.value || undefined })}
              placeholder="Help text for users"
              className="bg-background text-xs h-7"
            />
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Full Program Builder Dialog ─────────────────────

// ═══════════════════════════════════════════════════════
// ─── EXECUTION HISTORY TAB ──────────────────────────
// ═══════════════════════════════════════════════════════

function ExecutionHistoryTab({
  executions,
  onReview,
  isMobile,
}: {
  executions: any[];
  onReview: (id: number, notes?: string, rating?: number) => void;
  isMobile: boolean;
}) {
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [reviewNotes, setReviewNotes] = useState("");
  const [reviewRating, setReviewRating] = useState(0);

  const formatDate = (date: string | Date | null) => {
    if (!date) return "—";
    return new Date(date).toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  };

  const formatDurationMs = (start: string | Date, end: string | Date | null) => {
    if (!end) return "In progress";
    const ms = new Date(end).getTime() - new Date(start).getTime();
    if (ms < 60000) return `${Math.round(ms / 1000)}s`;
    if (ms < 3600000) return `${Math.round(ms / 60000)}min`;
    const hrs = Math.floor(ms / 3600000);
    const mins = Math.round((ms % 3600000) / 60000);
    return `${hrs}h ${mins}m`;
  };

  const outcomeColor = (outcome: string) => {
    switch (outcome) {
      case "completed": return "text-green-400";
      case "running": return "text-amber-400";
      case "aborted": return "text-red-400";
      case "failed": return "text-red-500";
      default: return "text-muted-foreground";
    }
  };

  const outcomeBadge = (outcome: string) => {
    switch (outcome) {
      case "completed": return "bg-green-500/10 text-green-400 border-green-500/20";
      case "running": return "bg-amber-500/10 text-amber-400 border-amber-500/20";
      case "aborted": return "bg-red-500/10 text-red-400 border-red-500/20";
      case "failed": return "bg-red-500/10 text-red-500 border-red-500/20";
      default: return "bg-muted text-muted-foreground border-border";
    }
  };

  const handleExpand = (exec: any) => {
    if (expandedId === exec.id) {
      setExpandedId(null);
    } else {
      setExpandedId(exec.id);
      setReviewNotes(exec.notes || "");
      setReviewRating(exec.rating || 0);
    }
  };

  if (executions.length === 0) {
    return (
      <Card className="bg-card border-border">
        <CardContent className="p-6 sm:p-8 text-center">
          <History className="h-8 w-8 text-muted-foreground mx-auto mb-3 opacity-30" />
          <p className="text-muted-foreground text-sm font-mono">
            No execution history yet.
          </p>
          <p className="text-xs text-muted-foreground/60 mt-1">
            Start a program from the Library or My Programs tab to begin tracking.
          </p>
        </CardContent>
      </Card>
    );
  }

  // Summary stats
  const totalRuns = executions.length;
  const completedRuns = executions.filter((e: any) => e.outcome === "completed").length;
  const avgRating = executions.filter((e: any) => e.rating).length > 0
    ? (executions.filter((e: any) => e.rating).reduce((sum: number, e: any) => sum + (e.rating || 0), 0) /
       executions.filter((e: any) => e.rating).length).toFixed(1)
    : null;

  return (
    <div className="space-y-4">
      {/* Summary Cards */}
      <div className={`grid gap-3 ${isMobile ? "grid-cols-2" : "grid-cols-4"}`}>
        <Card className="bg-card border-border">
          <CardContent className="p-3 text-center">
            <div className="text-lg font-bold text-foreground font-mono">{totalRuns}</div>
            <div className="text-[10px] text-muted-foreground font-mono uppercase tracking-wider">Total Runs</div>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardContent className="p-3 text-center">
            <div className="text-lg font-bold text-green-400 font-mono">{completedRuns}</div>
            <div className="text-[10px] text-muted-foreground font-mono uppercase tracking-wider">Completed</div>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardContent className="p-3 text-center">
            <div className="text-lg font-bold text-foreground font-mono">
              {completedRuns > 0 ? `${Math.round((completedRuns / totalRuns) * 100)}%` : "—"}
            </div>
            <div className="text-[10px] text-muted-foreground font-mono uppercase tracking-wider">Success Rate</div>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardContent className="p-3 text-center">
            <div className="text-lg font-bold text-amber-400 font-mono">
              {avgRating ? `${avgRating}` : "—"}
            </div>
            <div className="text-[10px] text-muted-foreground font-mono uppercase tracking-wider">Avg Rating</div>
          </CardContent>
        </Card>
      </div>

      {/* Execution List */}
      <div className="space-y-2">
        {executions.map((exec: any) => (
          <Collapsible key={exec.id} open={expandedId === exec.id} onOpenChange={() => handleExpand(exec)}>
            <div className="rounded-lg border border-border bg-card overflow-hidden">
              <CollapsibleTrigger asChild>
                <div className="flex items-center gap-3 p-3 cursor-pointer hover:bg-accent/30 transition-colors">
                  {/* Outcome indicator */}
                  <div className={`w-2 h-2 rounded-full shrink-0 ${exec.outcome === "completed" ? "bg-green-400" : exec.outcome === "running" ? "bg-amber-400 animate-pulse" : "bg-red-400"}`} />

                  {/* Program info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-foreground text-sm truncate">
                        {exec.programName}
                      </span>
                      <Badge variant="outline" className={`text-[9px] font-mono border ${outcomeBadge(exec.outcome)}`}>
                        {exec.outcome}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-3 mt-0.5">
                      <span className="text-[10px] text-muted-foreground font-mono flex items-center gap-1">
                        <CalendarDays className="h-3 w-3" />
                        {formatDate(exec.startedAt)}
                      </span>
                      <span className="text-[10px] text-muted-foreground font-mono flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {formatDurationMs(exec.startedAt, exec.endedAt)}
                      </span>
                      <span className="text-[10px] text-muted-foreground font-mono">
                        {exec.stepsCompleted}/{exec.totalSteps} steps
                      </span>
                    </div>
                  </div>

                  {/* Rating stars */}
                  {exec.rating && (
                    <div className="flex items-center gap-0.5 shrink-0">
                      {[1, 2, 3, 4, 5].map(s => (
                        <Star
                          key={s}
                          className={`h-3 w-3 ${s <= exec.rating ? "text-amber-400 fill-amber-400" : "text-muted-foreground/30"}`}
                        />
                      ))}
                    </div>
                  )}

                  {/* Peak temps */}
                  {(exec.peakGrillTemp || exec.peakProbeTemp) && (
                    <div className="hidden sm:flex items-center gap-2 text-[10px] font-mono text-muted-foreground shrink-0">
                      {exec.peakGrillTemp && (
                        <span className="flex items-center gap-0.5">
                          <Flame className="h-3 w-3 text-orange-400" />
                          {Math.round(exec.peakGrillTemp)}°F
                        </span>
                      )}
                      {exec.peakProbeTemp && (
                        <span className="flex items-center gap-0.5">
                          <Thermometer className="h-3 w-3 text-red-400" />
                          {Math.round(exec.peakProbeTemp)}°F
                        </span>
                      )}
                    </div>
                  )}

                  {expandedId === exec.id ? (
                    <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
                  ) : (
                    <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                  )}
                </div>
              </CollapsibleTrigger>

              <CollapsibleContent>
                <div className="px-3 pb-4 space-y-4 border-t border-border/50 pt-3">
                  {/* Details Grid */}
                  <div className={`grid gap-3 ${isMobile ? "grid-cols-1" : "grid-cols-2"}`}>
                    <div className="space-y-2">
                      <div className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">Details</div>
                      <div className="space-y-1">
                        {exec.programCategory && (
                          <div className="flex items-center gap-2 text-xs">
                            <span className="text-muted-foreground">Category:</span>
                            <span className="text-foreground capitalize">{exec.programCategory}</span>
                          </div>
                        )}
                        {exec.programMethod && (
                          <div className="flex items-center gap-2 text-xs">
                            <span className="text-muted-foreground">Method:</span>
                            <span className="text-foreground capitalize">{exec.programMethod}</span>
                          </div>
                        )}
                        {exec.programMeatCut && (
                          <div className="flex items-center gap-2 text-xs">
                            <span className="text-muted-foreground">Cut:</span>
                            <span className="text-foreground">{exec.programMeatCut}</span>
                          </div>
                        )}
                        <div className="flex items-center gap-2 text-xs">
                          <span className="text-muted-foreground">Started:</span>
                          <span className="text-foreground">{formatDate(exec.startedAt)}</span>
                        </div>
                        {exec.endedAt && (
                          <div className="flex items-center gap-2 text-xs">
                            <span className="text-muted-foreground">Ended:</span>
                            <span className="text-foreground">{formatDate(exec.endedAt)}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Peak Temps */}
                    <div className="space-y-2">
                      <div className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">Performance</div>
                      <div className="space-y-1">
                        {exec.peakGrillTemp && (
                          <div className="flex items-center gap-2 text-xs">
                            <Flame className="h-3 w-3 text-orange-400" />
                            <span className="text-muted-foreground">Peak Grill:</span>
                            <span className="text-foreground font-mono">{Math.round(exec.peakGrillTemp)}°F</span>
                          </div>
                        )}
                        {exec.peakProbeTemp && (
                          <div className="flex items-center gap-2 text-xs">
                            <Thermometer className="h-3 w-3 text-red-400" />
                            <span className="text-muted-foreground">Peak Probe:</span>
                            <span className="text-foreground font-mono">{Math.round(exec.peakProbeTemp)}°F</span>
                          </div>
                        )}
                        <div className="flex items-center gap-2 text-xs">
                          <TrendingUp className="h-3 w-3 text-primary" />
                          <span className="text-muted-foreground">Steps:</span>
                          <span className="text-foreground font-mono">{exec.stepsCompleted} / {exec.totalSteps}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Execution Log */}
                  {exec.executionLogJson && Array.isArray(exec.executionLogJson) && exec.executionLogJson.length > 0 && (
                    <div className="space-y-2">
                      <div className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">Execution Log</div>
                      <div className="bg-secondary/30 rounded-lg p-2 max-h-32 overflow-y-auto space-y-1">
                        {(exec.executionLogJson as Array<{timestamp: number; event: string; detail?: string}>).map((entry, i) => (
                          <div key={i} className="flex items-start gap-2 text-[10px] font-mono">
                            <span className="text-muted-foreground/60 shrink-0">
                              {new Date(entry.timestamp).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit", second: "2-digit" })}
                            </span>
                            <span className={outcomeColor(entry.event === "started" ? "running" : entry.event === "stopped" ? "aborted" : "completed")}>
                              {entry.event}
                            </span>
                            {entry.detail && (
                              <span className="text-muted-foreground truncate">{entry.detail}</span>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Cook Session Link */}
                  {exec.cookSessionId && (
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="font-mono text-xs h-7"
                        onClick={() => window.location.href = `/cook-history`}
                      >
                        <ExternalLink className="h-3 w-3 mr-1" />
                        View Cook Session #{exec.cookSessionId}
                      </Button>
                    </div>
                  )}

                  {/* Post-Cook Review */}
                  {exec.outcome !== "running" && (
                    <div className="space-y-2 pt-2 border-t border-border/50">
                      <div className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">Post-Cook Review</div>
                      <div className="flex items-center gap-1">
                        {[1, 2, 3, 4, 5].map(s => (
                          <button
                            key={s}
                            onClick={() => setReviewRating(s)}
                            className="p-0.5 hover:scale-110 transition-transform"
                          >
                            <Star
                              className={`h-5 w-5 ${s <= reviewRating ? "text-amber-400 fill-amber-400" : "text-muted-foreground/30 hover:text-amber-400/50"}`}
                            />
                          </button>
                        ))}
                        {reviewRating > 0 && (
                          <span className="text-xs text-muted-foreground ml-2 font-mono">{reviewRating}/5</span>
                        )}
                      </div>
                      <Textarea
                        value={reviewNotes}
                        onChange={(e) => setReviewNotes(e.target.value)}
                        placeholder="How did this cook turn out? Any notes for next time..."
                        className="bg-secondary text-xs font-mono min-h-[60px]"
                        rows={2}
                      />
                      <Button
                        size="sm"
                        onClick={() => onReview(exec.id, reviewNotes || undefined, reviewRating || undefined)}
                        className="bg-primary text-primary-foreground font-mono text-xs h-7"
                      >
                        <CheckCircle2 className="h-3 w-3 mr-1" />
                        Save Review
                      </Button>
                    </div>
                  )}
                </div>
              </CollapsibleContent>
            </div>
          </Collapsible>
        ))}
      </div>
    </div>
  );
}

function ProgramBuilder({
  open,
  onClose,
  onSave,
  initialProgram,
}: {
  open: boolean;
  onClose: () => void;
  onSave: (program: CookProgram) => void;
  initialProgram?: CookProgram;
}) {
  const isMobile = useIsMobile();
  const [wizardStep, setWizardStep] = useState(0);

  // Program metadata
  const [name, setName] = useState(initialProgram?.name || "");
  const [description, setDescription] = useState(initialProgram?.description || "");
  const [category, setCategory] = useState<CookProgram["category"]>(initialProgram?.category || "beef");
  const [method, setMethod] = useState<CookProgram["method"]>(initialProgram?.method || "smoke");
  const [meatCut, setMeatCut] = useState(initialProgram?.meatCut || "");
  const [difficulty, setDifficulty] = useState<CookProgram["difficulty"]>(initialProgram?.difficulty || "intermediate");
  const [estimatedTime, setEstimatedTime] = useState(initialProgram?.estimatedTime || "");
  const [tags, setTags] = useState(initialProgram?.tags?.join(", ") || "");
  const [tips, setTips] = useState(initialProgram?.tips?.join("\n") || "");

  // Variables & Steps
  const [variables, setVariables] = useState<ProgramVariable[]>(initialProgram?.variables || []);
  const [steps, setSteps] = useState<ProgramStep[]>(
    initialProgram?.steps || [
      {
        name: "Step 1",
        trigger: { type: "probe_temp", value: 165 },
        entryActions: [{ type: "set_grill_temp", params: { temp: 225 } }],
        actions: [{ type: "send_notification", params: { message: "Step complete!" } }],
      },
    ]
  );

  // Stable IDs for sortable steps (increment counter for new steps)
  const [stepIdCounter, setStepIdCounter] = useState(() => initialProgram?.steps?.length || 1);
  const [stepIds, setStepIds] = useState<string[]>(() =>
    (initialProgram?.steps || [{ name: "Step 1" }]).map((_, i) => `step-${i}`)
  );

  // DnD sensors
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor)
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = stepIds.indexOf(String(active.id));
    const newIndex = stepIds.indexOf(String(over.id));
    if (oldIndex === -1 || newIndex === -1) return;
    setSteps(arrayMove(steps, oldIndex, newIndex));
    setStepIds(arrayMove(stepIds, oldIndex, newIndex));
  };

  // Reset when dialog opens with new initial
  useEffect(() => {
    if (open && initialProgram) {
      setName(initialProgram.name);
      setDescription(initialProgram.description);
      setCategory(initialProgram.category);
      setMethod(initialProgram.method);
      setMeatCut(initialProgram.meatCut || "");
      setDifficulty(initialProgram.difficulty);
      setEstimatedTime(initialProgram.estimatedTime || "");
      setTags(initialProgram.tags?.join(", ") || "");
      setTips(initialProgram.tips?.join("\n") || "");
      setVariables(initialProgram.variables || []);
      const initSteps = initialProgram.steps || [];
      setSteps(initSteps);
      setStepIds(initSteps.map((_: ProgramStep, i: number) => `step-${i}`));
      setStepIdCounter(initSteps.length);
      setWizardStep(0);
    } else if (open && !initialProgram) {
      setName("");
      setDescription("");
      setCategory("beef");
      setMethod("smoke");
      setMeatCut("");
      setStepIds(["step-0"]);
      setStepIdCounter(1);
      setDifficulty("intermediate");
      setEstimatedTime("");
      setTags("");
      setTips("");
      setVariables([]);
      setSteps([{
        name: "Step 1",
        trigger: { type: "probe_temp", value: 165 },
        entryActions: [{ type: "set_grill_temp", params: { temp: 225 } }],
        actions: [{ type: "send_notification", params: { message: "Step complete!" } }],
      }]);
      setWizardStep(0);
    }
  }, [open, initialProgram]);

  const addStep = () => {
    const newId = `step-${stepIdCounter}`;
    setStepIdCounter(stepIdCounter + 1);
    setSteps([
      ...steps,
      {
        name: `Step ${steps.length + 1}`,
        trigger: { type: "probe_temp", value: 165 },
        entryActions: [],
        actions: [],
      },
    ]);
    setStepIds([...stepIds, newId]);
  };

  const updateStep = (index: number, step: ProgramStep) => {
    const newSteps = [...steps];
    newSteps[index] = step;
    setSteps(newSteps);
  };

  const removeStep = (index: number) => {
    if (steps.length <= 1) { toast.error("Need at least one step"); return; }
    setSteps(steps.filter((_, i) => i !== index));
    setStepIds(stepIds.filter((_, i) => i !== index));
  };

  const handleSave = () => {
    if (!name.trim()) { toast.error("Program name is required"); return; }
    if (steps.length === 0) { toast.error("Add at least one step"); return; }

    const program: CookProgram = {
      name: name.trim(),
      description: description.trim(),
      category,
      method,
      meatCut: meatCut.trim() || undefined,
      difficulty,
      estimatedTime: estimatedTime.trim() || undefined,
      tags: tags.split(",").map(t => t.trim()).filter(Boolean),
      variables,
      steps,
      tips: tips.split("\n").map(t => t.trim()).filter(Boolean),
    };

    onSave(program);
  };

  const wizardSteps = [
    { label: "Info", icon: <Info className="h-3.5 w-3.5" /> },
    { label: "Variables", icon: <Layers className="h-3.5 w-3.5" /> },
    { label: "Steps", icon: <Workflow className="h-3.5 w-3.5" /> },
    { label: "Tips", icon: <Lightbulb className="h-3.5 w-3.5" /> },
  ];

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className={`bg-card border-border ${
        isMobile
          ? "max-w-[100vw] w-full h-[95vh] max-h-[95vh] rounded-t-2xl rounded-b-none fixed bottom-0 top-auto translate-y-0"
          : "max-w-3xl max-h-[90vh]"
      } overflow-y-auto`}>
        <DialogHeader>
          <DialogTitle className="text-foreground flex items-center gap-2">
            <Wrench className="h-5 w-5 text-primary" />
            {initialProgram ? "Edit Program" : "Build Custom Program"}
          </DialogTitle>
          <DialogDescription>
            Create a multi-step cook program with triggers, actions, and variables.
          </DialogDescription>
        </DialogHeader>

        {/* Wizard step indicator */}
        <div className="flex gap-1 mb-2">
          {wizardSteps.map((ws, i) => (
            <button
              key={i}
              onClick={() => setWizardStep(i)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-mono transition-colors min-h-[32px] ${
                i === wizardStep
                  ? "bg-primary text-primary-foreground"
                  : "bg-secondary text-muted-foreground hover:text-foreground"
              }`}
            >
              {ws.icon}
              <span className="hidden sm:inline">{ws.label}</span>
              <span className="sm:hidden">{i + 1}</span>
            </button>
          ))}
        </div>

        {/* Step 0: Info */}
        {wizardStep === 0 && (
          <div className="space-y-3">
            <div>
              <Label className="text-xs font-mono">Program Name *</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g., My Perfect Brisket" className="bg-secondary" />
            </div>
            <div>
              <Label className="text-xs font-mono">Description</Label>
              <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Describe your cook method..." className="bg-secondary resize-none" rows={2} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-mono">Category</Label>
                <Select value={category} onValueChange={(v) => setCategory(v as CookProgram["category"])}>
                  <SelectTrigger className="bg-secondary"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map(c => <SelectItem key={c.id} value={c.id}>{c.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs font-mono">Method</Label>
                <Select value={method} onValueChange={(v) => setMethod(v as CookProgram["method"])}>
                  <SelectTrigger className="bg-secondary"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {COOKING_METHODS.map(m => <SelectItem key={m.id} value={m.id}>{m.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label className="text-xs font-mono">Meat Cut</Label>
                <Input value={meatCut} onChange={(e) => setMeatCut(e.target.value)} placeholder="e.g., Pork Butt" className="bg-secondary" />
              </div>
              <div>
                <Label className="text-xs font-mono">Difficulty</Label>
                <Select value={difficulty} onValueChange={(v) => setDifficulty(v as CookProgram["difficulty"])}>
                  <SelectTrigger className="bg-secondary"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="beginner">Beginner</SelectItem>
                    <SelectItem value="intermediate">Intermediate</SelectItem>
                    <SelectItem value="advanced">Advanced</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs font-mono">Est. Time</Label>
                <Input value={estimatedTime} onChange={(e) => setEstimatedTime(e.target.value)} placeholder="e.g., 8-12 hrs" className="bg-secondary" />
              </div>
            </div>
            <div>
              <Label className="text-xs font-mono">Tags (comma-separated)</Label>
              <Input value={tags} onChange={(e) => setTags(e.target.value)} placeholder="brisket, low-and-slow, beef" className="bg-secondary" />
            </div>
          </div>
        )}

        {/* Step 1: Variables */}
        {wizardStep === 1 && (
          <VariableBuilder variables={variables} onChange={setVariables} />
        )}

        {/* Step 2: Steps */}
        {wizardStep === 2 && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-mono text-muted-foreground uppercase tracking-wider">
                Cook Steps ({steps.length})
              </Label>
              <Button variant="outline" size="sm" onClick={addStep} className="font-mono text-xs h-8">
                <Plus className="h-3 w-3 mr-1" />Add Step
              </Button>
            </div>
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <SortableContext items={stepIds} strategy={verticalListSortingStrategy}>
                {steps.map((step, i) => (
                  <SortableStepBuilder
                    key={stepIds[i]}
                    stepId={stepIds[i]}
                    step={step}
                    index={i}
                    onChange={(s: ProgramStep) => updateStep(i, s)}
                    onRemove={() => removeStep(i)}
                  />
                ))}
              </SortableContext>
            </DndContext>
          </div>
        )}

        {/* Step 3: Tips */}
        {wizardStep === 3 && (
          <div className="space-y-3">
            <div>
              <Label className="text-xs font-mono">Tips & Notes (one per line)</Label>
              <Textarea
                value={tips}
                onChange={(e) => setTips(e.target.value)}
                placeholder={"Let the meat rest for 30 minutes after pulling\nUse butcher paper instead of foil for better bark\nSpritz with apple cider vinegar every hour"}
                className="bg-secondary resize-none"
                rows={8}
              />
            </div>

            {/* Preview summary */}
            <div className="bg-secondary/30 rounded-lg p-4 border border-border">
              <h4 className="text-xs font-mono text-muted-foreground uppercase tracking-wider mb-2">Program Summary</h4>
              <div className="space-y-1 text-sm">
                <div><span className="text-muted-foreground font-mono text-xs">Name:</span> <span className="text-foreground">{name || "(unnamed)"}</span></div>
                <div><span className="text-muted-foreground font-mono text-xs">Category:</span> <span className="text-foreground capitalize">{category}</span></div>
                <div><span className="text-muted-foreground font-mono text-xs">Method:</span> <span className="text-foreground capitalize">{method}</span></div>
                <div><span className="text-muted-foreground font-mono text-xs">Steps:</span> <span className="text-foreground">{steps.length}</span></div>
                <div><span className="text-muted-foreground font-mono text-xs">Variables:</span> <span className="text-foreground">{variables.length}</span></div>
                <div><span className="text-muted-foreground font-mono text-xs">Tips:</span> <span className="text-foreground">{tips.split("\n").filter(t => t.trim()).length}</span></div>
              </div>
            </div>
          </div>
        )}

        <DialogFooter className={`${isMobile ? "flex-col gap-2" : ""} mt-4`}>
          <div className="flex gap-2 w-full">
            {wizardStep > 0 && (
              <Button variant="outline" onClick={() => setWizardStep(wizardStep - 1)} className="font-mono text-xs min-h-[44px]">
                Back
              </Button>
            )}
            <div className="flex-1" />
            {wizardStep < wizardSteps.length - 1 ? (
              <Button onClick={() => setWizardStep(wizardStep + 1)} className="bg-primary text-primary-foreground font-mono text-xs min-h-[44px]">
                Next
              </Button>
            ) : (
              <Button onClick={handleSave} className="bg-primary text-primary-foreground font-mono text-xs min-h-[44px]">
                <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" />
                Save Program
              </Button>
            )}
            <Button variant="outline" onClick={onClose} className="font-mono text-xs min-h-[44px]">
              Cancel
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ═══════════════════════════════════════════════════════
// ─── MAIN PAGE ───────────────────────────────────────
// ═══════════════════════════════════════════════════════

export default function CookPrograms() {
  const [, setLocation] = useLocation();
  const { user, isAuthenticated } = useAuth();
  const { data: status } = useTraegerStatus();
  const { telemetry: sseTelemetry } = useSSETelemetry({ enabled: !!status?.connected });
  const isMobile = useIsMobile();
  const utils = trpc.useUtils();

  // Automation programs from DB
  const { data: savedPrograms, refetch: refetchSaved } = trpc.automation.list.useQuery(undefined, {
    enabled: !!status?.connected,
  });

  // Custom templates (legacy) from DB
  const { data: myTemplates, refetch: refetchMyTemplates } = trpc.customTemplates.mine.useQuery(undefined, {
    enabled: !!isAuthenticated,
  });
  const { data: communityTemplates } = trpc.customTemplates.community.useQuery();

  // Execution history
  const { data: executionHistory, refetch: refetchHistory } = trpc.executions.history.useQuery(
    { limit: 50 },
    { enabled: !!isAuthenticated }
  );
  const reviewExecution = trpc.executions.review.useMutation({
    onSuccess: () => {
      refetchHistory();
      toast.success("Review saved!");
    },
  });

  // State
  const [activeTab, setActiveTab] = useState("library");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [selectedItem, setSelectedItem] = useState<UnifiedProgram | null>(null);
  const [variableValues, setVariableValues] = useState<Record<string, string | number>>({});
  const [showBuilder, setShowBuilder] = useState(false);
  const [builderInitial, setBuilderInitial] = useState<CookProgram | undefined>(undefined);

  // First-use hints
  const [showWelcomeHint, dismissWelcomeHint] = useFirstUseHint("cook_programs_welcome");

  // Mutations
  const createFromPreset = trpc.automation.createFromPreset.useMutation({
    onSuccess: () => {
      refetchSaved();
      setSelectedItem(null);
      toast.success("Program added to your collection!");
    },
  });
  const deleteProgram = trpc.automation.delete.useMutation({
    onSuccess: () => {
      refetchSaved();
      setSelectedItem(null);
      toast.info("Program deleted");
    },
  });
  const startProgram = trpc.automation.start.useMutation({
    onSuccess: () => {
      refetchSaved();
      setSelectedItem(null);
      toast.success("Program started!");
    },
  });
  const stopProgram = trpc.automation.stop.useMutation({
    onSuccess: () => {
      refetchSaved();
      toast.info("Program stopped");
    },
  });
  const forkProgram = trpc.automation.fork.useMutation({
    onSuccess: () => {
      refetchSaved();
      toast.success("Program duplicated!");
    },
  });
  const createProgram = trpc.automation.create.useMutation({
    onSuccess: () => {
      refetchSaved();
      setShowBuilder(false);
      toast.success("Custom program created!");
    },
  });

  // Legacy template mutations
  const forkTemplate = trpc.customTemplates.fork.useMutation({
    onSuccess: () => {
      refetchMyTemplates();
      toast.success("Template forked!");
    },
  });
  const publishTemplate = trpc.customTemplates.publish.useMutation({
    onSuccess: () => {
      refetchMyTemplates();
      utils.customTemplates.community.invalidate();
      toast.success("Visibility updated");
    },
  });
  const deleteTemplate = trpc.customTemplates.delete.useMutation({
    onSuccess: () => {
      refetchMyTemplates();
      setSelectedItem(null);
      toast.info("Template deleted");
    },
  });

  // Build unified library: presets + legacy guide templates
  const libraryItems: UnifiedProgram[] = useMemo(() => {
    const items: UnifiedProgram[] = [];

    // Automation presets (rich programs)
    PRESET_PROGRAMS.forEach((preset, i) => {
      items.push({
        id: `preset-${i}`,
        source: "preset",
        program: preset,
        presetIndex: i,
      });
    });

    // Legacy cook guide templates (converted)
    COOK_TEMPLATES.forEach(template => {
      const program = templateToProgram(template);
      // Don't duplicate if a preset already covers this (e.g., Competition Brisket vs Classic Brisket)
      const isDuplicate = items.some(item =>
        item.program.name.toLowerCase() === program.name.toLowerCase() ||
        (item.program.meatCut?.toLowerCase() === program.meatCut?.toLowerCase() &&
         item.program.method === program.method)
      );
      if (!isDuplicate) {
        items.push({
          id: `guide-${template.id}`,
          source: "guide",
          program,
        });
      }
    });

    return items;
  }, []);

  // Saved programs from DB
  const savedItems: UnifiedProgram[] = useMemo(() => {
    if (!savedPrograms) return [];
    return savedPrograms.map((prog) => {
      const programData = prog.programJson as CookProgram | null;
      return {
        id: `saved-${prog.id}`,
        source: "saved" as const,
        program: programData || {
          name: prog.name,
          description: prog.description || "",
          category: (prog.category || "other") as CookProgram["category"],
          method: (prog.method || "smoke") as CookProgram["method"],
          difficulty: (prog.difficulty || "intermediate") as CookProgram["difficulty"],
          estimatedTime: prog.estimatedTime || undefined,
          tags: [],
          variables: [],
          steps: [],
          tips: [],
        },
        dbId: prog.id,
        isActive: prog.isActive as number,
        status: prog.status,
      };
    });
  }, [savedPrograms]);

  // Community items from legacy custom templates
  const communityItems: UnifiedProgram[] = useMemo(() => {
    if (!communityTemplates) return [];
    return communityTemplates.map((t: any) => {
      const stages = JSON.parse(String(t.stagesJson || "[]"));
      const tips = t.tipsJson ? JSON.parse(String(t.tipsJson)) : [];
      // Convert legacy stages to steps
      const steps: ProgramStep[] = stages.map((s: any) => ({
        name: s.name,
        trigger: {
          type: s.triggerType === "time" ? "timer" : s.triggerType === "probe_temp" ? "probe_temp" : "manual",
          value: s.triggerType === "manual" ? undefined : s.triggerValue,
        } as StepTrigger,
        entryActions: [
          { type: "set_grill_temp" as ActionType, params: { temp: s.grillTemp } },
          ...(s.superSmoke ? [{ type: "super_smoke_on" as ActionType }] : []),
        ],
        actions: s.alertMessage ? [{ type: "send_notification" as ActionType, params: { message: s.alertMessage } }] : [],
      }));

      return {
        id: `community-${t.id}`,
        source: "community" as const,
        program: {
          name: t.name,
          description: t.description || "",
          category: (t.category || "other") as CookProgram["category"],
          method: (t.method || "smoke") as CookProgram["method"],
          meatCut: t.meatCut || undefined,
          difficulty: (t.difficulty || "intermediate") as CookProgram["difficulty"],
          estimatedTime: t.estimatedTime || undefined,
          tags: [],
          variables: [],
          steps,
          tips,
        },
        customId: t.id,
        isPublished: t.isPublished === 1,
        authorName: t.authorName || undefined,
        forkCount: t.forkCount || 0,
      };
    });
  }, [communityTemplates]);

  // Filter library
  const filteredLibrary = useMemo(() => {
    let items = libraryItems;
    if (selectedCategory !== "all") {
      items = items.filter(i => i.program.category === selectedCategory);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      items = items.filter(i =>
        i.program.name.toLowerCase().includes(q) ||
        i.program.description.toLowerCase().includes(q) ||
        (i.program.meatCut?.toLowerCase().includes(q)) ||
        i.program.method.toLowerCase().includes(q) ||
        i.program.category.toLowerCase().includes(q) ||
        i.program.tags.some(t => t.toLowerCase().includes(q))
      );
    }
    return items;
  }, [libraryItems, selectedCategory, searchQuery]);

  // Filter saved
  const filteredSaved = useMemo(() => {
    if (!searchQuery.trim()) return savedItems;
    const q = searchQuery.toLowerCase();
    return savedItems.filter(i =>
      i.program.name.toLowerCase().includes(q) ||
      i.program.description.toLowerCase().includes(q)
    );
  }, [savedItems, searchQuery]);

  // Filter community
  const filteredCommunity = useMemo(() => {
    if (!searchQuery.trim()) return communityItems;
    const q = searchQuery.toLowerCase();
    return communityItems.filter(i =>
      i.program.name.toLowerCase().includes(q) ||
      i.program.description.toLowerCase().includes(q) ||
      (i.authorName?.toLowerCase().includes(q))
    );
  }, [communityItems, searchQuery]);

  // Handlers
  const handleSelectItem = (item: UnifiedProgram) => {
    const defaults: Record<string, string | number> = {};
    for (const v of item.program.variables || []) {
      if (v.default != null) defaults[v.name] = v.default;
    }
    setVariableValues(defaults);
    setSelectedItem(item);
    if (showWelcomeHint) dismissWelcomeHint();
  };

  const handleStartPreset = () => {
    if (!selectedItem) return;
    if (selectedItem.presetIndex != null) {
      createFromPreset.mutate({
        presetIndex: selectedItem.presetIndex,
        variableValues,
      });
    } else {
      // For guide templates or community, create as custom program
      createProgram.mutate({
        name: selectedItem.program.name,
        description: selectedItem.program.description,
        category: selectedItem.program.category,
        method: selectedItem.program.method,
        difficulty: selectedItem.program.difficulty,
        estimatedTime: selectedItem.program.estimatedTime,
        program: selectedItem.program,
        variableValues,
      });
    }
  };

  const handleStartSaved = () => {
    if (!selectedItem?.dbId) return;
    startProgram.mutate({ id: selectedItem.dbId });
  };

  const handleBuilderSave = (program: CookProgram) => {
    createProgram.mutate({
      name: program.name,
      description: program.description,
      category: program.category,
      method: program.method,
      difficulty: program.difficulty,
      estimatedTime: program.estimatedTime,
      program: program,
      variableValues: {},
    });
  };

  // Active program for live execution display
  const activeProgram = savedItems.find(p => p.isActive === 1);
  const activeProgramDb = savedPrograms?.find(p => p.isActive);

  return (
    <div className="max-w-4xl mx-auto space-y-4 sm:space-y-6 px-0 sm:px-0">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-foreground tracking-tight">Cook Programs</h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1">
            Browse recipes, build custom programs, and run automated cooks with smart triggers.
          </p>
        </div>
        <div className="flex gap-2 shrink-0">
          {isAuthenticated && (
            <Button
              onClick={() => { setBuilderInitial(undefined); setShowBuilder(true); }}
              className="bg-primary text-primary-foreground font-mono text-xs min-h-[40px]"
            >
              <Wrench className="h-3.5 w-3.5 mr-1.5" />
              <span className="hidden sm:inline">Build Program</span>
              <span className="sm:hidden">Build</span>
            </Button>
          )}
        </div>
      </div>

      {/* Welcome hint */}
      {showWelcomeHint && !activeProgram && (
        <div className="flex items-start gap-3 p-3 rounded-lg bg-primary/5 border border-primary/20">
          <Info className="h-4 w-4 text-primary shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-xs text-foreground">
              Browse the <strong>Library</strong> for proven cook programs with smart triggers and auto-temperature control.
              Use the <strong>Builder</strong> to create your own custom programs from scratch.
            </p>
          </div>
          <button onClick={dismissWelcomeHint} className="text-muted-foreground hover:text-foreground text-xs shrink-0">
            dismiss
          </button>
        </div>
      )}

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search programs by name, cut, method..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-9 bg-secondary border-border font-mono text-sm placeholder:text-muted-foreground/50"
        />
        {searchQuery && (
          <button
            onClick={() => setSearchQuery("")}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Live Execution Hero — always on top when active */}
      {activeProgram && activeProgramDb && (
        <div className="space-y-2">
          <LiveExecution
            programId={activeProgramDb.id}
            program={activeProgramDb}
            viewers={sseTelemetry?.viewers}
          />
          <div className="flex justify-end">
            <Button
              variant="outline"
              size="sm"
              onClick={() => stopProgram.mutate({ id: activeProgramDb.id })}
              className="font-mono text-xs text-destructive hover:text-destructive min-h-[36px]"
            >
              <Square className="h-3.5 w-3.5 mr-1.5" />
              stop program
            </Button>
          </div>
        </div>
      )}

      {/* Main Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="bg-secondary w-full sm:w-auto">
          <TabsTrigger value="library" className="font-mono text-xs flex-1 sm:flex-none min-h-[40px]">
            <BookOpen className="h-3.5 w-3.5 mr-1.5" />
            Library
          </TabsTrigger>
          <TabsTrigger value="saved" className="font-mono text-xs flex-1 sm:flex-none min-h-[40px]">
            <ChefHat className="h-3.5 w-3.5 mr-1.5" />
            My Programs
            {savedItems.length > 0 && (
              <Badge variant="outline" className="ml-1.5 text-[9px] font-mono">{savedItems.length}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="community" className="font-mono text-xs flex-1 sm:flex-none min-h-[40px]">
            <Users className="h-3.5 w-3.5 mr-1.5" />
            Community
          </TabsTrigger>
          <TabsTrigger value="history" className="font-mono text-xs flex-1 sm:flex-none min-h-[40px]">
            <History className="h-3.5 w-3.5 mr-1.5" />
            History
            {executionHistory && executionHistory.length > 0 && (
              <Badge variant="outline" className="ml-1.5 text-[9px] font-mono">{executionHistory.length}</Badge>
            )}
          </TabsTrigger>
        </TabsList>

        {/* Library Tab */}
        <TabsContent value="library" className="mt-4 space-y-4">
          {/* Category filter */}
          <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-none">
            <Button
              variant={selectedCategory === "all" ? "default" : "outline"}
              size="sm"
              onClick={() => setSelectedCategory("all")}
              className="font-mono text-xs shrink-0 min-h-[40px]"
            >
              All
            </Button>
            {CATEGORIES.map(cat => (
              <Button
                key={cat.id}
                variant={selectedCategory === cat.id ? "default" : "outline"}
                size="sm"
                onClick={() => setSelectedCategory(cat.id)}
                className="font-mono text-xs shrink-0 min-h-[40px]"
              >
                {cat.label}
              </Button>
            ))}
          </div>

          {/* Program cards */}
          <div className={`grid gap-3 ${isMobile ? "grid-cols-1" : "grid-cols-1 md:grid-cols-2"}`}>
            {filteredLibrary.map(item => (
              <ProgramCard key={item.id} item={item} onSelect={() => handleSelectItem(item)} />
            ))}
          </div>

          {filteredLibrary.length === 0 && (
            <div className="text-center py-12 text-muted-foreground">
              {searchQuery ? <Search className="h-8 w-8 mx-auto mb-2 opacity-30" /> : <BookOpen className="h-8 w-8 mx-auto mb-2 opacity-30" />}
              <p className="text-sm font-mono">{searchQuery ? `No programs match "${searchQuery}"` : "No programs in this category."}</p>
            </div>
          )}
        </TabsContent>

        {/* My Programs Tab */}
        <TabsContent value="saved" className="mt-4 space-y-3">
          {filteredSaved.length > 0 ? (
            filteredSaved.map(item => (
              <Card key={item.id} className={`bg-card border-border ${item.isActive ? "border-green-500/50" : ""}`}>
                <CardContent className="p-3 sm:p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div
                      className="flex-1 min-w-0 cursor-pointer"
                      onClick={() => handleSelectItem(item)}
                    >
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-semibold text-foreground text-sm">{item.program.name}</h3>
                        {item.isActive === 1 ? (
                          <Badge className="bg-green-500/20 text-green-400 border-green-500/30 font-mono text-xs">
                            running
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="font-mono text-[10px]">
                            {item.status || "ready"}
                          </Badge>
                        )}
                        <Badge variant="outline" className={`text-xs font-mono ${methodColor(item.program.method)}`}>
                          {methodLabel(item.program.method)}
                        </Badge>
                      </div>
                      {item.program.description && (
                        <p className="text-xs text-muted-foreground mt-1 line-clamp-1">{item.program.description}</p>
                      )}
                      <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground font-mono flex-wrap">
                        <span>{item.program.steps.length} steps</span>
                        {item.program.estimatedTime && <span>{item.program.estimatedTime}</span>}
                      </div>
                    </div>
                    <div className={`flex items-center gap-1.5 shrink-0 ${isMobile ? "flex-col" : "flex-row"}`}>
                      {item.isActive === 1 ? (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => item.dbId && stopProgram.mutate({ id: item.dbId })}
                          className="font-mono text-xs min-h-[36px] min-w-[36px]"
                        >
                          <Square className="h-3.5 w-3.5" />
                          {!isMobile && <span className="ml-1.5">stop</span>}
                        </Button>
                      ) : (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => item.dbId && startProgram.mutate({ id: item.dbId })}
                          className="font-mono text-xs min-h-[36px] min-w-[36px]"
                        >
                          <Play className="h-3.5 w-3.5" />
                          {!isMobile && <span className="ml-1.5">start</span>}
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => item.dbId && forkProgram.mutate({ sourceId: item.dbId })}
                        className="h-9 w-9 p-0 text-muted-foreground"
                        title="Duplicate"
                      >
                        <Copy className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          if (item.dbId && confirm("Delete this program?")) {
                            deleteProgram.mutate({ id: item.dbId });
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
            ))
          ) : (
            <Card className="bg-card border-border">
              <CardContent className="p-6 sm:p-8 text-center">
                <Workflow className="h-8 w-8 text-muted-foreground mx-auto mb-3 opacity-30" />
                <p className="text-muted-foreground text-sm font-mono">
                  No saved programs yet.
                </p>
                <p className="text-xs text-muted-foreground/60 mt-1 mb-4">
                  Browse the Library to add proven cook programs, or build your own.
                </p>
                <div className="flex gap-2 justify-center">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setActiveTab("library")}
                    className="font-mono text-xs min-h-[40px]"
                  >
                    <BookOpen className="h-3.5 w-3.5 mr-1.5" />
                    Browse Library
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => { setBuilderInitial(undefined); setShowBuilder(true); }}
                    className="bg-primary text-primary-foreground font-mono text-xs min-h-[40px]"
                  >
                    <Wrench className="h-3.5 w-3.5 mr-1.5" />
                    Build Custom
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Community Tab */}
        <TabsContent value="community" className="mt-4 space-y-3">
          {filteredCommunity.length > 0 ? (
            <div className={`grid gap-3 ${isMobile ? "grid-cols-1" : "grid-cols-1 md:grid-cols-2"}`}>
              {filteredCommunity.map(item => (
                <ProgramCard key={item.id} item={item} onSelect={() => handleSelectItem(item)} />
              ))}
            </div>
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              <Users className="h-8 w-8 mx-auto mb-2 opacity-30" />
              <p className="text-sm font-mono">
                {searchQuery ? `No community programs match "${searchQuery}"` : "No community programs shared yet."}
              </p>
              <p className="text-xs text-muted-foreground/60 mt-1">
                Build a program and share it with the community.
              </p>
            </div>
          )}
        </TabsContent>

        {/* History Tab */}
        <TabsContent value="history" className="mt-4 space-y-3">
          <ExecutionHistoryTab
            executions={executionHistory ?? []}
            onReview={(id, notes, rating) => reviewExecution.mutate({ id, notes, rating })}
            isMobile={isMobile}
          />
        </TabsContent>
      </Tabs>

      {/* Program Detail Dialog */}
      <ProgramDetailDialog
        item={selectedItem}
        open={!!selectedItem}
        onClose={() => setSelectedItem(null)}
        onStartPreset={handleStartPreset}
        onStartSaved={selectedItem?.source === "saved" ? handleStartSaved : undefined}
        onFork={
          selectedItem?.source === "community" && selectedItem.customId
            ? () => { forkTemplate.mutate({ id: selectedItem.customId! }); setSelectedItem(null); }
            : selectedItem?.source === "saved" && selectedItem.dbId
            ? () => { forkProgram.mutate({ sourceId: selectedItem.dbId! }); setSelectedItem(null); }
            : undefined
        }
        onDelete={
          selectedItem?.source === "saved" && selectedItem.dbId
            ? () => { if (confirm("Delete this program?")) { deleteProgram.mutate({ id: selectedItem.dbId! }); } }
            : selectedItem?.source === "community" && selectedItem.customId
            ? () => { if (confirm("Delete this template?")) { deleteTemplate.mutate({ id: selectedItem.customId! }); } }
            : undefined
        }
        onPublish={
          selectedItem?.source === "community" && selectedItem.customId
            ? (pub) => { publishTemplate.mutate({ id: selectedItem.customId!, publish: pub }); setSelectedItem(null); }
            : undefined
        }
        variableValues={variableValues}
        onVariableChange={setVariableValues}
      />

      {/* Program Builder Dialog */}
      <ProgramBuilder
        open={showBuilder}
        onClose={() => setShowBuilder(false)}
        onSave={handleBuilderSave}
        initialProgram={builderInitial}
      />
    </div>
  );
}
