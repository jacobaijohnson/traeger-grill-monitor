import { trpc } from "@/lib/trpc";
import { useTraegerStatus } from "@/hooks/useTraeger";
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
  Workflow,
  Plus,
  Play,
  Square,
  Trash2,
  Copy,
  WifiOff,
  ChevronRight,
  Flame,
  Timer,
  Thermometer,
  Bell,
  SkipForward,
  CheckCircle2,
  BookOpen,
  Beef,
  ChefHat,
} from "lucide-react";
import { useState, useMemo } from "react";
import { useLocation } from "wouter";
import { toast } from "sonner";
import type { CookProgram, ProgramStep, ProgramVariable } from "@shared/cook-programs";

// ─── Preset Library Browser ────────────────────────────

function PresetLibrary({
  onSelect,
}: {
  onSelect: (preset: CookProgram & { id: string }, index: number) => void;
}) {
  const { data: presets } = trpc.automation.presets.useQuery();
  const [filter, setFilter] = useState<string>("all");

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

  const difficultyColor = (d: string) => {
    switch (d) {
      case "beginner": return "bg-green-500/20 text-green-400 border-green-500/30";
      case "intermediate": return "bg-amber-500/20 text-amber-400 border-amber-500/30";
      case "advanced": return "bg-red-500/20 text-red-400 border-red-500/30";
      default: return "bg-muted text-muted-foreground";
    }
  };

  return (
    <div className="space-y-4">
      {/* Category filter */}
      <div className="flex flex-wrap gap-2">
        {categories.map((cat) => (
          <Button
            key={cat}
            variant={filter === cat ? "default" : "outline"}
            size="sm"
            onClick={() => setFilter(cat)}
            className="font-mono text-xs capitalize"
          >
            {cat}
          </Button>
        ))}
      </div>

      {/* Preset cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {filtered.map((preset: any, i: number) => (
          <Card
            key={preset.id}
            className="bg-card border-border hover:border-primary/50 transition-colors cursor-pointer"
            onClick={() => onSelect(preset, i)}
          >
            <CardContent className="p-4">
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-semibold text-foreground text-sm truncate">{preset.name}</h3>
                    <Badge className={`${difficultyColor(preset.difficulty)} font-mono text-[10px] shrink-0`}>
                      {preset.difficulty}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground line-clamp-2">{preset.description}</p>
                  <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground font-mono">
                    {preset.estimatedTime && <span className="flex items-center gap-1"><Timer className="h-3 w-3" />{preset.estimatedTime}</span>}
                    {preset.method && <span className="capitalize">{preset.method}</span>}
                    <span>{preset.steps?.length || 0} steps</span>
                  </div>
                  {preset.tags && preset.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {preset.tags.slice(0, 4).map((tag: string) => (
                        <Badge key={tag} variant="outline" className="text-[10px] font-mono">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0 ml-2 mt-1" />
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

// ─── Variable Configuration Dialog ─────────────────────

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
        <div key={v.name} className="flex items-center gap-3">
          <div className="flex-1">
            <Label className="text-xs text-muted-foreground font-mono">{v.label}</Label>
            {v.options ? (
              <div className="flex flex-wrap gap-2 mt-1">
                {v.options.map((opt) => (
                  <Button
                    key={opt}
                    variant={(values[v.name] ?? v.default) === opt ? "default" : "outline"}
                    size="sm"
                    onClick={() => onChange({ ...values, [v.name]: opt })}
                    className="font-mono text-xs capitalize"
                  >
                    {opt}
                  </Button>
                ))}
              </div>
            ) : (
              <Input
                type={v.type === "number" ? "number" : "text"}
                value={values[v.name] ?? v.default ?? ""}
                onChange={(e) => onChange({
                  ...values,
                  [v.name]: v.type === "number" ? Number(e.target.value) || 0 : e.target.value,
                })}
                min={v.min}
                max={v.max}
                className="bg-secondary text-foreground text-sm font-mono mt-1"
              />
            )}
            {v.unit && <span className="text-[10px] text-muted-foreground/60 font-mono ml-1">{v.unit}</span>}
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Step Preview ──────────────────────────────────────

function StepPreview({ steps }: { steps: ProgramStep[] }) {
  return (
    <div className="space-y-2">
      <h4 className="text-xs text-muted-foreground font-mono uppercase tracking-wider">Program Steps</h4>
      {steps.map((step, i) => (
        <div key={i} className="flex items-start gap-3 p-2 rounded bg-secondary/50">
          <div className="w-6 h-6 rounded-full bg-primary/20 text-primary flex items-center justify-center text-xs font-bold font-mono shrink-0 mt-0.5">
            {i + 1}
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-semibold text-foreground text-sm">{step.name}</div>
            <div className="flex flex-wrap items-center gap-2 mt-1 text-xs text-muted-foreground font-mono">
              {/* Entry actions summary */}
              {step.entryActions?.map((a, j) => {
                if (a.type === "set_grill_temp") return (
                  <span key={j} className="flex items-center gap-1">
                    <Flame className="h-3 w-3 text-orange-400" />
                    {String(a.params?.temp ?? "?")}°F
                  </span>
                );
                if (a.type === "super_smoke_on") return (
                  <Badge key={j} className="bg-blue-500/20 text-blue-400 border-blue-500/30 text-[10px]">S.Smoke</Badge>
                );
                return null;
              })}
              {/* Trigger */}
              <span className="flex items-center gap-1 text-primary/80">
                <Thermometer className="h-3 w-3" />
                {step.trigger.type === "probe_temp" && `Probe → ${step.trigger.value}°F`}
                {step.trigger.type === "grill_temp" && `Grill → ${step.trigger.value}°F`}
                {step.trigger.type === "timer" && `Timer: ${Math.round(Number(step.trigger.value || 0) / 60)}min`}
                {step.trigger.type === "manual" && "Manual advance"}
                {step.trigger.type === "immediate" && "Immediate"}
              </span>
              {/* Alert indicator */}
              {step.alertOnTrigger && (
                <span className="flex items-center gap-1">
                  <Bell className="h-3 w-3 text-amber-400" />
                  {step.alertOnTrigger.type === "alarm" ? "Alarm" : "Notify"}
                </span>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Live Execution Display ────────────────────────────

function LiveExecution({
  programId,
  program,
}: {
  programId: number;
  program: any;
}) {
  const { data: liveState, refetch: refetchLive } = trpc.automation.getLiveState.useQuery(
    { grillId: undefined },
    { refetchInterval: 2000 }
  );
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

  if (!liveState?.active) return null;

  const steps: ProgramStep[] = program?.programJson?.steps || program?.steps || [];
  const currentStep = steps[liveState.phase];

  return (
    <Card className="bg-card border-primary/50 border-2">
      <CardContent className="p-4">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
          <span className="text-xs font-mono text-green-400 uppercase tracking-wider">Live Execution</span>
          <span className="text-xs text-muted-foreground font-mono ml-auto">
            Phase {liveState.phase + 1} / {liveState.totalPhases}
          </span>
        </div>

        {/* Phase progress bar */}
        <div className="flex gap-1 mb-3">
          {Array.from({ length: liveState.totalPhases }).map((_, i) => (
            <div
              key={i}
              className={`h-1.5 flex-1 rounded-full transition-colors ${
                i < liveState.phase
                  ? "bg-green-500"
                  : i === liveState.phase
                  ? "bg-primary animate-pulse"
                  : "bg-muted"
              }`}
            />
          ))}
        </div>

        {/* Current phase info */}
        {currentStep && (
          <div className="bg-secondary/50 rounded p-3 mb-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-primary/20 text-primary flex items-center justify-center text-sm font-bold font-mono">
                {liveState.phase + 1}
              </div>
              <div>
                <div className="font-semibold text-foreground text-sm">{liveState.currentPhaseName || currentStep.name}</div>
                <div className="text-xs text-muted-foreground font-mono">
                  {currentStep.trigger.type === "probe_temp" && `Waiting for probe to reach ${currentStep.trigger.value}°F`}
                  {currentStep.trigger.type === "timer" && `Timer: ${Math.round(Number(currentStep.trigger.value || 0) / 60)} minutes`}
                  {currentStep.trigger.type === "manual" && "Waiting for manual advance"}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Auto commands log */}
        {liveState.autoCommandsSent.length > 0 && (
          <div className="text-xs text-muted-foreground font-mono mb-3 space-y-1">
            {liveState.autoCommandsSent.slice(-3).map((cmd, i) => (
              <div key={i} className="flex items-center gap-1.5">
                <CheckCircle2 className="h-3 w-3 text-green-400" />
                <span>{cmd}</span>
              </div>
            ))}
          </div>
        )}

        {/* Action buttons */}
        <div className="flex items-center gap-2">
          {liveState.phaseAcknowledged === false && (
            <Button
              size="sm"
              className="bg-amber-500 hover:bg-amber-600 text-white font-mono text-xs animate-pulse"
              onClick={() => acknowledge.mutate({ grillId: undefined })}
            >
              <Bell className="h-3.5 w-3.5 mr-1.5" />
              acknowledge alarm
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            className="font-mono text-xs"
            onClick={() => skip.mutate({ grillId: undefined })}
          >
            <SkipForward className="h-3.5 w-3.5 mr-1.5" />
            skip phase
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Main Automation Page ──────────────────────────────

export default function Automation() {
  const [, setLocation] = useLocation();
  const { data: status } = useTraegerStatus();
  const { data: programs, refetch } = trpc.automation.list.useQuery(undefined, {
    enabled: !!status?.connected,
  });

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

  // Find active program
  const activeProgram = programs?.find((p) => p.isActive);

  const handleSelectPreset = (preset: any, index: number) => {
    // Initialize variable values from defaults
    const defaults: Record<string, string | number> = {};
    for (const v of preset.variables || []) {
      if (v.default != null) defaults[v.name] = v.default;
    }
    setVariableValues(defaults);
    setSelectedPreset({ preset, index });
  };

  const handleCreateFromPreset = () => {
    if (!selectedPreset) return;
    createFromPreset.mutate({
      presetIndex: selectedPreset.index,
      variableValues,
    });
  };

  if (!status?.connected) {
    return (
      <div className="max-w-lg mx-auto mt-12">
        <Card className="bg-card border-border">
          <CardContent className="p-8 text-center">
            <WifiOff className="h-10 w-10 text-muted-foreground mx-auto mb-4 opacity-50" />
            <h2 className="text-lg font-semibold text-foreground mb-2">No Grill Connected</h2>
            <p className="text-sm text-muted-foreground mb-6">
              Connect your grill account to create automation programs.
            </p>
            <Button onClick={() => setLocation("/settings")} className="bg-primary text-primary-foreground font-mono text-xs">
              go to settings
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight">Cook Automation</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Multi-phase cook programs with automatic temperature control, smart triggers, and persistent alarms.
          </p>
        </div>
      </div>

      {/* Live Execution Display */}
      {activeProgram && (
        <LiveExecution programId={activeProgram.id} program={activeProgram} />
      )}

      {/* Tabs: My Programs / Preset Library */}
      <Tabs defaultValue="programs" className="w-full">
        <TabsList className="bg-secondary">
          <TabsTrigger value="programs" className="font-mono text-xs">
            <ChefHat className="h-3.5 w-3.5 mr-1.5" />
            My Programs
          </TabsTrigger>
          <TabsTrigger value="presets" className="font-mono text-xs">
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
                <Card key={prog.id} className="bg-card border-border">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
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
                          {prog.difficulty && (
                            <Badge variant="outline" className="font-mono text-[10px] capitalize">
                              {prog.difficulty}
                            </Badge>
                          )}
                        </div>
                        {prog.description && (
                          <p className="text-xs text-muted-foreground mt-1 line-clamp-1">{prog.description}</p>
                        )}
                        <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground font-mono">
                          <span>{steps.length} steps</span>
                          {prog.estimatedTime && <span>{prog.estimatedTime}</span>}
                          {prog.category && <span className="capitalize">{prog.category}</span>}
                          {steps.length > 0 && (
                            <span className="text-primary/60">
                              {steps.slice(0, 3).map((s) => s.name).join(" → ")}
                              {steps.length > 3 ? " ..." : ""}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0 ml-3">
                        {prog.isActive ? (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => stopProgram.mutate({ id: prog.id })}
                            className="font-mono text-xs"
                          >
                            <Square className="h-3.5 w-3.5 mr-1.5" />
                            stop
                          </Button>
                        ) : (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => startProgram.mutate({ id: prog.id })}
                            className="font-mono text-xs"
                          >
                            <Play className="h-3.5 w-3.5 mr-1.5" />
                            start
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => forkProgram.mutate({ sourceId: prog.id })}
                          className="h-8 w-8 p-0 text-muted-foreground"
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
                          className="text-destructive h-8 w-8 p-0"
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
              <CardContent className="p-8 text-center">
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

      {/* Preset Configuration Dialog */}
      <Dialog open={!!selectedPreset} onOpenChange={(open) => !open && setSelectedPreset(null)}>
        <DialogContent className="bg-card border-border max-w-2xl max-h-[85vh] overflow-y-auto">
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
                <VariableConfig
                  variables={selectedPreset.preset.variables}
                  values={variableValues}
                  onChange={setVariableValues}
                />
              )}

              {/* Step preview */}
              <StepPreview steps={selectedPreset.preset.steps || []} />

              {/* Tips */}
              {selectedPreset.preset.tips && selectedPreset.preset.tips.length > 0 && (
                <div className="space-y-1">
                  <h4 className="text-xs text-muted-foreground font-mono uppercase tracking-wider">Tips</h4>
                  {selectedPreset.preset.tips.map((tip: string, i: number) => (
                    <p key={i} className="text-xs text-muted-foreground pl-3 border-l-2 border-primary/30">
                      {tip}
                    </p>
                  ))}
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedPreset(null)} className="font-mono text-xs">
              cancel
            </Button>
            <Button
              className="bg-primary text-primary-foreground font-mono text-xs"
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
