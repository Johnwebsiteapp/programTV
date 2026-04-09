// ============================================================
// WIDOK KANAŁU — pełny rozkład programu wybranego kanału
// Otwiera się po kliknięciu na nazwę kanału w siatce EPG.
// Pokazuje programy pogrupowane po dniach z możliwością
// ustawienia przypomnienia bezpośrednio z listy.
// ============================================================

import { useState, useMemo, useRef } from 'react';
import { X, Bell, BellOff, ChevronLeft, ChevronRight, Heart, Clock, ChevronDown } from 'lucide-react';
import { startOfDay, isSameDay, addDays, format, isToday, isTomorrow } from 'date-fns';
import { pl } from 'date-fns/locale';
import { useAppStore } from '../../store/useAppStore';
import { GenreBadge } from '../ui/Badge';
import { formatTime, formatDuration, isNowPlaying, isFinished, NOTIFICATION_OPTIONS } from '../../utils/dateUtils';
import { useAnimatedMount } from '../../utils/useAnimatedMount';
import clsx from 'clsx';

export function ChannelView() {
  const {
    selectedChannel, setSelectedChannel,
    programs, setSelectedProgram,
    isFavoriteProgram, addFavorite, removeFavorite, favorites,
    hasNotification, addNotification, removeNotification, notifications,
    toggleFavoriteChannel,
  } = useAppStore();

  const [viewDate, setViewDate] = useState<Date>(startOfDay(new Date()));
  // Dla którego programu pokazywane są opcje powiadomień
  const [notifOpenFor, setNotifOpenFor] = useState<string | null>(null);

  // Animacja wejścia/wyjścia panelu
  const { mounted, visible } = useAnimatedMount(!!selectedChannel, 350);
  // Zachowaj ostatni kanał podczas animacji wyjścia (ref aktualizowany synchronicznie)
  const lastChannelRef = useRef(selectedChannel);
  if (selectedChannel) lastChannelRef.current = selectedChannel;

  // Programy dla wybranego kanału i dnia (hooki przed early return!)
  const dayPrograms = useMemo(() => {
    if (!selectedChannel) return [];
    return programs
      .filter(p => p.channelId === selectedChannel.id && isSameDay(p.startTime, viewDate))
      .sort((a, b) => a.startTime.getTime() - b.startTime.getTime());
  }, [programs, selectedChannel, viewDate]);

  // Dostępne dni (te dla których mamy programy)
  const availableDays = useMemo(() => {
    if (!selectedChannel) return [];
    const days = new Set<string>();
    programs
      .filter(p => p.channelId === selectedChannel.id)
      .forEach(p => days.add(startOfDay(p.startTime).toISOString()));
    return Array.from(days)
      .map(d => new Date(d))
      .sort((a, b) => a.getTime() - b.getTime());
  }, [programs, selectedChannel]);

  if (!mounted || !lastChannelRef.current) return null;

  const channel = lastChannelRef.current;
  const now = new Date();

  const currentDayIndex = availableDays.findIndex(d => isSameDay(d, viewDate));

  function dayLabel(date: Date) {
    if (isToday(date)) return 'Dziś';
    if (isTomorrow(date)) return 'Jutro';
    return format(date, 'EEEE, d MMM', { locale: pl });
  }

  function handleNotifToggle(programId: string) {
    if (hasNotification(programId)) {
      const notif = notifications.find(n => n.programId === programId && !n.fired);
      if (notif) removeNotification(notif.id);
      setNotifOpenFor(null);
    } else {
      setNotifOpenFor(prev => prev === programId ? null : programId);
    }
  }

  function handleNotifSet(program: import('../../types').Program, minutes: number) {
    addNotification(program, minutes);
    setNotifOpenFor(null);
  }

  const isFavChannel = channel.isFavorite;

  return (
    <>
      {/* Overlay */}
      <div
        className={clsx(
          'fixed inset-0 bg-black/40 z-[65] modal-backdrop',
          visible ? 'modal-visible' : 'modal-hidden'
        )}
        onClick={() => setSelectedChannel(null)}
      />

      {/* Panel — wysuwa się z prawej */}
      <div className={clsx(
        'fixed inset-y-0 right-0 w-full max-w-md bg-white dark:bg-slate-900 z-[66] flex flex-col shadow-2xl panel-slide',
        visible ? 'panel-visible' : 'panel-hidden'
      )}>

        {/* Nagłówek kanału */}
        <div className="bg-primary-600 dark:bg-primary-800 px-4 pt-5 pb-4 flex-shrink-0">
          <div className="flex items-center justify-between mb-3">
            <button
              onClick={() => setSelectedChannel(null)}
              className="p-1.5 rounded-lg text-white/70 hover:text-white hover:bg-white/10 transition-colors"
            >
              <X size={18} />
            </button>

            {/* Ulubiony kanał */}
            <button
              onClick={() => toggleFavoriteChannel(channel.id)}
              className={clsx(
                'flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full transition-colors',
                isFavChannel
                  ? 'bg-white/20 text-white'
                  : 'text-white/70 hover:text-white hover:bg-white/10'
              )}
            >
              <Heart size={13} className={isFavChannel ? 'fill-current' : ''} />
              {isFavChannel ? 'Ulubiony' : 'Dodaj do ulubionych'}
            </button>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-4xl">{channel.logoEmoji}</span>
            <div>
              <h2 className="text-xl font-bold text-white">{channel.name}</h2>
              {channel.description && (
                <p className="text-sm text-white/70 mt-0.5">{channel.description}</p>
              )}
            </div>
          </div>
        </div>

        {/* Nawigacja dni */}
        <div className="flex items-center gap-2 px-4 py-3 bg-gray-50 dark:bg-slate-800 border-b border-gray-200 dark:border-slate-700 flex-shrink-0">
          <button
            onClick={() => currentDayIndex > 0 && setViewDate(availableDays[currentDayIndex - 1])}
            disabled={currentDayIndex <= 0}
            className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-200 dark:hover:bg-gray-700 disabled:opacity-30 disabled:cursor-default transition-colors"
          >
            <ChevronLeft size={16} />
          </button>

          <div className="flex-1 flex gap-1 overflow-x-auto no-scrollbar">
            {availableDays.map(day => (
              <button
                key={day.toISOString()}
                onClick={() => setViewDate(day)}
                className={clsx(
                  'flex-shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium transition-all whitespace-nowrap',
                  isSameDay(day, viewDate)
                    ? 'bg-primary-600 text-white'
                    : 'text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
                )}
              >
                {dayLabel(day)}
              </button>
            ))}
          </div>

          <button
            onClick={() => currentDayIndex < availableDays.length - 1 && setViewDate(availableDays[currentDayIndex + 1])}
            disabled={currentDayIndex >= availableDays.length - 1}
            className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-200 dark:hover:bg-gray-700 disabled:opacity-30 disabled:cursor-default transition-colors"
          >
            <ChevronRight size={16} />
          </button>
        </div>

        {/* Lista programów */}
        <div className="flex-1 overflow-y-auto">
          {dayPrograms.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-gray-400 dark:text-gray-500">
              <span className="text-4xl mb-3">📭</span>
              <p className="text-sm">Brak danych programowych dla tego dnia</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100 dark:divide-slate-700/50">
              {dayPrograms.map(program => {
                const isLive = isNowPlaying(program.startTime, program.endTime, now);
                const isDone = isFinished(program.endTime, now);
                const isFav = isFavoriteProgram(program.id);
                const hasNotif = hasNotification(program.id);
                const notif = notifications.find(n => n.programId === program.id && !n.fired);
                const duration = formatDuration(program.startTime, program.endTime);
                const notifOpen = notifOpenFor === program.id;

                return (
                  <div
                    key={program.id}
                    className={clsx(
                      'px-4 py-3',
                      isLive && 'bg-primary-50 dark:bg-primary-900/10',
                      isDone && 'opacity-50'
                    )}
                  >
                    <div className="flex items-start gap-3">
                      {/* Godzina */}
                      <div className="w-12 flex-shrink-0 pt-0.5">
                        <span className={clsx(
                          'text-sm font-bold tabular-nums',
                          isLive ? 'text-primary-600 dark:text-primary-400' : 'text-gray-700 dark:text-gray-300'
                        )}>
                          {formatTime(program.startTime)}
                        </span>
                        {isLive && (
                          <div className="flex items-center gap-1 mt-0.5">
                            <span className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse" />
                            <span className="text-[10px] font-bold text-red-500">LIVE</span>
                          </div>
                        )}
                      </div>

                      {/* Treść programu */}
                      <div
                        className="flex-1 min-w-0 cursor-pointer"
                        onClick={() => setSelectedProgram(program)}
                      >
                        <div className="flex items-center gap-2 flex-wrap mb-0.5">
                          <GenreBadge genre={program.genre} />
                        </div>
                        <p className={clsx(
                          'text-sm font-semibold leading-snug',
                          isLive ? 'text-primary-700 dark:text-primary-300' : 'text-gray-900 dark:text-white'
                        )}>
                          {program.title}
                        </p>
                        <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5 flex items-center gap-1">
                          <Clock size={10} />
                          {formatTime(program.startTime)}–{formatTime(program.endTime)}
                          <span>·</span>
                          {duration}
                        </p>
                      </div>

                      {/* Przyciski akcji */}
                      <div className="flex items-center gap-1 flex-shrink-0">
                        {/* Ulubione */}
                        <button
                          onClick={() => {
                            const fav = favorites.find(f => f.programId === program.id);
                            if (isFav && fav) removeFavorite(fav.id);
                            else addFavorite(program);
                          }}
                          className={clsx(
                            'p-1.5 rounded-lg transition-colors',
                            isFav
                              ? 'text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20'
                              : 'text-gray-300 dark:text-gray-600 hover:text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700'
                          )}
                          title={isFav ? 'Usuń z ulubionych' : 'Dodaj do ulubionych'}
                        >
                          <Heart size={14} className={isFav ? 'fill-current' : ''} />
                        </button>

                        {/* Powiadomienie */}
                        {!isDone && (
                          <button
                            onClick={() => handleNotifToggle(program.id)}
                            className={clsx(
                              'p-1.5 rounded-lg transition-colors',
                              hasNotif
                                ? 'text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20'
                                : 'text-gray-300 dark:text-gray-600 hover:text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700'
                            )}
                            title={hasNotif
                              ? `Przypomnienie: ${NOTIFICATION_OPTIONS.find(o => o.value === notif?.minutesBefore)?.label}`
                              : 'Ustaw przypomnienie'
                            }
                          >
                            {hasNotif
                              ? <Bell size={14} className="fill-current" />
                              : <BellOff size={14} />
                            }
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Rozwijane opcje czasu powiadomienia */}
                    {notifOpen && !isDone && !hasNotif && (
                      <div className="mt-2 ml-15 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-600 rounded-xl shadow-md overflow-hidden">
                        <p className="px-3 pt-2 pb-1 text-[11px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide">
                          Przypomnij przed startem
                        </p>
                        {NOTIFICATION_OPTIONS.map(opt => {
                          const scheduledAt = new Date(program.startTime.getTime() - opt.value * 60 * 1000);
                          const isPast = scheduledAt < now;
                          return (
                            <button
                              key={opt.value}
                              onClick={() => !isPast && handleNotifSet(program, opt.value)}
                              disabled={isPast}
                              className={clsx(
                                'flex items-center gap-2 w-full px-3 py-2 text-sm text-left transition-colors',
                                isPast
                                  ? 'text-gray-300 dark:text-gray-600 cursor-not-allowed'
                                  : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                              )}
                            >
                              <Bell size={12} />
                              {opt.label}
                              {isPast && <span className="ml-auto text-xs text-gray-300">minął termin</span>}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
