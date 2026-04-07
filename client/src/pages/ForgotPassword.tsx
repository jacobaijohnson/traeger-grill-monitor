import { useState } from "react";
import { Link } from "wouter";
import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Flame, ArrowLeft, Mail, CheckCircle2, Terminal } from "lucide-react";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;

    setLoading(true);
    try {
      // This triggers the server-side sendResetPassword which logs the reset URL to console
      await (authClient as any).forgetPassword({
        email,
        redirectTo: "/reset-password",
      });
    } catch {
      // Always show success to prevent email enumeration
    } finally {
      setSent(true);
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="flex items-center justify-center gap-2 mb-8">
          <div className="h-10 w-10 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center">
            <Flame className="h-5 w-5 text-primary" />
          </div>
          <span className="text-lg font-bold text-foreground tracking-tight">
            Traeger Grill Monitor
          </span>
        </div>

        <Card className="bg-card border-border">
          <CardHeader className="text-center pb-4">
            <CardTitle className="text-xl font-bold">
              {sent ? "Reset Link Generated" : "Forgot Password"}
            </CardTitle>
            <CardDescription className="text-sm">
              {sent
                ? "A password reset link has been generated in the server logs."
                : "Enter your email to request a password reset."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {sent ? (
              <div className="space-y-4">
                <div className="flex items-center justify-center py-4">
                  <div className="h-16 w-16 rounded-full bg-green-500/10 border border-green-500/20 flex items-center justify-center">
                    <CheckCircle2 className="h-8 w-8 text-green-400" />
                  </div>
                </div>

                <div className="p-3 rounded-lg bg-secondary/50 border border-border space-y-2">
                  <div className="flex items-center gap-2 text-xs font-mono text-muted-foreground">
                    <Terminal className="h-3.5 w-3.5" />
                    How to get your reset link
                  </div>
                  <p className="text-xs text-muted-foreground">
                    This server does not send emails. The password reset link has been printed
                    to the <strong className="text-foreground">server console / Docker logs</strong>.
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Ask your server admin to check the logs with:
                  </p>
                  <code className="block text-xs font-mono bg-background p-2 rounded border border-border text-foreground">
                    docker logs traeger-grill-monitor
                  </code>
                  <p className="text-xs text-muted-foreground">
                    The admin will find a boxed reset URL they can share with you.
                    The link expires in 1 hour.
                  </p>
                </div>

                <Button variant="outline" className="w-full font-mono text-xs" asChild>
                  <Link to="/login">
                    <ArrowLeft className="h-3.5 w-3.5 mr-1.5" />
                    Back to Login
                  </Link>
                </Button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email" className="text-xs font-mono text-muted-foreground uppercase tracking-wider">
                    Email Address
                  </Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="email"
                      type="email"
                      placeholder="you@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="pl-10 bg-secondary font-mono"
                      required
                      autoFocus
                    />
                  </div>
                </div>

                <div className="p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/20">
                  <p className="text-xs text-amber-300/80">
                    <Terminal className="h-3 w-3 inline mr-1" />
                    This server uses console-only password reset. The reset link will appear
                    in the Docker logs for your admin to share with you.
                  </p>
                </div>

                <Button
                  type="submit"
                  className="w-full bg-primary text-primary-foreground font-mono"
                  disabled={loading || !email}
                >
                  {loading ? "Requesting..." : "Request Reset Link"}
                </Button>

                <div className="text-center">
                  <Link to="/login" className="text-xs text-muted-foreground hover:text-foreground transition-colors font-mono">
                    <ArrowLeft className="h-3 w-3 inline mr-1" />
                    Back to Login
                  </Link>
                </div>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
