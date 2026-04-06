import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  BarChart3, Flame, Clock, Star, TrendingUp, Trophy,
  ChefHat, Loader2, Beef, Timer, Award, Target,
} from "lucide-react";
import { useMemo } from "react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, CartesianGrid, Legend,
  AreaChart, Area,
} from "recharts";

// ─── Color Palette ────────────────────────────────────
const CHART_COLORS = [
  "#f59e0b", "#ef4444", "#3b82f6", "#10b981", "#8b5cf6",
  "#ec4899", "#06b6d4", "#f97316", "#84cc16", "#6366f1",
];

const RATING_COLORS: Record<number, string> = {
  1: "#ef4444",
  2: "#f97316",
  3: "#eab308",
  4: "#84cc16",
  5: "#22c55e",
};

function formatMinutes(mins: number): string {
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

function formatHours(mins: number): string {
  const h = Math.round(mins / 60 * 10) / 10;
  return `${h}h`;
}

// ─── Stat Card ────────────────────────────────────────

function StatCard({
  icon: Icon,
  label,
  value,
  subtext,
  color = "text-amber-400",
}: {
  icon: React.ElementType;
  label: string;
  value: string | number;
  subtext?: string;
  color?: string;
}) {
  return (
    <Card className="bg-card/50 border-border/50">
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-mono mb-1">{label}</p>
            <p className="text-2xl font-mono font-bold text-foreground">{value}</p>
            {subtext && <p className="text-xs text-muted-foreground mt-0.5">{subtext}</p>}
          </div>
          <div className={`p-2 rounded-lg bg-secondary/50 ${color}`}>
            <Icon className="h-5 w-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Custom Tooltip ───────────────────────────────────

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-popover border border-border rounded-lg p-3 shadow-lg">
      <p className="text-xs font-mono text-muted-foreground mb-1">{label}</p>
      {payload.map((entry: any, i: number) => (
        <p key={i} className="text-sm font-mono" style={{ color: entry.color }}>
          {entry.name}: {typeof entry.value === "number" && entry.name?.includes("Duration")
            ? formatMinutes(entry.value)
            : entry.value}
        </p>
      ))}
    </div>
  );
}

// ─── Empty State ──────────────────────────────────────

function EmptyAnalytics() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6">
      <div className="p-6 rounded-full bg-card/50 border border-border/50">
        <BarChart3 className="h-16 w-16 text-muted-foreground" />
      </div>
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-bold">No Cook Data Yet</h2>
        <p className="text-muted-foreground max-w-md">
          Complete a few cook sessions to see your analytics. Track your progress,
          compare cook times, and discover your best cooks.
        </p>
      </div>
    </div>
  );
}

// ─── Main Analytics Page ──────────────────────────────

