"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { Globe, ListTodo, Pencil, RefreshCw, Share2, Trash2, Cake, Users, Plus, Eraser, Palette } from "lucide-react";
import { cn, formatDateTime } from "@/lib/utils";
import type { Calendar } from "@/lib/jmap/types";
import { CalendarColorPicker } from "@/components/settings/calendar-management-settings";
import { useCalendarStore } from "@/stores/calendar-store";
import { useSettingsStore } from "@/stores/settings-store";
import { useTaskStore } from "@/stores/task-store";
import { BIRTHDAY_CALENDAR_ID } from "@/lib/birthday-calendar";
import { toast } from "@/stores/toast-store";
import { ContextMenu, ContextMenuItem, ContextMenuSeparator, ContextMenuSubMenu } from "@/components/ui/context-menu";
import { useContextMenu } from "@/hooks/use-context-menu";
import type { IJMAPClient } from '@/lib/jmap/client-interface';

interface CalendarSidebarPanelProps {
  calendars: Calendar[];
  selectedCalendarIds: string[];
  onToggleVisibility: (id: string) => void;
  onColorChange?: (calendarId: string, color: string) => void;
  onShareCalendar?: (calendar: Calendar) => void;
  onCreateEvent?: (calendar: Calendar) => void;
  onClearCalendar?: (calendar: Calendar) => void;
  onDeleteCalendar?: (calendar: Calendar) => void;
  onCreateCalendar?: () => void;
  onSubscribe?: () => void;
  onEditSubscription?: (subscriptionId: string) => void;
  client?: IJMAPClient | null;
}

