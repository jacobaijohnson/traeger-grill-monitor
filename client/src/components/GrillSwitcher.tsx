import { trpc } from "@/lib/trpc";
import { useTraegerStatus } from "@/hooks/useTraeger";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Flame, Wifi, WifiOff } from "lucide-react";
import { toast } from "sonner";

interface GrillSwitcherProps {
  /** Compact mode for collapsed sidebar */
  compact?: boolean;
}

/**
 * Grill switcher dropdown.
 * Shows the currently selected grill and allows switching between grills.
 * Uses the existing traeger.selectGrill mutation.
 */
export default function GrillSwitcher({ compact = false }: GrillSwitcherProps) {
  const { data: status } = useTraegerStatus();
  const utils = trpc.useUtils();

  const selectGrill = trpc.traeger.selectGrill.useMutation({
    onSuccess: () => {
      // Invalidate everything that depends on the selected grill
      utils.traeger.status.invalidate();
      utils.grill.telemetry.invalidate();
      utils.grill.telemetryHistory.invalidate();
      utils.cookSession.list.invalidate();
      utils.analytics.summary.invalidate();
      utils.analytics.byMeatType.invalidate();
      utils.analytics.byMethod.invalidate();
      utils.analytics.byMonth.invalidate();
      utils.analytics.byCut.invalidate();
      utils.analytics.ratingDistribution.invalidate();
      utils.analytics.pelletSummary.invalidate();
      utils.analytics.pelletTrend.invalidate();
      utils.liveCook.active.invalidate();
      toast.success("Grill switched");
    },
  });

  if (!status?.connected || !status.grills || status.grills.length <= 1) {
    return null; // Don't show switcher if only one grill or not connected
  }

  const selectedGrill = status.grills.find(
    (g: { thingName: string }) => g.thingName === status.selectedGrillId
  );

  if (compact) {
    return (
      <button
        className="h-8 w-8 flex items-center justify-center rounded-lg bg-primary/10 border border-primary/20 hover:bg-primary/20 transition-colors"
        title={selectedGrill?.friendlyName || "Switch grill"}
        onClick={() => {
          // Cycle through grills
          const currentIdx = status.grills!.findIndex(
            (g: { thingName: string }) => g.thingName === status.selectedGrillId
          );
          const nextIdx = (currentIdx + 1) % status.grills!.length;
          selectGrill.mutate({ grillId: status.grills![nextIdx].thingName });
        }}
      >
        <Flame className="h-4 w-4 text-primary" />
      </button>
    );
  }

  return (
    <div className="px-2 py-1">
      <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground mb-1.5 px-1">
        Active Grill
      </div>
      <Select
        value={status.selectedGrillId || ""}
        onValueChange={(grillId) => {
          if (grillId !== status.selectedGrillId) {
            selectGrill.mutate({ grillId });
          }
        }}
      >
        <SelectTrigger className="h-9 text-xs font-mono bg-secondary/30 border-border/50">
          <div className="flex items-center gap-2 min-w-0">
            <Flame className="h-3.5 w-3.5 text-primary shrink-0" />
            <SelectValue placeholder="Select grill" />
          </div>
        </SelectTrigger>
        <SelectContent>
          {status.grills.map((grill: { thingName: string; friendlyName: string }) => (
            <SelectItem key={grill.thingName} value={grill.thingName}>
              <div className="flex items-center gap-2">
                <span>{grill.friendlyName || grill.thingName}</span>
                {grill.thingName === status.selectedGrillId && (
                  <Badge variant="outline" className="text-[9px] font-mono px-1 py-0 h-4">
                    active
                  </Badge>
                )}
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