export default function Analytics() {
  const { user } = useAuth();

  const summaryQuery = trpc.analytics.summary.useQuery(undefined, { enabled: !!user });
  const meatTypeQuery = trpc.analytics.byMeatType.useQuery(undefined, { enabled: !!user });
  const methodQuery = trpc.analytics.byMethod.useQuery(undefined, { enabled: !!user });
  const monthQuery = trpc.analytics.byMonth.useQuery(undefined, { enabled: !!user });
  const cutQuery = trpc.analytics.byCut.useQuery(undefined, { enabled: !!user });
  const ratingQuery = trpc.analytics.ratingDistribution.useQuery(undefined, { enabled: !!user });

  const isLoading = summaryQuery.isLoading || meatTypeQuery.isLoading;
  const summary = summaryQuery.data;
  const byMeatType = meatTypeQuery.data || [];
  const byMethod = methodQuery.data || [];
  const byMonth = monthQuery.data || [];
  const byCut = cutQuery.data || [];
  const ratingDist = ratingQuery.data || [];

  // Prepare chart data
  const meatChartData = useMemo(() =>
    byMeatType.map(m => ({
      name: m.meatType.charAt(0).toUpperCase() + m.meatType.slice(1),
      Cooks: m.count,
      "Avg Duration": m.avgDurationMinutes,
      "Avg Rating": m.avgRating || 0,
    })),
    [byMeatType]
  );

  const methodChartData = useMemo(() =>
    byMethod.map(m => ({
      name: m.method.charAt(0).toUpperCase() + m.method.slice(1).replace("_", " "),
      Cooks: m.count,
      "Avg Duration": m.avgDurationMinutes,
    })),
    [byMethod]
  );

  const monthChartData = useMemo(() =>
    byMonth.map(m => ({
      name: m.month,
      Cooks: m.count,
      "Avg Rating": m.avgRating || 0,
      "Total Hours": Math.round(m.totalMinutes / 60 * 10) / 10,
    })),
    [byMonth]
  );

  const pieData = useMemo(() =>
    byMeatType.map((m, i) => ({
      name: m.meatType.charAt(0).toUpperCase() + m.meatType.slice(1),
      value: m.count,
      color: CHART_COLORS[i % CHART_COLORS.length],
    })),
    [byMeatType]
  );

  const ratingChartData = useMemo(() =>
    ratingDist.map(r => ({
      name: `${r.rating} ★`,
      count: r.count,
      fill: RATING_COLORS[r.rating] || "#888",
    })),
    [ratingDist]
  );

  // Completion rate
  const completionRate = summary && summary.totalCooks > 0
    ? Math.round((summary.completedCooks / summary.totalCooks) * 100)
    : 0;

  if (!user) return null;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-amber-400" />
      </div>
    );
  }

  if (!summary || summary.totalCooks === 0) {
    return <EmptyAnalytics />;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <BarChart3 className="h-6 w-6 text-amber-400" />
          Cook Analytics
        </h1>
        <p className="text-sm text-muted-foreground font-mono mt-1">
          Your cooking performance at a glance
        </p>
      </div>

      {/* Summary Stats Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard
          icon={ChefHat}
          label="Total Cooks"
          value={summary.totalCooks}
          subtext={`${summary.completedCooks} completed · ${summary.cancelledCooks} cancelled`}
        />
        <StatCard
          icon={Clock}
          label="Total Cook Time"
          value={formatHours(summary.totalCookMinutes)}
          subtext={`Avg: ${formatMinutes(summary.avgCookMinutes)} per cook`}
          color="text-blue-400"
        />
        <StatCard
          icon={Star}
          label="Avg Rating"
          value={summary.avgRating !== null ? `${summary.avgRating} ★` : "—"}
          subtext={summary.ratedCooks > 0 ? `${summary.ratedCooks} rated cooks` : "No ratings yet"}
          color="text-yellow-400"
        />
        <StatCard
          icon={Target}
          label="Completion Rate"
          value={`${completionRate}%`}
          subtext={`${summary.completedCooks} of ${summary.totalCooks} cooks`}
          color="text-green-400"
        />
      </div>

      {/* Highlights Row */}
      {(summary.bestRatedCook || summary.longestCook) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {summary.bestRatedCook && (
            <Card className="bg-gradient-to-r from-amber-500/10 to-transparent border-amber-500/20">
              <CardContent className="p-4 flex items-center gap-4">
                <div className="p-3 rounded-full bg-amber-500/20">
                  <Trophy className="h-6 w-6 text-amber-400" />
                </div>
                <div>
                  <p className="text-xs font-mono text-muted-foreground uppercase tracking-wider">Best Rated Cook</p>
                  <p className="font-bold text-lg">
                    {summary.bestRatedCook.cutName || summary.bestRatedCook.meatType || "Cook"}
                    <span className="text-amber-400 ml-2">{summary.bestRatedCook.rating} ★</span>
                  </p>
                </div>
              </CardContent>
            </Card>
          )}
          {summary.longestCook && (
            <Card className="bg-gradient-to-r from-blue-500/10 to-transparent border-blue-500/20">
              <CardContent className="p-4 flex items-center gap-4">
                <div className="p-3 rounded-full bg-blue-500/20">
                  <Timer className="h-6 w-6 text-blue-400" />
                </div>
                <div>
                  <p className="text-xs font-mono text-muted-foreground uppercase tracking-wider">Longest Cook</p>
                  <p className="font-bold text-lg">
                    {summary.longestCook.cutName || summary.longestCook.meatType || "Cook"}
                    <span className="text-blue-400 ml-2">{formatMinutes(summary.longestCook.durationMinutes)}</span>
                  </p>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      <Separator className="opacity-30" />

      {/* Charts Row 1: Meat Type Distribution + Pie */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Bar: Cooks by Meat Type */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-mono flex items-center gap-2">
              <Beef className="h-4 w-4 text-amber-400" />
              Cooks by Meat Type
            </CardTitle>
          </CardHeader>
          <CardContent>
            {meatChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={meatChartData} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
                  <XAxis dataKey="name" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                  <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="Cooks" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-10">No data yet</p>
            )}
          </CardContent>
        </Card>

        {/* Pie: Meat Type Distribution */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-mono">Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            {pieData.length > 0 ? (
              <div>
                <ResponsiveContainer width="100%" height={180}>
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={40}
                      outerRadius={70}
                      paddingAngle={3}
                      dataKey="value"
                    >
                      {pieData.map((entry, i) => (
                        <Cell key={i} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      content={({ active, payload }) => {
                        if (!active || !payload?.length) return null;
                        const d = payload[0].payload;
                        return (
                          <div className="bg-popover border border-border rounded-lg p-2 shadow-lg">
                            <p className="text-xs font-mono" style={{ color: d.color }}>
                              {d.name}: {d.value} cooks
                            </p>
                          </div>
                        );
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className="flex flex-wrap gap-2 justify-center mt-2">
                  {pieData.map((d, i) => (
                    <div key={i} className="flex items-center gap-1.5">
                      <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: d.color }} />
                      <span className="text-[10px] font-mono text-muted-foreground">{d.name}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-10">No data yet</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Charts Row 2: Cooks Over Time + Rating Distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Area: Cooks Over Time */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-mono flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-green-400" />
              Cooks Over Time
            </CardTitle>
          </CardHeader>
          <CardContent>
            {monthChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={240}>
                <AreaChart data={monthChartData} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
                  <defs>
                    <linearGradient id="cookGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
                  <XAxis dataKey="name" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
                  <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                  <Tooltip content={<CustomTooltip />} />
                  <Area type="monotone" dataKey="Cooks" stroke="#f59e0b" fill="url(#cookGradient)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-10">Need more cook history</p>
            )}
          </CardContent>
        </Card>

        {/* Bar: Rating Distribution */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-mono flex items-center gap-2">
              <Star className="h-4 w-4 text-yellow-400" />
              Rating Distribution
            </CardTitle>
          </CardHeader>
          <CardContent>
            {ratingChartData.some(r => r.count > 0) ? (
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={ratingChartData} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
                  <XAxis dataKey="name" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                  <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} allowDecimals={false} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="count" name="Cooks" radius={[4, 4, 0, 0]}>
                    {ratingChartData.map((entry, i) => (
                      <Cell key={i} fill={entry.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-10">Rate your cooks to see distribution</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Charts Row 3: Method Breakdown */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-mono flex items-center gap-2">
            <Flame className="h-4 w-4 text-red-400" />
            Cooking Method Breakdown
          </CardTitle>
        </CardHeader>
        <CardContent>
          {methodChartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={methodChartData} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                <YAxis yAxisId="left" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                <Tooltip content={<CustomTooltip />} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar yAxisId="left" dataKey="Cooks" fill="#ef4444" radius={[4, 4, 0, 0]} />
                <Bar yAxisId="right" dataKey="Avg Duration" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-10">No data yet</p>
          )}
        </CardContent>
      </Card>

      {/* Table: Cut Leaderboard */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-mono flex items-center gap-2">
            <Award className="h-4 w-4 text-amber-400" />
            Cut Leaderboard
            <Badge variant="outline" className="text-[10px] font-mono">{byCut.length} cuts</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {byCut.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/50">
                    <th className="text-left py-2 px-2 text-[10px] font-mono uppercase tracking-wider text-muted-foreground">Cut</th>
                    <th className="text-left py-2 px-2 text-[10px] font-mono uppercase tracking-wider text-muted-foreground">Type</th>
                    <th className="text-center py-2 px-2 text-[10px] font-mono uppercase tracking-wider text-muted-foreground">Cooks</th>
                    <th className="text-center py-2 px-2 text-[10px] font-mono uppercase tracking-wider text-muted-foreground">Avg Time</th>
                    <th className="text-center py-2 px-2 text-[10px] font-mono uppercase tracking-wider text-muted-foreground">Avg Rating</th>
                    <th className="text-center py-2 px-2 text-[10px] font-mono uppercase tracking-wider text-muted-foreground">Best</th>
                    <th className="text-center py-2 px-2 text-[10px] font-mono uppercase tracking-wider text-muted-foreground">Avg Peak Probe</th>
                  </tr>
                </thead>
                <tbody>
                  {byCut.map((cut, i) => (
                    <tr key={i} className="border-b border-border/30 hover:bg-secondary/30 transition-colors">
                      <td className="py-2.5 px-2 font-mono font-medium">{cut.cutName}</td>
                      <td className="py-2.5 px-2">
                        <Badge variant="outline" className="text-[10px] font-mono capitalize">
                          {cut.meatType || "—"}
                        </Badge>
                      </td>
                      <td className="py-2.5 px-2 text-center font-mono">{cut.count}</td>
                      <td className="py-2.5 px-2 text-center font-mono text-blue-400">
                        {cut.avgDurationMinutes > 0 ? formatMinutes(cut.avgDurationMinutes) : "—"}
                      </td>
                      <td className="py-2.5 px-2 text-center font-mono text-yellow-400">
                        {cut.avgRating !== null ? `${cut.avgRating} ★` : "—"}
                      </td>
                      <td className="py-2.5 px-2 text-center font-mono text-green-400">
                        {cut.bestRating !== null ? `${cut.bestRating} ★` : "—"}
                      </td>
                      <td className="py-2.5 px-2 text-center font-mono text-red-400">
                        {cut.avgPeakProbeTemp !== null ? `${cut.avgPeakProbeTemp}°F` : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-6">No cut data yet</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
