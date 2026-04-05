import { useTraegerStatus, useGrillCommands } from "@/hooks/useTraeger";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Thermometer,
  Flame,
  Timer,
  Wind,
  Power,
  AlertTriangle,
  WifiOff,
  Gauge,
} from "lucide-react";
import { useState } from "react";
import { useLocation } from "wouter";
import { toast } from "sonner";

export default function Controls() {
  const [, setLocation] = useLocation();
  const { data: status } = useTraegerStatus();
  const commands = useGrillCommands();

  const [targetTemp, setTargetTemp] = useState(225);
  const [timerHours, setTimerHours] = useState(0);
  const [timerMinutes, setTimerMinutes] = useState(30);
  const [probeAlarm, setProbeAlarm] = useState(165);
  const [superSmoke, setSuperSmoke] = useState(false);
  const [keepWarm, setKeepWarm] = useState(false);

  if (!status?.connected) {
    return (
      <div className="max-w-lg mx-auto mt-12">
        <Card className="bg-card border-border">
          <CardContent className="p-8 text-center">
            <WifiOff className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-foreground mb-2">No Grill Connected</h2>
            <p className="text-muted-foreground mb-6 text-sm">
              Connect your grill account to access remote controls.
            </p>
            <Button onClick={() => setLocation("/settings")} className="bg-primary text-primary-foreground">
              Connect Account
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground tracking-tight">Grill Controls</h1>
        <p className="text-sm text-muted-foreground mt-1 font-mono">
          Remote command interface
        </p>
      </div>

      {/* Temperature Control */}
      <Card className="bg-card border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-xs font-mono uppercase tracking-wider text-muted-foreground flex items-center gap-2">
            <Gauge className="h-3.5 w-3.5 text-primary" />
            Temperature
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-4xl font-bold font-mono text-primary">{targetTemp}</span>
              <span className="text-lg text-muted-foreground ml-1">°F</span>
            </div>
            <Button
              onClick={() => {
                commands.setTemp.mutate({ temp: targetTemp });
                toast.success(`Temperature set to ${targetTemp}°F`);
              }}
              disabled={commands.setTemp.isPending}
              className="bg-primary text-primary-foreground font-mono text-xs"
            >
              set temp
            </Button>
          </div>
          <Slider
            value={[targetTemp]}
            onValueChange={([v]) => setTargetTemp(v)}
            min={165}
            max={500}
            step={5}
            className="py-2"
          />
          <div className="flex justify-between text-xs text-muted-foreground font-mono">
            <span>165°F</span>
            <span>Smoke: 180-225</span>
            <span>Grill: 350-450</span>
            <span>500°F</span>
          </div>
        </CardContent>
      </Card>

      {/* Timer */}
      <Card className="bg-card border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-xs font-mono uppercase tracking-wider text-muted-foreground flex items-center gap-2">
            <Timer className="h-3.5 w-3.5 text-primary" />
            Cook Timer
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-xs text-muted-foreground font-mono">Hours</Label>
              <Input
                type="number"
                value={timerHours}
                onChange={(e) => setTimerHours(Math.max(0, parseInt(e.target.value) || 0))}
                className="bg-secondary text-foreground font-mono"
                min={0}
                max={24}
              />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground font-mono">Minutes</Label>
              <Input
                type="number"
                value={timerMinutes}
                onChange={(e) => setTimerMinutes(Math.max(0, parseInt(e.target.value) || 0))}
                className="bg-secondary text-foreground font-mono"
                min={0}
                max={59}
              />
            </div>
          </div>
          <div className="flex gap-2">
            <Button
              onClick={() => {
                const seconds = timerHours * 3600 + timerMinutes * 60;
                if (seconds < 60) {
                  toast.error("Timer must be at least 1 minute");
                  return;
                }
                commands.setTimer.mutate({ seconds });
                toast.success(`Timer set for ${timerHours}h ${timerMinutes}m`);
              }}
              disabled={commands.setTimer.isPending}
              className="bg-primary text-primary-foreground font-mono text-xs flex-1"
            >
              start timer
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                commands.clearTimer.mutate();
                toast.info("Timer cleared");
              }}
              disabled={commands.clearTimer.isPending}
              className="font-mono text-xs"
            >
              clear
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Probe Alarm */}
      <Card className="bg-card border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-xs font-mono uppercase tracking-wider text-muted-foreground flex items-center gap-2">
            <Thermometer className="h-3.5 w-3.5 text-red-400" />
            Probe Alarm
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-3xl font-bold font-mono text-red-400">{probeAlarm}</span>
              <span className="text-lg text-muted-foreground ml-1">°F</span>
            </div>
            <Button
              onClick={() => {
                commands.setProbeAlarm.mutate({ temp: probeAlarm });
                toast.success(`Probe alarm set at ${probeAlarm}°F`);
              }}
              disabled={commands.setProbeAlarm.isPending}
              className="bg-primary text-primary-foreground font-mono text-xs"
            >
              set alarm
            </Button>
          </div>
          <Slider
            value={[probeAlarm]}
            onValueChange={([v]) => setProbeAlarm(v)}
            min={100}
            max={220}
            step={1}
            className="py-2"
          />
          <div className="flex justify-between text-xs text-muted-foreground font-mono">
            <span>100°F</span>
            <span>Poultry: 165</span>
            <span>Beef: 203</span>
            <span>220°F</span>
          </div>
        </CardContent>
      </Card>

      {/* Toggles */}
      <Card className="bg-card border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-xs font-mono uppercase tracking-wider text-muted-foreground">
            Modes
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Wind className="h-5 w-5 text-purple-400" />
              <div>
                <div className="font-medium text-foreground text-sm">Super Smoke</div>
                <div className="text-xs text-muted-foreground">
                  Maximum smoke output (165-225°F only)
                </div>
              </div>
            </div>
            <Switch
              checked={superSmoke}
              onCheckedChange={(checked) => {
                setSuperSmoke(checked);
                commands.setSuperSmoke.mutate({ enabled: checked });
                toast.info(checked ? "Super Smoke enabled" : "Super Smoke disabled");
              }}
            />
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Flame className="h-5 w-5 text-amber-400" />
              <div>
                <div className="font-medium text-foreground text-sm">Keep Warm</div>
                <div className="text-xs text-muted-foreground">
                  Maintain low temperature after cook completes
                </div>
              </div>
            </div>
            <Switch
              checked={keepWarm}
              onCheckedChange={(checked) => {
                setKeepWarm(checked);
                commands.setKeepWarm.mutate({ enabled: checked });
                toast.info(checked ? "Keep Warm enabled" : "Keep Warm disabled");
              }}
            />
          </div>
        </CardContent>
      </Card>

      {/* Shutdown */}
      <Card className="bg-card border-destructive/30">
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Power className="h-5 w-5 text-destructive" />
              <div>
                <div className="font-medium text-foreground">Shutdown Grill</div>
                <div className="text-xs text-muted-foreground">
                  Safe shutdown with fan cool-down (10-15 min)
                </div>
              </div>
            </div>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" className="font-mono text-xs">
                  <Power className="h-3.5 w-3.5 mr-1.5" />
                  shutdown
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent className="bg-card border-border">
                <AlertDialogHeader>
                  <AlertDialogTitle className="text-foreground">Confirm Shutdown</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will initiate a safe shutdown cycle. The fan will continue running for 10-15
                    minutes to cool down. This cannot be undone remotely.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    className="bg-destructive text-destructive-foreground"
                    onClick={() => {
                      commands.shutdown.mutate();
                      toast.success("Shutdown command sent. Fan will run 10-15 minutes.");
                    }}
                  >
                    Confirm Shutdown
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </CardContent>
      </Card>

      {/* Safety Notice */}
      <div className="flex items-start gap-3 p-4 rounded-lg bg-amber-500/5 border border-amber-500/15">
        <AlertTriangle className="h-5 w-5 text-amber-400 shrink-0 mt-0.5" />
        <div className="text-sm text-muted-foreground">
          <strong className="text-amber-400">Safety:</strong> Remote ignition is not possible.
          The grill must be physically started before commands can be sent. Always ensure the grill is
          in a safe location and attended when operating remotely.
        </div>
      </div>
    </div>
  );
}
