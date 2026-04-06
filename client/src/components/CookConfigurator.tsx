/**
 * CookConfigurator — Pre-start cook configuration panel
 * 
 * Three-level drill-down:
 *   1. Category (beef, pork, poultry, lamb, seafood, game)
 *   2. Cut (searchable combobox with type-to-filter)
 *   3. Parameters (doneness, thickness, weight — dynamic based on cut)
 * 
 * All values are user-overridable. Shows calculated targets, estimated time, and tips.
 */

import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
} from "@/components/ui/command";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Flame,
  ChevronDown,
  Check,
  Thermometer,
  Clock,
  Scale,
  Ruler,
  Lightbulb,
  AlertTriangle,
  Shield,
  Play,
  Settings2,
  RotateCcw,
  Bell,
  BellRing,
} from "lucide-react";
import {
  ALL_CUTS,
  CUT_CATEGORIES,
  getCutsByCategory,
  getCutById,
  searchCuts,
  buildCookConfig,
  getDefaultDoneness,
  estimateCookTime,
  type CutDefinition,
  type DonenessLevel,
  type CookConfig,
} from "../../../shared/cut-catalog";

// ─── Types ─────────────────────────────────────────────

export interface CookConfigResult {
  config: CookConfig;
  enableNotifications: boolean;
  enableAlarms: boolean;
}

interface CookConfiguratorProps {
  initialCutId?: string;
  initialCategory?: string;
  onStartCook: (result: CookConfigResult) => void;
  onCancel: () => void;
  isStarting?: boolean;
  grillConnected: boolean;
}

// ─── Searchable Combobox ───────────────────────────────

