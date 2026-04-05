import { useAuth } from "@/_core/hooks/useAuth";
import { useTraegerStatus, useTraegerConnect, useTraegerDisconnect } from "@/hooks/useTraeger";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
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
  User,
  Wifi,
  WifiOff,
  Link2,
  Unlink,
  RefreshCw,
  Check,
  Shield,
  Info,
  Eye,
  EyeOff,
  AlertTriangle,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

/**
 * Convert raw API/Cognito error messages into plain-English explanations.
 */
function friendlyError(raw: string): string {
  const lower = raw.toLowerCase();

  if (lower.includes("incorrect username or password") || lower.includes("notauthorizedexception")) {
    return "Incorrect email or password. Please double-check your Traeger account credentials and try again.";
  }
  if (lower.includes("user does not exist") || lower.includes("usernotfoundexception")) {
    return "No Traeger account found with that email address. Make sure you're using the same email you registered with in the Traeger app.";
  }
  if (lower.includes("password attempts exceeded") || lower.includes("too many")) {
    return "Too many login attempts. Your account has been temporarily locked. Please wait a few minutes and try again.";
  }
  if (lower.includes("user is not confirmed") || lower.includes("usernotconfirmedexception")) {
    return "Your Traeger account hasn't been verified yet. Please check your email for a verification link from Traeger.";
  }
  if (lower.includes("network") || lower.includes("econnrefused") || lower.includes("timeout") || lower.includes("enotfound")) {
    return "Unable to reach Traeger's servers. Please check your internet connection and try again.";
  }
  if (lower.includes("password reset") || lower.includes("passwordresetrequiredexception")) {
    return "Traeger requires you to reset your password. Please use the Traeger app or website to reset it, then try again here.";
  }
  if (lower.includes("invalid parameter") || lower.includes("invalidparameterexception")) {
    return "Something was wrong with the login request. Please make sure your email is valid and your password isn't empty.";
  }
  if (lower.includes("request failed with status code 400")) {
    return "Login request was rejected by Traeger's servers. This usually means incorrect credentials. Please verify your email and password.";
  }
  if (lower.includes("request failed with status code 422")) {
    return "Traeger's servers couldn't process the login request. Please try again in a moment.";
  }
  if (lower.includes("request failed with status code 5") || lower.includes("internal server error")) {
    return "Traeger's servers are experiencing issues. This is on their end — please try again in a few minutes.";
  }
  if (lower.includes("request failed with status code 403")) {
    return "Access denied by Traeger's servers. Your account may be restricted. Try logging in through the official Traeger app first.";
  }
  if (lower.includes("request failed with status code 429")) {
    return "Too many requests. Traeger's servers are rate-limiting us. Please wait a minute and try again.";
  }

  // Fallback: strip technical prefixes and clean up
  const cleaned = raw
    .replace(/^Traeger login failed:\s*/i, "")
    .replace(/^Authentication failed\.\n?/i, "")
    .replace(/Traeger proxy:.*?\n/g, "")
    .replace(/Cognito direct:.*?\n/g, "")
    .trim();

  return cleaned || "An unexpected error occurred. Please try again.";
}

