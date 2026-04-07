/**
 * AlarmBanner - Persistent alarm overlay that appears at the top of the app
 * when the service worker receives an alarm-type push notification.
 *
 * Shows a pulsing red banner with alarm details and dismiss buttons.
 * The banner is always rendered at the app root level so it appears
 * regardless of which page the user is on.
 */

import { useAlarmAudio } from "../hooks/useAlarmAudio";
import { Button } from "./ui/button";
import { X, BellOff, AlertTriangle } from "lucide-react";

export function AlarmBanner() {
  const { activeAlarms, hasActiveAlarms, alarmCount, dismissAlarm, dismissAllAlarms } =
    useAlarmAudio();

  if (!hasActiveAlarms) return null;

  const alarmList = Array.from(activeAlarms.values());

  return (
    <div className="fixed top-0 left-0 right-0 z-[100] animate-pulse">
      <div className="bg-red-600 text-white shadow-lg shadow-red-600/30">
        {/* Dismiss All bar (when multiple alarms) */}
        {alarmCount > 1 && (
          <div className="flex items-center justify-between px-4 py-1 bg-red-700 text-xs">
            <span>{alarmCount} active alarms</span>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 text-xs text-white hover:bg-red-800 hover:text-white"
              onClick={dismissAllAlarms}
            >
              <BellOff className="w-3 h-3 mr-1" />
              Dismiss All
            </Button>
          </div>
        )}

        {/* Individual alarm cards */}
        {alarmList.map((alarm) => {
          const elapsed = Math.round((Date.now() - alarm.startedAt) / 1000);
          const minutes = Math.floor(elapsed / 60);
          const seconds = elapsed % 60;
          const timeStr = minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`;

          return (
            <div
              key={alarm.alarmKey}
              className="flex items-center gap-3 px-4 py-3 border-b border-red-500 last:border-b-0"
            >
              <AlertTriangle className="w-5 h-5 flex-shrink-0 animate-bounce" />
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-sm truncate">{alarm.title}</div>
                <div className="text-xs text-red-100 truncate">{alarm.body}</div>
                {alarm.loopCount > 0 && (
                  <div className="text-xs text-red-200 mt-0.5">
                    Alarm active for {timeStr}
                  </div>
                )}
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 px-3 text-white hover:bg-red-700 hover:text-white border border-red-400"
                onClick={() => dismissAlarm(alarm.alarmKey)}
              >
                <X className="w-4 h-4 mr-1" />
                Dismiss
              </Button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
