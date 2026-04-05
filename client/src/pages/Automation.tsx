import { trpc } from "@/lib/trpc";
import { useTraegerStatus } from "@/hooks/useTraeger";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
  Workflow,
  Plus,
  Play,
  Square,
  Trash2,
  X,
  WifiOff,
} from "lucide-react";
import { useState } from "react";
import { useLocation } from "wouter";
import { toast } from "sonner";
import type { CookStage } from "@shared/traeger-types";

interface StageForm {
  name: string;
  grillTemp: number;
  triggerType: "time" | "probe_temp" | "manual";
  triggerValue: number;
  superSmoke: boolean;
  alertMessage: string;
}

const emptyStage: StageForm = {
  name: "",
  grillTemp: 225,
  triggerType: "probe_temp",
  triggerValue: 165,
  superSmoke: false,
  alertMessage: "",
};

function StageEditor({
  stage,
  index,
  onChange,
  onRemove,
}: {
  stage: StageForm;
  index: number;
  onChange: (s: StageForm) => void;
  onRemove: () => void;
}) {
  return (
    <Card className="bg-secondary/50 border-border">
      <CardContent className="p-3 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-full bg-primary/20 text-primary flex items-center justify-center text-xs font-bold font-mono">
              {index + 1}
            </div>
            <Input
              value={stage.name}
              onChange={(e) => onChange({ ...stage, name: e.target.value })}
              placeholder="Stage name (e.g., Smoke Phase)"
              className="bg-background text-foreground max-w-xs text-sm"
            />
          </div>
          <Button variant="ghost" size="sm" onClick={onRemove} className="h-6 w-6 p-0 text-destructive">
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div>
            <Label className="text-xs text-muted-foreground font-mono">Grill Temp (°F)</Label>
            <Input
              type="number"
              value={stage.grillTemp}
              onChange={(e) => onChange({ ...stage, grillTemp: parseInt(e.target.value) || 225 })}
              className="bg-background text-foreground text-sm font-mono"
              min={165}
              max={500}
            />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground font-mono">Trigger</Label>
            <Select
              value={stage.triggerType}
              onValueChange={(v) => onChange({ ...stage, triggerType: v as StageForm["triggerType"] })}
            >
              <SelectTrigger className="bg-background text-foreground text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="probe_temp">Probe Temp</SelectItem>
                <SelectItem value="time">Time</SelectItem>
                <SelectItem value="manual">Manual</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs text-muted-foreground font-mono">
              {stage.triggerType === "time" ? "Duration (min)" : stage.triggerType === "probe_temp" ? "Target °F" : "N/A"}
            </Label>
            <Input
              type="number"
              value={stage.triggerType === "time" ? Math.floor(stage.triggerValue / 60) : stage.triggerValue}
              onChange={(e) => {
                const val = parseInt(e.target.value) || 0;
                onChange({
                  ...stage,
                  triggerValue: stage.triggerType === "time" ? val * 60 : val,
                });
              }}
              className="bg-background text-foreground text-sm font-mono"
              disabled={stage.triggerType === "manual"}
            />
          </div>
          <div className="flex items-end">
            <div className="flex items-center gap-2">
              <Switch
                checked={stage.superSmoke}
                onCheckedChange={(c) => onChange({ ...stage, superSmoke: c })}
              />
              <Label className="text-xs text-muted-foreground font-mono">S.Smoke</Label>
            </div>
          </div>
        </div>

        <div>
          <Label className="text-xs text-muted-foreground font-mono">Alert Message</Label>
          <Input
            value={stage.alertMessage}
            onChange={(e) => onChange({ ...stage, alertMessage: e.target.value })}
            placeholder="e.g., Time to wrap the brisket!"
            className="bg-background text-foreground text-sm"
          />
        </div>
      </CardContent>
    </Card>
  );
}

