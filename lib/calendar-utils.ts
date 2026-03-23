import { differenceInCalendarDays, parseISO, startOfDay, subMilliseconds } from "date-fns";
import { parseDuration } from "@/components/calendar/event-card";
import type { CalendarEvent } from "@/lib/jmap/types";

export interface CalendarWeekSegment {
  event: CalendarEvent;
  startIndex: number;
  span: number;
  row: number;
  continuesBefore: boolean;
  continuesAfter: boolean;
}

export function getEventEndDate(event: CalendarEvent): Date {
  const start = new Date(event.start);
  if (!event.duration) return start;
  return new Date(start.getTime() + parseDuration(event.duration) * 60000);
}

export function getEventDisplayEndDate(event: CalendarEvent): Date {
  const end = getEventEndDate(event);
  if (!event.showWithoutTime || end.getTime() <= new Date(event.start).getTime()) {
    return end;
  }
  return subMilliseconds(end, 1);
}

export function getEventDayBounds(event: CalendarEvent): { startDay: Date; endDay: Date } {
  return {
    startDay: startOfDay(new Date(event.start)),
    endDay: startOfDay(getEventDisplayEndDate(event)),
  };
}

export function normalizeAllDayDuration(duration: string | undefined): string | undefined {
  if (!duration) return undefined;
  const totalMinutes = parseDuration(duration);
  const totalDays = Math.max(1, Math.ceil(totalMinutes / (24 * 60)));
  return `P${totalDays}D`;
}

export function buildAllDayDuration(start: Date, inclusiveEnd: Date): string {
  const dayCount = Math.max(1, differenceInCalendarDays(startOfDay(inclusiveEnd), startOfDay(start)) + 1);
  return `P${dayCount}D`;
}

export function buildWeekSegments(events: CalendarEvent[], weekDays: Date[]): CalendarWeekSegment[] {
  if (weekDays.length === 0) return [];

  const weekStart = startOfDay(weekDays[0]);
  const weekEnd = startOfDay(weekDays[weekDays.length - 1]);

  const rawSegments = events.flatMap((event) => {
    const { startDay, endDay } = getEventDayBounds(event);
    if (endDay < weekStart || startDay > weekEnd) {
      return [];
    }

    const segmentStart = startDay < weekStart ? weekStart : startDay;
    const segmentEnd = endDay > weekEnd ? weekEnd : endDay;
    const startIndex = differenceInCalendarDays(segmentStart, weekStart);
    const span = differenceInCalendarDays(segmentEnd, segmentStart) + 1;

    return [{
      event,
      startIndex,
      span,
      row: -1,
      continuesBefore: startDay < weekStart,
      continuesAfter: endDay > weekEnd,
    } satisfies CalendarWeekSegment];
  });

  rawSegments.sort((left, right) => {
    if (left.startIndex !== right.startIndex) return left.startIndex - right.startIndex;
    if (left.span !== right.span) return right.span - left.span;
    if (left.event.showWithoutTime !== right.event.showWithoutTime) {
      return left.event.showWithoutTime ? -1 : 1;
    }
    const timeDiff = new Date(left.event.start).getTime() - new Date(right.event.start).getTime();
    if (timeDiff !== 0) return timeDiff;
    return (left.event.title || "").localeCompare(right.event.title || "");
  });

  const rowEndIndices: number[] = [];
  return rawSegments.map((segment) => {
    const segmentEndIndex = segment.startIndex + segment.span - 1;
    let row = rowEndIndices.findIndex((endIndex) => endIndex < segment.startIndex);
    if (row === -1) {
      row = rowEndIndices.length;
      rowEndIndices.push(segmentEndIndex);
    } else {
      rowEndIndices[row] = segmentEndIndex;
    }
    return { ...segment, row };
  });
}

export function layoutOverlappingEvents(
  events: CalendarEvent[],
): { event: CalendarEvent; column: number; totalColumns: number }[] {
  const sorted = [...events].sort((a, b) => {
    const diff = new Date(a.start).getTime() - new Date(b.start).getTime();
    if (diff !== 0) return diff;
    return parseDuration(b.duration) - parseDuration(a.duration);
  });

  const columns: { event: CalendarEvent; end: number }[][] = [];
  const result: { event: CalendarEvent; column: number; totalColumns: number }[] = [];

  for (const event of sorted) {
    const start = parseISO(event.start);
    const startMin = start.getHours() * 60 + start.getMinutes();
    const endMin = Math.min(1440, startMin + Math.max(15, parseDuration(event.duration)));
    let placed = false;
    for (let col = 0; col < columns.length; col++) {
      if (columns[col].every(e => e.end <= startMin)) {
        columns[col].push({ event, end: endMin });
        result.push({ event, column: col, totalColumns: 0 });
        placed = true;
        break;
      }
    }
    if (!placed) {
      columns.push([{ event, end: endMin }]);
      result.push({ event, column: columns.length - 1, totalColumns: 0 });
    }
  }

  const total = columns.length;
  result.forEach(r => r.totalColumns = total);
  return result;
}

export function formatSnapTime(minutes: number, timeFormat: "12h" | "24h"): string {
  const clamped = Math.max(0, Math.min(1440, minutes));
  const h = Math.floor(clamped / 60) % 24;
  const m = clamped % 60;
  if (timeFormat === "12h") {
    return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`;
  }
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export function getPrimaryCalendarId(event: Pick<CalendarEvent, 'calendarIds'>): string | undefined {
  return Object.keys(event.calendarIds || {})[0];
}
