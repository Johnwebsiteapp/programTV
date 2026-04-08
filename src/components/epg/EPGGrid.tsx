// ============================================================
// EPG — lista pionowa w stylu Telemagazyn
// Kanały jako zwijane sekcje, programy ułożone pionowo
// ============================================================

import { useEffect, useMemo, useState } from 'react';
import { startOfDay, isSameDay } from 'date-fns';
import { ChevronUp, ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react';
import { useAppStore, selectVisibleChannels, programMatchesFilters } from '../../store/useAppStore';
import { formatTime } from '../../utils/dateUtils';
import { GENRE_LABELS } from '../ui/Badge';
import type { Program, Channel } from '../../types';
import clsx from 'clsx';

// ─── GŁÓWNY KOMPONENT ─────────────────────────────────────

export function EPGGrid() {
  const { programs, currentDate, filters, categories, setCurrentDate } = useAppStore();
  const channels = useAppStore(selectVisibleChannels);

  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(id);
  }, []);

  const isToday = isSameDay(currentDate, new Date());
  const epgFilters = useMemo(() => ({ ...filters, searchQuery: '' }), [filters]);

  const dayPrograms = useMemo(() => {
    return programs.filter(p => {
      if (!isSameDay(p.startTime, currentDate)) return false;
      return programMatchesFilters(p, epgFilters, categories);
    });
  }, [programs, currentDate, epgFilters, categories]);

  const programsByChannel = useMemo(() => {
    const map = new Map<string, Program[]>();
    for (const p of dayPrograms) {
      const list = map.get(p.channelId) ?? [];
      list.push(p);
      map.set(p.channelId, list);
    }
    return map;
  }, [dayPrograms]);

  if (channels.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-gray-400">
        <span className="text-4xl mb-3">📺</span>
        <p className="text-sm">Brak widocznych kanałów.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <DayNavigation currentDate={currentDate} onDateChange={setCurrentDate} />
      {isToday && <NowStrip programs={programs} channels={channels} now={now} />}
      <div className="flex-1 overflow-y-auto bg-white dark:bg-slate-950">
        {channels.map(channel => (
          <ChannelSection
            key={channel.id}
            channel={channel}
            programs={programsByChannel.get(channel.id) ?? []}
            now={now}
            isToday={isToday}
          />
        ))}
        <div className="h-4" />
      </div>
    </div>
  );
}

// ─── SEKCJA KANAŁU ────────────────────────────────────────

function ChannelSection({ channel, programs, now, isToday }: {
  channel: Channel;
  programs: Program[];
  now: Date;
  isToday: boolean;
}) {
  const { setSelectedChannel, setSelectedProgram } = useAppStore();
  const [collapsed, setCollapsed] = useState(false);

  // Pokaż tylko programy od teraz (lub wszystkie dla innych dni)
  const visiblePrograms = useMemo(() => {
    const sorted = [...programs].sort((a, b) => a.startTime.getTime() - b.startTime.getTime());
    if (!isToday) return sorted;
    // Dziś: pokaż aktualny + następne (od 1h przed)
    const cutoff = new Date(now.getTime() - 60 * 60 * 1000);
    return sorted.filter(p => p.endTime > cutoff);
  }, [programs, now, isToday]);

  return (
    <div className="border-b border-gray-100 dark:border-slate-800">
      {/* ── Nagłówek kanału ─────────────────────────── */}
      <div className="flex items-center bg-white dark:bg-slate-900 sticky top-0 z-10 border-b border-gray-100 dark:border-slate-800">
        {/* Kliknięcie w logo/nazwę → pełny program kanału */}
        <button
          className="flex items-center gap-2.5 flex-1 px-3 py-2.5 text-left hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors"
          onClick={() => setSelectedChannel(channel)}
        >
          <span className="text-xl w-8 text-center flex-shrink-0">{channel.logoEmoji}</span>
          <span className="font-bold text-sm text-gray-900 dark:text-white">{channel.name}</span>
        </button>

        {/* Przycisk zwijania */}
        <button
          className="px-3 py-2.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
          onClick={() => setCollapsed(c => !c)}
        >
          {collapsed ? <ChevronDown size={18} /> : <ChevronUp size={18} />}
        </button>
      </div>

      {/* ── Lista programów ──────────────────────────── */}
      {!collapsed && (
        <div className="bg-white dark:bg-slate-900">
          {visiblePrograms.length === 0 ? (
            <p className="text-xs text-gray-400 px-4 py-3">Brak danych programowych</p>
          ) : (
            visiblePrograms.map(program => (
              <ProgramRow
                key={program.id}
                program={program}
                now={now}
                onSelect={() => setSelectedProgram(program)}
              />
            ))
          )}
        </div>
      )}
    </div>
  );
}

// ─── WIERSZ PROGRAMU ──────────────────────────────────────

