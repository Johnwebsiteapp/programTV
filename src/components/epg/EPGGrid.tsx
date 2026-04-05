// ============================================================
// SIATKA EPG — główny widok programu telewizyjnego
//
// Wyświetla siatkę w stylu tradycyjnego programu TV:
// - Pionowo: kanały
// - Poziomo: oś czasu (24 godziny)
// - Komórki: programy jako prostokąty na osi czasu
// ============================================================

import { useRef, useEffect, useCallback, useMemo, useState } from 'react';
import { startOfDay, isSameDay } from 'date-fns';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { ProgramCell } from './ProgramCell';
import { useAppStore, selectVisibleChannels, programMatchesFilters } from '../../store/useAppStore';
import { timeToPixels, durationToPixels, formatTime, generateTimeSlots } from '../../utils/dateUtils';
import clsx from 'clsx';

// ─── STAŁE SIATKI ─────────────────────────────────────────

const CHANNEL_LABEL_WIDTH = 150; // px — szerokość kolumny nazw kanałów
const ROW_HEIGHT = 64;           // px — wysokość wiersza kanału
const TIME_HEADER_HEIGHT = 36;   // px — wysokość nagłówka czasu
const PIXELS_PER_MINUTE = 3;     // px na minutę (1h = 180px, 24h = 4320px)
const TOTAL_DAY_WIDTH = 24 * 60 * PIXELS_PER_MINUTE; // szerokość całej doby

// ─── KOMPONENT ────────────────────────────────────────────