export default function Automation() {
  const [, setLocation] = useLocation();
  const { data: status } = useTraegerStatus();
  const { data: programs, refetch } = trpc.automation.list.useQuery(undefined, {
    enabled: !!status?.connected,
  });
  const createProgram = trpc.automation.create.useMutation({
    onSuccess: () => {
      refetch();
      setShowBuilder(false);
      toast.success("Cook program created!");
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

  const [showBuilder, setShowBuilder] = useState(false);
  const [programName, setProgramName] = useState("");
  const [programDesc, setProgramDesc] = useState("");
  const [stages, setStages] = useState<StageForm[]>([{ ...emptyStage }]);

  const addStage = () => setStages([...stages, { ...emptyStage }]);
  const removeStage = (i: number) => setStages(stages.filter((_, idx) => idx !== i));
  const updateStage = (i: number, s: StageForm) => {
    const next = [...stages];
    next[i] = s;
    setStages(next);
  };

  const handleCreate = () => {
    if (!programName.trim()) {
      toast.error("Program name is required");
      return;
    }
    if (stages.length === 0) {
      toast.error("At least one stage is required");
      return;
    }
    createProgram.mutate({
      name: programName,
      description: programDesc || undefined,
      stages: stages.map((s) => ({
        name: s.name || `Stage ${stages.indexOf(s) + 1}`,
        grillTemp: s.grillTemp,
        triggerType: s.triggerType,
        triggerValue: s.triggerValue,
        superSmoke: s.superSmoke,
        alertMessage: s.alertMessage || "Stage complete",
      })),
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
            Create multi-stage cook programs with automatic temperature changes and smart triggers.
          </p>
        </div>
        <Button onClick={() => setShowBuilder(true)} className="bg-primary text-primary-foreground font-mono text-xs">
          <Plus className="h-3.5 w-3.5 mr-1.5" />
          new program
        </Button>
      </div>

      {/* Existing Programs */}
      {programs && programs.length > 0 ? (
        <div className="space-y-3">
          {programs.map((prog) => {
            const parsedStages: CookStage[] = typeof prog.stagesJson === "string"
              ? JSON.parse(prog.stagesJson)
              : (prog.stagesJson as CookStage[]);
            return (
              <Card key={prog.id} className="bg-card border-border">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-foreground text-sm">{prog.name}</h3>
                        {prog.isActive ? (
                          <Badge className="bg-green-500/20 text-green-400 border-green-500/30 font-mono text-xs">
                            active · stage {(prog.currentStage || 0) + 1}
                          </Badge>
                        ) : null}
                      </div>
                      {prog.description && (
                        <p className="text-xs text-muted-foreground mt-1">{prog.description}</p>
                      )}
                      <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground font-mono">
                        <span>{parsedStages.length} stages</span>
                        <span className="text-primary/60">
                          {parsedStages.map((s) => `${s.grillTemp}°`).join(" → ")}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
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
                          className="text-green-400 border-green-500/30 font-mono text-xs"
                        >
                          <Play className="h-3.5 w-3.5 mr-1.5" />
                          start
                        </Button>
                      )}
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
          })}
        </div>
      ) : (
        <Card className="bg-card border-border">
          <CardContent className="p-8 text-center">
            <Workflow className="h-8 w-8 text-muted-foreground mx-auto mb-3 opacity-30" />
            <p className="text-muted-foreground text-sm font-mono">
              No automation programs yet.
            </p>
            <p className="text-xs text-muted-foreground/60 mt-1">
              Create one to automate multi-stage cooks, or browse the Cook Guide for pre-built programs.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Program Builder Dialog */}
      <Dialog open={showBuilder} onOpenChange={setShowBuilder}>
        <DialogContent className="bg-card border-border max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-foreground">Create Cook Program</DialogTitle>
            <DialogDescription>
              Define stages with temperature targets and trigger conditions.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-xs text-muted-foreground font-mono">Program Name *</Label>
                <Input
                  value={programName}
                  onChange={(e) => setProgramName(e.target.value)}
                  placeholder="e.g., Overnight Brisket"
                  className="bg-secondary text-foreground"
                />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground font-mono">Description</Label>
                <Input
                  value={programDesc}
                  onChange={(e) => setProgramDesc(e.target.value)}
                  placeholder="e.g., 12-hour low and slow brisket"
                  className="bg-secondary text-foreground"
                />
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-xs text-muted-foreground font-mono uppercase tracking-wider">Stages</Label>
                <Button variant="outline" size="sm" onClick={addStage} className="font-mono text-xs">
                  <Plus className="h-3 w-3 mr-1.5" />
                  add stage
                </Button>
              </div>
              {stages.map((stage, i) => (
                <StageEditor
                  key={i}
                  stage={stage}
                  index={i}
                  onChange={(s) => updateStage(i, s)}
                  onRemove={() => removeStage(i)}
                />
              ))}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowBuilder(false)} className="font-mono text-xs">
              cancel
            </Button>
            <Button
              className="bg-primary text-primary-foreground font-mono text-xs"
              onClick={handleCreate}
              disabled={createProgram.isPending}
            >
              {createProgram.isPending ? "creating..." : "create program"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
