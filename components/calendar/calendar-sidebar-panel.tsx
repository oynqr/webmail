"use client";

import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import type { Calendar } from "@/lib/jmap/types";

interface CalendarSidebarPanelProps {
  calendars: Calendar[];
  selectedCalendarIds: string[];
  onToggleVisibility: (id: string) => void;
}

export function CalendarSidebarPanel({
  calendars,
  selectedCalendarIds,
  onToggleVisibility,
}: CalendarSidebarPanelProps) {
  const t = useTranslations("calendar");

  if (calendars.length === 0) return null;

  return (
    <div className="mt-4">
      <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2 px-1">
        {t("my_calendars")}
      </h3>
      <div className="space-y-0.5">
        {calendars.map((cal) => {
          const isVisible = selectedCalendarIds.includes(cal.id);
          const color = cal.color || "#3b82f6";

          return (
            <button
              key={cal.id}
              onClick={() => onToggleVisibility(cal.id)}
              className={cn(
                "flex items-center gap-2 w-full px-1.5 py-1 rounded-md text-sm transition-colors duration-150",
                "hover:bg-muted"
              )}
            >
              <span
                className={cn(
                  "w-3 h-3 rounded-sm border-2 flex-shrink-0 transition-colors",
                  isVisible ? "border-transparent" : "border-muted-foreground/40 bg-transparent"
                )}
                style={isVisible ? { backgroundColor: color, borderColor: color } : undefined}
              />
              <span className={cn("truncate", !isVisible && "text-muted-foreground")}>
                {cal.name}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
