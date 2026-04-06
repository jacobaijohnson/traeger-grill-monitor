import { trpc } from "@/lib/trpc";
import { useTraegerStatus } from "@/hooks/useTraeger";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import {
  History as HistoryIcon,
  Clock,
  Flame,
  Star,
  WifiOff,
  ChevronRight,
  Download,
} from "lucide-react";
import { useState } from "react";
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

function StarRating({
  value,
  onChange,
}: {
  value: number;
  onChange?: (v: number) => void;
}) {
  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((star) => (
        <Star
          key={star}
          className={`h-4 w-4 cursor-pointer transition-colors ${
            star <= value ? "text-amber-400 fill-amber-400" : "text-muted-foreground"
          }`}
          onClick={() => onChange?.(star)}
        />
      ))}
    </div>
  );
}

function formatDuration(start: Date | string, end: Date | string | null): string {
  if (!end) return "In progress";
  const ms = new Date(end).getTime() - new Date(start).getTime();
  const hours = Math.floor(ms / 3600000);
  const minutes = Math.floor((ms % 3600000) / 60000);
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

function ExportCsvButton({ sessionId }: { sessionId: number }) {
  const { data, isLoading, refetch } = trpc.cookSession.exportCsv.useQuery(
    { id: sessionId },
    { enabled: false } // Only fetch on demand
  );
  const [downloading, setDownloading] = useState(false);

  const handleExport = async () => {
    setDownloading(true);
    try {
      const result = await refetch();
      if (result.data) {
        const blob = new Blob([result.data.csv], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = result.data.filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        toast.success("CSV exported");
      }
    } catch {
      toast.error("Failed to export CSV");
    } finally {
      setDownloading(false);
    }
  };

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleExport}
      disabled={downloading}
      className="font-mono text-xs"
    >
      <Download className="h-3 w-3 mr-1" />
      {downloading ? "exporting..." : "export csv"}
    </Button>
  );
}

