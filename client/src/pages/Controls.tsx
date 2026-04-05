import { useTraegerStatus, useGrillCommands } from "@/hooks/useTraeger";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
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
  Wind,
  Timer,
  Power,
  AlertTriangle,
  WifiOff,
  Target,
} from "lucide-react";
import { useState, useMemo } from "react";
import { useLocation } from "wouter";
import { toast } from "sonner";

export default function Controls() {
  const [, setLocation] = useLocation();
  const { data: status } = useTraegerStatus();
  const commands = useGrillCommands();

  const [grillTemp, setGrillTemp] = useState(225);
  const [probeAlarmTemp, setProbeAlarmTemp] = useState(165);
  const [timerHours, setTimerHours] = useState(0);
  const [timerMinutes, setTimerMinutes] = useState(0);
  const [superSmoke, setSuperSmoke] = useState(false);
  const [keepWarm, setKeepWarm] = useState(false);

  const timerSeconds = useMemo(() => timerHours * 3600 + timerMinutes * 60, [timerHours, timerMinutes]);

  if (!status?.connected) {
    return (
      <div className="max-w-lg mx-auto mt-12">
        <Card className="bg-card border-border">
          <CardContent className="p-8 text-center">
            <WifiOff className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-foreground mb-2">No Grill Connected</h2>
            <p className="text-muted-foreground mb-6">Connect your Traeger account to access grill controls.</p>
            <Button onClick={() => setLocation("/settings")} className="bg-primary text-primary-foreground">
              Connect Account
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Grill Controls</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Adjust temperature, timers, and features for your grill.
        </p>
      </div>

      {/* Temperature Control */}
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-foreground">
            <Flame className="h-5 w-5 text-orange-400" />
            Grill Temperature
          </CardTitle>
          <CardDescription>Set the target grill temperature (165-500°F)</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <Slider
                value={[grillTemp]}
                onValueChange={([v]) => setGrillTemp(v)}
                min={165}
                max={500}
                step={5}
                className="w-full"
              />
              <div className="flex justify-between text-xs text-muted-foreground mt-1">
                <span>165°F</span>
                <span>Smoke</span>
                <span>Low</span>
                <span>Med</span>
                <span>High</span>
                <span>500°F</span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Input
                type="number"
                value={grillTemp}
                onChange={(e) => setGrillTemp(Math.min(500, Math.max(165, parseInt(e.target.value) || 165)))}
                className="w-20 text-center font-mono bg-secondary text-foreground"
              />
              <span className="text-sm text-muted-foreground">°F</span>
            </div>
          </div>
          <div className="flex gap-2 flex-wrap">
            {[180, 225, 250, 275, 325, 375, 450].map((t) => (
              <Button
                key={t}
                variant={grillTemp === t ? "default" : "outline"}
                size="sm"
                onClick={() => setGrillTemp(t)}
                className={grillTemp === t ? "bg-primary text-primary-foreground" : ""}
              >
                {t}°
              </Button>
            ))}
          </div>
          <Button
            className="w-full bg-primary text-primary-foreground"
            onClick={() => {
              commands.setTemp.mutate({ temp: grillTemp });
              toast.success(`Grill temperature set to ${grillTemp}°F`);
            }}
            disabled={commands.setTemp.isPending}
          >
            <Flame className="h-4 w-4 mr-2" />
            Set Grill to {grillTemp}°F
          </Button>
        </CardContent>
      </Card>

      {/* Probe Alarm */}
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-foreground">
            <Target className="h-5 w-5 text-red-400" />
            Probe Alarm
          </CardTitle>
          <CardDescription>Set an alarm when the probe reaches a target temperature</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <Slider
                value={[probeAlarmTemp]}
                onValueChange={([v]) => setProbeAlarmTemp(v)}
                min={100}
                max={220}
                step={1}
              />
            </div>
            <div className="flex items-center gap-2">
              <Input
                type="number"
                value={probeAlarmTemp}
                onChange={(e) => setProbeAlarmTemp(Math.min(220, Math.max(100, parseInt(e.target.value) || 100)))}
                className="w-20 text-center font-mono bg-secondary text-foreground"
              />
              <span className="text-sm text-muted-foreground">°F</span>
            </div>
          </div>
          <div className="flex gap-2 flex-wrap">
            {[135, 145, 160, 165, 180, 195, 203].map((t) => (
              <Button
                key={t}
                variant={probeAlarmTemp === t ? "default" : "outline"}
                size="sm"
                onClick={() => setProbeAlarmTemp(t)}
                className={probeAlarmTemp === t ? "bg-primary text-primary-foreground" : ""}
              >
                {t}°
              </Button>
            ))}
          </div>
          <Button
            className="w-full"
            variant="outline"
            onClick={() => {
              commands.setProbeAlarm.mutate({ temp: probeAlarmTemp });
              toast.success(`Probe alarm set to ${probeAlarmTemp}°F`);
            }}
            disabled={commands.setProbeAlarm.isPending}
          >
            <Thermometer className="h-4 w-4 mr-2" />
            Set Probe Alarm at {probeAlarmTemp}°F
          </Button>
        </CardContent>
      </Card>

      {/* Cook Timer */}
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-foreground">
            <Timer className="h-5 w-5 text-blue-400" />
            Cook Timer
          </CardTitle>
          <CardDescription>Set a countdown timer for your cook</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <div>
                <Label className="text-xs text-muted-foreground">Hours</Label>
                <Input
                  type="number"
                  value={timerHours}
                  onChange={(e) => setTimerHours(Math.max(0, parseInt(e.target.value) || 0))}
                  className="w-20 text-center font-mono bg-secondary text-foreground"
                  min={0}
                  max={24}
                />
              </div>
              <span className="text-lg text-muted-foreground mt-5">:</span>
              <div>
                <Label className="text-xs text-muted-foreground">Minutes</Label>
                <Input
                  type="number"
                  value={timerMinutes}
                  onChange={(e) => setTimerMinutes(Math.max(0, Math.min(59, parseInt(e.target.value) || 0)))}
                  className="w-20 text-center font-mono bg-secondary text-foreground"
                  min={0}
                  max={59}
                />
              </div>
            </div>
            <div className="flex gap-2 flex-wrap flex-1">
              {[
                { label: "30m", h: 0, m: 30 },
                { label: "1h", h: 1, m: 0 },
                { label: "2h", h: 2, m: 0 },
                { label: "3h", h: 3, m: 0 },
                { label: "6h", h: 6, m: 0 },
              ].map((preset) => (
                <Button
                  key={preset.label}
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setTimerHours(preset.h);
                    setTimerMinutes(preset.m);
                  }}
                >
                  {preset.label}
                </Button>
              ))}
            </div>
          </div>
          <div className="flex gap-2">
            <Button
              className="flex-1 bg-primary text-primary-foreground"
              onClick={() => {
                if (timerSeconds < 60) {
                  toast.error("Timer must be at least 1 minute");
                  return;
                }
                commands.setTimer.mutate({ seconds: timerSeconds });
                toast.success(`Timer set for ${timerHours}h ${timerMinutes}m`);
              }}
              disabled={commands.setTimer.isPending || timerSeconds < 60}
            >
              Start Timer
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                commands.clearTimer.mutate();
                toast.info("Timer cleared");
              }}
              disabled={commands.clearTimer.isPending}
            >
              Clear
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Toggles */}
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-foreground">Features</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Wind className="h-5 w-5 text-purple-400" />
              <div>
                <div className="font-medium text-foreground">Super Smoke</div>
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
                <div className="font-medium text-foreground">Keep Warm</div>
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
                  Initiates a safe shutdown cycle with fan cool-down (10-15 min)
                </div>
              </div>
            </div>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive">
                  <Power className="h-4 w-4 mr-2" />
                  Shutdown
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent className="bg-card border-border">
                <AlertDialogHeader>
                  <AlertDialogTitle className="text-foreground">Shutdown Grill?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will initiate a safe shutdown cycle. The fan will continue running for 10-15
                    minutes to cool down the grill. This action cannot be undone remotely.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    className="bg-destructive text-destructive-foreground"
                    onClick={() => {
                      commands.shutdown.mutate();
                      toast.success("Shutdown command sent. Fan will run for 10-15 minutes.");
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
      <div className="flex items-start gap-3 p-4 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
        <AlertTriangle className="h-5 w-5 text-yellow-400 shrink-0 mt-0.5" />
        <div className="text-sm text-yellow-200/80">
          <strong className="text-yellow-300">Safety Notice:</strong> Remote ignition is not possible.
          The grill must be physically started before commands can be sent. Always ensure the grill is
          in a safe location and attended when operating remotely.
        </div>
      </div>
    </div>
  );
}