function CutCombobox({
  cuts,
  selectedId,
  onSelect,
  placeholder,
}: {
  cuts: CutDefinition[];
  selectedId: string | null;
  onSelect: (cut: CutDefinition) => void;
  placeholder: string;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    if (!search.trim()) return cuts;
    return searchCuts(search);
  }, [cuts, search]);

  const selected = selectedId ? getCutById(selectedId) : null;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between bg-secondary/50 font-mono text-sm h-10"
        >
          {selected ? selected.name : placeholder}
          <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput
            placeholder="Type to search..."
            value={search}
            onValueChange={setSearch}
          />
          <CommandList>
            <CommandEmpty>No cuts found.</CommandEmpty>
            <CommandGroup>
              {filtered.map((cut) => (
                <CommandItem
                  key={cut.id}
                  value={cut.id}
                  onSelect={() => {
                    onSelect(cut);
                    setOpen(false);
                    setSearch("");
                  }}
                  className="flex items-center justify-between"
                >
                  <div className="flex items-center gap-2">
                    <Check
                      className={`h-4 w-4 ${selectedId === cut.id ? "opacity-100" : "opacity-0"}`}
                    />
                    <div>
                      <span className="font-medium">{cut.name}</span>
                      {cut.aliases.length > 0 && (
                        <span className="text-xs text-muted-foreground ml-2">
                          {cut.aliases.slice(0, 2).join(", ")}
                        </span>
                      )}
                    </div>
                  </div>
                  <Badge variant="outline" className="text-[10px] ml-2">
                    {cut.defaultMethod.replace("_", " ")}
                  </Badge>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

// ─── Main Component ────────────────────────────────────

export default function CookConfigurator({
  initialCutId,
  initialCategory,
  onStartCook,
  onCancel,
  isStarting,
  grillConnected,
}: CookConfiguratorProps) {
  // Selection state
  const [category, setCategory] = useState<string>(initialCategory || "");
  const [cutId, setCutId] = useState<string | null>(initialCutId || null);
  const [donenessId, setDonenessId] = useState<string | null>(null);
  const [thicknessId, setThicknessId] = useState<string | null>(null);
  const [weightLbs, setWeightLbs] = useState<number | undefined>(undefined);

  // Override state
  const [showOverrides, setShowOverrides] = useState(false);
  const [grillTempOverride, setGrillTempOverride] = useState<number | undefined>(undefined);
  const [methodOverride, setMethodOverride] = useState<string | undefined>(undefined);
  const [pullTempOverride, setPullTempOverride] = useState<number | undefined>(undefined);

  // Alert preferences
  const [enableNotifications, setEnableNotifications] = useState(true);
  const [enableAlarms, setEnableAlarms] = useState(true);

  // Derived data
  const selectedCut = cutId ? getCutById(cutId) : null;
  const availableCuts = category ? getCutsByCategory(category) : ALL_CUTS;

  // When category changes, reset cut if it doesn't match
  useEffect(() => {
    if (category && selectedCut && selectedCut.category !== category) {
      setCutId(null);
      setDonenessId(null);
      setThicknessId(null);
      setWeightLbs(undefined);
    }
  }, [category]);

  // When cut changes, set defaults
  useEffect(() => {
    if (selectedCut) {
      setCategory(selectedCut.category);
      const defaultDoneness = getDefaultDoneness(selectedCut);
      setDonenessId(defaultDoneness.id);
      setThicknessId(selectedCut.thicknessOptions?.[1]?.id || selectedCut.thicknessOptions?.[0]?.id || null);
      setWeightLbs(selectedCut.defaultWeightLbs);
      // Reset overrides
      setGrillTempOverride(undefined);
      setMethodOverride(undefined);
      setPullTempOverride(undefined);
      setShowOverrides(false);
    }
  }, [cutId]);

  // Build the config
  const config = useMemo(() => {
    if (!selectedCut) return null;
    const cfg = buildCookConfig(
      selectedCut,
      donenessId || undefined,
      thicknessId || undefined,
      weightLbs,
      grillTempOverride,
      methodOverride,
    );
    // Apply pull temp override
    if (pullTempOverride !== undefined) {
      cfg.pullTemp = pullTempOverride;
      cfg.finalTemp = pullTempOverride + 5;
    }
    return cfg;
  }, [selectedCut, donenessId, thicknessId, weightLbs, grillTempOverride, methodOverride, pullTempOverride]);

  const selectedDoneness = selectedCut?.doneness.find(d => d.id === donenessId);
  const selectedThickness = selectedCut?.thicknessOptions?.find(t => t.id === thicknessId);

  const handleStart = () => {
    if (!config) return;
    onStartCook({
      config,
      enableNotifications,
      enableAlarms,
    });
  };

  const handleReset = () => {
    setCategory("");
    setCutId(null);
    setDonenessId(null);
    setThicknessId(null);
    setWeightLbs(undefined);
    setGrillTempOverride(undefined);
    setMethodOverride(undefined);
    setPullTempOverride(undefined);
    setShowOverrides(false);
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Settings2 className="h-5 w-5 text-primary" />
            Configure Your Cook
          </h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Select what you're cooking, then customize the parameters.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={handleReset} className="font-mono text-xs">
            <RotateCcw className="h-3.5 w-3.5 mr-1" />
            reset
          </Button>
          <Button variant="outline" size="sm" onClick={onCancel} className="font-mono text-xs">
            cancel
          </Button>
        </div>
      </div>

      {/* Step 1: Category */}
      <div>
        <Label className="text-xs font-mono uppercase tracking-wider text-muted-foreground mb-2 block">
          1. What are you cooking?
        </Label>
        <div className="flex flex-wrap gap-2">
          {CUT_CATEGORIES.map((cat) => (
            <Button
              key={cat.id}
              variant={category === cat.id ? "default" : "outline"}
              size="sm"
              onClick={() => setCategory(cat.id)}
              className="font-mono text-xs"
            >
              <span className="mr-1.5">{cat.icon}</span>
              {cat.label}
            </Button>
          ))}
        </div>
      </div>

      {/* Step 2: Cut selection (searchable combobox) */}
      {category && (
        <div>
          <Label className="text-xs font-mono uppercase tracking-wider text-muted-foreground mb-2 block">
            2. Select the cut
          </Label>
          <CutCombobox
            cuts={availableCuts}
            selectedId={cutId}
            onSelect={(cut) => setCutId(cut.id)}
            placeholder="Search or select a cut..."
          />
        </div>
      )}

      {/* Step 3: Parameters */}
      {selectedCut && (
        <div className="space-y-4">
          <Label className="text-xs font-mono uppercase tracking-wider text-muted-foreground block">
            3. Cook parameters
          </Label>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Doneness */}
            {selectedCut.doneness.length > 1 && (
              <div>
                <Label className="text-xs font-mono text-muted-foreground mb-1.5 flex items-center gap-1">
                  <Thermometer className="h-3 w-3" />
                  Doneness
                </Label>
                <Select value={donenessId || ""} onValueChange={setDonenessId}>
                  <SelectTrigger className="bg-secondary/50 font-mono text-sm">
                    <SelectValue placeholder="Select doneness" />
                  </SelectTrigger>
                  <SelectContent>
                    {selectedCut.doneness.map((d) => (
                      <SelectItem key={d.id} value={d.id}>
                        <div className="flex items-center gap-2">
                          <span>{d.label}</span>
                          <span className="text-xs text-muted-foreground">
                            ({d.pullTemp}°F pull → {d.finalTemp}°F)
                          </span>
                          {d.isDefault && (
                            <Badge variant="outline" className="text-[9px] py-0 px-1">rec</Badge>
                          )}
                          {!d.isSafe && (
                            <AlertTriangle className="h-3 w-3 text-amber-400" />
                          )}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {selectedDoneness && (
                  <p className="text-[11px] text-muted-foreground mt-1 font-mono">
                    {selectedDoneness.description}
                    {!selectedDoneness.isSafe && (
                      <span className="text-amber-400 ml-1">(below USDA minimum)</span>
                    )}
                  </p>
                )}
              </div>
            )}

            {/* Thickness */}
            {selectedCut.thicknessOptions && selectedCut.thicknessOptions.length > 1 && (
              <div>
                <Label className="text-xs font-mono text-muted-foreground mb-1.5 flex items-center gap-1">
                  <Ruler className="h-3 w-3" />
                  Thickness
                </Label>
                <Select value={thicknessId || ""} onValueChange={setThicknessId}>
                  <SelectTrigger className="bg-secondary/50 font-mono text-sm">
                    <SelectValue placeholder="Select thickness" />
                  </SelectTrigger>
                  <SelectContent>
                    {selectedCut.thicknessOptions.map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Weight */}
            {selectedCut.weightRelevant && (
              <div>
                <Label className="text-xs font-mono text-muted-foreground mb-1.5 flex items-center gap-1">
                  <Scale className="h-3 w-3" />
                  Weight (lbs)
                </Label>
                <Input
                  type="number"
                  value={weightLbs ?? ""}
                  onChange={(e) => setWeightLbs(e.target.value ? Number(e.target.value) : undefined)}
                  placeholder={`Default: ${selectedCut.defaultWeightLbs || "?"} lbs`}
                  className="bg-secondary/50 font-mono text-sm"
                  min={0.5}
                  max={50}
                  step={0.5}
                />
              </div>
            )}
          </div>

          {/* Calculated summary */}
          {config && (
            <Card className="bg-primary/5 border-primary/20">
              <CardContent className="p-4">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-mono">Grill Temp</p>
                    <p className="text-lg font-mono font-bold text-primary">{config.grillTemp}°F</p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-mono">Pull At</p>
                    <p className="text-lg font-mono font-bold text-red-400">{config.pullTemp}°F</p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-mono">Est. Time</p>
                    <p className="text-lg font-mono font-bold text-foreground">{config.estimatedTime}</p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-mono">Method</p>
                    <p className="text-lg font-mono font-bold text-foreground capitalize">{config.method.replace("_", " ")}</p>
                  </div>
                </div>

                {/* Extra info badges */}
                <div className="flex flex-wrap gap-1.5 mt-3">
                  {config.hasStall && (
                    <Badge variant="outline" className="text-[10px] border-amber-500/30 text-amber-400 font-mono">
                      Stall Expected (150-170°F)
                    </Badge>
                  )}
                  {config.wrapRecommended && (
                    <Badge variant="outline" className="text-[10px] border-blue-500/30 text-blue-400 font-mono">
                      Wrap Recommended
                    </Badge>
                  )}
                  {config.restMinutes > 0 && (
                    <Badge variant="outline" className="text-[10px] font-mono">
                      Rest {config.restMinutes}+ min
                    </Badge>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Override section */}
          <div>
            <button
              onClick={() => setShowOverrides(!showOverrides)}
              className="flex items-center gap-1.5 text-xs font-mono text-muted-foreground hover:text-foreground transition-colors"
            >
              <Settings2 className="h-3.5 w-3.5" />
              {showOverrides ? "Hide" : "Show"} manual overrides
              <ChevronDown className={`h-3 w-3 transition-transform ${showOverrides ? "rotate-180" : ""}`} />
            </button>

            {showOverrides && (
              <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-3 p-3 rounded-lg bg-secondary/30 border border-border/50">
                <div>
                  <Label className="text-xs font-mono text-muted-foreground">Grill Temp Override (°F)</Label>
                  <Input
                    type="number"
                    value={grillTempOverride ?? ""}
                    onChange={(e) => setGrillTempOverride(e.target.value ? Number(e.target.value) : undefined)}
                    placeholder={`Default: ${selectedCut.defaultGrillTemp}°F`}
                    className="bg-background font-mono text-sm"
                    min={165}
                    max={500}
                  />
                </div>
                <div>
                  <Label className="text-xs font-mono text-muted-foreground">Pull Temp Override (°F)</Label>
                  <Input
                    type="number"
                    value={pullTempOverride ?? ""}
                    onChange={(e) => setPullTempOverride(e.target.value ? Number(e.target.value) : undefined)}
                    placeholder={`Default: ${selectedDoneness?.pullTemp || "?"}°F`}
                    className="bg-background font-mono text-sm"
                    min={100}
                    max={250}
                  />
                </div>
                <div>
                  <Label className="text-xs font-mono text-muted-foreground">Method Override</Label>
                  <Select value={methodOverride || "default"} onValueChange={(v) => setMethodOverride(v === "default" ? undefined : v)}>
                    <SelectTrigger className="bg-background font-mono text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="default">Default ({selectedCut.defaultMethod.replace("_", " ")})</SelectItem>
                      <SelectItem value="smoke">Smoke</SelectItem>
                      <SelectItem value="grill">Grill</SelectItem>
                      <SelectItem value="reverse_sear">Reverse Sear</SelectItem>
                      <SelectItem value="roast">Roast</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}
          </div>

          <Separator />

          {/* Alert preferences */}
          <div className="space-y-3">
            <Label className="text-xs font-mono uppercase tracking-wider text-muted-foreground block">
              Alert Preferences
            </Label>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Bell className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">Notifications</p>
                  <p className="text-xs text-muted-foreground">One-time pings for milestones</p>
                </div>
              </div>
              <Switch checked={enableNotifications} onCheckedChange={setEnableNotifications} />
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <BellRing className="h-4 w-4 text-amber-400" />
                <div>
                  <p className="text-sm font-medium">Alarms</p>
                  <p className="text-xs text-muted-foreground">Persistent alerts until dismissed</p>
                </div>
              </div>
              <Switch checked={enableAlarms} onCheckedChange={setEnableAlarms} />
            </div>
          </div>

          {/* Tips */}
          {config && config.tips.length > 0 && (
            <div>
              <Label className="text-xs font-mono uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1">
                <Lightbulb className="h-3.5 w-3.5 text-amber-400" />
                Pro Tips
              </Label>
              <ul className="space-y-1.5">
                {config.tips.map((tip, i) => (
                  <li key={i} className="text-xs text-muted-foreground flex items-start gap-2">
                    <span className="text-primary mt-0.5 shrink-0">·</span>{tip}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Start button */}
          <div className="flex gap-3 pt-2">
            <Button
              onClick={handleStart}
              disabled={!config || isStarting || !grillConnected}
              className="flex-1 bg-primary text-primary-foreground font-mono h-12 text-sm"
              size="lg"
            >
              {isStarting ? (
                <>Starting...</>
              ) : !grillConnected ? (
                <>Grill Not Connected</>
              ) : (
                <>
                  <Play className="h-5 w-5 mr-2" />
                  Start Cook — {config?.cutName}
                </>
              )}
            </Button>
          </div>

          {!grillConnected && (
            <p className="text-xs text-amber-400 text-center flex items-center justify-center gap-1">
              <AlertTriangle className="h-3 w-3" />
              Connect your grill in Settings before starting a cook.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