export function EPGGrid() {
  const { programs, currentDate, filters, categories, epgScrollToNow,
          setCurrentDate, setSelectedChannel } = useAppStore();
  const channels = useAppStore(selectVisibleChannels);

  const containerRef = useRef<HTMLDivElement>(null);
  const isToday = isSameDay(currentDate, new Date());

  // Punkt zerowy osi czasu = 00:00 wybranego dnia
  const dayStart = startOfDay(currentDate);

  // Sloty godzin dla nagłówka (co 30 minut)
  const timeSlots = useMemo(() => generateTimeSlots(dayStart, 30), [dayStart]);

  // Programy dla bieżącego dnia (ze wszystkich kanałów)
  // UWAGA: w siatce EPG celowo ignorujemy searchQuery — jest ona tylko dla widoku Szukaj.
  // W EPG filtrujemy tylko po gatunku, live, kategorii i ulubionych kanałach.
  const epgFilters = useMemo(() => ({ ...filters, searchQuery: '' }), [filters]);

  const dayPrograms = useMemo(() => {
    return programs.filter(p => {
      if (!isSameDay(p.startTime, currentDate)) return false;
      return programMatchesFilters(p, epgFilters, categories);
    });
  }, [programs, currentDate, epgFilters, categories]);

  // Indeks programów wg kanału (szybsze wyszukiwanie)
  const programsByChannel = useMemo(() => {
    const map = new Map<string, typeof dayPrograms>();
    for (const p of dayPrograms) {
      const list = map.get(p.channelId) || [];
      list.push(p);
      map.set(p.channelId, list);
    }
    return map;
  }, [dayPrograms]);

  // Pozycja X aktualnej godziny
  const nowPixels = useMemo(() => {
    if (!isToday) return null;
    return timeToPixels(new Date(), dayStart, PIXELS_PER_MINUTE);
  }, [isToday, dayStart]);

  // Przewiń do aktualnej godziny
  const scrollToNow = useCallback(() => {
    if (!containerRef.current || nowPixels === null) return;
    const scrollLeft = nowPixels + CHANNEL_LABEL_WIDTH - containerRef.current.clientWidth / 2;
    containerRef.current.scrollTo({ left: Math.max(0, scrollLeft), behavior: 'smooth' });
  }, [nowPixels]);

  // Automatyczne przewijanie do teraz gdy załaduje się strona
  useEffect(() => {
    if (isToday) {
      const timer = setTimeout(scrollToNow, 200);
      return () => clearTimeout(timer);
    }
  }, [isToday, scrollToNow]);

  // Trigger zewnętrzny (z przycisku "Teraz")
  useEffect(() => {
    if (epgScrollToNow) {
      scrollToNow();
      // Reset triggera
      useAppStore.setState({ epgScrollToNow: false });
    }
  }, [epgScrollToNow, scrollToNow]);

  if (channels.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-gray-400 dark:text-gray-500">
        <span className="text-4xl mb-3">📺</span>
        <p className="text-sm">Brak widocznych kanałów.</p>
        <p className="text-xs mt-1">Włącz kanały w ustawieniach.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Pasek nawigacji dni */}
      <DayNavigation currentDate={currentDate} onDateChange={setCurrentDate} />

      {/* Pasek "Teraz w TV" */}
      {isToday && <NowInTV programs={programs} channels={channels} />}

      {/* Siatka EPG */}
      <div
        ref={containerRef}
        className="epg-container flex-1 border-t border-gray-200 dark:border-slate-700"
        style={{ minHeight: 0 }}
      >
        {/* Szerokość wewnętrzna = kolumna kanałów + cała doba */}
        <div style={{ width: CHANNEL_LABEL_WIDTH + TOTAL_DAY_WIDTH, minWidth: '100%' }}>

          {/* ── Nagłówek czasu ──────────────────────────── */}
          <div className="epg-time-header" style={{ height: TIME_HEADER_HEIGHT }}>
            {/* Lewy górny róg */}
            <div
              className="epg-corner flex items-center justify-center"
              style={{ width: CHANNEL_LABEL_WIDTH }}
            >
              <button
                onClick={scrollToNow}
                disabled={!isToday}
                className={clsx(
                  'text-xs px-2 py-0.5 rounded-full transition-colors font-medium',
                  isToday
                    ? 'bg-primary-100 text-primary-700 hover:bg-primary-200 dark:bg-primary-900/40 dark:text-primary-300'
                    : 'text-gray-300 dark:text-gray-600 cursor-default'
                )}
              >
                {isToday ? '▶ Teraz' : formatTime(new Date())}
              </button>
            </div>

            {/* Etykiety godzin */}
            <div className="relative flex-1" style={{ width: TOTAL_DAY_WIDTH }}>
              {timeSlots.map((slot, i) => (
                <div
                  key={i}
                  className="absolute top-0 bottom-0 flex items-center"
                  style={{ left: timeToPixels(slot, dayStart, PIXELS_PER_MINUTE) }}
                >
                  <span className="text-[11px] text-gray-400 dark:text-gray-500 tabular-nums pl-1.5">
                    {formatTime(slot)}
                  </span>
                </div>
              ))}

              {/* Linia "teraz" w nagłówku */}
              {isToday && nowPixels !== null && (
                <div
                  className="absolute top-0 bottom-0 w-0.5 bg-red-400"
                  style={{ left: nowPixels }}
                />
              )}
            </div>
          </div>

          {/* ── Wiersze kanałów ─────────────────────────── */}
          {channels.map(channel => {
            const channelPrograms = programsByChannel.get(channel.id) || [];

            return (
              <div
                key={channel.id}
                className="epg-channel-row"
                style={{ height: ROW_HEIGHT }}
              >
                {/* Nazwa kanału (sticky left) — klikalny */}
                <div
                  className="epg-channel-label cursor-pointer hover:bg-primary-50 dark:hover:bg-primary-900/20 transition-colors group"
                  style={{ width: CHANNEL_LABEL_WIDTH }}
                  onClick={() => setSelectedChannel(channel)}
                  title={`${channel.name} — kliknij aby zobaczyć pełny program`}
                >
                  <span className="text-lg flex-shrink-0">{channel.logoEmoji}</span>
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-gray-700 dark:text-gray-200 truncate group-hover:text-primary-700 dark:group-hover:text-primary-300 transition-colors">
                      {channel.name}
                    </p>
                  </div>
                </div>

                {/* Ścieżka programów (relatywna — programy absolutne) */}
                <div
                  className="epg-programs-track relative"
                  style={{ width: TOTAL_DAY_WIDTH, height: ROW_HEIGHT }}
                >
                  {/* Pionowe linie godzin co 30 minut */}
                  {timeSlots.map((slot, i) => (
                    <div
                      key={i}
                      className="epg-grid-line"
                      style={{ left: timeToPixels(slot, dayStart, PIXELS_PER_MINUTE) }}
                    />
                  ))}

                  {/* Linia "teraz" */}
                  {isToday && nowPixels !== null && (
                    <div className="epg-now-line" style={{ left: nowPixels }}>
                      <div className="epg-now-dot" />
                    </div>
                  )}

                  {/* Programy */}
                  {channelPrograms.map(program => {
                    const leftPx = timeToPixels(program.startTime, dayStart, PIXELS_PER_MINUTE);
                    const widthPx = durationToPixels(program.startTime, program.endTime, PIXELS_PER_MINUTE);
                    return (
                      <ProgramCell
                        key={program.id}
                        program={program}
                        leftPx={leftPx}
                        widthPx={widthPx}
                      />
                    );
                  })}

                  {/* Informacja gdy brak programów */}
                  {channelPrograms.length === 0 && (
                    <div className="absolute inset-0 flex items-center px-4">
                      <span className="text-xs text-gray-300 dark:text-gray-600">
                        Brak danych dla tego dnia
                      </span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─── NAWIGACJA DNI ────────────────────────────────────────

function DayNavigation({
  currentDate,
  onDateChange,
}: {
  currentDate: Date;
  onDateChange: (d: Date) => void;
}) {
  // Generuj 8 dni: wczoraj + dziś + 6 następnych
  const days = useMemo(() => {
    const result: Date[] = [];
    for (let i = -1; i <= 6; i++) {
      const d = new Date();
      d.setDate(d.getDate() + i);
      result.push(startOfDay(d));
    }
    return result;
  }, []);

  const dayNames = ['Nd', 'Pn', 'Wt', 'Śr', 'Cz', 'Pt', 'Sb'];
  const today = startOfDay(new Date());

  return (
    <div className="flex items-center gap-1 px-3 py-2 bg-white dark:bg-slate-800 border-b border-gray-200 dark:border-slate-700 overflow-x-auto">
      <button
        onClick={() => onDateChange(new Date(currentDate.getTime() - 86400000))}
        className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 flex-shrink-0"
      >
        <ChevronLeft size={16} />
      </button>

      <div className="flex gap-1 flex-1 overflow-x-auto no-scrollbar">
        {days.map(day => {
          const isCurrentDay = isSameDay(day, currentDate);
          const isToday = isSameDay(day, today);
          const dd = day.getDate();
          const dayName = isToday ? 'Dziś' : dayNames[day.getDay()];

          return (
            <button
              key={day.toISOString()}
              onClick={() => onDateChange(day)}
              className={clsx(
                'flex-shrink-0 flex flex-col items-center justify-center w-12 h-12 rounded-xl text-xs transition-all',
                isCurrentDay
                  ? 'bg-primary-600 text-white font-bold'
                  : isToday
                  ? 'bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 font-medium'
                  : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
              )}
            >
              <span className="text-[10px] leading-none">{dayName}</span>
              <span className="text-sm font-bold leading-tight">{dd}</span>
            </button>
          );
        })}
      </div>

      <button
        onClick={() => onDateChange(new Date(currentDate.getTime() + 86400000))}
        className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 flex-shrink-0"
      >
        <ChevronRight size={16} />
      </button>
    </div>
  );
}

// ─── PASEK "TERAZ W TV" ───────────────────────────────────

function NowInTV({ programs, channels }: {
  programs: import('../../types').Program[];
  channels: import('../../types').Channel[];
}) {
  // Odświeżamy "teraz" co minutę — dzięki temu pasek aktualizuje się
  // automatycznie gdy jeden program kończy się, a zaczyna się następny.
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);

  // Znajdź po 1 aktualnym programie dla top 8 kanałów
  const livePrograms = useMemo(() => {
    return channels
      .slice(0, 8)
      .map(ch => ({
        channel: ch,
        program: programs.find(
          p => p.channelId === ch.id && p.startTime <= now && p.endTime > now
        ),
      }))
      .filter(item => item.program);
  }, [programs, channels, now]);

  if (livePrograms.length === 0) return null;

  return (
    <div className="bg-gradient-to-r from-primary-600 to-primary-700 dark:from-primary-800 dark:to-primary-900 px-4 py-2">
      <div className="flex items-center gap-3 overflow-x-auto no-scrollbar">
        <span className="text-xs font-bold text-white/80 whitespace-nowrap flex-shrink-0 flex items-center gap-1">
          <span className="w-1.5 h-1.5 bg-red-400 rounded-full animate-live-pulse" />
          TERAZ W TV
        </span>
        {livePrograms.map(({ channel, program }) => (
          <div
            key={channel.id}
            className="flex-shrink-0 flex items-center gap-1.5 bg-white/10 hover:bg-white/20 px-2.5 py-1 rounded-lg cursor-pointer transition-colors"
            onClick={() => useAppStore.getState().setSelectedProgram(program!)}
          >
            <span className="text-sm">{channel.logoEmoji}</span>
            <div className="min-w-0">
              <p className="text-[11px] font-medium text-white truncate max-w-[120px]">
                {program!.title}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
