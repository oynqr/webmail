import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { IJMAPClient } from '@/lib/jmap/client-interface';
import type { Calendar, CalendarEvent, CalendarParticipant } from '@/lib/jmap/types';
import { debug } from '@/lib/debug';
import { normalizeAllDayDuration } from '@/lib/calendar-utils';

export type CalendarViewMode = 'month' | 'week' | 'day' | 'agenda' | 'tasks';

const CALENDAR_VIEW_MODES: CalendarViewMode[] = ['month', 'week', 'day', 'agenda', 'tasks'];

export function isCalendarViewMode(value: unknown): value is CalendarViewMode {
  return typeof value === 'string' && CALENDAR_VIEW_MODES.includes(value as CalendarViewMode);
}

export interface ICalSubscription {
  id: string;
  url: string;
  calendarId: string;
  name: string;
  color: string;
  refreshInterval: number; // minutes
  lastRefreshed: string | null;
}

interface CalendarStore {
  calendars: Calendar[];
  events: CalendarEvent[];
  selectedDate: Date;
  viewMode: CalendarViewMode;
  selectedCalendarIds: string[];
  selectedEventId: string | null;
  isLoading: boolean;
  isLoadingEvents: boolean;
  supportsCalendar: boolean;
  error: string | null;
  dateRange: { start: string; end: string } | null;

  setSupported: (supported: boolean) => void;
  fetchCalendars: (client: IJMAPClient) => Promise<void>;
  fetchEvents: (client: IJMAPClient, start: string, end: string) => Promise<void>;
  createEvent: (client: IJMAPClient, event: Partial<CalendarEvent>, sendSchedulingMessages?: boolean) => Promise<CalendarEvent | null>;
  updateEvent: (client: IJMAPClient, id: string, updates: Partial<CalendarEvent>, sendSchedulingMessages?: boolean) => Promise<void>;
  deleteEvent: (client: IJMAPClient, id: string, sendSchedulingMessages?: boolean) => Promise<void>;
  rsvpEvent: (client: IJMAPClient, eventId: string, participantId: string, status: string, replyTo?: Record<string, string> | null) => Promise<void>;
  importEvents: (client: IJMAPClient, events: Partial<CalendarEvent>[], calendarId: string) => Promise<number>;
  updateCalendar: (client: IJMAPClient, calendarId: string, updates: Partial<Calendar>) => Promise<void>;
  createCalendar: (client: IJMAPClient, calendar: Partial<Calendar>) => Promise<Calendar | null>;
  removeCalendar: (client: IJMAPClient, calendarId: string) => Promise<void>;
  clearCalendarEvents: (client: IJMAPClient, calendarId: string) => Promise<number>;
  setSelectedDate: (date: Date) => void;
  setViewMode: (mode: CalendarViewMode) => void;
  toggleCalendarVisibility: (calendarId: string) => void;
  setSelectedEventId: (id: string | null) => void;
  clearState: () => void;

  // iCal subscriptions
  icalSubscriptions: ICalSubscription[];
  addICalSubscription: (client: IJMAPClient, url: string, name: string, color: string, refreshInterval?: number) => Promise<ICalSubscription | null>;
  removeICalSubscription: (client: IJMAPClient, subscriptionId: string) => Promise<void>;
  refreshICalSubscription: (client: IJMAPClient, subscriptionId: string) => Promise<void>;
  refreshAllSubscriptions: (client: IJMAPClient) => Promise<void>;
  isSubscriptionCalendar: (calendarId: string) => boolean;
}

const initialState = {
  calendars: [],
  events: [],
  selectedDate: new Date(),
  selectedCalendarIds: [] as string[],
  selectedEventId: null as string | null,
  isLoading: false,
  isLoadingEvents: false,
  supportsCalendar: false,
  error: null as string | null,
  dateRange: null as { start: string; end: string } | null,
  icalSubscriptions: [] as ICalSubscription[],
};

function getSafeCalendarViewMode(value: unknown): CalendarViewMode {
  return isCalendarViewMode(value) ? value : 'month';
}