export default function Settings() {
  const { user } = useAuth();
  const { data: status, isLoading } = useTraegerStatus();
  const connectMutation = useTraegerConnect();
  const disconnectMutation = useTraegerDisconnect();
  const selectGrill = trpc.traeger.selectGrill.useMutation({
    onSuccess: () => {
      trpc.useUtils().traeger.status.invalidate();
      toast.success("Grill selected");
    },
  });
  const refreshGrills = trpc.traeger.refreshGrills.useMutation({
    onSuccess: () => {
      trpc.useUtils().traeger.status.invalidate();
      toast.success("Grill list refreshed");
    },
  });

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [connectError, setConnectError] = useState<string | null>(null);

  const handleConnect = () => {
    if (!email || !password) {
      toast.error("Please enter your Traeger email and password");
      return;
    }
    setConnectError(null);
    connectMutation.mutate(
      { email, password },
      {
        onSuccess: (data) => {
          toast.success(`Connected! Found ${data.grills.length} grill(s)`);
          setEmail("");
          setPassword("");
          setConnectError(null);
        },
        onError: (err) => {
          const friendly = friendlyError(err.message || "Unknown error");
          setConnectError(friendly);
          toast.error(friendly);
        },
      }
    );
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Settings</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Manage your Traeger account connection and grill settings.
        </p>
      </div>

      {/* App Account */}
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-foreground text-base">
            <User className="h-5 w-5 text-primary" />
            App Account
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div>
              <div className="font-medium text-foreground">{user?.name || "User"}</div>
              <div className="text-sm text-muted-foreground">{user?.email || "No email"}</div>
            </div>
            <Badge variant="outline" className="text-xs">
              {user?.role || "user"}
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* Traeger Account Connection */}
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-foreground text-base">
            {status?.connected ? (
              <Wifi className="h-5 w-5 text-green-400" />
            ) : (
              <WifiOff className="h-5 w-5 text-muted-foreground" />
            )}
            Traeger Account
          </CardTitle>
          <CardDescription>
            Connect your Traeger WiFIRE account to control your grill remotely.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {status?.connected ? (
            <>
              <div className="flex items-center justify-between p-3 rounded-lg bg-green-500/10 border border-green-500/20">
                <div className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-green-400" />
                  <span className="text-sm text-green-300">Connected as {status.email}</span>
                </div>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="outline" size="sm" className="text-destructive border-destructive/30">
                      <Unlink className="h-4 w-4 mr-1" />
                      Disconnect
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent className="bg-card border-border">
                    <AlertDialogHeader>
                      <AlertDialogTitle className="text-foreground">Disconnect Traeger Account?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This will remove your Traeger credentials and disconnect from all grills.
                        You can reconnect at any time.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        className="bg-destructive text-destructive-foreground"
                        onClick={() => disconnectMutation.mutate()}
                      >
                        Disconnect
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>

              {/* Grill Selection */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <Label className="text-muted-foreground">Your Grills</Label>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => refreshGrills.mutate()}
                    disabled={refreshGrills.isPending}
                  >
                    <RefreshCw className={`h-4 w-4 mr-1 ${refreshGrills.isPending ? "animate-spin" : ""}`} />
                    Refresh
                  </Button>
                </div>
                <div className="space-y-2">
                  {status.grills?.map((grill: { thingName: string; friendlyName: string; deviceTypeId: string; status: string }) => (
                    <div
                      key={grill.thingName}
                      className={`flex items-center justify-between p-3 rounded-lg border transition-colors cursor-pointer ${
                        status.selectedGrillId === grill.thingName
                          ? "border-primary bg-primary/10"
                          : "border-border hover:border-primary/30"
                      }`}
                      onClick={() => selectGrill.mutate({ grillId: grill.thingName })}
                    >
                      <div>
                        <div className="font-medium text-foreground text-sm">
                          {grill.friendlyName || grill.thingName}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {grill.thingName}
                          {grill.deviceTypeId && ` · ${grill.deviceTypeId}`}
                        </div>
                      </div>
                      {status.selectedGrillId === grill.thingName && (
                        <Badge className="bg-primary/20 text-primary border-primary/30">
                          <Check className="h-3 w-3 mr-1" />
                          Active
                        </Badge>
                      )}
                    </div>
                  ))}
                  {(!status.grills || status.grills.length === 0) && (
                    <div className="text-center py-4 text-muted-foreground text-sm">
                      No grills found on this account.
                    </div>
                  )}
                </div>
              </div>
            </>
          ) : (
            <div className="space-y-4">
              <div className="flex items-start gap-3 p-3 rounded-lg bg-blue-500/10 border border-blue-500/20">
                <Shield className="h-4 w-4 text-blue-400 shrink-0 mt-0.5" />
                <div className="text-xs text-blue-200/80">
                  Your Traeger credentials are used to authenticate with Traeger's cloud API.
                  They are stored encrypted and only used to maintain your session. We never share
                  your credentials with third parties.
                </div>
              </div>

              {/* Error display */}
              {connectError && (
                <div className="flex items-start gap-3 p-3 rounded-lg bg-red-500/10 border border-red-500/20">
                  <AlertTriangle className="h-4 w-4 text-red-400 shrink-0 mt-0.5" />
                  <div className="text-sm text-red-300">{connectError}</div>
                </div>
              )}

              <div className="space-y-3">
                <div>
                  <Label className="text-muted-foreground">Traeger Email</Label>
                  <Input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="your@email.com"
                    className="bg-secondary text-foreground"
                  />
                </div>
                <div>
                  <Label className="text-muted-foreground">Traeger Password</Label>
                  <div className="relative">
                    <Input
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Your Traeger account password"
                      className="bg-secondary text-foreground pr-10"
                      onKeyDown={(e) => e.key === "Enter" && handleConnect()}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                      tabIndex={-1}
                      aria-label={showPassword ? "Hide password" : "Show password"}
                    >
                      {showPassword ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                </div>
                <Button
                  className="w-full bg-primary text-primary-foreground"
                  onClick={handleConnect}
                  disabled={connectMutation.isPending}
                >
                  {connectMutation.isPending ? (
                    <>
                      <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                      Connecting...
                    </>
                  ) : (
                    <>
                      <Link2 className="h-4 w-4 mr-2" />
                      Connect Traeger Account
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Info */}
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-foreground text-base">
            <Info className="h-5 w-5 text-muted-foreground" />
            About
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <p>
            Traeger Grill Command Center is an independent dashboard for monitoring and controlling
            Traeger WiFIRE-enabled grills. It is not affiliated with or endorsed by Traeger Grills LLC.
          </p>
          <Separator />
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div>
              <span className="text-muted-foreground">API Endpoint</span>
              <div className="text-foreground font-mono">iot.traegergrills.io</div>
            </div>
            <div>
              <span className="text-muted-foreground">Protocol</span>
              <div className="text-foreground font-mono">MQTT over WSS</div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
