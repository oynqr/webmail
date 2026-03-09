'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Calendar,
  CalendarCheck,
  CalendarX,
  Clock,
  MapPin,
  Users,
  Loader2,
  Check,
  HelpCircle,
  X,
  AlertCircle,
  ChevronDown,
} from 'lucide-react';
import { useTranslations, useFormatter } from 'next-intl';
import { useAuthStore } from '@/stores/auth-store';
import { useCalendarStore } from '@/stores/calendar-store';
import type { Email, CalendarEvent } from '@/lib/jmap/types';
import {
  findCalendarAttachment,
  getInvitationMethod,
  formatEventSummary,
  findParticipantByEmail,
} from '@/lib/calendar-invitation';
import { cn } from '@/lib/utils';
import { sanitizeColor } from '@/components/calendar/event-card';

interface CalendarInvitationBannerProps {
  email: Email;
}

type BannerState = 'loading' | 'parsed' | 'rsvp-sent' | 'imported' | 'error';

export function CalendarInvitationBanner({ email }: CalendarInvitationBannerProps) {
  const t = useTranslations('email_viewer.calendar_invitation');
  const format = useFormatter();
  const client = useAuthStore((s) => s.client);
  const currentUserEmail = useAuthStore((s) => s.primaryIdentity?.email);
  const { calendars, supportsCalendar, importEvents, rsvpEvent, events: storeEvents } = useCalendarStore();

  const [state, setState] = useState<BannerState>('loading');
  const [parsedEvent, setParsedEvent] = useState<Partial<CalendarEvent> | null>(null);
  const [rsvpStatus, setRsvpStatus] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showCalendarPicker, setShowCalendarPicker] = useState(false);
  const [selectedCalendarId, setSelectedCalendarId] = useState<string>('');

  const attachment = findCalendarAttachment(email);

  const parseEvent = useCallback(async () => {
    if (!client || !attachment) return;
    setState('loading');
    try {
      const events = await client.parseCalendarEvents(client.getCalendarsAccountId(), attachment.blobId);
      if (events.length > 0) {
        const parsed = events[0];
        setParsedEvent(parsed);
        if (parsed.uid && supportsCalendar) {
          const storeHasIt = useCalendarStore.getState().events.some((e) => e.uid === parsed.uid);
          if (!storeHasIt) {
            try {
              const serverEvents = await client.queryCalendarEvents({});
              const matching = serverEvents.filter((e) => e.uid === parsed.uid);
              if (matching.length > 0) {
                useCalendarStore.setState((s) => {
                  const existingIds = new Set(s.events.map((e) => e.id));
                  const newEvents = matching.filter((e) => !existingIds.has(e.id));
                  return newEvents.length > 0 ? { events: [...s.events, ...newEvents] } : s;
                });
              }
            } catch { /* ignore lookup failure */ }
          }
        }
        setState('parsed');
      } else {
        setState('error');
      }
    } catch {
      setState('error');
    }
  }, [client, attachment, supportsCalendar]);

  useEffect(() => {
    if (attachment) {
      parseEvent();
    }
  }, [email.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (calendars.length > 0 && !selectedCalendarId) {
      const defaultCal = calendars.find((c) => c.isDefault) || calendars[0];
      setSelectedCalendarId(defaultCal.id);
    }
  }, [calendars, selectedCalendarId]);

  if (!attachment) return null;

  const method = parsedEvent ? getInvitationMethod(parsedEvent) : 'unknown';
  const summary = parsedEvent ? formatEventSummary(parsedEvent) : null;
  const isCancellation = method === 'cancel';

  const existingEvent = parsedEvent?.uid
    ? storeEvents.find((e) => e.uid === parsedEvent.uid)
    : null;

  const myParticipantParsed = parsedEvent && currentUserEmail
    ? findParticipantByEmail(parsedEvent, currentUserEmail)
    : null;

  const myParticipantServer = existingEvent && currentUserEmail
    ? findParticipantByEmail(existingEvent, currentUserEmail)
    : null;

  const myParticipant = myParticipantServer || myParticipantParsed;

  const currentRsvp = rsvpStatus
    || myParticipantServer?.participant.participationStatus
    || myParticipantParsed?.participant.participationStatus
    || null;

  const handleRsvp = async (status: 'accepted' | 'tentative' | 'declined') => {
    if (!client || !parsedEvent || isProcessing) return;
    const calId = selectedCalendarId || calendars.find((c) => c.isDefault)?.id || calendars[0]?.id;
    setIsProcessing(true);

    try {
      if (existingEvent && myParticipant) {
        await rsvpEvent(client, existingEvent.id, myParticipant.id, status);
        setRsvpStatus(status);
        setState('rsvp-sent');
      } else if (calId) {
        const imported = await importEvents(client, [parsedEvent], calId);
        if (imported > 0) {
          const newEvent = useCalendarStore.getState().events.find(
            (e) => e.uid === parsedEvent.uid
          );
          const participant = myParticipant
            || (newEvent && currentUserEmail ? findParticipantByEmail(newEvent, currentUserEmail) : null);
          if (newEvent && participant) {
            await rsvpEvent(client, newEvent.id, participant.id, status);
          }
          setRsvpStatus(status);
          setState('rsvp-sent');
        } else {
          setState('error');
        }
      } else {
        setState('error');
      }
    } catch {
      setState('error');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleImport = async (calendarId?: string) => {
    const calId = calendarId || selectedCalendarId || calendars.find((c) => c.isDefault)?.id || calendars[0]?.id;
    if (!client || !parsedEvent || !calId || isProcessing) {
      if (!calId) setState('error');
      return;
    }
    setIsProcessing(true);
    try {
      const count = await importEvents(client, [parsedEvent], calId);
      if (count > 0) {
        setState('imported');
      } else {
        setState('error');
      }
    } catch {
      setState('error');
    } finally {
      setIsProcessing(false);
    }
  };

  const formatDateTime = (dateStr: string | null) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return dateStr;
    return format.dateTime(date, {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  if (state === 'loading') {
    return (
      <div className="flex items-center gap-2">
        <Calendar className="w-3.5 h-3.5 text-primary" />
        <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground" />
        <span className="text-sm text-muted-foreground">{t('loading')}</span>
      </div>
    );
  }

  if (state === 'error') {
    return (
      <div className="flex items-center gap-2">
        <AlertCircle className="w-3.5 h-3.5 text-red-600 dark:text-red-400" />
        <span className="text-sm text-red-600 dark:text-red-400">{t('parse_error')}</span>
      </div>
    );
  }

  if (state === 'imported') {
    return (
      <div className="flex items-center gap-2">
        <CalendarCheck className="w-3.5 h-3.5 text-green-600 dark:text-green-400" />
        <span className="text-sm text-muted-foreground">{t('added')}</span>
      </div>
    );
  }

  if (state === 'rsvp-sent') {
    return (
      <div className="flex items-center gap-2">
        <CalendarCheck className="w-3.5 h-3.5 text-green-600 dark:text-green-400" />
        <span className="text-sm text-muted-foreground">{t('rsvp_sent')}</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {/* Event info row */}
      <div className="flex items-start gap-2 flex-wrap">
        {isCancellation ? (
          <CalendarX className="w-4 h-4 text-red-600 dark:text-red-400 mt-0.5 flex-shrink-0" />
        ) : (
          <Calendar className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
        )}

        <div className="flex-1 min-w-0 space-y-0.5">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={cn(
              "text-sm font-medium",
              isCancellation ? "line-through text-muted-foreground" : "text-foreground"
            )}>
              {isCancellation ? t('cancelled_title') : t('title')}
              {summary?.title && `: ${summary.title}`}
            </span>
          </div>

          <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
            {summary?.start && (
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {formatDateTime(summary.start)}
                {summary.end && ` – ${formatDateTime(summary.end)}`}
              </span>
            )}
            {summary?.location && (
              <span className="flex items-center gap-1">
                <MapPin className="w-3 h-3" />
                {summary.location}
              </span>
            )}
            {summary?.organizer && (
              <span>{t('organizer', { name: summary.organizer })}</span>
            )}
            {summary && summary.attendeeCount > 0 && (
              <span className="flex items-center gap-1">
                <Users className="w-3 h-3" />
                {t('attendees', { count: summary.attendeeCount })}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Action row */}
      {!isCancellation && (
        <div className="flex items-center gap-2 ml-6 flex-wrap">
          {supportsCalendar && myParticipant && (
            <>
              <button
                onClick={() => handleRsvp('accepted')}
                disabled={isProcessing}
                aria-pressed={currentRsvp === 'accepted'}
                className={cn(
                  "flex items-center gap-1 text-sm px-2 py-0.5 rounded-md transition-colors duration-150 min-h-[44px] md:min-h-0 disabled:opacity-50",
                  currentRsvp === 'accepted'
                    ? "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 font-medium"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted"
                )}
              >
                <Check className="w-3.5 h-3.5" />
                {t('accept')}
              </button>
              <button
                onClick={() => handleRsvp('tentative')}
                disabled={isProcessing}
                aria-pressed={currentRsvp === 'tentative'}
                className={cn(
                  "flex items-center gap-1 text-sm px-2 py-0.5 rounded-md transition-colors duration-150 min-h-[44px] md:min-h-0 disabled:opacity-50",
                  currentRsvp === 'tentative'
                    ? "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 font-medium"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted"
                )}
              >
                <HelpCircle className="w-3.5 h-3.5" />
                {t('maybe')}
              </button>
              <button
                onClick={() => handleRsvp('declined')}
                disabled={isProcessing}
                aria-pressed={currentRsvp === 'declined'}
                className={cn(
                  "flex items-center gap-1 text-sm px-2 py-0.5 rounded-md transition-colors duration-150 min-h-[44px] md:min-h-0 disabled:opacity-50",
                  currentRsvp === 'declined'
                    ? "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 font-medium"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted"
                )}
              >
                <X className="w-3.5 h-3.5" />
                {t('decline')}
              </button>

              <div className="w-px h-4 bg-border" />
            </>
          )}

          {supportsCalendar && existingEvent && !myParticipant && (
            <span className="flex items-center gap-1 text-sm text-muted-foreground">
              <CalendarCheck className="w-3.5 h-3.5 text-green-600 dark:text-green-400" />
              {t('already_in_calendar')}
            </span>
          )}

          {supportsCalendar && !existingEvent && (
            <div className="relative">
              <button
                onClick={() => {
                  if (calendars.length <= 1) {
                    handleImport();
                  } else {
                    setShowCalendarPicker(!showCalendarPicker);
                  }
                }}
                disabled={isProcessing}
                className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground hover:bg-muted px-2 py-0.5 rounded-md transition-colors duration-150 min-h-[44px] md:min-h-0 disabled:opacity-50"
              >
                <CalendarCheck className="w-3.5 h-3.5" />
                {t('add_to_calendar')}
                {calendars.length > 1 && <ChevronDown className="w-3 h-3" />}
              </button>

              {showCalendarPicker && calendars.length > 1 && (
                <div className="absolute left-0 top-full mt-1 w-52 bg-background rounded-md shadow-lg border border-border z-10 py-1">
                  <div className="px-3 py-1.5 text-xs font-medium text-muted-foreground">
                    {t('select_calendar')}
                  </div>
                  {calendars.map((cal) => (
                    <button
                      key={cal.id}
                      onClick={() => {
                        setShowCalendarPicker(false);
                        handleImport(cal.id);
                      }}
                      className="w-full px-3 py-1.5 text-sm text-left hover:bg-muted flex items-center gap-2"
                    >
                      <span
                        className="w-3 h-3 rounded-full flex-shrink-0"
                        style={{ backgroundColor: sanitizeColor(cal.color) }}
                      />
                      <span className="truncate text-foreground">{cal.name}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {!supportsCalendar && (
            <span className="text-xs text-muted-foreground italic">{t('no_calendar')}</span>
          )}
        </div>
      )}
    </div>
  );
}