export default function History() {
  const [, setLocation] = useLocation();
  const { data: status } = useTraegerStatus();
  const { data: sessions, refetch } = trpc.cookSession.list.useQuery(undefined, {
    enabled: !!status?.connected,
  });
  const updateNotes = trpc.cookSession.updateNotes.useMutation({
    onSuccess: () => {
      refetch();
      toast.success("Notes saved");
    },
  });

  const [selectedSession, setSelectedSession] = useState<number | null>(null);
  const [notes, setNotes] = useState("");
  const [rating, setRating] = useState(0);

  const { data: sessionTelemetry } = trpc.telemetry.forSession.useQuery(
    { cookSessionId: selectedSession! },
    { enabled: !!selectedSession }
  );

  const { data: sessionDetail } = trpc.cookSession.get.useQuery(
    { id: selectedSession! },
    { enabled: !!selectedSession }
  );

  const chartData = sessionTelemetry?.map((t) => ({
    time: new Date(t.recordedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    grill: t.grillTemp > 0 ? t.grillTemp : undefined,
    probe: t.probeTemp && t.probeTemp > 0 ? t.probeTemp : undefined,
    ambient: t.ambientTemp && t.ambientTemp > 0 ? t.ambientTemp : undefined,
    target: t.targetTemp && t.targetTemp > 0 ? t.targetTemp : undefined,
  })) || [];

  if (!status?.connected) {
    return (
      <div className="max-w-lg mx-auto mt-12">
        <Card className="bg-card border-border">
          <CardContent className="p-8 text-center">
            <WifiOff className="h-10 w-10 text-muted-foreground mx-auto mb-4 opacity-50" />
            <h2 className="text-lg font-semibold text-foreground mb-2">No Grill Connected</h2>
            <p className="text-sm text-muted-foreground mb-6">
              Connect your grill account to view cook history.
            </p>
            <Button onClick={() => setLocation("/settings")} className="bg-primary text-primary-foreground font-mono text-xs">
              go to settings
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground tracking-tight">Cook History</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Review past cooks with temperature graphs, notes, and ratings.
        </p>
      </div>

      {sessions && sessions.length > 0 ? (
        <div className="space-y-3">
          {sessions.map((session) => (
            <Card
              key={session.id}
              className="bg-card border-border hover:border-primary/30 transition-colors cursor-pointer group"
              onClick={() => {
                setSelectedSession(session.id);
                setNotes(session.notes || "");
                setRating(session.rating || 0);
              }}
            >
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-semibold text-foreground text-sm group-hover:text-primary transition-colors">
                        {session.cutName || session.meatType || "Cook Session"}
                      </h3>
                      {session.method && (
                        <Badge variant="outline" className="text-xs font-mono">
                          {session.method}
                        </Badge>
                      )}
                      {session.rating && session.rating > 0 && (
                        <StarRating value={session.rating} />
                      )}
                    </div>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground font-mono">
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {new Date(session.startedAt).toLocaleDateString()}
                      </span>
                      <span>
                        {formatDuration(session.startedAt, session.endedAt)}
                      </span>
                      {session.templateId && (
                        <span className="text-primary/60">tmpl:{session.templateId}</span>
                      )}
                    </div>
                  </div>
                  <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card className="bg-card border-border">
          <CardContent className="p-8 text-center">
            <HistoryIcon className="h-8 w-8 text-muted-foreground mx-auto mb-3 opacity-30" />
            <p className="text-muted-foreground text-sm font-mono">
              No cook sessions recorded yet.
            </p>
            <p className="text-xs text-muted-foreground/60 mt-1">
              Start a cook from the Dashboard to begin tracking.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Session Detail Dialog */}
      <Dialog open={!!selectedSession} onOpenChange={() => setSelectedSession(null)}>
        <DialogContent className="bg-card border-border max-w-3xl max-h-[85vh] overflow-y-auto">
          {sessionDetail && (
            <>
              <DialogHeader>
                <DialogTitle className="text-foreground">
                  {sessionDetail.cutName || sessionDetail.meatType || "Cook Session"}
                </DialogTitle>
              </DialogHeader>

              <div className="space-y-5">
                {/* Info Grid */}
                <div className="grid grid-cols-3 gap-4">
                  <div className="p-3 rounded-lg bg-secondary/50 border border-border">
                    <span className="text-xs text-muted-foreground font-mono uppercase">Date</span>
                    <div className="text-foreground font-medium text-sm mt-1">
                      {new Date(sessionDetail.startedAt).toLocaleDateString()}
                    </div>
                  </div>
                  <div className="p-3 rounded-lg bg-secondary/50 border border-border">
                    <span className="text-xs text-muted-foreground font-mono uppercase">Duration</span>
                    <div className="text-foreground font-medium text-sm mt-1">
                      {formatDuration(sessionDetail.startedAt, sessionDetail.endedAt)}
                    </div>
                  </div>
                  <div className="p-3 rounded-lg bg-secondary/50 border border-border">
                    <span className="text-xs text-muted-foreground font-mono uppercase">Method</span>
                    <div className="text-foreground font-medium text-sm mt-1">
                      {sessionDetail.method || "N/A"}
                    </div>
                  </div>
                </div>

                {/* Temperature Graph */}
                {chartData.length > 0 ? (
                  <div>
                    <h4 className="text-xs font-mono uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
                      <Flame className="h-3.5 w-3.5 text-primary" />
                      Temperature Graph
                    </h4>
                    <div className="p-3 rounded-lg bg-secondary/30 border border-border">
                      <ResponsiveContainer width="100%" height={250}>
                        <LineChart data={chartData}>
                          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                          <XAxis dataKey="time" stroke="rgba(255,255,255,0.25)" fontSize={10} fontFamily="monospace" />
                          <YAxis stroke="rgba(255,255,255,0.25)" fontSize={10} fontFamily="monospace" />
                          <Tooltip
                            contentStyle={{
                              backgroundColor: "hsl(220 15% 12%)",
                              border: "1px solid hsl(220 10% 20%)",
                              borderRadius: "6px",
                              fontSize: "11px",
                              fontFamily: "monospace",
                            }}
                          />
                          <Legend wrapperStyle={{ fontSize: "11px", fontFamily: "monospace" }} />
                          <Line type="monotone" dataKey="grill" stroke="hsl(28 90% 55%)" strokeWidth={2} dot={false} name="Grill" />
                          <Line type="monotone" dataKey="probe" stroke="hsl(0 80% 60%)" strokeWidth={2} dot={false} name="Probe" />
                          <Line type="monotone" dataKey="ambient" stroke="hsl(210 60% 60%)" strokeWidth={1.5} dot={false} name="Ambient" />
                          <Line type="stepAfter" dataKey="target" stroke="hsl(220 10% 50%)" strokeWidth={1} strokeDasharray="5 5" dot={false} name="Target" />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground text-sm font-mono">
                    No telemetry data recorded for this session.
                  </div>
                )}

                {/* Notes & Rating */}
                <div className="space-y-3">
                  <h4 className="text-xs font-mono uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                    <Star className="h-3.5 w-3.5 text-amber-400" />
                    Notes & Rating
                  </h4>
                  <StarRating value={rating} onChange={setRating} />
                  <Textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="How did this cook turn out? Any adjustments for next time?"
                    className="bg-secondary text-foreground min-h-[80px]"
                  />
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        updateNotes.mutate({
                          id: selectedSession!,
                          notes,
                          rating: rating > 0 ? rating : undefined,
                        });
                      }}
                      disabled={updateNotes.isPending}
                      className="font-mono text-xs"
                    >
                      save notes
                    </Button>
                    <ExportCsvButton sessionId={selectedSession!} />
                  </div>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
