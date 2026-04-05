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
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
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
  Scale,
  Lock,
  ChevronDown,
  Terminal,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

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
  const { data: status } = useTraegerStatus();
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
  const [legalOpen, setLegalOpen] = useState(false);

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
        <h1 className="text-2xl font-bold text-foreground tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Manage your grill connection and account preferences.
        </p>
      </div>

      {/* App Account */}
      <Card className="bg-card border-border">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-foreground text-sm font-mono uppercase tracking-wider">
            <User className="h-4 w-4 text-primary" />
            App Account
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div>
              <div className="font-medium text-foreground">{user?.name || "User"}</div>
              <div className="text-sm text-muted-foreground font-mono">{user?.email || "No email"}</div>
            </div>
            <Badge variant="outline" className="text-xs font-mono">
              {user?.role || "user"}
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* Traeger Account Connection */}
      <Card className="bg-card border-border">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-foreground text-sm font-mono uppercase tracking-wider">
            {status?.connected ? (
              <Wifi className="h-4 w-4 text-green-400" />
            ) : (
              <WifiOff className="h-4 w-4 text-muted-foreground" />
            )}
            Grill Account
          </CardTitle>
          <CardDescription className="text-xs">
            Connect your Traeger WiFIRE account to control your grill remotely.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {status?.connected ? (
            <>
              <div className="flex items-center justify-between p-3 rounded-lg bg-green-500/10 border border-green-500/20">
                <div className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-green-400" />
                  <span className="text-sm text-green-300 font-mono">{status.email}</span>
                </div>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="outline" size="sm" className="text-destructive border-destructive/30 font-mono text-xs">
                      <Unlink className="h-3.5 w-3.5 mr-1.5" />
                      disconnect
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent className="bg-card border-border">
                    <AlertDialogHeader>
                      <AlertDialogTitle className="text-foreground">Disconnect Account?</AlertDialogTitle>
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
                  <Label className="text-xs text-muted-foreground font-mono uppercase tracking-wider">Your Grills</Label>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => refreshGrills.mutate()}
                    disabled={refreshGrills.isPending}
                    className="font-mono text-xs"
                  >
                    <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${refreshGrills.isPending ? "animate-spin" : ""}`} />
                    refresh
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
                        <div className="text-xs text-muted-foreground font-mono">
                          {grill.thingName}
                        </div>
                      </div>
                      {status.selectedGrillId === grill.thingName && (
                        <Badge className="bg-primary/20 text-primary border-primary/30 font-mono text-xs">
                          <Check className="h-3 w-3 mr-1" />
                          active
                        </Badge>
                      )}
                    </div>
                  ))}
                  {(!status.grills || status.grills.length === 0) && (
                    <div className="text-center py-4 text-muted-foreground text-sm font-mono">
                      No grills found on this account.
                    </div>
                  )}
                </div>
              </div>
            </>
          ) : (
            <div className="space-y-4">
              <div className="flex items-start gap-3 p-3 rounded-lg bg-primary/5 border border-primary/15">
                <Shield className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                <div className="text-xs text-muted-foreground">
                  Your credentials are sent directly to Traeger's authentication servers.
                  They are stored server-side, tied to your user account, and never shared.
                  Each user's data is completely isolated.
                </div>
              </div>

              {connectError && (
                <div className="flex items-start gap-3 p-3 rounded-lg bg-red-500/10 border border-red-500/20">
                  <AlertTriangle className="h-4 w-4 text-red-400 shrink-0 mt-0.5" />
                  <div className="text-sm text-red-300">{connectError}</div>
                </div>
              )}

              <div className="space-y-3">
                <div>
                  <Label className="text-xs text-muted-foreground font-mono">Traeger Email</Label>
                  <Input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="your@email.com"
                    className="bg-secondary text-foreground font-mono"
                  />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground font-mono">Traeger Password</Label>
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
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
                <Button
                  className="w-full bg-primary text-primary-foreground font-mono text-xs"
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
                      Connect Account
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Security & Privacy */}
      <Card className="bg-card border-border">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-foreground text-sm font-mono uppercase tracking-wider">
            <Lock className="h-4 w-4 text-primary" />
            Security & Privacy
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <div className="grid gap-3">
            <div className="flex items-start gap-3">
              <Shield className="h-4 w-4 text-green-400 shrink-0 mt-0.5" />
              <div>
                <div className="font-medium text-foreground text-xs">Credential Isolation</div>
                <div className="text-xs mt-0.5">
                  Each user's Traeger credentials and session tokens are stored separately in the database,
                  tied to their unique user ID. No user can access another user's data.
                </div>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Lock className="h-4 w-4 text-blue-400 shrink-0 mt-0.5" />
              <div>
                <div className="font-medium text-foreground text-xs">Server-Side Only</div>
                <div className="text-xs mt-0.5">
                  Traeger credentials and API tokens are never sent to the browser. All communication
                  with Traeger's API happens server-side through a secure proxy.
                </div>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Terminal className="h-4 w-4 text-purple-400 shrink-0 mt-0.5" />
              <div>
                <div className="font-medium text-foreground text-xs">Standard Authentication</div>
                <div className="text-xs mt-0.5">
                  This app uses the same AWS Cognito authentication flow as the official Traeger app.
                  No security measures are bypassed or circumvented.
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Legal Disclaimer */}
      <Card className="bg-card border-border">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-foreground text-sm font-mono uppercase tracking-wider">
            <Scale className="h-4 w-4 text-muted-foreground" />
            Legal Notice
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-xs text-muted-foreground">
          <div className="p-3 rounded-lg bg-secondary/50 border border-border space-y-2">
            <p>
              <strong className="text-foreground">PitDeck</strong> is an independent, community-built
              dashboard for monitoring and controlling WiFIRE-enabled pellet grills. It is{" "}
              <strong className="text-foreground">not affiliated with, endorsed by, or sponsored by
              Traeger Grills LLC</strong> or any of its subsidiaries.
            </p>
            <p>
              "Traeger," "WiFIRE," and "Super Smoke" are trademarks of Traeger Pellet Grills LLC.
              All trademarks are property of their respective owners and are used here solely for
              identification and interoperability purposes.
            </p>
          </div>

          <Collapsible open={legalOpen} onOpenChange={setLegalOpen}>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="sm" className="w-full justify-between font-mono text-xs text-muted-foreground">
                Full Legal Disclaimer
                <ChevronDown className={`h-3.5 w-3.5 transition-transform ${legalOpen ? "rotate-180" : ""}`} />
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="space-y-3 pt-2">
              <div className="space-y-3 text-xs text-muted-foreground leading-relaxed">
                <div>
                  <h4 className="font-medium text-foreground mb-1">Interoperability & Fair Use</h4>
                  <p>
                    This software exercises the user's right to interoperate with hardware they own.
                    It authenticates using the same standard AWS Cognito flow as the official mobile
                    application — no security measures are bypassed, circumvented, or reverse-engineered.
                    Users authenticate with their own legitimate credentials to access their own grill data.
                  </p>
                </div>

                <div>
                  <h4 className="font-medium text-foreground mb-1">Legal Basis</h4>
                  <p>
                    This project operates under established legal precedents including: the DMCA
                    interoperability exemption (17 U.S.C. § 1201(f)), which permits reverse engineering
                    for interoperability; Google LLC v. Oracle America, Inc. (2021), where the Supreme
                    Court ruled that reimplementing APIs constitutes fair use; and Van Buren v. United
                    States (2021), which narrowed the Computer Fraud and Abuse Act to exclude authorized
                    users accessing systems for non-intended purposes.
                  </p>
                </div>

                <div>
                  <h4 className="font-medium text-foreground mb-1">No Warranty</h4>
                  <p>
                    This software is provided "as is" without warranty of any kind, express or implied.
                    The developers are not responsible for any damage to your grill, food, property, or
                    person resulting from the use of this software. Pellet grills involve fire and high
                    temperatures — always follow manufacturer safety guidelines and never leave a grill
                    unattended.
                  </p>
                </div>

                <div>
                  <h4 className="font-medium text-foreground mb-1">API Dependency</h4>
                  <p>
                    This application depends on Traeger's cloud API, which may change without notice.
                    Traeger may modify, restrict, or discontinue API access at any time. The developers
                    of PitDeck have no control over Traeger's API availability or behavior.
                  </p>
                </div>

                <div>
                  <h4 className="font-medium text-foreground mb-1">Data Handling</h4>
                  <p>
                    Your Traeger credentials are transmitted directly to Traeger's authentication servers
                    (AWS Cognito) and stored server-side in an isolated database record tied to your user
                    account. Session tokens are refreshed automatically and never exposed to the browser.
                    No telemetry, usage data, or personal information is shared with third parties.
                    You may disconnect and delete your stored credentials at any time.
                  </p>
                </div>

                <div>
                  <h4 className="font-medium text-foreground mb-1">Open Source Heritage</h4>
                  <p>
                    This project builds on the work of the open-source community, including the Home
                    Assistant Traeger integration, go-traeger, and other community efforts to provide
                    users with better control over hardware they own. It is part of a broader movement
                    supporting the right to repair and the right to interoperate.
                  </p>
                </div>
              </div>
            </CollapsibleContent>
          </Collapsible>
        </CardContent>
      </Card>

      {/* About */}
      <Card className="bg-card border-border">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-foreground text-sm font-mono uppercase tracking-wider">
            <Info className="h-4 w-4 text-muted-foreground" />
            About PitDeck
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-xs text-muted-foreground">
          <p>
            PitDeck is an independent, open-source-inspired dashboard that gives you direct control
            over your WiFIRE-enabled grill. Built by pitmasters, for pitmasters — because you should
            be able to control the hardware you own.
          </p>
          <Separator />
          <div className="grid grid-cols-2 gap-3">
            <div>
              <span className="text-muted-foreground/60 font-mono text-xs">API</span>
              <div className="text-foreground font-mono text-xs">iot.traegergrills.io</div>
            </div>
            <div>
              <span className="text-muted-foreground/60 font-mono text-xs">Protocol</span>
              <div className="text-foreground font-mono text-xs">MQTT over WSS</div>
            </div>
            <div>
              <span className="text-muted-foreground/60 font-mono text-xs">Auth</span>
              <div className="text-foreground font-mono text-xs">AWS Cognito</div>
            </div>
            <div>
              <span className="text-muted-foreground/60 font-mono text-xs">Region</span>
              <div className="text-foreground font-mono text-xs">us-west-2</div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
