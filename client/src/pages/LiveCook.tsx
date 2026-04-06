import { useAuth } from "@/_core/hooks/useAuth";
import { useLiveCook, useLiveTelemetry, useTelemetryHistory, useNotifications, useTraegerStatus } from "@/hooks/useTraeger";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import TemperatureGraph from "@/components/TemperatureGraph";
import CookConfigurator, { type CookConfigResult } from "@/components/CookConfigurator";
import { MEAT_PROFILES, getMeatProfile } from "../../../shared/meat-science";
import { getCutById } from "../../../shared/cut-catalog";
import { getSystemStatus } from "../../../shared/traeger-types";
import {
  Flame, Timer, Thermometer, AlertTriangle, Bell, BellOff, BellRing,
  Play, Square, ChefHat, ArrowRight, Plus, Trash2, Clock, TrendingUp,
  TrendingDown, Minus, BookOpen, Loader2, X, Settings2,
} from "lucide-react";
import { useState, useEffect, useMemo } from "react";
import { useLocation, useSearch } from "wouter";
import { toast } from "sonner";
import type { MeatProfile } from "../../../shared/meat-science";

function formatDuration(startMs: number): string {
  const elapsed = Date.now() - startMs;
  const h = Math.floor(elapsed / 3600000);
  const m = Math.floor((elapsed % 3600000) / 60000);
  const s = Math.floor((elapsed % 60000) / 1000);
  if (h > 0) return `${h}h ${m}m ${s}s`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

// ===== Alarm Banner =====
function AlarmBanner({ alarms, onDismiss }: { alarms: Array<{ id: string; title: string; body: string }>; onDismiss: (id: string) => void }) {
  if (alarms.length === 0) return null;
  return (
    <div className="space-y-2 mb-4">
      {alarms.map((alarm) => (
        <div key={alarm.id} className="bg-red-500/20 border border-red-500/50 rounded-lg p-4 flex items-center justify-between animate-pulse">
          <div className="flex items-center gap-3">
            <BellRing className="h-6 w-6 text-red-400 animate-bounce" />
            <div>
              <p className="font-bold text-red-300">{alarm.title}</p>
              <p className="text-sm text-red-200/80">{alarm.body}</p>
            </div>
          </div>
          <Button variant="destructive" size="sm" onClick={() => onDismiss(alarm.id)}>
            Dismiss
          </Button>
        </div>
      ))}
    </div>
  );
}

// ===== Stall Detector Card =====
function StallDetector({ stallInfo }: { stallInfo: { detected: boolean; startedAt?: number; startTemp?: number; duration?: number } | null }) {
  if (!stallInfo || !stallInfo.detected) return null;
  const minutes = Math.floor((stallInfo.duration || 0) / 60000);
  return (
    <Card className="border-amber-500/30 bg-amber-500/5">
      <CardContent className="p-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-full bg-amber-500/20">
            <Minus className="h-5 w-5 text-amber-400" />
          </div>
          <div className="flex-1">
            <p className="font-semibold text-amber-300 font-mono">Temperature Stall Detected</p>
            <p className="text-sm text-muted-foreground">
              Probe temp has been flat at ~{stallInfo.startTemp || 0}°F for {minutes} minutes.
              {minutes > 30 && " Consider wrapping in butcher paper or foil to push through."}
            </p>
          </div>
          <Badge variant="outline" className="border-amber-500/50 text-amber-400 font-mono">
            {minutes}m stalled
          </Badge>
        </div>
      </CardContent>
    </Card>
  );
}

// ===== Cook Summary Stats =====
function CookSummary({ session, mqttState, telemetry }: { session: any; mqttState: any; telemetry: any }) {
  const startTime = session?.startedAt ? new Date(session.startedAt).getTime() : Date.now();
  const [elapsed, setElapsed] = useState(formatDuration(startTime));

  useEffect(() => {
    const interval = setInterval(() => setElapsed(formatDuration(startTime)), 1000);
    return () => clearInterval(interval);
  }, [startTime]);

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      <div className="bg-card/50 rounded-lg p-3 border border-border/50">
        <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-mono">Duration</p>
        <p className="text-xl font-mono font-bold text-foreground">{elapsed}</p>
      </div>
      <div className="bg-card/50 rounded-lg p-3 border border-border/50">
        <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-mono">Grill</p>
        <p className="text-xl font-mono font-bold text-amber-400">{telemetry?.grill || 0}°F</p>
      </div>
      <div className="bg-card/50 rounded-lg p-3 border border-border/50">
        <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-mono">Probe</p>
        <p className="text-xl font-mono font-bold text-red-400">{telemetry?.probe || 0}°F</p>
      </div>
      <div className="bg-card/50 rounded-lg p-3 border border-border/50">
        <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-mono">Peak Probe</p>
        <p className="text-xl font-mono font-bold text-green-400">{mqttState?.peakProbeTemp || telemetry?.probe || 0}°F</p>
      </div>
    </div>
  );
}

