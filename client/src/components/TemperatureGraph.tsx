import { useMemo, useState, useCallback, useRef, useEffect } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
  ReferenceArea,
  Brush,
} from "recharts";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { TempMarker, MeatProfile } from "../../../shared/meat-science";
import {
  ZoomIn,
  ZoomOut,
  Maximize2,
  Clock,
  ChevronLeft,
  ChevronRight,
  ChevronsRight,
  SkipForward,
} from "lucide-react";

interface DataPoint {
  timestamp: number;
  time?: string;
  grill: number;
  probe: number;
  ambient: number;
  set: number;
  smoke?: number;
  keepwarm?: number;
}

interface TemperatureGraphProps {
  data: DataPoint[];
  meatProfile?: MeatProfile | null;
  showAmbient?: boolean;
  showTarget?: boolean;
  height?: number;
  cookStartTime?: number;
  className?: string;
}

const TIME_WINDOWS = [
  { label: "10m", minutes: 10 },
  { label: "30m", minutes: 30 },
  { label: "1h", minutes: 60 },
  { label: "2h", minutes: 120 },
  { label: "4h", minutes: 240 },
  { label: "8h", minutes: 480 },
  { label: "All", minutes: 0 },
];

function formatElapsed(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatTimeRange(startTs: number, endTs: number): string {
  return `${formatTime(startTs)} — ${formatTime(endTs)}`;
}

// Custom tooltip
function CustomTooltip({ active, payload, label, cookStartTime }: any) {
  if (!active || !payload?.length) return null;
  const ts = payload[0]?.payload?.timestamp;
  return (
    <div className="bg-card/95 backdrop-blur border border-border rounded-lg p-3 shadow-xl">
      <p className="text-xs text-muted-foreground font-mono mb-1.5">
        {ts ? formatTime(ts) : label}
        {cookStartTime && ts ? (
          <span className="ml-2 text-amber-400">
            +{formatElapsed(ts - cookStartTime)}
          </span>
        ) : null}
      </p>
      {payload.map((entry: any, i: number) => (
        <div key={i} className="flex items-center gap-2 text-sm">
          <div
            className="w-2 h-2 rounded-full"
            style={{ backgroundColor: entry.color }}
          />
          <span className="text-muted-foreground">{entry.name}:</span>
          <span
            className="font-mono font-medium"
            style={{ color: entry.color }}
          >
            {Math.round(entry.value)}°F
          </span>
        </div>
      ))}
    </div>
  );
}

// Marker legend
function MarkerLegend({ markers }: { markers: TempMarker[] }) {
  return (
    <div className="flex flex-wrap gap-1.5 mt-2">
      {markers.map((m, i) => (
        <Badge
          key={i}
          variant="outline"
          className="text-[10px] font-mono py-0 px-1.5 border-opacity-50"
          style={{ borderColor: m.color, color: m.color }}
        >
          {m.temp}°F {m.label}
        </Badge>
      ))}
    </div>
  );
}

export default function TemperatureGraph({
  data,
  meatProfile,
  showAmbient = true,
  showTarget = true,
  height = 350,
  cookStartTime,
  className,
}: TemperatureGraphProps) {
  const [timeWindow, setTimeWindow] = useState<number>(0); // 0 = all
  const [yZoom, setYZoom] = useState<number>(1); // 1 = auto, 2 = zoomed in
  const [offset, setOffset] = useState<number>(0); // offset in ms from "now" (0 = latest)
  const [autoFollow, setAutoFollow] = useState(true); // auto-scroll to latest
  const prevDataLenRef = useRef(data.length);

  // When new data arrives and autoFollow is on, reset offset to 0
  useEffect(() => {
    if (autoFollow && data.length !== prevDataLenRef.current) {
      setOffset(0);
    }
    prevDataLenRef.current = data.length;
  }, [data.length, autoFollow]);

  // When time window changes, reset offset and re-enable auto-follow
  const handleTimeWindowChange = useCallback((minutes: number) => {
    setTimeWindow(minutes);
    setOffset(0);
    setAutoFollow(true);
  }, []);

  // Navigate backward/forward in time
  const stepSize = useMemo(() => {
    if (timeWindow === 0) return 0;
    // Step by 25% of the window
    return timeWindow * 60 * 1000 * 0.25;
  }, [timeWindow]);

  const handleStepBack = useCallback(() => {
    if (timeWindow === 0 || data.length === 0) return;
    setAutoFollow(false);
    setOffset((prev) => {
      const dataStart = data[0]?.timestamp || 0;
      const windowMs = timeWindow * 60 * 1000;
      const maxOffset = Date.now() - dataStart - windowMs;
      return Math.min(prev + stepSize, Math.max(0, maxOffset));
    });
  }, [timeWindow, stepSize, data]);

  const handleStepForward = useCallback(() => {
    if (timeWindow === 0) return;
    setOffset((prev) => {
      const newOffset = Math.max(0, prev - stepSize);
      if (newOffset === 0) setAutoFollow(true);
      return newOffset;
    });
  }, [stepSize, timeWindow]);

  const handleJumpToNow = useCallback(() => {
    setOffset(0);
    setAutoFollow(true);
  }, []);

  // Filter data by time window + offset
  const filteredData = useMemo(() => {
    if (timeWindow === 0 || data.length === 0) return data;
    const windowMs = timeWindow * 60 * 1000;
    const windowEnd = Date.now() - offset;
    const windowStart = windowEnd - windowMs;
    const filtered = data.filter(
      (d) => d.timestamp >= windowStart && d.timestamp <= windowEnd
    );
    return filtered.length > 0 ? filtered : data.slice(-5);
  }, [data, timeWindow, offset]);

  // Check if we can navigate
  const canStepBack = useMemo(() => {
    if (timeWindow === 0 || data.length === 0) return false;
    const dataStart = data[0]?.timestamp || 0;
    const windowMs = timeWindow * 60 * 1000;
    const windowStart = Date.now() - offset - windowMs;
    return windowStart > dataStart;
  }, [timeWindow, offset, data]);

  const canStepForward = offset > 0;
  const isAtLatest = offset === 0;

  // P3: Touch/swipe support for mobile timeline navigation
  const touchStartRef = useRef<{ x: number; y: number; time: number } | null>(null);
  const chartContainerRef = useRef<HTMLDivElement>(null);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (timeWindow === 0) return;
    const touch = e.touches[0];
    touchStartRef.current = { x: touch.clientX, y: touch.clientY, time: Date.now() };
  }, [timeWindow]);

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    if (!touchStartRef.current || timeWindow === 0) return;
    const touch = e.changedTouches[0];
    const dx = touch.clientX - touchStartRef.current.x;
    const dy = touch.clientY - touchStartRef.current.y;
    const dt = Date.now() - touchStartRef.current.time;
    touchStartRef.current = null;

    // Only trigger if horizontal swipe is dominant and fast enough
    if (Math.abs(dx) < 40 || Math.abs(dy) > Math.abs(dx) || dt > 500) return;

    if (dx > 0) {
      // Swipe right = go back in time
      handleStepBack();
    } else {
      // Swipe left = go forward in time
      handleStepForward();
    }
  }, [timeWindow, handleStepBack, handleStepForward]);

  // Gap threshold: if two consecutive points are >5 minutes apart, it's a session gap
  const GAP_THRESHOLD_MS = 5 * 60 * 1000;

  // Detect session gaps and insert null-value break points
  const chartDataWithGaps = useMemo(() => {
    if (filteredData.length < 2) {
      return filteredData.map((d) => ({
        ...d,
        timeLabel: cookStartTime
          ? formatElapsed(d.timestamp - cookStartTime)
          : formatTime(d.timestamp),
        isGap: false,
      }));
    }

    const result: Array<typeof filteredData[0] & { timeLabel: string; isGap: boolean; grill: number | null; probe: number | null; ambient: number | null; set: number | null }> = [];

    for (let i = 0; i < filteredData.length; i++) {
      const d = filteredData[i];
      const prev = i > 0 ? filteredData[i - 1] : null;

      // Insert a gap marker if there's a big time jump
      if (prev && d.timestamp - prev.timestamp > GAP_THRESHOLD_MS) {
        // Insert a null-point to break the line
        result.push({
          ...d,
          timestamp: prev.timestamp + 1000,
          grill: null as any,
          probe: null as any,
          ambient: null as any,
          set: null as any,
          timeLabel: "---",
          isGap: true,
        });
      }

      result.push({
        ...d,
        timeLabel: cookStartTime
          ? formatElapsed(d.timestamp - cookStartTime)
          : formatTime(d.timestamp),
        isGap: false,
      });
    }

    return result;
  }, [filteredData, cookStartTime]);

  // Use chartDataWithGaps as the chart data
  const chartData = chartDataWithGaps;

  // Count session segments (gaps + 1)
  const sessionCount = useMemo(() => {
    return chartData.filter(d => d.isGap).length + (chartData.length > 0 ? 1 : 0);
  }, [chartData]);

  // Session gap timestamps for ReferenceArea shading
  const gapRegions = useMemo(() => {
    const regions: Array<{ startLabel: string; endLabel: string }> = [];
    for (let i = 0; i < chartData.length; i++) {
      if (chartData[i].isGap && i + 1 < chartData.length) {
        // The gap is between the previous real point and the next real point
        const prevReal = i > 0 ? chartData[i - 1] : null;
        const nextReal = chartData[i + 1];
        if (prevReal && nextReal) {
          regions.push({
            startLabel: prevReal.timeLabel,
            endLabel: nextReal.timeLabel,
          });
        }
      }
    }
    return regions;
  }, [chartData]);

  // Calculate Y axis domain
  const yDomain = useMemo(() => {
    if (chartData.length === 0) return [0, 500];
    const allTemps = chartData
      .flatMap((d) => [
        d.grill,
        d.probe,
        ...(showAmbient ? [d.ambient] : []),
        ...(showTarget ? [d.set] : []),
      ])
      .filter((t) => t > 0);

    const markerTemps = meatProfile?.markers.map((m) => m.temp) ?? [];
    const allValues = [...allTemps, ...markerTemps];

    if (allValues.length === 0) return [0, 500];
    const min = Math.min(...allValues);
    const max = Math.max(...allValues);
    const padding = yZoom === 1 ? 30 : 15;
    return [
      Math.max(0, Math.floor((min - padding) / 10) * 10),
      Math.ceil((max + padding) / 10) * 10,
    ];
  }, [chartData, showAmbient, showTarget, meatProfile, yZoom]);

  // Crossed markers
  const crossedMarkers = useMemo(() => {
    if (!meatProfile || chartData.length === 0) return new Set<number>();
    const maxProbe = Math.max(...chartData.map((d) => d.probe));
    return new Set(
      meatProfile.markers.filter((m) => maxProbe >= m.temp).map((m) => m.temp)
    );
  }, [meatProfile, chartData]);

  // Current window time range for display
  const windowTimeRange = useMemo(() => {
    if (timeWindow === 0 || chartData.length === 0) return null;
    const first = chartData[0]?.timestamp;
    const last = chartData[chartData.length - 1]?.timestamp;
    if (!first || !last) return null;
    return formatTimeRange(first, last);
  }, [chartData, timeWindow]);

  return (
    <div className={className}>
      {/* Controls bar */}
      <div className="flex items-center justify-between gap-2 mb-3 flex-wrap">
        {/* Time window presets */}
        <div className="flex items-center gap-1">
          <Clock className="h-3.5 w-3.5 text-muted-foreground" />
          {TIME_WINDOWS.map((tw) => (
            <Button
              key={tw.label}
              variant={timeWindow === tw.minutes ? "default" : "ghost"}
              size="sm"
              className="h-6 px-2 text-xs font-mono"
              onClick={() => handleTimeWindowChange(tw.minutes)}
            >
              {tw.label}
            </Button>
          ))}
        </div>

        {/* Zoom controls */}
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0"
            onClick={() => setYZoom(Math.min(yZoom + 1, 3))}
            title="Zoom in (Y axis)"
          >
            <ZoomIn className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0"
            onClick={() => setYZoom(Math.max(yZoom - 1, 1))}
            title="Zoom out (Y axis)"
          >
            <ZoomOut className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0"
            onClick={() => {
              setYZoom(1);
              handleTimeWindowChange(0);
            }}
            title="Reset view"
          >
            <Maximize2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* Timeline navigation bar — only shown when a time window is selected */}
      {timeWindow > 0 && (
        <div className="flex items-center justify-between gap-2 mb-2 px-1">
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0"
              onClick={handleStepBack}
              disabled={!canStepBack}
              title="Step back"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0"
              onClick={handleStepForward}
              disabled={!canStepForward}
              title="Step forward"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          {/* Time range indicator */}
          <div className="flex-1 text-center">
            {windowTimeRange && (
              <span className="text-xs font-mono text-muted-foreground">
                {windowTimeRange}
              </span>
            )}
            {!isAtLatest && (
              <span className="ml-2 text-[10px] font-mono text-amber-400">
                (viewing history)
              </span>
            )}
          </div>

          {/* Jump to now */}
          <Button
            variant={isAtLatest ? "ghost" : "default"}
            size="sm"
            className={`h-7 px-2 text-xs font-mono ${isAtLatest ? "opacity-50" : "bg-primary text-primary-foreground"}`}
            onClick={handleJumpToNow}
            disabled={isAtLatest}
            title="Jump to now"
          >
            <SkipForward className="h-3.5 w-3.5 mr-1" />
            Now
          </Button>
        </div>
      )}

      {/* Chart — with touch swipe for mobile timeline navigation */}
      <div
        ref={chartContainerRef}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        className="touch-pan-y"
      >
      <ResponsiveContainer width="100%" height={height}>
        <LineChart
          data={chartData}
          margin={{ top: 5, right: 10, left: -10, bottom: 5 }}
        >
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="hsl(var(--border))"
            opacity={0.3}
          />
          <XAxis
            dataKey="timeLabel"
            tick={{
              fill: "hsl(var(--muted-foreground))",
              fontSize: 10,
              fontFamily: "monospace",
            }}
            tickLine={false}
            axisLine={{ stroke: "hsl(var(--border))" }}
            interval="preserveStartEnd"
            minTickGap={40}
          />
          <YAxis
            domain={yDomain}
            tick={{
              fill: "hsl(var(--muted-foreground))",
              fontSize: 10,
              fontFamily: "monospace",
            }}
            tickLine={false}
            axisLine={{ stroke: "hsl(var(--border))" }}
            tickFormatter={(v) => `${v}°`}
          />
          <Tooltip
            content={<CustomTooltip cookStartTime={cookStartTime} />}
          />
          <Legend
            iconType="circle"
            iconSize={8}
            wrapperStyle={{
              fontSize: 11,
              fontFamily: "monospace",
              paddingTop: 8,
            }}
          />

          {/* Meat science reference bands */}
          {meatProfile?.markers
            .filter((m) => m.style === "band" && m.bandEnd)
            .map((m, i) => (
              <ReferenceArea
                key={`band-${i}`}
                y1={m.temp}
                y2={m.bandEnd}
                fill={m.color}
                fillOpacity={0.08}
                stroke={m.color}
                strokeOpacity={0.2}
                strokeDasharray="4 4"
              />
            ))}

          {/* Meat science reference lines */}
          {meatProfile?.markers
            .filter((m) => m.style === "line")
            .map((m, i) => (
              <ReferenceLine
                key={`line-${i}`}
                y={m.temp}
                stroke={m.color}
                strokeDasharray={
                  crossedMarkers.has(m.temp) ? "0" : "6 3"
                }
                strokeWidth={crossedMarkers.has(m.temp) ? 1.5 : 1}
                strokeOpacity={crossedMarkers.has(m.temp) ? 0.9 : 0.5}
                label={{
                  value: `${m.label} ${m.temp}°`,
                  position: "right",
                  fill: m.color,
                  fontSize: 9,
                  fontFamily: "monospace",
                }}
              />
            ))}

          {/* Gap region shading */}
          {gapRegions.map((gap, i) => (
            <ReferenceArea
              key={`gap-${i}`}
              x1={gap.startLabel}
              x2={gap.endLabel}
              fill="hsl(var(--muted))"
              fillOpacity={0.15}
              stroke="hsl(var(--muted-foreground))"
              strokeOpacity={0.2}
              strokeDasharray="4 4"
              label={{
                value: "gap",
                position: "insideTop",
                fill: "hsl(var(--muted-foreground))",
                fontSize: 9,
                fontFamily: "monospace",
              }}
            />
          ))}

          {/* Temperature lines — connectNulls=false to break at gaps */}
          <Line
            type="monotone"
            dataKey="grill"
            name="Grill"
            stroke="#f59e0b"
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 3, fill: "#f59e0b" }}
            connectNulls={false}
          />
          <Line
            type="monotone"
            dataKey="probe"
            name="Probe"
            stroke="#ef4444"
            strokeWidth={2.5}
            dot={false}
            activeDot={{ r: 4, fill: "#ef4444" }}
            connectNulls={false}
          />
          {showAmbient && (
            <Line
              type="monotone"
              dataKey="ambient"
              name="Ambient"
              stroke="#6b7280"
              strokeWidth={1}
              strokeDasharray="4 2"
              dot={false}
              activeDot={{ r: 2 }}
              connectNulls={false}
            />
          )}
          {showTarget && (
            <Line
              type="monotone"
              dataKey="set"
              name="Target"
              stroke="#22c55e"
              strokeWidth={1.5}
              strokeDasharray="8 4"
              dot={false}
              activeDot={{ r: 2 }}
              connectNulls={false}
            />
          )}
        </LineChart>
      </ResponsiveContainer>
      </div>

      {/* Meat science marker legend */}
      {meatProfile && <MarkerLegend markers={meatProfile.markers} />}

      {/* Data info */}
      <div className="flex items-center justify-between mt-2 text-[10px] text-muted-foreground font-mono">
        <span>{chartData.filter(d => !d.isGap).length} data points{sessionCount > 1 ? ` · ${sessionCount} sessions` : ""}</span>
        {cookStartTime && chartData.length > 0 && (
          <span>
            Cook duration: {formatElapsed(Date.now() - cookStartTime)}
          </span>
        )}
        <span>
          {timeWindow === 0
            ? "Full history"
            : isAtLatest
              ? `Last ${TIME_WINDOWS.find((t) => t.minutes === timeWindow)?.label}`
              : `${TIME_WINDOWS.find((t) => t.minutes === timeWindow)?.label} window`}
        </span>
      </div>
    </div>
  );
}