export function CalendarSidebarPanel({
  calendars,
  selectedCalendarIds,
  onToggleVisibility,
  onColorChange,
  onShareCalendar,
  onCreateEvent,
  onClearCalendar,
  onDeleteCalendar,
  onCreateCalendar,
  onSubscribe,
  onEditSubscription,
  client,
}: CalendarSidebarPanelProps) {
  const t = useTranslations("calendar");
  const tSub = useTranslations("calendar.subscription");
  const tMgmt = useTranslations("calendar.management");
  const isSubscriptionCalendar = useCalendarStore((s) => s.isSubscriptionCalendar);
  const icalSubscriptions = useCalendarStore((s) => s.icalSubscriptions);
  const refreshICalSubscription = useCalendarStore((s) => s.refreshICalSubscription);
  const removeICalSubscription = useCalendarStore((s) => s.removeICalSubscription);
  const timeFormat = useSettingsStore((s) => s.timeFormat);
  const enableCalendarTasks = useSettingsStore((s) => s.enableCalendarTasks);
  const tasks = useTaskStore((s) => s.tasks);
  const setViewMode = useCalendarStore((s) => s.setViewMode);

  const pendingTaskCount = useMemo(() => tasks.filter(t => t.progress !== 'completed' && t.progress !== 'cancelled').length, [tasks]);
  const overdueTaskCount = useMemo(() => {
    const now = new Date();
    return tasks.filter(t => t.progress !== 'completed' && t.progress !== 'cancelled' && t.due && new Date(t.due) < now).length;
  }, [tasks]);

  const { contextMenu, openContextMenu, closeContextMenu, menuRef } = useContextMenu<Calendar>();
  const [refreshingSubId, setRefreshingSubId] = useState<string | null>(null);

  const personalCalendars = useMemo(() => calendars.filter(c => !c.isShared), [calendars]);
  const sharedAccountGroups = useMemo(() => {
    const shared = calendars.filter(c => c.isShared);
    const groups = new Map<string, { accountName: string; calendars: Calendar[] }>();
    for (const cal of shared) {
      const key = cal.accountId || cal.accountName || cal.id;
      if (!groups.has(key)) {
        groups.set(key, { accountName: cal.accountName || key, calendars: [] });
      }
      groups.get(key)!.calendars.push(cal);
    }
    return Array.from(groups.values());
  }, [calendars]);

  const getSubscriptionForCalendar = (calendarId: string) => {
    return icalSubscriptions.find(s => s.calendarId === calendarId);
  };

  const handleRefreshSubscription = async (subId: string) => {
    if (!client) return;
    setRefreshingSubId(subId);
    try {
      await refreshICalSubscription(client, subId);
      toast.success(tSub('refresh_success'));
    } catch {
      toast.error(tSub('refresh_error'));
    } finally {
      setRefreshingSubId(null);
    }
  };

  const handleUnsubscribe = async (subId: string) => {
    if (!client) return;
    try {
      await removeICalSubscription(client, subId);
      toast.success(tSub('deleted'));
    } catch {
      toast.error(tSub('delete_error'));
    }
  };

  if (calendars.length === 0 && !onSubscribe) return null;

  const renderCalendarItem = (cal: Calendar) => {
    const isVisible = selectedCalendarIds.includes(cal.id);
    const color = cal.color || "#3b82f6";
    const hasMenu = isSubscriptionCalendar(cal.id) ? !!client : true;

    return (
      <div key={cal.id} className="relative">
        <button
          onClick={() => onToggleVisibility(cal.id)}
          onContextMenu={hasMenu ? (e) => openContextMenu(e, cal) : undefined}
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
          {isSubscriptionCalendar(cal.id) && (
            <>
              <Globe className="w-3 h-3 text-muted-foreground flex-shrink-0" />
              {refreshingSubId === getSubscriptionForCalendar(cal.id)?.id && (
                <RefreshCw className="w-3 h-3 text-muted-foreground flex-shrink-0 animate-spin" />
              )}
            </>
          )}
          {cal.id === BIRTHDAY_CALENDAR_ID && (
            <Cake className="w-3 h-3 text-muted-foreground flex-shrink-0" />
          )}
        </button>
      </div>
    );
  };

  const renderCalendarMenu = () => {
    const cal = contextMenu.data;
    if (!cal) return null;

    if (isSubscriptionCalendar(cal.id)) {
      const sub = getSubscriptionForCalendar(cal.id);
      if (!sub || !client) return null;
      return (
        <ContextMenu ref={menuRef} isOpen={contextMenu.isOpen} position={contextMenu.position} onClose={closeContextMenu}>
          <ContextMenuItem
            icon={Pencil}
            label={tSub('edit')}
            onClick={() => { closeContextMenu(); onEditSubscription?.(sub.id); }}
          />
          <ContextMenuItem
            icon={RefreshCw}
            label={tSub('refresh')}
            onClick={() => { closeContextMenu(); handleRefreshSubscription(sub.id); }}
          />
          <ContextMenuSeparator />
          <ContextMenuItem
            icon={Trash2}
            label={tSub('unsubscribe')}
            onClick={() => { closeContextMenu(); handleUnsubscribe(sub.id); }}
            destructive
          />
          {sub.lastRefreshed && (
            <div className="px-3 py-1.5 text-xs text-muted-foreground border-t border-border mt-1 pt-1">
              {tSub('last_refreshed', { time: formatDateTime(sub.lastRefreshed, timeFormat, { month: 'short', day: 'numeric', year: 'numeric' }) })}
            </div>
          )}
        </ContextMenu>
      );
    }

    const isBirthday = cal.id === BIRTHDAY_CALENDAR_ID;
    const canCreate = onCreateEvent && !isBirthday && cal.myRights?.mayWriteOwn !== false;
    const canShare = onShareCalendar && cal.myRights?.mayShare && !cal.isShared;
    const canChangeColor = !!onColorChange;
    const canClear = onClearCalendar && !isBirthday && cal.myRights?.mayDelete !== false;
    const canDelete = onDeleteCalendar && !isBirthday && !cal.isDefault && !cal.isShared;
    const showSeparator = (canCreate || canShare || canChangeColor) && (canClear || canDelete);
    const color = cal.color || "#3b82f6";

    return (
      <ContextMenu ref={menuRef} isOpen={contextMenu.isOpen} position={contextMenu.position} onClose={closeContextMenu}>
        {canCreate && (
          <ContextMenuItem
            icon={Plus}
            label={tMgmt('new_event_in_calendar')}
            onClick={() => { closeContextMenu(); onCreateEvent(cal); }}
          />
        )}
        {canShare && (
          <ContextMenuItem
            icon={Users}
            label={tMgmt('share')}
            onClick={() => { closeContextMenu(); onShareCalendar(cal); }}
          />
        )}
        {canChangeColor && (
          <ContextMenuSubMenu icon={Palette} label={tMgmt('change_color')}>
            <div className="px-2 py-1.5 w-[200px]">
              <CalendarColorPicker
                value={color}
                onChange={(c) => { onColorChange(cal.id, c); closeContextMenu(); }}
                allowCustom
              />
            </div>
          </ContextMenuSubMenu>
        )}
        {showSeparator && <ContextMenuSeparator />}
        {canClear && (
          <ContextMenuItem
            icon={Eraser}
            label={tMgmt('clear_events')}
            onClick={() => { closeContextMenu(); onClearCalendar(cal); }}
          />
        )}
        {canDelete && (
          <ContextMenuItem
            icon={Trash2}
            label={tMgmt('delete')}
            onClick={() => { closeContextMenu(); onDeleteCalendar(cal); }}
            destructive
          />
        )}
      </ContextMenu>
    );
  };

  return (
    <div className="mt-4">
      {enableCalendarTasks && (
        <button
          onClick={() => setViewMode('tasks')}
          className="flex items-center gap-2 w-full px-1.5 py-1.5 mb-3 rounded-md text-sm hover:bg-muted transition-colors"
        >
          <ListTodo className="w-4 h-4 text-muted-foreground" />
          <span>{t('tasks.label')}</span>
          {pendingTaskCount > 0 && (
            <span className="ml-auto text-xs text-muted-foreground">{pendingTaskCount}</span>
          )}
          {overdueTaskCount > 0 && (
            <span className="text-xs text-destructive font-medium">{overdueTaskCount} {t('tasks.filter_overdue').toLowerCase()}</span>
          )}
        </button>
      )}
      <div className="flex items-center justify-between mb-2 px-1 group">
        {onCreateCalendar ? (
          <button
            onClick={onCreateCalendar}
            className="text-xs font-medium text-muted-foreground uppercase tracking-wider hover:text-foreground transition-colors flex items-center gap-1.5"
            title={tMgmt('add_calendar')}
          >
            {t('my_calendars')}
            <Plus className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
          </button>
        ) : (
          <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            {t('my_calendars')}
          </h3>
        )}
      </div>
      <div className="space-y-0.5">
        {personalCalendars.map(renderCalendarItem)}
      </div>

      {sharedAccountGroups.map((group) => (
        <div key={group.accountName} className="mt-4">
          <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2 px-1 flex items-center gap-1.5">
            <Share2 className="w-3 h-3" />
            {group.accountName}
          </h3>
          <div className="space-y-0.5">
            {group.calendars.map(renderCalendarItem)}
          </div>
        </div>
      ))}

      {renderCalendarMenu()}
    </div>
  );
}
