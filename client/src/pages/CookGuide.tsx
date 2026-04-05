import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Flame,
  Clock,
  Thermometer,
  ChevronRight,
  Wind,
  AlertCircle,
  Lightbulb,
  Play,
  Plus,
  Users,
  BookOpen,
  Trash2,
  Share2,
  GitFork,
  Pencil,
  X,
} from "lucide-react";
import { useState, useMemo } from "react";
import { CATEGORIES, COOKING_METHODS } from "@shared/cook-templates";
import type { CookTemplate, CookStage } from "@shared/traeger-types";
import { toast } from "sonner";

function MethodBadge({ method }: { method: string }) {
  const colors: Record<string, string> = {
    smoke: "bg-purple-500/20 text-purple-400 border-purple-500/30",
    grill: "bg-primary/20 text-primary border-primary/30",
    reverse_sear: "bg-red-500/20 text-red-400 border-red-500/30",
    roast: "bg-amber-500/20 text-amber-400 border-amber-500/30",
    bake: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  };
  const labels: Record<string, string> = {
    smoke: "Smoke",
    grill: "Grill",
    reverse_sear: "Reverse Sear",
    roast: "Roast",
    bake: "Bake",
  };
  return (
    <Badge variant="outline" className={`text-xs font-mono ${colors[method] || ""}`}>
      {labels[method] || method}
    </Badge>
  );
}