// ===== Alert List =====
function AlertList({
  alerts,
  onDismiss,
  onRemove,
}: {
  alerts: Array<{ id: string; label: string; triggerTemp: number; alertType: string; status: string; message?: string }>;
  onDismiss: (id: string) => void;
  onRemove: (id: string) => void;
}) {
  const pending = alerts.filter((a) => a.status === "pending");
  const fired = alerts.filter((a) => a.status === "fired");
  const dismissed = alerts.filter((a) => a.status === "dismissed");

  return (
    <div className="space-y-2">
      {fired.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-xs font-mono text-red-400 uppercase tracking-wider">Active</p>
          {fired.map((a) => (
            <div key={a.id} className="flex items-center justify-between bg-red-500/10 border border-red-500/30 rounded p-2">
              <div className="flex items-center gap-2">
                <BellRing className="h-4 w-4 text-red-400" />
                <span className="text-sm font-mono">{a.label}</span>
                <Badge variant="outline" className="text-[10px] border-red-500/50 text-red-400">{a.triggerTemp}°F</Badge>
              </div>
              <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={() => onDismiss(a.id)}>Dismiss</Button>
            </div>
          ))}
        </div>
      )}
      {pending.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-xs font-mono text-muted-foreground uppercase tracking-wider">Pending</p>
          {pending.map((a) => (
            <div key={a.id} className="flex items-center justify-between bg-card/30 border border-border/30 rounded p-2">
              <div className="flex items-center gap-2">
                {a.alertType === "alarm" ? <BellRing className="h-3.5 w-3.5 text-amber-400" /> : <Bell className="h-3.5 w-3.5 text-muted-foreground" />}
                <span className="text-sm font-mono">{a.label}</span>
                <Badge variant="outline" className="text-[10px]">{a.triggerTemp}°F</Badge>
                <Badge variant="outline" className="text-[10px]">{a.alertType}</Badge>
              </div>
              <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-muted-foreground hover:text-red-400" onClick={() => onRemove(a.id)}>
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
          ))}
        </div>
      )}
      {dismissed.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-xs font-mono text-green-400/60 uppercase tracking-wider">Completed</p>
          {dismissed.map((a) => (
            <div key={a.id} className="flex items-center gap-2 bg-green-500/5 border border-green-500/20 rounded p-2 opacity-60">
              <span className="text-sm font-mono line-through">{a.label}</span>
              <Badge variant="outline" className="text-[10px] border-green-500/30 text-green-400">{a.triggerTemp}°F ✓</Badge>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ===== No Active Cook — Idle State =====
function IdleState({ onConfigure, onBrowse }: { onConfigure: () => void; onBrowse: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6">
      <div className="p-6 rounded-full bg-card/50 border border-border/50">
        <ChefHat className="h-16 w-16 text-muted-foreground" />
      </div>
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-bold">Ready to Cook</h2>
        <p className="text-muted-foreground max-w-md">
          Configure a new cook session with intelligent cut selection, doneness targets,
          and smart alerts — or browse the Cook Guide for pre-built templates.
        </p>
      </div>
      <div className="flex gap-3">
        <Button size="lg" className="gap-2" onClick={onConfigure}>
          <Settings2 className="h-5 w-5" />
          Configure Cook
        </Button>
        <Button size="lg" variant="outline" className="gap-2" onClick={onBrowse}>
          <BookOpen className="h-5 w-5" />
          Cook Guide
        </Button>
      </div>
    </div>
  );
}

// ===== Main Live Cook Page =====
export default function LiveCook() {
  const { user } = useAuth();
  const { activeCook, isLoading, startCook, dismissAlert: dismissAlertMutation, addAlert: addAlertMutation, removeAlert: removeAlertMutation, endCook, cancelCook } = useLiveCook();
  const telemetryQuery = useLiveTelemetry();
  const { chartData } = useTelemetryHistory();
  const notifications = useNotifications();
  const traegerStatus = useTraegerStatus();
  const [, setLocation] = useLocation();
  const searchString = useSearch();

  // Parse query params for pre-selection from Cook Guide
  const searchParams = useMemo(() => new URLSearchParams(searchString), [searchString]);
  const initialCutId = searchParams.get("cutId") || undefined;
  const initialCategory = searchParams.get("category") || undefined;
  const fromTemplate = searchParams.get("template") || undefined;

  // Three states: "idle" | "configure" | "active"
  const [pageState, setPageState] = useState<"idle" | "configure">(
    initialCutId || initialCategory || fromTemplate ? "configure" : "idle"
  );

  // When query params change (navigating from Cook Guide), switch to configure
  useEffect(() => {
    if (initialCutId || initialCategory || fromTemplate) {
      setPageState("configure");
    }
  }, [initialCutId, initialCategory, fromTemplate]);

  const [showEndDialog, setShowEndDialog] = useState(false);
  const [showAddAlertDialog, setShowAddAlertDialog] = useState(false);
  const [endNotes, setEndNotes] = useState("");
  const [endRating, setEndRating] = useState(5);
  const [newAlertLabel, setNewAlertLabel] = useState("");
  const [newAlertTemp, setNewAlertTemp] = useState(200);
  const [newAlertType, setNewAlertType] = useState<"notification" | "alarm">("notification");
  const [newAlertTrigger, setNewAlertTrigger] = useState<"probe" | "grill">("probe");

  const telemetry = telemetryQuery.data;

  // Determine meat profile for the active cook
  const meatProfile: MeatProfile | null = useMemo(() => {
    if (!activeCook?.session) return null;
    const session = activeCook.session;
    const profile = getMeatProfile(undefined, session.meatType ?? undefined, session.cutName ?? undefined);
    return profile ?? null;
  }, [activeCook?.session]);

  // Cook start time for elapsed display
  const cookStartTime = useMemo(() => {
    if (activeCook?.session?.startedAt) {
      return new Date(activeCook.session.startedAt).getTime();
    }
    if (activeCook?.mqttState?.startedAt) {
      return activeCook.mqttState.startedAt;
    }
    return undefined;
  }, [activeCook]);

  // Process alerts from MQTT state and trigger browser notifications
  useEffect(() => {
    if (!activeCook?.firedAlerts) return;
    for (const alert of activeCook.firedAlerts) {
      if (alert.alertType === "alarm") {
        notifications.startAlarm(alert.id, alert.label, alert.message || `${alert.label} at ${alert.triggerTemp}°F`);
      } else {
        notifications.sendNotification(alert.id, alert.label, alert.message || `${alert.label} at ${alert.triggerTemp}°F`);
      }
    }
  }, [activeCook?.firedAlerts]);

  // Process missed alerts
  useEffect(() => {
    if (!activeCook?.missedAlerts || activeCook.missedAlerts.length === 0) return;
    for (const alert of activeCook.missedAlerts) {
      toast.warning(`Missed alert: ${alert.label} at ${alert.triggerTemp}°F`, {
        description: alert.message,
        duration: 15000,
      });
    }
  }, [activeCook?.missedAlerts]);

  // Request notification permission on mount
  useEffect(() => {
    if (notifications.permission === "default") {
      notifications.requestPermission();
    }
  }, []);

  const handleEndCook = () => {
    endCook.mutate(
      { notes: endNotes, rating: endRating },
      {
        onSuccess: () => {
          notifications.dismissAllAlarms();
          notifications.resetFiredAlerts();
          setShowEndDialog(false);
          toast.success("Cook session ended and saved to history.");
        },
      }
    );
  };

  const handleAddAlert = () => {
    if (!newAlertLabel.trim()) return;
    addAlertMutation.mutate(
      { label: newAlertLabel, triggerTemp: newAlertTemp, alertType: newAlertType, triggerType: newAlertTrigger },
      {
        onSuccess: () => {
          setShowAddAlertDialog(false);
          setNewAlertLabel("");
          toast.success("Alert added");
        },
      }
    );
  };

  // Handle starting a cook from the configurator
  const handleStartFromConfig = (result: CookConfigResult) => {
    const grillId = traegerStatus.data?.selectedGrillId;
    if (!grillId) {
      toast.error("No grill selected", { description: "Go to Settings to connect your grill." });
      return;
    }

    const { config, enableNotifications: notif, enableAlarms: alarms } = result;

    // Build stages from the cut catalog config
    const stages = [];

    // Main cook stage
    stages.push({
      name: `${config.method === "reverse_sear" ? "Smoke" : config.method === "smoke" ? "Smoke" : "Cook"} — ${config.cutName}`,
      grillTemp: config.grillTemp,
      triggerType: "probe_temp" as const,
      triggerValue: config.pullTemp,
      superSmoke: config.method === "smoke" && config.grillTemp <= 225,
      alertMessage: `${config.cutName} has reached ${config.pullTemp}°F — time to pull!`,
    });

    // Reverse sear: add sear stage
    if (config.method === "reverse_sear") {
      stages.push({
        name: "Sear",
        grillTemp: 450,
        triggerType: "time" as const,
        triggerValue: 180, // 3 minutes
        superSmoke: false,
        alertMessage: "Flip and sear the other side!",
      });
    }

    startCook.mutate(
      {
        grillId,
        meatType: config.category,
        cutName: config.cutName,
        method: config.method,
        meatProfileId: config.meatProfileId,
        stages,
        enableNotifications: notif,
        enableAlarms: alarms,
      },
      {
        onSuccess: () => {
          toast.success(`Cook started: ${config.cutName}`, {
            description: `${config.donenessLabel} — pull at ${config.pullTemp}°F`,
          });
          // Clear query params
          setLocation("/live-cook", { replace: true });
        },
        onError: (err) => {
          toast.error("Failed to start cook", { description: err.message });
        },
      }
    );
  };

  if (!user) return null;
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-amber-400" />
      </div>
    );
  }

  // ===== STATE: Active Cook =====
  if (activeCook) {
    const session = activeCook.session;
    const mqttState = activeCook.mqttState;
    const allAlerts = mqttState?.alerts || [];

    return (
      <div className="space-y-4">
        {/* Alarm banners */}
        <AlarmBanner
          alarms={notifications.activeAlarms}
          onDismiss={(id) => {
            notifications.dismissAlarm(id);
            dismissAlertMutation.mutate({ alertId: id });
          }}
        />

        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Flame className="h-6 w-6 text-amber-400" />
              Live Cook
            </h1>
            <p className="text-sm text-muted-foreground font-mono">
              {session?.meatType && session?.cutName
                ? `${session.meatType} — ${session.cutName}`
                : session?.method || "Active Cook Session"}
              {session?.templateId && <span className="ml-2 text-amber-400/60">({session.templateId})</span>}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {/* Notification toggles */}
            <div className="flex items-center gap-3 mr-4">
              <div className="flex items-center gap-1.5">
                <Switch
                  checked={notifications.notificationsEnabled}
                  onCheckedChange={notifications.setNotificationsEnabled}
                  className="scale-75"
                />
                <Label className="text-xs font-mono cursor-pointer">
                  <Bell className="h-3 w-3 inline mr-1" />
                  Notify
                </Label>
              </div>
              <div className="flex items-center gap-1.5">
                <Switch
                  checked={notifications.alarmsEnabled}
                  onCheckedChange={notifications.setAlarmsEnabled}
                  className="scale-75"
                />
                <Label className="text-xs font-mono cursor-pointer">
                  <BellRing className="h-3 w-3 inline mr-1" />
                  Alarm
                </Label>
              </div>
            </div>
            <Button variant="outline" size="sm" className="gap-1.5 font-mono" onClick={() => setShowEndDialog(true)}>
              <Square className="h-3.5 w-3.5" />
              End Cook
            </Button>
          </div>
        </div>

        {/* Cook Summary Stats */}
        <CookSummary session={session} mqttState={mqttState} telemetry={telemetry} />

        {/* Stall Detector */}
        <StallDetector stallInfo={activeCook.stallInfo} />

        {/* Temperature Graph */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-mono flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-amber-400" />
              Temperature History
              {meatProfile && (
                <Badge variant="outline" className="ml-2 text-[10px] font-mono border-amber-500/30 text-amber-400">
                  {meatProfile.name} markers
                </Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <TemperatureGraph
              data={chartData}
              meatProfile={meatProfile}
              cookStartTime={cookStartTime}
              height={300}
            />
          </CardContent>
        </Card>

        {/* Alerts Panel */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-mono flex items-center gap-2">
                <Bell className="h-4 w-4 text-amber-400" />
                Alerts & Alarms
                <Badge variant="outline" className="text-[10px]">{allAlerts.length}</Badge>
              </CardTitle>
              <Button variant="outline" size="sm" className="h-7 text-xs font-mono gap-1" onClick={() => setShowAddAlertDialog(true)}>
                <Plus className="h-3 w-3" />
                Add Alert
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {allAlerts.length > 0 ? (
              <AlertList
                alerts={allAlerts}
                onDismiss={(id) => {
                  notifications.dismissAlarm(id);
                  dismissAlertMutation.mutate({ alertId: id });
                }}
                onRemove={(id) => removeAlertMutation.mutate({ alertId: id })}
              />
            ) : (
              <p className="text-sm text-muted-foreground text-center py-4">
                No alerts configured. Add custom alerts to get notified at specific temperatures.
              </p>
            )}
          </CardContent>
        </Card>

        {/* Notification Permission Warning */}
        {notifications.permission !== "granted" && (
          <Card className="border-amber-500/30">
            <CardContent className="p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <AlertTriangle className="h-5 w-5 text-amber-400" />
                <div>
                  <p className="text-sm font-medium">Browser notifications are not enabled</p>
                  <p className="text-xs text-muted-foreground">Enable to receive alerts when temperatures are reached.</p>
                </div>
              </div>
              <Button variant="outline" size="sm" onClick={notifications.requestPermission}>
                Enable
              </Button>
            </CardContent>
          </Card>
        )}

        {/* End Cook Dialog */}
        <Dialog open={showEndDialog} onOpenChange={setShowEndDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>End Cook Session</DialogTitle>
              <DialogDescription>Save notes and rate this cook for your history.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label className="text-sm font-mono">Rating</Label>
                <div className="flex gap-1 mt-1">
                  {[1, 2, 3, 4, 5].map((r) => (
                    <Button
                      key={r}
                      variant={endRating >= r ? "default" : "outline"}
                      size="sm"
                      className="w-8 h-8 p-0"
                      onClick={() => setEndRating(r)}
                    >
                      {r}
                    </Button>
                  ))}
                </div>
              </div>
              <div>
                <Label className="text-sm font-mono">Notes</Label>
                <Textarea
                  value={endNotes}
                  onChange={(e) => setEndNotes(e.target.value)}
                  placeholder="How did it turn out? Any adjustments for next time?"
                  rows={3}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowEndDialog(false)}>Cancel</Button>
              <Button onClick={handleEndCook} disabled={endCook.isPending}>
                {endCook.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Save & End
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Add Alert Dialog */}
        <Dialog open={showAddAlertDialog} onOpenChange={setShowAddAlertDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Custom Alert</DialogTitle>
              <DialogDescription>Set a temperature-based notification or alarm.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label className="text-sm font-mono">Label</Label>
                <Input value={newAlertLabel} onChange={(e) => setNewAlertLabel(e.target.value)} placeholder="e.g., Wrap point" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-sm font-mono">Temperature (°F)</Label>
                  <Input type="number" value={newAlertTemp} onChange={(e) => setNewAlertTemp(Number(e.target.value))} min={50} max={500} />
                </div>
                <div>
                  <Label className="text-sm font-mono">Trigger On</Label>
                  <Select value={newAlertTrigger} onValueChange={(v) => setNewAlertTrigger(v as "probe" | "grill")}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="probe">Probe Temp</SelectItem>
                      <SelectItem value="grill">Grill Temp</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <Label className="text-sm font-mono">Alert Type</Label>
                <div className="flex gap-3 mt-1.5">
                  <Button
                    variant={newAlertType === "notification" ? "default" : "outline"}
                    size="sm"
                    className="gap-1.5"
                    onClick={() => setNewAlertType("notification")}
                  >
                    <Bell className="h-3.5 w-3.5" />
                    Notification
                  </Button>
                  <Button
                    variant={newAlertType === "alarm" ? "default" : "outline"}
                    size="sm"
                    className="gap-1.5"
                    onClick={() => setNewAlertType("alarm")}
                  >
                    <BellRing className="h-3.5 w-3.5" />
                    Alarm
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {newAlertType === "notification"
                    ? "Sends a one-time browser notification."
                    : "Keeps alerting every 15 seconds until dismissed."}
                </p>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowAddAlertDialog(false)}>Cancel</Button>
              <Button onClick={handleAddAlert} disabled={!newAlertLabel.trim() || addAlertMutation.isPending}>
                Add Alert
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  // ===== STATE: Configure (pre-start) =====
  if (pageState === "configure") {
    return (
      <div className="max-w-3xl mx-auto">
        <CookConfigurator
          initialCutId={initialCutId}
          initialCategory={initialCategory}
          onStartCook={handleStartFromConfig}
          onCancel={() => {
            setPageState("idle");
            setLocation("/live-cook", { replace: true });
          }}
          isStarting={startCook.isPending}
          grillConnected={!!traegerStatus.data?.connected && !!traegerStatus.data?.selectedGrillId}
        />
      </div>
    );
  }

  // ===== STATE: Idle =====
  return (
    <IdleState
      onConfigure={() => setPageState("configure")}
      onBrowse={() => setLocation("/cook-programs")}
    />
  );
}