function ProgramRow({ program, now, onSelect }: {
  program: Program;
  now: Date;
  onSelect: () => void;
}) {
  const isLive  = program.startTime <= now && program.endTime > now;
  const isDone  = program.endTime <= now;
  const progress = isLive
    ? Math.round(((now.getTime() - program.startTime.getTime()) /
        (program.endTime.getTime() - program.startTime.getTime())) * 100)
    : 0;

  return (
    <button
      onClick={onSelect}
      className={clsx(
        'w-full text-left border-b border-gray-50 dark:border-slate-800',
        'hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors',
        isDone && 'opacity-40'
      )}
    >
      <div className="flex items-start gap-3 px-3 pt-2.5 pb-1.5">
        {/* Godzina */}
        <div className="flex-shrink-0 mt-0.5">
          <span className={clsx(
            'inline-block text-xs font-bold px-1.5 py-0.5 rounded',
            isLive
              ? 'bg-primary-600 text-white'
              : 'bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-gray-300'
          )}>
            {formatTime(program.startTime)}
          </span>
        </div>

        {/* Treść */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={clsx(
              'text-sm font-bold leading-snug',
              isLive ? 'text-gray-900 dark:text-white' : 'text-gray-700 dark:text-gray-200'
            )}>
              {program.title}
            </span>
            {program.isLive && (
              <span className="text-[10px] font-bold bg-primary-600 text-white px-1.5 py-0.5 rounded">
                NA ŻYWO
              </span>
            )}
            {program.isPremiere && (
              <span className="text-[10px] font-bold bg-amber-500 text-white px-1.5 py-0.5 rounded">
                PREMIERA
              </span>
            )}
          </div>

          {/* Info pod tytułem */}
          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
            {program.episode?.episode && (
              <span className="text-xs text-gray-500 dark:text-gray-400">
                Odcinek{' '}
                <span className={clsx('font-semibold', isLive && 'text-primary-600 dark:text-primary-400')}>
                  {program.episode.episode}
                </span>
                {program.episode.season && (
                  <> Sezon <span className={clsx('font-semibold', isLive && 'text-primary-600 dark:text-primary-400')}>{program.episode.season}</span></>
                )}
              </span>
            )}
            <span className="text-xs text-gray-400 dark:text-gray-500">
              {GENRE_LABELS[program.genre] ?? program.genre}
            </span>
          </div>
        </div>

        {/* "● Trwa" z prawej */}
        {isLive && (
          <div className="flex-shrink-0 flex items-center gap-1 mt-1">
            <span className="w-1.5 h-1.5 bg-primary-500 rounded-full animate-live-pulse" />
            <span className="text-xs font-semibold text-primary-600 dark:text-primary-400">Trwa</span>
          </div>
        )}
      </div>

      {/* Pasek postępu dla aktualnego programu */}
      {isLive && (
        <div className="mx-3 mb-2 h-1 bg-gray-100 dark:bg-slate-700 rounded-full overflow-hidden">
          <div
            className="h-full bg-primary-500 rounded-full transition-all duration-1000"
            style={{ width: `${progress}%` }}
          />
        </div>
      )}
    </button>
  );
}

// ─── PASEK "TERAZ NA ŻYWO" ────────────────────────────────

function NowStrip({ programs, channels, now }: {
  programs: Program[];
  channels: Channel[];
  now: Date;
}) {
  const livePrograms = useMemo(() =>
    channels.slice(0, 8).map(ch => ({
      channel: ch,
      program: programs.find(p => p.channelId === ch.id && p.startTime <= now && p.endTime > now),
    })).filter(x => x.program),
  [programs, channels, now]);

  if (livePrograms.length === 0) return null;

  return (
    <div className="bg-gradient-to-r from-primary-600 to-primary-700 dark:from-primary-800 dark:to-primary-900 px-4 py-2">
      <div className="flex items-center gap-3 overflow-x-auto no-scrollbar">
        <span className="text-xs font-bold text-white/80 whitespace-nowrap flex-shrink-0 flex items-center gap-1">
          <span className="w-1.5 h-1.5 bg-red-400 rounded-full animate-live-pulse" />
          TERAZ W TV
        </span>
        {livePrograms.map(({ channel, program }) => (
          <button
            key={channel.id}
            className="flex-shrink-0 flex items-center gap-1.5 bg-white/10 hover:bg-white/20 px-2.5 py-1 rounded-lg transition-colors"
            onClick={() => useAppStore.getState().setSelectedProgram(program!)}
          >
            <span className="text-sm">{channel.logoEmoji}</span>
            <p className="text-[11px] font-medium text-white truncate max-w-[120px]">{program!.title}</p>
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── NAWIGACJA DNI ────────────────────────────────────────

function DayNavigation({ currentDate, onDateChange }: {
  currentDate: Date;
  onDateChange: (d: Date) => void;
}) {
  const days = useMemo(() => {
    return Array.from({ length: 8 }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() + i - 1);
      return startOfDay(d);
    });
  }, []);

  const dayNames = ['Nd', 'Pn', 'Wt', 'Śr', 'Cz', 'Pt', 'Sb'];
  const today = startOfDay(new Date());

  return (
    <div className="flex items-center gap-1 px-2 py-2 bg-white dark:bg-slate-900 border-b border-gray-200 dark:border-slate-700">
      <button
        onClick={() => onDateChange(new Date(currentDate.getTime() - 86400000))}
        className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 flex-shrink-0"
      >
        <ChevronLeft size={16} />
      </button>

      <div className="flex gap-1 flex-1 overflow-x-auto no-scrollbar">
        {days.map(day => {
          const isActive = isSameDay(day, currentDate);
          const isToday  = isSameDay(day, today);
          const label    = isToday ? 'Dziś' : dayNames[day.getDay()];
          return (
            <button
              key={day.toISOString()}
              onClick={() => onDateChange(day)}
              className={clsx(
                'flex-shrink-0 flex flex-col items-center justify-center w-12 h-12 rounded-xl text-xs transition-all',
                isActive
                  ? 'bg-primary-600 text-white font-bold'
                  : isToday
                  ? 'bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 font-medium'
                  : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
              )}
            >
              <span className="text-[10px] leading-none">{label}</span>
              <span className="text-sm font-bold leading-tight">{day.getDate()}</span>
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