export const useCalendarStore = create<CalendarStore>()(
  persist(
    (set, get) => ({
      ...initialState,
      viewMode: 'month' as CalendarViewMode,

      setSupported: (supported) => set({ supportsCalendar: supported }),

      fetchCalendars: async (client) => {
        set({ isLoading: true, error: null });
        try {
          const calendars = await client.getAllCalendars();
          const { selectedCalendarIds } = get();
          const validIds = calendars.map(c => c.id);
          const stillValid = selectedCalendarIds.filter(id => validIds.includes(id));
          set({
            calendars,
            isLoading: false,
            selectedCalendarIds: stillValid.length > 0 ? stillValid : validIds,
          });
        } catch (error) {
          debug.error('Failed to fetch calendars:', error);
          set({ error: 'Failed to load calendars', isLoading: false });
        }
      },

      fetchEvents: async (client, start, end) => {
        set({ isLoadingEvents: true, error: null });
        try {
          const rawEvents = await client.queryAllCalendarEvents({
            after: start,
            before: end,
          });
          // Filter out malformed events missing required 'start' field
          const events = rawEvents.filter(e => typeof e.start === 'string' && e.start);
          set({ events, isLoadingEvents: false, dateRange: { start, end } });
        } catch (error) {
          debug.error('Failed to fetch events:', error);
          set({ error: 'Failed to load events', isLoadingEvents: false });
        }
      },

      createEvent: async (client, event, sendSchedulingMessages) => {
        set({ error: null });
        try {
          // Resolve shared calendar context from calendarIds
          let targetAccountId = event.accountId;
          const cleanEvent = { ...event };
          if (event.calendarIds) {
            const remapped: Record<string, boolean> = {};
            for (const calId of Object.keys(event.calendarIds)) {
              const cal = get().calendars.find(c => c.id === calId);
              if (cal?.isShared && cal.originalId) {
                targetAccountId = cal.accountId;
                remapped[cal.originalId] = true;
              } else {
                remapped[calId] = true;
              }
            }
            cleanEvent.calendarIds = remapped;
          }
          if (event.originalCalendarIds) {
            cleanEvent.calendarIds = event.originalCalendarIds;
          }
          const created = await client.createCalendarEvent(cleanEvent, sendSchedulingMessages, targetAccountId);
          set((state) => ({ events: [...state.events, created] }));
          return created;
        } catch (error) {
          debug.error('Failed to create event:', error);
          set({ error: 'Failed to create event' });
          return null;
        }
      },

      updateEvent: async (client, id, updates, sendSchedulingMessages) => {
        set({ error: null });
        try {
          // Resolve shared event IDs
          const storeEvent = get().events.find(e => e.id === id);
          const realId = storeEvent?.originalId || id;
          const targetAccountId = storeEvent?.accountId;
          // Remap namespaced calendarIds back to original IDs
          const cleanUpdates = { ...updates };
          if (cleanUpdates.calendarIds) {
            const remapped: Record<string, boolean> = {};
            for (const [calId, v] of Object.entries(cleanUpdates.calendarIds)) {
              const cal = get().calendars.find(c => c.id === calId);
              remapped[cal?.originalId || calId] = v;
            }
            cleanUpdates.calendarIds = remapped;
          }
          try {
            await client.updateCalendarEvent(realId, cleanUpdates, sendSchedulingMessages, targetAccountId);
          } catch (updateError) {
            // Stalwart rejects updates to "synthetic" JMAP IDs (CalDAV-created events
            // or expanded recurring-event instances returned by expandRecurrences).
            // Resolve the real event via a UID query and retry.
            const message = updateError instanceof Error ? updateError.message : '';
            if (message.toLowerCase().includes('synthetic') && storeEvent) {
              debug.log('Event has synthetic ID, resolving real ID via UID query');
              const queryResults = await client.queryCalendarEvents(
                { uid: storeEvent.uid }, undefined, undefined, targetAccountId
              );
              const realEvent = queryResults.find(e => !e.recurrenceId) || queryResults[0];
              if (realEvent) {
                const resolvedId = realEvent.originalId || realEvent.id;
                if (storeEvent.recurrenceId) {
                  // Recurring instance: patch the master event's recurrenceOverrides.
                  // Escape recurrenceId per RFC 6901: ~ → ~0, / → ~1
                  const escapedRecurrenceId = storeEvent.recurrenceId.replace(/~/g, '~0').replace(/\//g, '~1');
                  // Build override object with all changed properties
                  const overrideObj: Record<string, unknown> = {};
                  for (const [key, value] of Object.entries(cleanUpdates as Record<string, unknown>)) {
                    if (['id', 'uid', '@type', 'calendarIds', 'recurrenceRules', 'recurrenceOverrides', 'excludedRecurrenceRules'].includes(key)) continue;
                    overrideObj[key] = value;
                  }
                  const patchUpdates: Record<string, unknown> = {
                    [`recurrenceOverrides/${escapedRecurrenceId}`]: overrideObj,
                  };
                  await client.updateCalendarEvent(
                    resolvedId,
                    patchUpdates as unknown as Partial<CalendarEvent>,
                    sendSchedulingMessages,
                    targetAccountId
                  );
                } else {
                  // Non-recurring event with synthetic ID: retry with the real ID
                  await client.updateCalendarEvent(resolvedId, cleanUpdates, sendSchedulingMessages, targetAccountId);
                }
                set((state) => ({
                  events: state.events.map(e => e.id === id ? { ...e, ...updates } : e),
                }));
                return;
              }
            }
            throw updateError;
          }
          set((state) => ({
            events: state.events.map(e => e.id === id ? { ...e, ...updates } : e),
          }));
        } catch (error) {
          debug.error('Failed to update event:', error);
          set({ error: 'Failed to update event' });
          throw error;
        }
      },

      rsvpEvent: async (client, eventId, participantId, status, replyTo) => {
        set({ error: null });
        // JMAP participant IDs are opaque strings — they can contain @, ., :, / etc.
        // Only reject empty or obviously malicious values (path traversal).
        if (!participantId || participantId.includes('..')) {
          set({ error: 'Invalid participant ID' });
          throw new Error('Invalid participant ID');
        }
        try {
          // Resolve shared event IDs
          const storeEvent = get().events.find(e => e.id === eventId);
          const realId = storeEvent?.originalId || eventId;
          const targetAccountId = storeEvent?.accountId;
          // Escape per RFC 6901 (JSON Pointer): ~ → ~0, / → ~1
          const escapedId = participantId.replace(/~/g, '~0').replace(/\//g, '~1');
          const patchKey = `participants/${escapedId}/participationStatus`;
          const patch: Record<string, unknown> = { [patchKey]: status };
          // Include replyTo so the server knows where to deliver the iTIP reply
          // (may be missing if the event was imported or auto-created without it).
          if (replyTo) {
            patch.replyTo = replyTo;
          }
          try {
            await client.updateCalendarEvent(
              realId,
              patch as unknown as Partial<CalendarEvent>,
              true,
              targetAccountId
            );
          } catch (updateError) {
            // Stalwart rejects updates to synthetic IDs. Resolve real ID via UID query.
            const message = updateError instanceof Error ? updateError.message : '';
            if (message.toLowerCase().includes('synthetic') && storeEvent) {
              debug.log('RSVP: Event has synthetic ID, resolving real ID via UID query');
              const queryResults = await client.queryCalendarEvents(
                { uid: storeEvent.uid }, undefined, undefined, targetAccountId
              );
              const realEvent = queryResults.find(e => !e.recurrenceId) || queryResults[0];
              if (realEvent) {
                const resolvedId = realEvent.originalId || realEvent.id;
                if (storeEvent.recurrenceId) {
                  // Recurring instance: patch RSVP as recurrence override on master
                  // Escape recurrenceId per RFC 6901: ~ → ~0, / → ~1
                  const escapedRecId = storeEvent.recurrenceId.replace(/~/g, '~0').replace(/\//g, '~1');
                  const overrideObj: Record<string, unknown> = {
                    [patchKey]: status,
                  };
                  if (replyTo) {
                    overrideObj['replyTo'] = replyTo;
                  }
                  const overridePatch: Record<string, unknown> = {
                    [`recurrenceOverrides/${escapedRecId}`]: overrideObj,
                  };
                  await client.updateCalendarEvent(
                    resolvedId,
                    overridePatch as unknown as Partial<CalendarEvent>,
                    true,
                    targetAccountId
                  );
                } else {
                  // Non-recurring event: retry RSVP with real ID
                  await client.updateCalendarEvent(
                    resolvedId,
                    patch as unknown as Partial<CalendarEvent>,
                    true,
                    targetAccountId
                  );
                }
                set((state) => ({
                  events: state.events.map(e => e.id === eventId ? { ...e, participants: {
                    ...e.participants,
                    ...(e.participants?.[participantId] ? {
                      [participantId]: { ...e.participants[participantId], participationStatus: status as CalendarParticipant['participationStatus'] },
                    } : {}),
                  }} : e),
                }));
                return;
              }
            }
            throw updateError;
          }
          set((state) => ({
            events: state.events.map(e => {
              if (e.id !== eventId || !e.participants?.[participantId]) return e;
              return {
                ...e,
                participants: {
                  ...e.participants,
                  [participantId]: { ...e.participants[participantId], participationStatus: status as CalendarParticipant['participationStatus'] },
                },
              };
            }),
          }));
        } catch (error) {
          debug.error('Failed to RSVP:', error);
          set({ error: 'Failed to update RSVP' });
          throw error;
        }
      },

      importEvents: async (client, events, calendarId) => {
        let imported = 0;
        // Resolve shared calendar IDs
        const cal = get().calendars.find(c => c.id === calendarId);
        const realCalendarId = cal?.originalId || calendarId;
        const targetAccountId = cal?.accountId;
        for (const event of events) {
          const src = event as Partial<CalendarEvent>;
          try {
            let cleanParticipants: Record<string, CalendarParticipant> | null = null;
            if (src.participants) {
              cleanParticipants = {};
              for (const [key, p] of Object.entries(src.participants)) {
                const participant: Record<string, unknown> = {
                  '@type': 'Participant',
                  name: p.name,
                  email: p.email,
                  calendarAddress: p.calendarAddress,
                  description: p.description,
                  sendTo: p.sendTo,
                  kind: p.kind,
                  roles: p.roles,
                  participationStatus: p.participationStatus,
                  participationComment: p.participationComment,
                  expectReply: p.expectReply,
                  scheduleAgent: p.scheduleAgent,
                  scheduleForceSend: p.scheduleForceSend,
                  scheduleId: p.scheduleId,
                  delegatedTo: p.delegatedTo,
                  delegatedFrom: p.delegatedFrom,
                  memberOf: p.memberOf,
                  locationId: p.locationId,
                  language: p.language,
                  links: p.links,
                };
                Object.keys(participant).forEach(k => {
                  if (participant[k] === undefined || participant[k] === null) delete participant[k];
                });
                cleanParticipants[key] = participant as unknown as CalendarParticipant;
              }
            }

            const data: Partial<CalendarEvent> = {
              calendarIds: { [realCalendarId]: true },
              uid: src.uid,
              title: src.title,
              description: src.description,
              descriptionContentType: src.descriptionContentType,
              start: src.start,
              duration: src.showWithoutTime ? normalizeAllDayDuration(src.duration) : src.duration,
              timeZone: src.showWithoutTime ? null : src.timeZone,
              showWithoutTime: src.showWithoutTime,
              status: src.status,
              freeBusyStatus: src.freeBusyStatus,
              privacy: src.privacy,
              color: src.color,
              keywords: src.keywords,
              categories: src.categories,
              locale: src.locale,
              replyTo: src.replyTo || (src.organizerCalendarAddress ? { imip: src.organizerCalendarAddress } : undefined),
              locations: src.locations,
              virtualLocations: src.virtualLocations,
              links: src.links,
              recurrenceRules: src.recurrenceRules,
              recurrenceOverrides: src.recurrenceOverrides,
              excludedRecurrenceRules: src.excludedRecurrenceRules,
              alerts: src.alerts,
              participants: cleanParticipants,
            };
            Object.keys(data).forEach(k => {
              const v = (data as Record<string, unknown>)[k];
              if (v === undefined || v === null) delete (data as Record<string, unknown>)[k];
            });
            const created = await client.createCalendarEvent(data, undefined, targetAccountId);
            set((state) => ({ events: [...state.events, created] }));
            imported++;
          } catch (error) {
            const msg = error instanceof Error ? error.message : '';
            if ((msg.includes('already exists') || msg.includes('duplicate') || msg.includes('conflict')) && src.uid) {
              const { events: storeEvents } = get();
              const alreadyInStore = storeEvents.some((e) => e.uid === src.uid);
              if (alreadyInStore) {
                imported++;
                continue;
              }
              try {
                const all = await client.queryCalendarEvents({}, undefined, undefined, targetAccountId);
                const matching = all.filter((e) => e.uid === src.uid);
                if (matching.length > 0) {
                  const existingIds = new Set(storeEvents.map((e) => e.id));
                  const newEvents = matching.filter((e) => !existingIds.has(e.id));
                  if (newEvents.length > 0) {
                    set((state) => ({ events: [...state.events, ...newEvents] }));
                  }
                  imported++;
                  continue;
                }
              } catch {
                // fall through to error
              }
            }
            debug.error('Failed to import event:', event.title, error);
          }
        }
        return imported;
      },

      deleteEvent: async (client, id, sendSchedulingMessages) => {
        set({ error: null });
        try {
          // Resolve shared event IDs
          const storeEvent = get().events.find(e => e.id === id);
          const realId = storeEvent?.originalId || id;
          const targetAccountId = storeEvent?.accountId;
          if (sendSchedulingMessages) {
            try {
              const event = await client.getCalendarEvent(realId, targetAccountId);
              if (event?.participants) {
                await client.sendImipCancellation(event);
              }
            } catch (e) {
              debug.error('Failed to send cancellation emails:', e);
            }
          }
          try {
            await client.deleteCalendarEvent(realId, sendSchedulingMessages, targetAccountId);
          } catch (deleteError) {
            // Stalwart rejects deletes on synthetic IDs (CalDAV-created events or
            // expanded recurring instances). Resolve the real ID via UID query.
            const message = deleteError instanceof Error ? deleteError.message : '';
            if (message.toLowerCase().includes('synthetic') && storeEvent) {
              debug.log('Event has synthetic ID, resolving real ID via UID query for delete');
              const queryResults = await client.queryCalendarEvents(
                { uid: storeEvent.uid }, undefined, undefined, targetAccountId
              );
              const realEvent = queryResults.find(e => !e.recurrenceId) || queryResults[0];
              if (realEvent) {
                const resolvedId = realEvent.originalId || realEvent.id;
                if (storeEvent.recurrenceId) {
                  // Recurring instance: exclude via recurrenceOverrides on master
                  await client.updateCalendarEvent(
                    resolvedId,
                    { [`recurrenceOverrides/${storeEvent.recurrenceId}`]: { excluded: true } } as unknown as Partial<CalendarEvent>,
                    false,
                    targetAccountId
                  );
                } else {
                  // Non-recurring event: delete using the real ID
                  await client.deleteCalendarEvent(resolvedId, sendSchedulingMessages, targetAccountId);
                }
              } else {
                throw deleteError;
              }
            } else {
              throw deleteError;
            }
          }
          set((state) => ({
            events: state.events.filter(e => e.id !== id),
            selectedEventId: state.selectedEventId === id ? null : state.selectedEventId,
          }));
        } catch (error) {
          debug.error('Failed to delete event:', error);
          set({ error: 'Failed to delete event' });
          throw error;
        }
      },

      setSelectedDate: (date) => set({ selectedDate: date }),
      setViewMode: (mode) => set({ viewMode: getSafeCalendarViewMode(mode) }),

      updateCalendar: async (client, calendarId, updates) => {
        set({ error: null });
        try {
          const cal = get().calendars.find(c => c.id === calendarId);
          const realId = cal?.originalId || calendarId;
          const targetAccountId = cal?.accountId;
          await client.updateCalendar(realId, updates, targetAccountId);
          set((state) => ({
            calendars: state.calendars.map(c =>
              c.id === calendarId ? { ...c, ...updates } : c
            ),
          }));
        } catch (error) {
          debug.error('Failed to update calendar:', error);
          set({ error: 'Failed to update calendar' });
          throw error;
        }
      },

      createCalendar: async (client, calendar) => {
        set({ error: null });
        try {
          const created = await client.createCalendar(calendar);
          set((state) => ({
            calendars: [...state.calendars, created],
            selectedCalendarIds: [...state.selectedCalendarIds, created.id],
          }));
          return created;
        } catch (error) {
          debug.error('Failed to create calendar:', error);
          set({ error: 'Failed to create calendar' });
          return null;
        }
      },

      removeCalendar: async (client, calendarId) => {
        set({ error: null });
        try {
          const cal = get().calendars.find(c => c.id === calendarId);
          const realId = cal?.originalId || calendarId;
          const targetAccountId = cal?.accountId;
          await client.deleteCalendar(realId, targetAccountId);
          set((state) => ({
            calendars: state.calendars.filter(c => c.id !== calendarId),
            selectedCalendarIds: state.selectedCalendarIds.filter(id => id !== calendarId),
            events: state.events.filter(e => !e.calendarIds?.[calendarId]),
          }));
        } catch (error) {
          debug.error('Failed to delete calendar:', error);
          set({ error: 'Failed to delete calendar' });
          throw error;
        }
      },

      clearCalendarEvents: async (client, calendarId) => {
        set({ error: null });
        try {
          const cal = get().calendars.find(c => c.id === calendarId);
          const realCalId = cal?.originalId || calendarId;
          const targetAccountId = cal?.accountId;
          let totalDeleted = 0;
          // Loop to handle pagination (getCalendarEvents has a 1000 limit)
          let hasMore = true;
          while (hasMore) {
            // Query all events and filter client-side by calendarId
            // to avoid relying on server-side inCalendars filter support
            const allEvents = await client.getCalendarEvents(undefined, targetAccountId);
            const calendarEvents = allEvents.filter(e => e.calendarIds?.[realCalId]);
            if (calendarEvents.length === 0) break;

            const ids = calendarEvents.map(e => e.id);
            const { destroyed } = await client.batchDeleteCalendarEvents(ids, targetAccountId);
            totalDeleted += destroyed.length;

            // If we couldn't destroy any events, stop to avoid infinite loop
            if (destroyed.length === 0) {
              debug.warn('Could not delete any events, stopping clear loop. Not destroyed:', ids.length);
              break;
            }

            // If we got fewer than the limit, we've fetched everything
            if (allEvents.length < 1000) hasMore = false;
          }

          set((state) => ({
            events: state.events.filter(e => !e.calendarIds?.[calendarId]),
          }));
          return totalDeleted;
        } catch (error) {
          debug.error('Failed to clear calendar events:', error);
          set({ error: 'Failed to clear calendar events' });
          throw error;
        }
      },

      toggleCalendarVisibility: (calendarId) => set((state) => {
        const ids = state.selectedCalendarIds;
        return {
          selectedCalendarIds: ids.includes(calendarId)
            ? ids.filter(id => id !== calendarId)
            : [...ids, calendarId],
        };
      }),

      setSelectedEventId: (id) => set({ selectedEventId: id }),

      // iCal subscriptions
      isSubscriptionCalendar: (calendarId) => {
        return get().icalSubscriptions.some(s => s.calendarId === calendarId);
      },

      addICalSubscription: async (client, url, name, color, refreshInterval = 60) => {
        try {
          // Create a new calendar for this subscription
          const calendar = await client.createCalendar({
            name,
            color,
            isVisible: true,
            isSubscribed: true,
          });
          if (!calendar) throw new Error('Failed to create calendar');

          const subscription: ICalSubscription = {
            id: crypto.randomUUID(),
            url,
            calendarId: calendar.id,
            name,
            color,
            refreshInterval,
            lastRefreshed: null,
          };

          set((state) => ({
            calendars: [...state.calendars, calendar],
            selectedCalendarIds: [...state.selectedCalendarIds, calendar.id],
            icalSubscriptions: [...state.icalSubscriptions, subscription],
          }));

          // Do initial fetch
          try {
            await get().refreshICalSubscription(client, subscription.id);
          } catch {
            // Subscription created, initial fetch failed - user can retry
            debug.warn('Initial subscription fetch failed for:', name);
          }

          return subscription;
        } catch (error) {
          debug.error('Failed to add iCal subscription:', error);
          return null;
        }
      },

      removeICalSubscription: async (client, subscriptionId) => {
        const sub = get().icalSubscriptions.find(s => s.id === subscriptionId);
        if (!sub) return;

        try {
          await client.deleteCalendar(sub.calendarId);
        } catch (error) {
          debug.error('Failed to delete subscription calendar:', error);
          // Continue removing subscription record even if calendar delete fails
        }

        set((state) => ({
          icalSubscriptions: state.icalSubscriptions.filter(s => s.id !== subscriptionId),
          calendars: state.calendars.filter(c => c.id !== sub.calendarId),
          selectedCalendarIds: state.selectedCalendarIds.filter(id => id !== sub.calendarId),
          events: state.events.filter(e => !e.calendarIds?.[sub.calendarId]),
        }));
      },

      refreshICalSubscription: async (client, subscriptionId) => {
        const sub = get().icalSubscriptions.find(s => s.id === subscriptionId);
        if (!sub) return;

        try {
          const response = await fetch('/api/fetch-ical', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url: sub.url }),
          });

          if (!response.ok) {
            const data = await response.json().catch(() => ({}));
            throw new Error(data.error || 'Failed to fetch calendar');
          }

          const blob = await response.blob();
          const file = new File([blob], 'subscription.ics', { type: 'text/calendar' });
          const uploaded = await client.uploadBlob(file);
          const accountId = client.getCalendarsAccountId();
          const parsedEvents = await client.parseCalendarEvents(accountId, uploaded.blobId);

          // Fetch ALL server-side events and filter client-side for this calendar
          // (avoids relying on server-side inCalendars filter support)
          const allServerEvents = await client.getCalendarEvents();
          const serverEvents = allServerEvents.filter(e => e.calendarIds?.[sub.calendarId]);

          // Build a map of incoming UIDs for diffing
          const incomingUids = new Set(parsedEvents.map(e => e.uid).filter(Boolean));

          // Build a map of existing UIDs on server
          const existingByUid = new Map<string, CalendarEvent[]>();
          for (const e of serverEvents) {
            if (e.uid) {
              const list = existingByUid.get(e.uid) || [];
              list.push(e);
              existingByUid.set(e.uid, list);
            }
          }

          // Delete events that are no longer in the feed
          const idsToDelete = serverEvents
            .filter(e => !e.uid || !incomingUids.has(e.uid))
            .map(e => e.id);
          if (idsToDelete.length > 0) {
            await client.batchDeleteCalendarEvents(idsToDelete);
          }

          // Import only events that don't already exist on server
          const eventsToImport = parsedEvents.filter(e => !e.uid || !existingByUid.has(e.uid));

          // Remove stale local events for this calendar
          set((state) => ({
            events: state.events.filter(e => !e.calendarIds?.[sub.calendarId]),
          }));

          // Import new events
          if (eventsToImport.length > 0) {
            await get().importEvents(client, eventsToImport, sub.calendarId);
          }

          // Re-fetch ALL events from server and filter for this calendar
          const allUpdatedEvents = await client.getCalendarEvents();
          const updatedEvents = allUpdatedEvents.filter(e => e.calendarIds?.[sub.calendarId]);
          set((state) => {
            const otherEvents = state.events.filter(e => !e.calendarIds?.[sub.calendarId]);
            return { events: [...otherEvents, ...updatedEvents] };
          });

          // Update last refreshed timestamp
          set((state) => ({
            icalSubscriptions: state.icalSubscriptions.map(s =>
              s.id === subscriptionId ? { ...s, lastRefreshed: new Date().toISOString() } : s
            ),
          }));
        } catch (error) {
          debug.error('Failed to refresh iCal subscription:', sub.name, error);
          throw error;
        }
      },

      refreshAllSubscriptions: async (client) => {
        const { icalSubscriptions } = get();
        const now = Date.now();

        for (const sub of icalSubscriptions) {
          const lastRefreshed = sub.lastRefreshed ? new Date(sub.lastRefreshed).getTime() : 0;
          const intervalMs = sub.refreshInterval * 60 * 1000;

          if (now - lastRefreshed >= intervalMs) {
            try {
              await get().refreshICalSubscription(client, sub.id);
            } catch {
              debug.warn('Failed to refresh subscription:', sub.name);
            }
          }
        }
      },

      clearState: () => {
        set({
          ...initialState,
          selectedDate: new Date(),
        });
        import('./calendar-notification-store').then(({ useCalendarNotificationStore }) => {
          useCalendarNotificationStore.getState().clearAll();
        }).catch(() => {});
      },
    }),
    {
      name: 'calendar-storage',
      merge: (persistedState, currentState) => {
        const mergedState = {
          ...currentState,
          ...(persistedState as Partial<CalendarStore> | undefined),
        };

        return {
          ...mergedState,
          selectedDate: new Date(),
          viewMode: getSafeCalendarViewMode(mergedState.viewMode),
        };
      },
      partialize: (state) => ({
        selectedCalendarIds: state.selectedCalendarIds,
        viewMode: state.viewMode,
        icalSubscriptions: state.icalSubscriptions,
      }),
    }
  )
);
