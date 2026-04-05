import { useTraegerStatus, useTelemetryState, useGrillCommands } from "@/hooks/useTraeger";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import {
  Thermometer,
  Flame,
  Wind,
  Battery,
  Timer,
  Power,
  Wifi,
  WifiOff,
  AlertTriangle,
  RefreshCw,
  Droplets,
} from "lucide-react";
import { getSystemStatus } from "@shared/traeger-types";
import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { toast } from "sonner";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

function StatusBadge({ code }: { code: number }) {
  const status = getSystemStatus(code);
  const colorMap: Record<string, string> = {
    gray: "bg-gray-500/20 text-gray-400 border-gray-500/30",
    blue: "bg-blue-500/20 text-blue-400 border-blue-500/30",
    yellow: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
    orange: "bg-orange-500/20 text-orange-400 border-orange-500/30",
    green: "bg-green-500/20 text-green-400 border-green-500/30",
    purple: "bg-purple-500/20 text-purple-400 border-purple-500/30",
    cyan: "bg-cyan-500/20 text-cyan-400 border-cyan-500/30",
    red: "bg-red-500/20 text-red-400 border-red-500/30",
  };
  return (
    <Badge variant="outline" className={`${colorMap[status.color] || colorMap.gray} text-xs font-medium`}>
      {status.label}
    </Badge>
  );
}