function StageTimeline({ stages }: { stages: CookStage[] }) {
  return (
    <div className="space-y-3">
      {stages.map((stage, i) => (
        <div key={i} className="flex gap-3">
          <div className="flex flex-col items-center">
            <div className="w-7 h-7 rounded-full bg-primary/20 text-primary flex items-center justify-center text-xs font-bold font-mono">
              {i + 1}
            </div>
            {i < stages.length - 1 && <div className="w-0.5 h-full bg-border mt-1" />}
          </div>
          <div className="flex-1 pb-4">
            <div className="font-medium text-foreground text-sm">{stage.name}</div>
            <div className="flex flex-wrap gap-1.5 mt-1">
              <Badge variant="outline" className="text-xs bg-primary/10 text-primary border-primary/20 font-mono">
                <Flame className="h-3 w-3 mr-1" />
                {stage.grillTemp}°F
              </Badge>
              {stage.superSmoke && (
                <Badge variant="outline" className="text-xs bg-purple-500/10 text-purple-400 border-purple-500/20 font-mono">
                  <Wind className="h-3 w-3 mr-1" />
                  Super Smoke
                </Badge>
              )}
              <Badge variant="outline" className="text-xs font-mono">
                {stage.triggerType === "time"
                  ? `${Math.floor(stage.triggerValue / 3600)}h ${Math.floor((stage.triggerValue % 3600) / 60)}m`
                  : stage.triggerType === "probe_temp"
                    ? `Probe → ${stage.triggerValue}°F`
                    : "Manual advance"}
              </Badge>
            </div>
            <div className="text-xs text-muted-foreground mt-1 flex items-start gap-1">
              <AlertCircle className="h-3 w-3 mt-0.5 shrink-0" />
              {stage.alertMessage}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function TemplateCard({
  template,
  onSelect,
}: {
  template: CookTemplate;
  onSelect: () => void;
}) {
  return (
    <Card
      className="bg-card border-border hover:border-primary/30 transition-colors cursor-pointer group"
      onClick={onSelect}
    >
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <h3 className="font-semibold text-foreground text-sm group-hover:text-primary transition-colors">
                {template.name}
              </h3>
              <MethodBadge method={template.method} />
            </div>
            <p className="text-xs text-muted-foreground mb-2">{template.cut}</p>
            <p className="text-xs text-muted-foreground/80 line-clamp-2">{template.description}</p>
            <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground font-mono">
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {template.estimatedTime}
              </span>
              <span className="flex items-center gap-1">
                <Flame className="h-3 w-3" />
                {template.stages[0]?.grillTemp}°F
              </span>
              <span>{template.stages.length} stage{template.stages.length !== 1 ? "s" : ""}</span>
            </div>
          </div>
          <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors shrink-0 mt-1" />
        </div>
      </CardContent>
    </Card>
  );
}

interface CustomTemplateRow {
  id: number;
  name: string;
  description: string | null;
  category: string;
  method: string;
  meatCut: string | null;
  difficulty: string;
  estimatedTime: string | null;
  stagesJson: unknown;
  tipsJson: unknown;
  isPublished: number;
  forkCount: number;
  authorName: string | null;
}

function CustomTemplateCard({
  template,
  onSelect,
  showAuthor,
}: {
  template: CustomTemplateRow;
  onSelect: () => void;
  showAuthor?: boolean;
}) {
  const stages = JSON.parse(String(template.stagesJson || "[]")) as CookStage[];
  return (
    <Card
      className="bg-card border-border hover:border-primary/30 transition-colors cursor-pointer group"
      onClick={onSelect}
    >
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <h3 className="font-semibold text-foreground text-sm group-hover:text-primary transition-colors">
                {template.name}
              </h3>
              <MethodBadge method={template.method} />
              {template.isPublished === 1 && (
                <Badge variant="outline" className="text-xs bg-green-500/10 text-green-400 border-green-500/20 font-mono">
                  shared
                </Badge>
              )}
            </div>
            {template.meatCut && (
              <p className="text-xs text-muted-foreground mb-1">{template.meatCut}</p>
            )}
            {template.description && (
              <p className="text-xs text-muted-foreground/80 line-clamp-2">{template.description}</p>
            )}
            <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground font-mono">
              {template.estimatedTime && (
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {template.estimatedTime}
                </span>
              )}
              <span>{stages.length} stage{stages.length !== 1 ? "s" : ""}</span>
              {template.forkCount > 0 && (
                <span className="flex items-center gap-1">
                  <GitFork className="h-3 w-3" />
                  {template.forkCount}
                </span>
              )}
              {showAuthor && template.authorName && (
                <span className="text-muted-foreground/60">by {template.authorName}</span>
              )}
            </div>
          </div>
          <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors shrink-0 mt-1" />
        </div>
      </CardContent>
    </Card>
  );
}

// Stage editor for creating custom templates
function StageEditor({
  stages,
  onChange,
}: {
  stages: CookStage[];
  onChange: (stages: CookStage[]) => void;
}) {
  const addStage = () => {
    onChange([
      ...stages,
      {
        name: `Stage ${stages.length + 1}`,
        grillTemp: 225,
        triggerType: "time",
        triggerValue: 3600,
        superSmoke: false,
        alertMessage: "Stage complete",
      },
    ]);
  };

  const updateStage = (index: number, updates: Partial<CookStage>) => {
    const newStages = [...stages];
    newStages[index] = { ...newStages[index], ...updates };
    onChange(newStages);
  };

  const removeStage = (index: number) => {
    onChange(stages.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-3">
      {stages.map((stage, i) => (
        <Card key={i} className="bg-secondary/50 border-border">
          <CardContent className="p-3 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono text-muted-foreground uppercase">Stage {i + 1}</span>
              {stages.length > 1 && (
                <Button variant="ghost" size="sm" onClick={() => removeStage(i)} className="h-6 w-6 p-0">
                  <X className="h-3 w-3" />
                </Button>
              )}
            </div>
            <Input
              value={stage.name}
              onChange={(e) => updateStage(i, { name: e.target.value })}
              placeholder="Stage name"
              className="bg-background text-sm"
            />
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs font-mono">Grill Temp (°F)</Label>
                <Input
                  type="number"
                  value={stage.grillTemp}
                  onChange={(e) => updateStage(i, { grillTemp: parseInt(e.target.value) || 225 })}
                  className="bg-background text-sm font-mono"
                  min={165}
                  max={500}
                />
              </div>
              <div>
                <Label className="text-xs font-mono">Trigger</Label>
                <Select
                  value={stage.triggerType}
                  onValueChange={(v) => updateStage(i, { triggerType: v as CookStage["triggerType"] })}
                >
                  <SelectTrigger className="bg-background text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="time">Time</SelectItem>
                    <SelectItem value="probe_temp">Probe Temp</SelectItem>
                    <SelectItem value="manual">Manual</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            {stage.triggerType !== "manual" && (
              <div>
                <Label className="text-xs font-mono">
                  {stage.triggerType === "time" ? "Duration (minutes)" : "Target Probe Temp (°F)"}
                </Label>
                <Input
                  type="number"
                  value={stage.triggerType === "time" ? Math.floor(stage.triggerValue / 60) : stage.triggerValue}
                  onChange={(e) => {
                    const val = parseInt(e.target.value) || 0;
                    updateStage(i, {
                      triggerValue: stage.triggerType === "time" ? val * 60 : val,
                    });
                  }}
                  className="bg-background text-sm font-mono"
                />
              </div>
            )}
            <div className="flex items-center justify-between">
              <Label className="text-xs font-mono">Super Smoke</Label>
              <Switch
                checked={stage.superSmoke}
                onCheckedChange={(v) => updateStage(i, { superSmoke: v })}
              />
            </div>
            <Input
              value={stage.alertMessage}
              onChange={(e) => updateStage(i, { alertMessage: e.target.value })}
              placeholder="Alert message when stage completes"
              className="bg-background text-sm"
            />
          </CardContent>
        </Card>
      ))}
      <Button variant="outline" size="sm" onClick={addStage} className="w-full font-mono text-xs">
        <Plus className="h-3 w-3 mr-1.5" />
        add stage
      </Button>
    </div>
  );
}

export default function CookGuide() {
  const { isAuthenticated } = useAuth();
  const [activeTab, setActiveTab] = useState("library");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [selectedTemplate, setSelectedTemplate] = useState<CookTemplate | null>(null);
  const [selectedCustom, setSelectedCustom] = useState<CustomTemplateRow | null>(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);

  const { data: templates } = trpc.templates.list.useQuery(undefined);
  const { data: myTemplates, refetch: refetchMine } = trpc.customTemplates.mine.useQuery(
    undefined,
    { enabled: isAuthenticated }
  );
  const { data: communityTemplates, refetch: refetchCommunity } =
    trpc.customTemplates.community.useQuery(undefined);

  const createMutation = trpc.customTemplates.create.useMutation({
    onSuccess: () => {
      refetchMine();
      setShowCreateDialog(false);
      toast.success("Template created!");
    },
  });
  const deleteMutation = trpc.customTemplates.delete.useMutation({
    onSuccess: () => {
      refetchMine();
      toast.success("Template deleted");
    },
  });
  const publishMutation = trpc.customTemplates.publish.useMutation({
    onSuccess: () => {
      refetchMine();
      refetchCommunity();
      toast.success("Template sharing updated");
    },
  });
  const forkMutation = trpc.customTemplates.fork.useMutation({
    onSuccess: () => {
      refetchMine();
      toast.success("Template forked to your collection!");
    },
  });

  // Create form state
  const [newName, setNewName] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newCategory, setNewCategory] = useState("beef");
  const [newMethod, setNewMethod] = useState("smoke");
  const [newMeatCut, setNewMeatCut] = useState("");
  const [newDifficulty, setNewDifficulty] = useState<"beginner" | "intermediate" | "advanced">("intermediate");
  const [newEstimatedTime, setNewEstimatedTime] = useState("");
  const [newStages, setNewStages] = useState<CookStage[]>([
    {
      name: "Stage 1",
      grillTemp: 225,
      triggerType: "probe_temp",
      triggerValue: 165,
      superSmoke: false,
      alertMessage: "Target reached!",
    },
  ]);
  const [newTips, setNewTips] = useState("");

  const filteredTemplates = useMemo(() => {
    if (!templates) return [];
    if (selectedCategory === "all") return templates;
    return templates.filter((t) => t.category === selectedCategory);
  }, [templates, selectedCategory]);

  const handleCreate = () => {
    if (!newName.trim()) {
      toast.error("Template name is required");
      return;
    }
    if (newStages.length === 0) {
      toast.error("Add at least one stage");
      return;
    }
    createMutation.mutate({
      name: newName,
      description: newDescription || undefined,
      category: newCategory,
      method: newMethod,
      meatCut: newMeatCut || undefined,
      difficulty: newDifficulty,
      estimatedTime: newEstimatedTime || undefined,
      stages: newStages,
      tips: newTips ? newTips.split("\n").filter((t) => t.trim()) : undefined,
    });
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight">Cook Guide</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Browse templates, create your own, or fork from the community.
          </p>
        </div>
        {isAuthenticated && (
          <Button
            onClick={() => setShowCreateDialog(true)}
            className="bg-primary text-primary-foreground font-mono text-xs"
          >
            <Plus className="h-3.5 w-3.5 mr-1.5" />
            new template
          </Button>
        )}
      </div>

      {/* Main Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="bg-secondary">
          <TabsTrigger value="library" className="font-mono text-xs">
            <BookOpen className="h-3.5 w-3.5 mr-1.5" />
            Library
          </TabsTrigger>
          {isAuthenticated && (
            <TabsTrigger value="mine" className="font-mono text-xs">
              <Pencil className="h-3.5 w-3.5 mr-1.5" />
              My Templates
            </TabsTrigger>
          )}
          <TabsTrigger value="community" className="font-mono text-xs">
            <Users className="h-3.5 w-3.5 mr-1.5" />
            Community
          </TabsTrigger>
        </TabsList>

        {/* Library Tab */}
        <TabsContent value="library" className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <Button
              variant={selectedCategory === "all" ? "default" : "outline"}
              size="sm"
              onClick={() => setSelectedCategory("all")}
              className="font-mono text-xs"
            >
              All
            </Button>
            {CATEGORIES.map((cat) => (
              <Button
                key={cat.id}
                variant={selectedCategory === cat.id ? "default" : "outline"}
                size="sm"
                onClick={() => setSelectedCategory(cat.id)}
                className="font-mono text-xs"
              >
                {cat.label}
              </Button>
            ))}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {filteredTemplates.map((template) => (
              <TemplateCard
                key={template.id}
                template={template}
                onSelect={() => setSelectedTemplate(template)}
              />
            ))}
          </div>

          {filteredTemplates.length === 0 && (
            <div className="text-center py-12 text-muted-foreground">
              <Flame className="h-8 w-8 mx-auto mb-2 opacity-30" />
              <p className="text-sm font-mono">No templates in this category.</p>
            </div>
          )}
        </TabsContent>

        {/* My Templates Tab */}
        <TabsContent value="mine" className="space-y-4">
          {myTemplates && myTemplates.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {myTemplates.map((template) => (
                <CustomTemplateCard
                  key={template.id}
                  template={template}
                  onSelect={() => setSelectedCustom(template)}
                />
              ))}
            </div>
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              <Plus className="h-8 w-8 mx-auto mb-2 opacity-30" />
              <p className="text-sm font-mono mb-3">No custom templates yet.</p>
              <Button
                onClick={() => setShowCreateDialog(true)}
                className="bg-primary text-primary-foreground font-mono text-xs"
              >
                Create Your First Template
              </Button>
            </div>
          )}
        </TabsContent>

        {/* Community Tab */}
        <TabsContent value="community" className="space-y-4">
          {communityTemplates && communityTemplates.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {communityTemplates.map((template) => (
                <CustomTemplateCard
                  key={template.id}
                  template={template}
                  onSelect={() => setSelectedCustom(template)}
                  showAuthor
                />
              ))}
            </div>
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              <Users className="h-8 w-8 mx-auto mb-2 opacity-30" />
              <p className="text-sm font-mono">No community templates shared yet.</p>
              <p className="text-xs text-muted-foreground/60 mt-1">
                Create a template and publish it to share with others.
              </p>
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Built-in Template Detail Dialog */}
      <Dialog open={!!selectedTemplate} onOpenChange={() => setSelectedTemplate(null)}>
        <DialogContent className="bg-card border-border max-w-2xl max-h-[85vh] overflow-y-auto">
          {selectedTemplate && (
            <>
              <DialogHeader>
                <div className="flex items-center gap-2">
                  <DialogTitle className="text-foreground">{selectedTemplate.name}</DialogTitle>
                  <MethodBadge method={selectedTemplate.method} />
                </div>
                <DialogDescription className="text-muted-foreground font-mono text-xs">
                  {selectedTemplate.cut} · {selectedTemplate.estimatedTime}
                  {selectedTemplate.weightBased && " (weight-dependent)"}
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-5 mt-2">
                <p className="text-sm text-foreground/80">{selectedTemplate.description}</p>

                <div>
                  <h4 className="text-xs font-mono uppercase tracking-wider text-muted-foreground mb-3">Cook Stages</h4>
                  <StageTimeline stages={selectedTemplate.stages} />
                </div>

                {selectedTemplate.tips.length > 0 && (
                  <div>
                    <h4 className="text-xs font-mono uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1">
                      <Lightbulb className="h-3.5 w-3.5 text-amber-400" />
                      Pro Tips
                    </h4>
                    <ul className="space-y-1.5">
                      {selectedTemplate.tips.map((tip, i) => (
                        <li key={i} className="text-xs text-muted-foreground flex items-start gap-2">
                          <span className="text-primary mt-0.5">·</span>
                          {tip}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                <div className="flex gap-2 pt-2">
                  <Button
                    className="flex-1 bg-primary text-primary-foreground font-mono text-xs"
                    onClick={() => {
                      toast.info("Connect your grill account to launch cook programs", {
                        description: "Go to Settings to connect.",
                      });
                    }}
                  >
                    <Play className="h-3.5 w-3.5 mr-1.5" />
                    launch cook
                  </Button>
                  <Button variant="outline" onClick={() => setSelectedTemplate(null)} className="font-mono text-xs">
                    close
                  </Button>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Custom Template Detail Dialog */}
      <Dialog open={!!selectedCustom} onOpenChange={() => setSelectedCustom(null)}>
        <DialogContent className="bg-card border-border max-w-2xl max-h-[85vh] overflow-y-auto">
          {selectedCustom && (() => {
            const stages = JSON.parse(String(selectedCustom.stagesJson || "[]")) as CookStage[];
            const tips = selectedCustom.tipsJson ? JSON.parse(String(selectedCustom.tipsJson)) as string[] : [];
            return (
              <>
                <DialogHeader>
                  <div className="flex items-center gap-2">
                    <DialogTitle className="text-foreground">{selectedCustom.name}</DialogTitle>
                    <MethodBadge method={selectedCustom.method} />
                    {selectedCustom.isPublished === 1 && (
                      <Badge variant="outline" className="text-xs bg-green-500/10 text-green-400 border-green-500/20 font-mono">
                        shared
                      </Badge>
                    )}
                  </div>
                  <DialogDescription className="text-muted-foreground font-mono text-xs">
                    {selectedCustom.meatCut && `${selectedCustom.meatCut} · `}
                    {selectedCustom.estimatedTime || "No time estimate"}
                    {selectedCustom.authorName && ` · by ${selectedCustom.authorName}`}
                  </DialogDescription>
                </DialogHeader>

                <div className="space-y-5 mt-2">
                  {selectedCustom.description && (
                    <p className="text-sm text-foreground/80">{selectedCustom.description}</p>
                  )}

                  <div>
                    <h4 className="text-xs font-mono uppercase tracking-wider text-muted-foreground mb-3">Cook Stages</h4>
                    <StageTimeline stages={stages} />
                  </div>

                  {tips.length > 0 && (
                    <div>
                      <h4 className="text-xs font-mono uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1">
                        <Lightbulb className="h-3.5 w-3.5 text-amber-400" />
                        Tips
                      </h4>
                      <ul className="space-y-1.5">
                        {tips.map((tip, i) => (
                          <li key={i} className="text-xs text-muted-foreground flex items-start gap-2">
                            <span className="text-primary mt-0.5">·</span>
                            {tip}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  <div className="flex flex-wrap gap-2 pt-2">
                    <Button
                      className="flex-1 bg-primary text-primary-foreground font-mono text-xs"
                      onClick={() => {
                        toast.info("Connect your grill account to launch cook programs");
                      }}
                    >
                      <Play className="h-3.5 w-3.5 mr-1.5" />
                      launch cook
                    </Button>
                    {isAuthenticated && (
                      <>
                        <Button
                          variant="outline"
                          className="font-mono text-xs"
                          onClick={() => {
                            forkMutation.mutate({ id: selectedCustom.id });
                            setSelectedCustom(null);
                          }}
                          disabled={forkMutation.isPending}
                        >
                          <GitFork className="h-3.5 w-3.5 mr-1.5" />
                          fork
                        </Button>
                        <Button
                          variant="outline"
                          className="font-mono text-xs"
                          onClick={() => {
                            publishMutation.mutate({
                              id: selectedCustom.id,
                              publish: selectedCustom.isPublished !== 1,
                            });
                            setSelectedCustom(null);
                          }}
                        >
                          <Share2 className="h-3.5 w-3.5 mr-1.5" />
                          {selectedCustom.isPublished === 1 ? "unshare" : "share"}
                        </Button>
                        <Button
                          variant="outline"
                          className="font-mono text-xs text-destructive hover:text-destructive"
                          onClick={() => {
                            if (confirm("Delete this template?")) {
                              deleteMutation.mutate({ id: selectedCustom.id });
                              setSelectedCustom(null);
                            }
                          }}
                        >
                          <Trash2 className="h-3.5 w-3.5 mr-1.5" />
                          delete
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              </>
            );
          })()}
        </DialogContent>
      </Dialog>

      {/* Create Template Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="bg-card border-border max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-foreground">Create Cook Template</DialogTitle>
            <DialogDescription className="text-muted-foreground">
              Build a custom cook program with temperature stages and timing.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 mt-2">
            <div>
              <Label className="text-xs font-mono">Template Name *</Label>
              <Input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="e.g., My Perfect Brisket"
                className="bg-secondary"
              />
            </div>

            <div>
              <Label className="text-xs font-mono">Description</Label>
              <Textarea
                value={newDescription}
                onChange={(e) => setNewDescription(e.target.value)}
                placeholder="Describe your cook method..."
                className="bg-secondary resize-none"
                rows={2}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-mono">Category</Label>
                <Select value={newCategory} onValueChange={setNewCategory}>
                  <SelectTrigger className="bg-secondary">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map((cat) => (
                      <SelectItem key={cat.id} value={cat.id}>
                        {cat.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs font-mono">Method</Label>
                <Select value={newMethod} onValueChange={setNewMethod}>
                  <SelectTrigger className="bg-secondary">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {COOKING_METHODS.map((m) => (
                      <SelectItem key={m.id} value={m.id}>
                        {m.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label className="text-xs font-mono">Meat Cut</Label>
                <Input
                  value={newMeatCut}
                  onChange={(e) => setNewMeatCut(e.target.value)}
                  placeholder="e.g., Pork Butt"
                  className="bg-secondary"
                />
              </div>
              <div>
                <Label className="text-xs font-mono">Difficulty</Label>
                <Select value={newDifficulty} onValueChange={(v) => setNewDifficulty(v as typeof newDifficulty)}>
                  <SelectTrigger className="bg-secondary">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="beginner">Beginner</SelectItem>
                    <SelectItem value="intermediate">Intermediate</SelectItem>
                    <SelectItem value="advanced">Advanced</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs font-mono">Est. Time</Label>
                <Input
                  value={newEstimatedTime}
                  onChange={(e) => setNewEstimatedTime(e.target.value)}
                  placeholder="e.g., 8-12 hrs"
                  className="bg-secondary"
                />
              </div>
            </div>

            <div>
              <Label className="text-xs font-mono uppercase tracking-wider mb-2 block">Cook Stages</Label>
              <StageEditor stages={newStages} onChange={setNewStages} />
            </div>

            <div>
              <Label className="text-xs font-mono">Tips (one per line)</Label>
              <Textarea
                value={newTips}
                onChange={(e) => setNewTips(e.target.value)}
                placeholder="Let the meat rest for 30 minutes after pulling&#10;Use butcher paper instead of foil for better bark"
                className="bg-secondary resize-none"
                rows={3}
              />
            </div>

            <div className="flex gap-2 pt-2">
              <Button
                onClick={handleCreate}
                disabled={createMutation.isPending}
                className="flex-1 bg-primary text-primary-foreground font-mono text-xs"
              >
                {createMutation.isPending ? "Creating..." : "Create Template"}
              </Button>
              <Button
                variant="outline"
                onClick={() => setShowCreateDialog(false)}
                className="font-mono text-xs"
              >
                Cancel
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
