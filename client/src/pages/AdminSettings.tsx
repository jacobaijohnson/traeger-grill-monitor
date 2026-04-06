import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
  Users,
  Shield,
  ShieldCheck,
  ShieldAlert,
  UserX,
  UserCheck,
  Trash2,
  Copy,
  Plus,
  Mail,
  Clock,
  Key,
  Lock,
  Unlock,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  RefreshCw,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Redirect } from "wouter";

// ─── Users Tab ────────────────────────────────────────

function UsersTab() {
  const { user: currentUser } = useAuth();
  const utils = trpc.useUtils();
  const { data: users, isLoading } = trpc.admin.listUsers.useQuery();
  const { data: pending } = trpc.admin.listPending.useQuery();

  const updateRole = trpc.admin.updateRole.useMutation({
    onSuccess: () => { utils.admin.listUsers.invalidate(); toast.success("Role updated"); },
    onError: (e) => toast.error(e.message),
  });
  const ban = trpc.admin.banUser.useMutation({
    onSuccess: () => { utils.admin.listUsers.invalidate(); toast.success("User banned"); },
    onError: (e) => toast.error(e.message),
  });
  const unban = trpc.admin.unbanUser.useMutation({
    onSuccess: () => { utils.admin.listUsers.invalidate(); toast.success("User unbanned"); },
    onError: (e) => toast.error(e.message),
  });
  const deleteUserMut = trpc.admin.deleteUser.useMutation({
    onSuccess: () => { utils.admin.listUsers.invalidate(); toast.success("User deleted"); },
    onError: (e) => toast.error(e.message),
  });
  const approve = trpc.admin.approveUser.useMutation({
    onSuccess: () => {
      utils.admin.listUsers.invalidate();
      utils.admin.listPending.invalidate();
      toast.success("User approved");
    },
    onError: (e) => toast.error(e.message),
  });

  const roleBadge = (role: string) => {
    switch (role) {
      case "admin":
        return <Badge className="bg-red-500/15 text-red-400 border-red-500/30 font-mono text-[10px]"><ShieldAlert className="h-3 w-3 mr-1" />admin</Badge>;
      case "trusted":
        return <Badge className="bg-blue-500/15 text-blue-400 border-blue-500/30 font-mono text-[10px]"><ShieldCheck className="h-3 w-3 mr-1" />trusted</Badge>;
      default:
        return <Badge variant="outline" className="font-mono text-[10px]"><Shield className="h-3 w-3 mr-1" />user</Badge>;
    }
  };

  if (isLoading) {
    return <div className="flex items-center justify-center py-12"><RefreshCw className="h-5 w-5 animate-spin text-muted-foreground" /></div>;
  }

  const userList = (users as any[]) || [];
  const pendingList = (pending as any[]) || [];

  return (
    <div className="space-y-6">
      {/* Pending Approvals */}
      {pendingList.length > 0 && (
        <Card className="bg-amber-500/5 border-amber-500/20">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-sm font-mono uppercase tracking-wider text-amber-400">
              <AlertTriangle className="h-4 w-4" />
              Pending Approvals ({pendingList.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {pendingList.map((u: any) => (
                <div key={u.id} className="flex items-center justify-between p-3 rounded-lg bg-card border border-border">
                  <div>
                    <div className="font-medium text-foreground text-sm">{u.name || "Unnamed"}</div>
                    <div className="text-xs text-muted-foreground font-mono">{u.email}</div>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" className="text-green-400 border-green-500/30 font-mono text-xs"
                      onClick={() => approve.mutate({ userId: u.id })}
                      disabled={approve.isPending}
                    >
                      <UserCheck className="h-3.5 w-3.5 mr-1" />approve
                    </Button>
                    <Button size="sm" variant="outline" className="text-destructive border-destructive/30 font-mono text-xs"
                      onClick={() => deleteUserMut.mutate({ userId: u.id })}
                      disabled={deleteUserMut.isPending}
                    >
                      <Trash2 className="h-3.5 w-3.5 mr-1" />reject
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* All Users */}
      <Card className="bg-card border-border">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-sm font-mono uppercase tracking-wider">
            <Users className="h-4 w-4 text-primary" />
            All Users ({userList.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg border border-border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-secondary/30">
                  <TableHead className="font-mono text-xs">User</TableHead>
                  <TableHead className="font-mono text-xs">Role</TableHead>
                  <TableHead className="font-mono text-xs">Status</TableHead>
                  <TableHead className="font-mono text-xs">Joined</TableHead>
                  <TableHead className="font-mono text-xs text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {userList.map((u: any) => {
                  const isSelf = u.id === currentUser?.id;
                  const isBanned = u.banned === 1 || u.banned === true;
                  return (
                    <TableRow key={u.id} className={isBanned ? "opacity-60" : ""}>
                      <TableCell>
                        <div>
                          <div className="font-medium text-foreground text-sm">
                            {u.name || "Unnamed"}
                            {isSelf && <span className="text-xs text-muted-foreground ml-1">(you)</span>}
                          </div>
                          <div className="text-xs text-muted-foreground font-mono">{u.email}</div>
                        </div>
                      </TableCell>
                      <TableCell>
                        {isSelf ? (
                          roleBadge(u.role || "user")
                        ) : (
                          <Select
                            value={u.role || "user"}
                            onValueChange={(val) => updateRole.mutate({ userId: u.id, role: val as any })}
                          >
                            <SelectTrigger className="w-[120px] h-7 text-xs font-mono">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="admin">admin</SelectItem>
                              <SelectItem value="trusted">trusted</SelectItem>
                              <SelectItem value="user">user</SelectItem>
                            </SelectContent>
                          </Select>
                        )}
                      </TableCell>
                      <TableCell>
                        {isBanned ? (
                          <Badge variant="destructive" className="font-mono text-[10px]">
                            <XCircle className="h-3 w-3 mr-1" />banned
                          </Badge>
                        ) : (
                          <Badge className="bg-green-500/15 text-green-400 border-green-500/30 font-mono text-[10px]">
                            <CheckCircle2 className="h-3 w-3 mr-1" />active
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground font-mono">
                        {u.createdAt ? new Date(u.createdAt).toLocaleDateString() : "—"}
                      </TableCell>
                      <TableCell className="text-right">
                        {!isSelf && (
                          <div className="flex gap-1 justify-end">
                            {isBanned ? (
                              <Button size="sm" variant="ghost" className="h-7 px-2 text-xs font-mono text-green-400"
                                onClick={() => unban.mutate({ userId: u.id })}
                                disabled={unban.isPending}
                                title="Unban user"
                              >
                                <Unlock className="h-3.5 w-3.5" />
                              </Button>
                            ) : (
                              <Button size="sm" variant="ghost" className="h-7 px-2 text-xs font-mono text-amber-400"
                                onClick={() => ban.mutate({ userId: u.id, reason: "Banned by admin" })}
                                disabled={ban.isPending}
                                title="Ban user"
                              >
                                <Lock className="h-3.5 w-3.5" />
                              </Button>
                            )}
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button size="sm" variant="ghost" className="h-7 px-2 text-xs font-mono text-destructive" title="Delete user">
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent className="bg-card border-border">
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Delete User?</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    This will permanently delete <strong>{u.name || u.email}</strong> and all their sessions. This cannot be undone.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction
                                    className="bg-destructive text-destructive-foreground"
                                    onClick={() => deleteUserMut.mutate({ userId: u.id })}
                                  >
                                    Delete
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
                {userList.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8 text-muted-foreground text-sm">
                      No users found.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Registration Tab ─────────────────────────────────

function RegistrationTab() {
  const utils = trpc.useUtils();
  const { data: config, isLoading } = trpc.admin.getRegistrationConfig.useQuery();

  const setConfig = trpc.admin.setRegistrationConfig.useMutation({
    onSuccess: () => { utils.admin.getRegistrationConfig.invalidate(); toast.success("Registration config updated"); },
    onError: (e) => toast.error(e.message),
  });
  const setExpiry = trpc.admin.setInviteExpiryHours.useMutation({
    onSuccess: () => { utils.admin.getRegistrationConfig.invalidate(); toast.success("Invite expiry updated"); },
    onError: (e) => toast.error(e.message),
  });

  const [expiryInput, setExpiryInput] = useState("");

  if (isLoading || !config) {
    return <div className="flex items-center justify-center py-12"><RefreshCw className="h-5 w-5 animate-spin text-muted-foreground" /></div>;
  }

  const handleModeChange = (mode: string) => {
    setConfig.mutate({
      mode: mode as "closed" | "gated",
      gates: mode === "closed" ? [] : config.gates,
    });
  };

  const handleGateToggle = (gate: string, checked: boolean) => {
    const newGates = checked
      ? [...config.gates, gate]
      : config.gates.filter((g: string) => g !== gate);
    setConfig.mutate({ mode: "gated", gates: newGates as any });
  };

  return (
    <div className="space-y-6">
      <Card className="bg-card border-border">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-sm font-mono uppercase tracking-wider">
            <Key className="h-4 w-4 text-primary" />
            Registration Mode
          </CardTitle>
          <CardDescription className="text-xs">
            Control how new users can register on this server.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Select value={config.mode} onValueChange={handleModeChange}>
            <SelectTrigger className="w-full font-mono text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="closed">Closed — No new registrations</SelectItem>
              <SelectItem value="gated">Gated — Registration with requirements</SelectItem>
            </SelectContent>
          </Select>

          {config.mode === "closed" && (
            <div className="flex items-start gap-3 p-3 rounded-lg bg-amber-500/5 border border-amber-500/20">
              <Lock className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
              <div className="text-xs text-muted-foreground">
                Registration is completely disabled. Only existing users and the admin can access the system.
              </div>
            </div>
          )}

          {config.mode === "gated" && (
            <div className="space-y-3">
              <Label className="text-xs text-muted-foreground font-mono uppercase tracking-wider">
                Active Gates (OR logic — user must pass at least one)
              </Label>
              <div className="space-y-2">
                <label className="flex items-center gap-3 p-3 rounded-lg border border-border hover:bg-secondary/30 transition-colors cursor-pointer">
                  <Checkbox
                    checked={config.gates.includes("invite")}
                    onCheckedChange={(checked) => handleGateToggle("invite", !!checked)}
                  />
                  <div>
                    <div className="text-sm font-medium text-foreground">Invite Code</div>
                    <div className="text-xs text-muted-foreground">Users must enter a valid invite code to register.</div>
                  </div>
                </label>
                <label className="flex items-center gap-3 p-3 rounded-lg border border-border hover:bg-secondary/30 transition-colors cursor-pointer">
                  <Checkbox
                    checked={config.gates.includes("allowlist")}
                    onCheckedChange={(checked) => handleGateToggle("allowlist", !!checked)}
                  />
                  <div>
                    <div className="text-sm font-medium text-foreground">Email Allowlist</div>
                    <div className="text-xs text-muted-foreground">Only pre-approved email addresses can register.</div>
                  </div>
                </label>
                <label className="flex items-center gap-3 p-3 rounded-lg border border-border hover:bg-secondary/30 transition-colors cursor-pointer">
                  <Checkbox
                    checked={config.gates.includes("approval")}
                    onCheckedChange={(checked) => handleGateToggle("approval", !!checked)}
                  />
                  <div>
                    <div className="text-sm font-medium text-foreground">Manual Approval</div>
                    <div className="text-xs text-muted-foreground">New registrations are held for admin approval before access is granted.</div>
                  </div>
                </label>
              </div>

              {config.gates.length === 0 && (
                <div className="flex items-start gap-3 p-3 rounded-lg bg-amber-500/5 border border-amber-500/20">
                  <AlertTriangle className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
                  <div className="text-xs text-muted-foreground">
                    No gates selected. Registration is effectively open to anyone. Select at least one gate to restrict access.
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Invite Expiry */}
      <Card className="bg-card border-border">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-sm font-mono uppercase tracking-wider">
            <Clock className="h-4 w-4 text-primary" />
            Invite Code Expiry
          </CardTitle>
          <CardDescription className="text-xs">
            Default expiry time for newly created invite codes.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-3 items-end">
            <div className="flex-1">
              <Label className="text-xs text-muted-foreground font-mono">Hours (current: {config.inviteExpiryHours}h)</Label>
              <Input
                type="number"
                min={1}
                max={8760}
                placeholder={String(config.inviteExpiryHours)}
                value={expiryInput}
                onChange={(e) => setExpiryInput(e.target.value)}
                className="bg-secondary font-mono"
              />
            </div>
            <Button
              variant="outline"
              className="font-mono text-xs"
              disabled={!expiryInput || setExpiry.isPending}
              onClick={() => {
                const hours = parseInt(expiryInput, 10);
                if (hours >= 1 && hours <= 8760) {
                  setExpiry.mutate({ hours });
                  setExpiryInput("");
                } else {
                  toast.error("Enter a value between 1 and 8760 hours");
                }
              }}
            >
              Update
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Invites Tab ──────────────────────────────────────

function InvitesTab() {
  const utils = trpc.useUtils();
  const { data: invites, isLoading } = trpc.admin.listInvites.useQuery();

  const createInvite = trpc.admin.createInvite.useMutation({
    onSuccess: (data) => {
      utils.admin.listInvites.invalidate();
      navigator.clipboard.writeText(data.code).then(() => {
        toast.success(`Invite code created and copied: ${data.code}`);
      }).catch(() => {
        toast.success(`Invite code created: ${data.code}`);
      });
    },
    onError: (e) => toast.error(e.message),
  });

  const deleteInvite = trpc.admin.deleteInvite.useMutation({
    onSuccess: () => { utils.admin.listInvites.invalidate(); toast.success("Invite deleted"); },
    onError: (e) => toast.error(e.message),
  });

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code).then(() => {
      toast.success("Copied to clipboard");
    }).catch(() => {
      toast.error("Failed to copy");
    });
  };

  if (isLoading) {
    return <div className="flex items-center justify-center py-12"><RefreshCw className="h-5 w-5 animate-spin text-muted-foreground" /></div>;
  }

  const inviteList = (invites as any[]) || [];

  return (
    <div className="space-y-6">
      <Card className="bg-card border-border">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-sm font-mono uppercase tracking-wider">
              <Key className="h-4 w-4 text-primary" />
              Invite Codes ({inviteList.length})
            </CardTitle>
            <Button
              size="sm"
              className="font-mono text-xs bg-primary text-primary-foreground"
              onClick={() => createInvite.mutate()}
              disabled={createInvite.isPending}
            >
              <Plus className="h-3.5 w-3.5 mr-1" />
              Generate Code
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {inviteList.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground text-sm font-mono">
              No invite codes yet. Click "Generate Code" to create one.
            </div>
          ) : (
            <div className="rounded-lg border border-border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-secondary/30">
                    <TableHead className="font-mono text-xs">Code</TableHead>
                    <TableHead className="font-mono text-xs">Created By</TableHead>
                    <TableHead className="font-mono text-xs">Status</TableHead>
                    <TableHead className="font-mono text-xs">Expires</TableHead>
                    <TableHead className="font-mono text-xs text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {inviteList.map((inv: any) => {
                    const isUsed = !!inv.usedAt;
                    const isExpired = !isUsed && new Date(inv.expiresAt) < new Date();
                    const isActive = !isUsed && !isExpired;
                    return (
                      <TableRow key={inv.id} className={!isActive ? "opacity-60" : ""}>
                        <TableCell>
                          <code className="text-sm font-mono text-foreground bg-secondary/50 px-2 py-0.5 rounded">
                            {inv.code}
                          </code>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {inv.createdByName || "System"}
                        </TableCell>
                        <TableCell>
                          {isUsed ? (
                            <Badge className="bg-blue-500/15 text-blue-400 border-blue-500/30 font-mono text-[10px]">
                              <CheckCircle2 className="h-3 w-3 mr-1" />used by {inv.usedByEmail || "unknown"}
                            </Badge>
                          ) : isExpired ? (
                            <Badge variant="destructive" className="font-mono text-[10px]">
                              <XCircle className="h-3 w-3 mr-1" />expired
                            </Badge>
                          ) : (
                            <Badge className="bg-green-500/15 text-green-400 border-green-500/30 font-mono text-[10px]">
                              <CheckCircle2 className="h-3 w-3 mr-1" />active
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground font-mono">
                          {new Date(inv.expiresAt).toLocaleString()}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex gap-1 justify-end">
                            {isActive && (
                              <Button size="sm" variant="ghost" className="h-7 px-2 text-xs"
                                onClick={() => copyCode(inv.code)} title="Copy code"
                              >
                                <Copy className="h-3.5 w-3.5" />
                              </Button>
                            )}
                            <Button size="sm" variant="ghost" className="h-7 px-2 text-xs text-destructive"
                              onClick={() => deleteInvite.mutate({ id: inv.id })}
                              disabled={deleteInvite.isPending}
                              title="Delete invite"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Allowlist Tab ────────────────────────────────────

function AllowlistTab() {
  const utils = trpc.useUtils();
  const { data: allowlist, isLoading } = trpc.admin.listAllowlist.useQuery();
  const [newEmail, setNewEmail] = useState("");
  const [newNote, setNewNote] = useState("");

  const addEmail = trpc.admin.addToAllowlist.useMutation({
    onSuccess: () => {
      utils.admin.listAllowlist.invalidate();
      setNewEmail("");
      setNewNote("");
      toast.success("Email added to allowlist");
    },
    onError: (e) => toast.error(e.message),
  });

  const removeEmail = trpc.admin.removeFromAllowlist.useMutation({
    onSuccess: () => { utils.admin.listAllowlist.invalidate(); toast.success("Email removed from allowlist"); },
    onError: (e) => toast.error(e.message),
  });

  if (isLoading) {
    return <div className="flex items-center justify-center py-12"><RefreshCw className="h-5 w-5 animate-spin text-muted-foreground" /></div>;
  }

  const list = (allowlist as any[]) || [];

  return (
    <div className="space-y-6">
      <Card className="bg-card border-border">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-sm font-mono uppercase tracking-wider">
            <Mail className="h-4 w-4 text-primary" />
            Email Allowlist ({list.length})
          </CardTitle>
          <CardDescription className="text-xs">
            Pre-approved email addresses that can register without an invite code.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Add Email Form */}
          <div className="flex gap-3 items-end">
            <div className="flex-1">
              <Label className="text-xs text-muted-foreground font-mono">Email Address</Label>
              <Input
                type="email"
                placeholder="user@example.com"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                className="bg-secondary font-mono"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && newEmail) {
                    addEmail.mutate({ email: newEmail, note: newNote || undefined });
                  }
                }}
              />
            </div>
            <div className="w-40">
              <Label className="text-xs text-muted-foreground font-mono">Note (optional)</Label>
              <Input
                placeholder="Reason"
                value={newNote}
                onChange={(e) => setNewNote(e.target.value)}
                className="bg-secondary font-mono"
              />
            </div>
            <Button
              className="font-mono text-xs bg-primary text-primary-foreground"
              disabled={!newEmail || addEmail.isPending}
              onClick={() => addEmail.mutate({ email: newEmail, note: newNote || undefined })}
            >
              <Plus className="h-3.5 w-3.5 mr-1" />
              Add
            </Button>
          </div>

          <Separator />

          {/* Allowlist Table */}
          {list.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground text-sm font-mono">
              No emails in the allowlist yet.
            </div>
          ) : (
            <div className="rounded-lg border border-border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-secondary/30">
                    <TableHead className="font-mono text-xs">Email</TableHead>
                    <TableHead className="font-mono text-xs">Note</TableHead>
                    <TableHead className="font-mono text-xs">Added</TableHead>
                    <TableHead className="font-mono text-xs text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {list.map((entry: any) => (
                    <TableRow key={entry.id}>
                      <TableCell className="font-mono text-sm">{entry.email}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{entry.note || "—"}</TableCell>
                      <TableCell className="text-xs text-muted-foreground font-mono">
                        {entry.createdAt ? new Date(entry.createdAt).toLocaleDateString() : "—"}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button size="sm" variant="ghost" className="h-7 px-2 text-xs text-destructive"
                          onClick={() => removeEmail.mutate({ id: entry.id })}
                          disabled={removeEmail.isPending}
                          title="Remove from allowlist"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Main Admin Settings Page ─────────────────────────

export default function AdminSettings() {
  const { user } = useAuth();

  // Redirect non-admins
  if (user && user.role !== "admin") {
    return <Redirect to="/settings" />;
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground tracking-tight">Admin Settings</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Manage users, registration, and access control for this server.
        </p>
      </div>

      <Tabs defaultValue="users" className="w-full">
        <TabsList className="w-full justify-start bg-secondary/30 border border-border">
          <TabsTrigger value="users" className="font-mono text-xs">
            <Users className="h-3.5 w-3.5 mr-1.5" />Users
          </TabsTrigger>
          <TabsTrigger value="registration" className="font-mono text-xs">
            <Key className="h-3.5 w-3.5 mr-1.5" />Registration
          </TabsTrigger>
          <TabsTrigger value="invites" className="font-mono text-xs">
            <Mail className="h-3.5 w-3.5 mr-1.5" />Invites
          </TabsTrigger>
          <TabsTrigger value="allowlist" className="font-mono text-xs">
            <Shield className="h-3.5 w-3.5 mr-1.5" />Allowlist
          </TabsTrigger>
        </TabsList>

        <TabsContent value="users" className="mt-4">
          <UsersTab />
        </TabsContent>
        <TabsContent value="registration" className="mt-4">
          <RegistrationTab />
        </TabsContent>
        <TabsContent value="invites" className="mt-4">
          <InvitesTab />
        </TabsContent>
        <TabsContent value="allowlist" className="mt-4">
          <AllowlistTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