function TempCard({
  label,
  value,
  target,
  icon: Icon,
  color,
  unit = "°F",
}: {
  label: string;
  value: number;
  target?: number;
  icon: typeof Thermometer;
  color: string;
  unit?: string;
}) {
  return (
    <Card className="bg-card border-border">
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm text-muted-foreground">{label}</span>
          <Icon className={`h-4 w-4 ${color}`} />
        </div>
        <div className="flex items-baseline gap-2">
          <span className={`text-3xl font-bold tabular-nums ${color}`}>
            {value > 0 ? value : "--"}
          </span>
          <span className="text-sm text-muted-foreground">{unit}</span>
        </div>
        {target !== undefined && target > 0 && (
          <div className="mt-1 text-xs text-muted-foreground">
            Target: {target}{unit}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function PelletGauge({ level }: { level: number }) {
  const getColor = (l: number) => {
    if (l > 60) return "bg-green-500";
    if (l > 30) return "bg-yellow-500";
    return "bg-red-500";
  };

  return (
    <Card className="bg-card border-border">
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm text-muted-foreground">Pellet Level</span>
          <Battery className="h-4 w-4 text-muted-foreground" />
        </div>
        <div className="flex items-baseline gap-2 mb-3">
          <span className="text-3xl font-bold tabular-nums text-foreground">
            {level > 0 ? level : "--"}
          </span>
          <span className="text-sm text-muted-foreground">%</span>
        </div>
        <Progress value={level} className={`h-2 ${getColor(level)}`} />
        {level > 0 && level <= 30 && (
          <div className="flex items-center gap-1 mt-2 text-xs text-yellow-400">
            <AlertTriangle className="h-3 w-3" />
            Low pellets - consider refilling
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function CookTimer({ start, end }: { start: number; end: number }) {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    if (end <= 0) return;
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, [end]);

  const isActive = end > 0 && start > 0;
  const remaining = isActive ? Math.max(0, Math.floor((end * 1000 - now) / 1000)) : 0;
  const hours = Math.floor(remaining / 3600);
  const minutes = Math.floor((remaining % 3600) / 60);
  const seconds = remaining % 60;

  return (
    <Card className="bg-card border-border">
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm text-muted-foreground">Cook Timer</span>
          <Timer className="h-4 w-4 text-muted-foreground" />
        </div>
        {isActive ? (
          <div className="text-3xl font-bold tabular-nums font-mono text-primary">
            {String(hours).padStart(2, "0")}:{String(minutes).padStart(2, "0")}:
            {String(seconds).padStart(2, "0")}
          </div>
        ) : (
          <div className="text-3xl font-bold tabular-nums text-muted-foreground">--:--:--</div>
        )}
        {remaining === 0 && isActive && (
          <div className="text-xs text-primary mt-1">Timer complete!</div>
        )}
      </CardContent>
    </Card>
  );
}

export default function Dashboard() {
  const [, setLocation] = useLocation();
  const { data: status, isLoading: statusLoading } = useTraegerStatus();
  const { telemetry, history, updateTelemetry } = useTelemetryState();
  const commands = useGrillCommands();

  // Demo data for when grill is not connected - shows UI capability
  const [demoMode] = useState(true);

  useEffect(() => {
    if (!status?.connected || !status?.selectedGrillId) return;
    // In production, this would connect to MQTT via SSE
    // For now, request status periodically
    const interval = setInterval(() => {
      commands.requestStatus.mutate();
    }, 30000);
    return () => clearInterval(interval);
  }, [status?.connected, status?.selectedGrillId]);

  const chartData = useMemo(() => {
    return history.map((h) => ({
      time: new Date(h.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      grill: h.grill > 0 ? h.grill : undefined,
      probe: h.probe > 0 ? h.probe : undefined,
      ambient: h.ambient > 0 ? h.ambient : undefined,
      target: h.set > 0 ? h.set : undefined,
    }));
  }, [history]);

  if (statusLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!status?.connected) {
    return (
      <div className="max-w-2xl mx-auto mt-12">
        <Card className="bg-card border-border">
          <CardContent className="p-8 text-center">
            <WifiOff className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-foreground mb-2">No Traeger Account Connected</h2>
            <p className="text-muted-foreground mb-6">
              Connect your Traeger WiFIRE account to monitor and control your grill in real-time.
            </p>
            <Button onClick={() => setLocation("/settings")} className="bg-primary text-primary-foreground">
              Connect Traeger Account
            </Button>
          </CardContent>
        </Card>

        <div className="mt-8">
          <h3 className="text-lg font-semibold text-foreground mb-4">What you'll get:</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[
              { icon: Thermometer, title: "Live Temperature", desc: "Real-time grill, probe, and ambient temps" },
              { icon: Flame, title: "Grill Controls", desc: "Set temperature, timers, and Super Smoke" },
              { icon: Timer, title: "Cook Automation", desc: "Multi-stage programs with smart triggers" },
              { icon: Droplets, title: "Pellet Tracking", desc: "Monitor pellet level and burn rate" },
            ].map((item) => (
              <Card key={item.title} className="bg-card/50 border-border">
                <CardContent className="p-4 flex items-start gap-3">
                  <item.icon className="h-5 w-5 text-primary mt-0.5" />
                  <div>
                    <div className="font-medium text-foreground text-sm">{item.title}</div>
                    <div className="text-xs text-muted-foreground">{item.desc}</div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // Connected state - show dashboard
  const selectedGrill = status.grills?.find(
    (g: { thingName: string }) => g.thingName === status.selectedGrillId
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">
            {selectedGrill?.friendlyName || "My Grill"}
          </h1>
          <div className="flex items-center gap-2 mt-1">
            <StatusBadge code={telemetry.systemStatus} />
            {telemetry.connected ? (
              <div className="flex items-center gap-1 text-xs text-green-400">
                <Wifi className="h-3 w-3" /> Connected
              </div>
            ) : (
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <WifiOff className="h-3 w-3" /> Waiting for data...
              </div>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              commands.requestStatus.mutate();
              toast.info("Status request sent");
            }}
          >
            <RefreshCw className="h-4 w-4 mr-1" />
            Refresh
          </Button>
          <Button
            variant="destructive"
            size="sm"
            onClick={() => {
              if (confirm("Are you sure you want to shut down the grill?")) {
                commands.shutdown.mutate();
                toast.success("Shutdown command sent");
              }
            }}
          >
            <Power className="h-4 w-4 mr-1" />
            Shutdown
          </Button>
        </div>
      </div>

      {/* Temperature Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <TempCard
          label="Grill Temp"
          value={telemetry.grill}
          target={telemetry.set}
          icon={Flame}
          color="text-orange-400"
        />
        <TempCard
          label="Probe Temp"
          value={telemetry.probe}
          target={telemetry.probeSet}
          icon={Thermometer}
          color="text-red-400"
        />
        <PelletGauge level={telemetry.pelletLevel} />
        <CookTimer start={telemetry.cookTimerStart} end={telemetry.cookTimerEnd} />
      </div>

      {/* Quick Controls */}
      <Card className="bg-card border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium text-muted-foreground">Quick Controls</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3">
            <Button
              variant="outline"
              size="sm"
              className={telemetry.smoke ? "border-primary text-primary bg-primary/10" : ""}
              onClick={() => {
                commands.setSuperSmoke.mutate({ enabled: !telemetry.smoke });
                toast.info(telemetry.smoke ? "Super Smoke OFF" : "Super Smoke ON");
              }}
            >
              <Wind className="h-4 w-4 mr-1" />
              Super Smoke {telemetry.smoke ? "ON" : "OFF"}
            </Button>
            <Button
              variant="outline"
              size="sm"
              className={telemetry.keepwarm ? "border-primary text-primary bg-primary/10" : ""}
              onClick={() => {
                commands.setKeepWarm.mutate({ enabled: !telemetry.keepwarm });
                toast.info(telemetry.keepwarm ? "Keep Warm OFF" : "Keep Warm ON");
              }}
            >
              <Flame className="h-4 w-4 mr-1" />
              Keep Warm {telemetry.keepwarm ? "ON" : "OFF"}
            </Button>
            <Button variant="outline" size="sm" onClick={() => setLocation("/controls")}>
              All Controls
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Temperature Graph */}
      <Card className="bg-card border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium text-muted-foreground">Temperature History</CardTitle>
        </CardHeader>
        <CardContent>
          {chartData.length > 1 ? (
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                <XAxis dataKey="time" stroke="rgba(255,255,255,0.3)" fontSize={11} />
                <YAxis stroke="rgba(255,255,255,0.3)" fontSize={11} domain={[0, "auto"]} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "rgba(23,23,23,0.95)",
                    border: "1px solid rgba(255,255,255,0.1)",
                    borderRadius: "8px",
                    fontSize: "12px",
                  }}
                />
                <Legend />
                <Line type="monotone" dataKey="grill" stroke="#f97316" strokeWidth={2} dot={false} name="Grill" />
                <Line type="monotone" dataKey="probe" stroke="#ef4444" strokeWidth={2} dot={false} name="Probe" />
                <Line type="monotone" dataKey="ambient" stroke="#60a5fa" strokeWidth={1.5} dot={false} name="Ambient" />
                <Line
                  type="stepAfter"
                  dataKey="target"
                  stroke="#a3a3a3"
                  strokeWidth={1}
                  strokeDasharray="5 5"
                  dot={false}
                  name="Target"
                />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex flex-col items-center justify-center h-48 text-muted-foreground">
              <Thermometer className="h-8 w-8 mb-2 opacity-50" />
              <p className="text-sm">Temperature data will appear here once your grill is connected and sending telemetry.</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Ambient Temperature */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-muted-foreground">Ambient Temp</span>
              <Wind className="h-4 w-4 text-blue-400" />
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold tabular-nums text-blue-400">
                {telemetry.ambient > 0 ? telemetry.ambient : "--"}
              </span>
              <span className="text-sm text-muted-foreground">°F</span>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-muted-foreground">Grill Status</span>
            </div>
            <div className="text-sm text-muted-foreground">
              {getSystemStatus(telemetry.systemStatus).description}
            </div>
            <div className="mt-2 flex items-center gap-2">
              <StatusBadge code={telemetry.systemStatus} />
              {telemetry.smoke ? (
                <Badge variant="outline" className="bg-purple-500/20 text-purple-400 border-purple-500/30 text-xs">
                  Super Smoke
                </Badge>
              ) : null}
              {telemetry.keepwarm ? (
                <Badge variant="outline" className="bg-amber-500/20 text-amber-400 border-amber-500/30 text-xs">
                  Keep Warm
                </Badge>
              ) : null}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
