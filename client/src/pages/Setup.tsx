/**
 * First-Boot Setup Wizard — shown when no admin user exists.
 * Prompts for admin credentials interactively (like Nextcloud/Gitea).
 * Once an admin is created, redirects to the login page.
 */
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Gauge, CheckCircle2, AlertCircle, Eye, EyeOff, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useLocation } from "wouter";

export default function Setup() {
  const [, navigate] = useLocation();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [done, setDone] = useState(false);

  const createAdmin = trpc.setup.createAdmin.useMutation({
    onSuccess: (data) => {
      setDone(true);
      toast.success("Admin account created! Redirecting to login...");
      setTimeout(() => navigate("/login"), 2000);
    },
    onError: (err) => {
      toast.error(err.message || "Failed to create admin account");
    },
  });

  const passwordsMatch = password === confirmPassword;
  const passwordLongEnough = password.length >= 8;
  const canSubmit = name && email && passwordLongEnough && passwordsMatch && !createAdmin.isPending;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    createAdmin.mutate({ name, email, password });
  }

  if (done) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <Card className="w-full max-w-md border-green-500/30 bg-green-500/5">
          <CardContent className="flex flex-col items-center gap-4 pt-8 pb-8">
            <CheckCircle2 className="h-16 w-16 text-green-500" />
            <h2 className="text-xl font-bold text-foreground">Setup Complete</h2>
            <p className="text-sm text-muted-foreground text-center">
              Your admin account has been created. Redirecting to login...
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-background">
      <div className="w-full max-w-lg px-4">
        {/* Header */}
        <div className="flex flex-col items-center gap-4 mb-8">
          <div className="h-16 w-16 rounded-xl bg-primary/15 border border-primary/30 flex items-center justify-center">
            <Gauge className="h-9 w-9 text-primary" />
          </div>
          <div className="text-center">
            <h1 className="text-3xl font-bold tracking-tight text-foreground font-mono">
              Welcome
            </h1>
            <p className="text-sm text-muted-foreground mt-2 max-w-sm">
              Set up your Traeger Grill Command Center by creating the first administrator account.
            </p>
          </div>
        </div>

        {/* Setup Form */}
        <Card className="bg-card border-border">
          <CardHeader className="pb-4">
            <CardTitle className="text-lg font-mono">Create Admin Account</CardTitle>
            <CardDescription>
              This account will have full control over the system. You can add more users later.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Name */}
              <div className="space-y-2">
                <Label htmlFor="name" className="text-sm font-mono text-muted-foreground">
                  Display Name
                </Label>
                <Input
                  id="name"
                  type="text"
                  placeholder="Admin"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="bg-secondary font-mono"
                  autoComplete="name"
                  required
                />
              </div>

              {/* Email */}
              <div className="space-y-2">
                <Label htmlFor="email" className="text-sm font-mono text-muted-foreground">
                  Email Address
                </Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="admin@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="bg-secondary font-mono"
                  autoComplete="email"
                  required
                />
              </div>

              {/* Password */}
              <div className="space-y-2">
                <Label htmlFor="password" className="text-sm font-mono text-muted-foreground">
                  Password
                </Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="Minimum 8 characters"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="bg-secondary font-mono pr-10"
                    autoComplete="new-password"
                    required
                    minLength={8}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {password && !passwordLongEnough && (
                  <p className="text-xs text-destructive flex items-center gap-1">
                    <AlertCircle className="h-3 w-3" />
                    Password must be at least 8 characters
                  </p>
                )}
              </div>

              {/* Confirm Password */}
              <div className="space-y-2">
                <Label htmlFor="confirm-password" className="text-sm font-mono text-muted-foreground">
                  Confirm Password
                </Label>
                <Input
                  id="confirm-password"
                  type={showPassword ? "text" : "password"}
                  placeholder="Re-enter password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="bg-secondary font-mono"
                  autoComplete="new-password"
                  required
                />
                {confirmPassword && !passwordsMatch && (
                  <p className="text-xs text-destructive flex items-center gap-1">
                    <AlertCircle className="h-3 w-3" />
                    Passwords do not match
                  </p>
                )}
              </div>

              {/* Error Display */}
              {createAdmin.error && (
                <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/30 text-destructive text-sm">
                  {createAdmin.error.message}
                </div>
              )}

              {/* Submit */}
              <Button
                type="submit"
                className="w-full font-mono"
                size="lg"
                disabled={!canSubmit}
              >
                {createAdmin.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Creating account...
                  </>
                ) : (
                  "Create Admin Account"
                )}
              </Button>
            </form>
          </CardContent>
        </Card>

        <p className="text-xs text-muted-foreground/60 text-center mt-6">
          Alternatively, set <code className="font-mono text-[10px] bg-secondary px-1 py-0.5 rounded">ADMIN_EMAIL</code> and{" "}
          <code className="font-mono text-[10px] bg-secondary px-1 py-0.5 rounded">ADMIN_PASSWORD</code> environment variables for headless setup.
        </p>
      </div>
    </div>
  );
}
