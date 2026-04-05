import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Flame,
  Clock,
  Thermometer,
  ChevronRight,
  Wind,
  AlertCircle,
  Lightbulb,
  Play,
} from "lucide-react";
import { useState, useMemo } from "react";
import { CATEGORIES, COOKING_METHODS } from "@shared/cook-templates";
import type { CookTemplate, CookStage } from "@shared/traeger-types";
import { toast } from "sonner";

function MethodBadge({ method }: { method: string }) {
  const colors: Record<string, string> = {
    smoke: "bg-purple-500/20 text-purple-400 border-purple-500/30",
    grill: "bg-orange-500/20 text-orange-400 border-orange-500/30",
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
    <Badge variant="outline" className={`text-xs ${colors[method] || ""}`}>
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
            <div className="w-8 h-8 rounded-full bg-primary/20 text-primary flex items-center justify-center text-sm font-bold">
              {i + 1}
            </div>
            {i < stages.length - 1 && <div className="w-0.5 h-full bg-border mt-1" />}
          </div>
          <div className="flex-1 pb-4">
            <div className="font-medium text-foreground text-sm">{stage.name}</div>
            <div className="flex flex-wrap gap-2 mt-1">
              <Badge variant="outline" className="text-xs bg-orange-500/10 text-orange-400 border-orange-500/20">
                <Flame className="h-3 w-3 mr-1" />
                {stage.grillTemp}°F
              </Badge>
              {stage.superSmoke && (
                <Badge variant="outline" className="text-xs bg-purple-500/10 text-purple-400 border-purple-500/20">
                  <Wind className="h-3 w-3 mr-1" />
                  Super Smoke
                </Badge>
              )}
              <Badge variant="outline" className="text-xs">
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
            <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
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

export default function CookGuide() {
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [selectedTemplate, setSelectedTemplate] = useState<CookTemplate | null>(null);
  const { data: templates } = trpc.templates.list.useQuery(undefined);

  const filteredTemplates = useMemo(() => {
    if (!templates) return [];
    if (selectedCategory === "all") return templates;
    return templates.filter((t) => t.category === selectedCategory);
  }, [templates, selectedCategory]);

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Cook Guide</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Browse pre-built cook programs by meat type. Each template includes temperature stages,
          timing, and expert tips.
        </p>
      </div>

      {/* Category Tabs */}
      <Tabs value={selectedCategory} onValueChange={setSelectedCategory}>
        <TabsList className="bg-secondary">
          <TabsTrigger value="all">All</TabsTrigger>
          {CATEGORIES.map((cat) => (
            <TabsTrigger key={cat.id} value={cat.id}>
              {cat.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {/* Template Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
          <Flame className="h-8 w-8 mx-auto mb-2 opacity-50" />
          <p>No templates found for this category.</p>
        </div>
      )}

      {/* Template Detail Dialog */}
      <Dialog open={!!selectedTemplate} onOpenChange={() => setSelectedTemplate(null)}>
        <DialogContent className="bg-card border-border max-w-2xl max-h-[85vh] overflow-y-auto">
          {selectedTemplate && (
            <>
              <DialogHeader>
                <div className="flex items-center gap-2">
                  <DialogTitle className="text-foreground">{selectedTemplate.name}</DialogTitle>
                  <MethodBadge method={selectedTemplate.method} />
                </div>
                <DialogDescription className="text-muted-foreground">
                  {selectedTemplate.cut} &middot; {selectedTemplate.estimatedTime}
                  {selectedTemplate.weightBased && " (weight-dependent)"}
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-5 mt-2">
                <p className="text-sm text-foreground/80">{selectedTemplate.description}</p>

                {/* Stages */}
                <div>
                  <h4 className="text-sm font-semibold text-foreground mb-3">Cook Stages</h4>
                  <StageTimeline stages={selectedTemplate.stages} />
                </div>

                {/* Tips */}
                {selectedTemplate.tips.length > 0 && (
                  <div>
                    <h4 className="text-sm font-semibold text-foreground mb-2 flex items-center gap-1">
                      <Lightbulb className="h-4 w-4 text-yellow-400" />
                      Pro Tips
                    </h4>
                    <ul className="space-y-1.5">
                      {selectedTemplate.tips.map((tip, i) => (
                        <li key={i} className="text-xs text-muted-foreground flex items-start gap-2">
                          <span className="text-primary mt-0.5">•</span>
                          {tip}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Action Buttons */}
                <div className="flex gap-2 pt-2">
                  <Button
                    className="flex-1 bg-primary text-primary-foreground"
                    onClick={() => {
                      toast.info("Connect your Traeger account to launch cook programs", {
                        description: "Go to Settings to connect your grill.",
                      });
                    }}
                  >
                    <Play className="h-4 w-4 mr-2" />
                    Launch Cook Program
                  </Button>
                  <Button variant="outline" onClick={() => setSelectedTemplate(null)}>
                    Close
                  </Button>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
