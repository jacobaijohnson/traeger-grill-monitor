import { useTraegerStatus, useTelemetryState, useGrillCommands } from "@/hooks/useTraeger";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
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
  Gauge,
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
    gray: "bg-muted text-muted-foreground",
    blue: "bg-blue-500/20 text-blue-400 border-blue-500/30",
    yellow: "bg-amber-500/20 text-amber-400 border-amber-500/30",
    orange: "bg-amber-600/20 text-amber-500 border-amber-600/30",
    green: "bg-green-500/20 text-green-400 border-green-500/30",
    purple: "bg-purple-500/20 text-purple-400 border-purple-500/30",
    cyan: "bg-cyan-500/20 text-cyan-400 border-cyan-500/30",
    red: "bg-red-500/20 text-red-400 border-red-500/30",
  };
  return (
    <Badge variant="outline" className={`${colorMap[status.color] || colorMap.gray} text-xs font-mono`}>
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
}: {
  label: string;
  value: number;
  target?: number;
  icon: typeof Thermometer;
  color: string;
}) {
  return (
    <Card className="bg-card border-border">
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs text-muted-foreground font-mono uppercase tracking-wider">{label}</span>
          <Icon className={`h-4 w-4 ${color}`} />
        </div>
        <div className="flex items-baseline gap-1">
          <span className={`text-3xl font-bold font-mono ${color}`}>
            {value > 0 ? value : "--"}
          </span>
          <span className="text-sm text-muted-foreground">°F</span>
        </div>
        {target !== undefined && target > 0 && (
          <div className="mt-1 text-xs text-muted-foreground font-mono">
            Target: {target}°F
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function PelletGauge({ level }: { level: number }) {
  return (
    <Card className="bg-card border-border">
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs text-muted-foreground font-mono uppercase tracking-wider">Pellets</span>
          <Battery className="h-4 w-4 text-muted-foreground" />
        </div>
        <div className="flex items-baseline gap-1 mb-3">
          <span className="text-3xl font-bold font-mono text-foreground">
            {level > 0 ? level : "--"}
          </span>
          <span className="text-sm text-muted-foreground">%</span>
        </div>
        <Progress value={level} className="h-2" />
        {level > 0 && level <= 30 && (
          <div className="flex items-center gap-1 mt-2 text-xs text-amber-400">
            <AlertTriangle className="h-3 w-3" />
            Low pellets — refill soon
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
          <span className="text-xs text-muted-foreground font-mono uppercase tracking-wider">Timer</span>
          <Timer className="h-4 w-4 text-muted-foreground" />
        </div>
        {isActive ? (
          <div className="text-3xl font-bold font-mono text-primary">
            {String(hours).padStart(2, "0")}:{String(minutes).padStart(2, "0")}:
            {String(seconds).padStart(2, "0")}
          </div>
        ) : (
          <div className="text-3xl font-bold font-mono text-muted-foreground/40">--:--:--</div>
        )}
        {remaining === 0 && isActive && (
          <div className="text-xs text-primary mt-1 font-mono">Timer complete!</div>
        )}
      </CardContent>
    </Card>
  );
}

export default function Dashboard() {
  const [, setLocation] = useLocation();
  const { data: status, isLoading: statusLoading } = useTraegerStatus();
  const { telemetry, history } = useTelemetryState();
  const commands = useGrillCommands();

  useEffect(() => {
    if (!status?.connected || !status?.selectedGrillId) return;
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
            <div className="inline-flex items-center justify-center h-16 w-16 rounded-xl bg-primary/10 border border-primary/20 mb-4">
              <Gauge className="h-9 w-9 text-primary" />
            </div>
            <h2 className="text-xl font-semibold text-foreground mb-2">Welcome to PitDeck</h2>
            <p className="text-muted-foreground mb-6 text-sm max-w-sm mx-auto">
              Connect your grill account in Settings to unlock live telemetry, remote controls, and cook automation.
            </p>
            <Button onClick={() => setLocation("/settings")} className="bg-primary text-primary-foreground">
              Connect Grill Account
            </Button>
          </CardContent>
        </Card>

        <div className="mt-8">
          <h3 className="text-sm font-mono uppercase tracking-wider text-muted-foreground mb-4">
            What you get
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {[
              { icon: Thermometer, title: "Live Telemetry", desc: "Real-time grill, probe, and ambient temperatures" },
              { icon: Flame, title: "Remote Controls", desc: "Set temperature, timers, Super Smoke, and more" },
              { icon: Timer, title: "Cook Automation", desc: "Multi-stage programs with smart triggers" },
              { icon: Battery, title: "Pellet Tracking", desc: "Monitor pellet level with low-level alerts" },
            ].map((item) => (
              <Card key={item.title} className="bg-card/50 border-border">
                <CardContent className="p-4 flex items-start gap-3">
                  <div className="p-2 rounded-lg bg-secondary">
                    <item.icon className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <div className="font-medium text-foreground text-sm">{item.title}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">{item.desc}</div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // Connected state
  const selectedGrill = status.grills?.find(
    (g: { thingName: string }) => g.thingName === status.selectedGrillId
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight">
            {selectedGrill?.friendlyName || "My Grill"}
          </h1>
          <div className="flex items-center gap-2 mt-1">
            <StatusBadge code={telemetry.systemStatus} />
            {telemetry.connected ? (
              <div className="flex items-center gap-1 text-xs text-green-400 font-mono">
                <Wifi className="h-3 w-3" /> online
              </div>
            ) : (
              <div className="flex items-center gap-1 text-xs text-muted-foreground font-mono">
                <WifiOff className="h-3 w-3" /> waiting...
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
            className="font-mono text-xs"
          >
            <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
            refresh
          </Button>
          <Button
            variant="destructive"
            size="sm"
            onClick={() => {
              if (confirm("Shut down the grill? Fan will run 10-15 min to cool down.")) {
                commands.shutdown.mutate();
                toast.success("Shutdown command sent");
              }
            }}
            className="font-mono text-xs"
          >
            <Power className="h-3.5 w-3.5 mr-1.5" />
            shutdown
          </Button>
        </div>
      </div>

      {/* Temperature Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <TempCard label="Grill" value={telemetry.grill} target={telemetry.set} icon={Flame} color="text-primary" />
        <TempCard label="Probe" value={telemetry.probe} target={telemetry.probeSet} icon={Thermometer} color="text-red-400" />
        <PelletGauge level={telemetry.pelletLevel} />
        <CookTimer start={telemetry.cookTimerStart} end={telemetry.cookTimerEnd} />
      </div>

      {/* Quick Controls */}
      <Card className="bg-card border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-xs font-mono uppercase tracking-wider text-muted-foreground">
            Quick Controls
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              className={`font-mono text-xs ${telemetry.smoke ? "border-primary text-primary bg-primary/10" : ""}`}
              onClick={() => {
                commands.setSuperSmoke.mutate({ enabled: !telemetry.smoke });
                toast.info(telemetry.smoke ? "Super Smoke OFF" : "Super Smoke ON");
              }}
            >
              <Wind className="h-3.5 w-3.5 mr-1.5" />
              super smoke {telemetry.smoke ? "on" : "off"}
            </Button>
            <Button
              variant="outline"
              size="sm"
              className={`font-mono text-xs ${telemetry.keepwarm ? "border-primary text-primary bg-primary/10" : ""}`}
              onClick={() => {
                commands.setKeepWarm.mutate({ enabled: !telemetry.keepwarm });
                toast.info(telemetry.keepwarm ? "Keep Warm OFF" : "Keep Warm ON");
              }}
            >
              <Flame className="h-3.5 w-3.5 mr-1.5" />
              keep warm {telemetry.keepwarm ? "on" : "off"}
            </Button>
            <Button variant="outline" size="sm" onClick={() => setLocation("/controls")} className="font-mono text-xs">
              all controls
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Temperature Graph */}
      <Card className="bg-card border-border">
        <CardHeader className="pb-2">
          <CardTitle className="text-xs font-mono uppercase tracking-wider text-muted-foreground flex items-center gap-2">
            <Flame className="h-3.5 w-3.5 text-primary" />
            Temperature History
          </CardTitle>
        </CardHeader>
        <CardContent>
          {chartData.length > 1 ? (
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                <XAxis
                  dataKey="time"
                  stroke="rgba(255,255,255,0.3)"
                  tick={{ fontSize: 10, fontFamily: "JetBrains Mono" }}
                />
                <YAxis
                  stroke="rgba(255,255,255,0.3)"
                  tick={{ fontSize: 10, fontFamily: "JetBrains Mono" }}
                  domain={[0, "auto"]}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "oklch(0.18 0.012 240)",
                    border: "1px solid rgba(255,255,255,0.1)",
                    borderRadius: "6px",
                    fontFamily: "JetBrains Mono",
                    fontSize: "11px",
                  }}
                  labelStyle={{ color: "rgba(255,255,255,0.5)" }}
                />
                <Legend wrapperStyle={{ fontFamily: "JetBrains Mono", fontSize: "11px" }} />
                <Line type="monotone" dataKey="grill" stroke="oklch(0.72 0.14 50)" strokeWidth={2} dot={false} name="Grill" />
                <Line type="monotone" dataKey="probe" stroke="oklch(0.60 0.18 25)" strokeWidth={2} dot={false} name="Probe" />
                <Line type="monotone" dataKey="ambient" stroke="oklch(0.65 0.10 220)" strokeWidth={1.5} dot={false} name="Ambient" />
                <Line type="stepAfter" dataKey="target" stroke="rgba(255,255,255,0.2)" strokeWidth={1} strokeDasharray="5 5" dot={false} name="Target" />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex flex-col items-center justify-center h-[280px] text-muted-foreground">
              <Thermometer className="h-8 w-8 mb-2 opacity-30" />
              <p className="text-sm font-mono">Waiting for telemetry data...</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Status Detail */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-muted-foreground font-mono uppercase tracking-wider">Ambient</span>
              <Wind className="h-4 w-4 text-blue-400" />
            </div>
            <div className="flex items-baseline gap-1">
              <span className="text-2xl font-bold font-mono text-blue-400">
                {telemetry.ambient > 0 ? telemetry.ambient : "--"}
              </span>
              <span className="text-sm text-muted-foreground">°F</span>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground font-mono uppercase tracking-wider mb-2">Status</div>
            <div className="text-sm text-muted-foreground mb-2">
              {getSystemStatus(telemetry.systemStatus).description}
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <StatusBadge code={telemetry.systemStatus} />
              {telemetry.smoke ? (
                <Badge variant="outline" className="bg-purple-500/20 text-purple-400 border-purple-500/30 text-xs font-mono">
                  Super Smoke
                </Badge>
              ) : null}
              {telemetry.keepwarm ? (
                <Badge variant="outline" className="bg-amber-500/20 text-amber-400 border-amber-500/30 text-xs font-mono">
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
