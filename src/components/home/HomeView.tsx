// ============================================================
// HOME VIEW — Ekran główny TV Stream
// ============================================================

import { useMemo, useState, useEffect } from 'react';
import { Bell, ChevronRight, Sparkles, Film, Star, X, Globe, Tag, Calendar } from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';
import { SmartFilterModal } from '../smartfilter/SmartFilterModal';
import { getCinemaMovies, FilmwebData } from '../../api/filmwebApi';
import clsx from 'clsx';

// Mapowanie gatunków na emoji/kolory kategorii
const CATEGORY_ICONS: Record<string, { emoji: string; bg: string; label: string }> = {
  sport:         { emoji: '⚽', bg: 'bg-green-500',  label: 'Sport' },
  movie:         { emoji: '🎬', bg: 'bg-blue-600',   label: 'Filmy' },
  series:        { emoji: '📺', bg: 'bg-purple-600', label: 'Seriale' },
  news:          { emoji: '📰', bg: 'bg-gray-700',   label: 'Wiadomości' },
  documentary:   { emoji: '🎥', bg: 'bg-amber-600',  label: 'Dokumenty' },
  entertainment: { emoji: '🎭', bg: 'bg-pink-500',   label: 'Rozrywka' },
  kids:          { emoji: '🧸', bg: 'bg-yellow-500', label: 'Dla dzieci' },
  music:         { emoji: '🎵', bg: 'bg-indigo-500', label: 'Muzyka' },
  other:         { emoji: '📡', bg: 'bg-slate-500',  label: 'Inne' },
};

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Dzień dobry';
  if (h < 18) return 'Witaj';
  return 'Dobry wieczór';
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' });
}

export function HomeView() {
  const { channels, programs, setActiveView, setSelectedProgram, setSelectedChannel, addNotification, hasNotification } = useAppStore();
  const [showSmartFilter, setShowSmartFilter] = useState(false);
  const [cinemaMovies, setCinemaMovies] = useState<FilmwebData[]>([]);
  const [cinemaLoading, setCinemaLoading] = useState(true);
  const [selectedCinemaFilm, setSelectedCinemaFilm] = useState<FilmwebData | null>(null);

  useEffect(() => {
    let cancelled = false;
    getCinemaMovies().then(films => {
      if (!cancelled) {
        setCinemaMovies(films);
        setCinemaLoading(false);
      }
    });
    return () => { cancelled = true; };
  }, []);

  const now = useMemo(() => new Date(), []);

  // "Up Next" — następne programy na kanałach ulubionych lub pierwszych
  const upNextPrograms = useMemo(() => {
    return channels
      .filter(ch => ch.isVisible)
      .slice(0, 6)
      .map(ch => {
        const next = programs
          .filter(p => p.channelId === ch.id && p.startTime > now)
          .sort((a, b) => a.startTime.getTime() - b.startTime.getTime())[0];
        return next ? { channel: ch, program: next } : null;
      })
      .filter(Boolean) as { channel: typeof channels[0]; program: typeof programs[0] }[];
  }, [channels, programs, now]);

  // Top kanały (pierwsze 6)
  const topChannels = channels.filter(ch => ch.isVisible).slice(0, 6);

  return (
    <>
    <div className="h-full overflow-y-auto bg-gray-50 dark:bg-slate-950">
      {/* ── Powitanie ──────────────────────────────────────── */}
      <div className="px-4 pt-5 pb-3">
        <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">
          {new Date().toLocaleDateString('pl-PL', { weekday: 'long', day: 'numeric', month: 'long' })}
        </p>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mt-0.5">
          {getGreeting()}, Jan 👋
        </h1>

        {/* Smart Filter button */}
        <button
          onClick={() => setShowSmartFilter(true)}
          className="mt-4 w-full flex items-center gap-3 bg-gradient-to-r from-primary-600 to-primary-700 text-white rounded-2xl px-4 py-3.5 shadow-lg shadow-primary-200 dark:shadow-primary-900/30 hover:from-primary-700 hover:to-primary-800 transition-all active:scale-95"
        >
          <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center flex-shrink-0">
            <Sparkles size={18} className="text-white" />
          </div>
          <div className="flex-1 text-left">
            <p className="font-bold text-sm leading-tight">Smart Filter</p>
            <p className="text-white/70 text-[11px]">Znajdź filmy i seriale z oceną Filmweb</p>
          </div>
          <ChevronRight size={18} className="text-white/70" />
        </button>
      </div>

      {/* ── Top Channels ───────────────────────────────────── */}
      <section className="px-4 mb-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-bold text-gray-900 dark:text-white">Top kanały</h2>
          <button
            onClick={() => setActiveView('channels')}
            className="flex items-center gap-0.5 text-xs text-primary-600 font-semibold"
          >
            Zobacz wszystkie <ChevronRight size={14} />
          </button>
        </div>
        <div className="flex gap-3 overflow-x-auto pb-1 scrollbar-hide">
          {topChannels.map(ch => (
            <button
              key={ch.id}
              onClick={() => setSelectedChannel(ch)}
              className="flex-shrink-0 flex flex-col items-center gap-1.5"
            >
              <div className="w-14 h-14 rounded-2xl bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-700 shadow-sm flex items-center justify-center text-2xl">
                {ch.logoEmoji ?? '📺'}
              </div>
              <span className="text-[10px] text-gray-500 dark:text-gray-400 font-medium w-14 truncate text-center">
                {ch.shortName}
              </span>
            </button>
          ))}
        </div>
      </section>

      {/* ── Nowości w kinie ─────────────────────────────────── */}
      <section className="px-4 mb-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-bold text-gray-900 dark:text-white">🎬 Teraz w kinach</h2>
          <span className="text-xs text-gray-400">Filmweb</span>
        </div>

        {cinemaLoading ? (
          /* Skeleton loader */
          <div className="flex gap-3 overflow-x-auto pb-1 scrollbar-hide">
            {[1,2,3,4].map(i => (
              <div key={i} className="flex-shrink-0 w-32 animate-pulse">
                <div className="w-32 h-44 rounded-2xl bg-gray-200 dark:bg-slate-700 mb-2" />
                <div className="h-3 bg-gray-200 dark:bg-slate-700 rounded w-4/5 mb-1" />
                <div className="h-3 bg-gray-200 dark:bg-slate-700 rounded w-2/5" />
              </div>
            ))}
          </div>
        ) : cinemaMovies.length === 0 ? (
          <p className="text-sm text-gray-400 py-4 text-center">Brak danych z Filmweb</p>
        ) : (
          <div className="flex gap-3 overflow-x-auto pb-1 scrollbar-hide">
            {cinemaMovies.map(film => (
              <CinemaCard key={film.id} film={film} onSelect={setSelectedCinemaFilm} />
            ))}
          </div>
        )}
      </section>

      {/* ── Kategorie ──────────────────────────────────────── */}
      <section className="px-4 mb-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-bold text-gray-900 dark:text-white">Kategorie</h2>
          <button
            onClick={() => setActiveView('categories')}
            className="flex items-center gap-0.5 text-xs text-primary-600 font-semibold"
          >
            Wszystkie <ChevronRight size={14} />
          </button>
        </div>
        <div className="grid grid-cols-4 gap-2">
          {Object.entries(CATEGORY_ICONS).slice(0, 4).map(([genre, cat]) => (
            <button
              key={genre}
              onClick={() => setActiveView('epg')}
              className="flex flex-col items-center gap-1.5 p-3 rounded-2xl bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-700 shadow-sm hover:shadow-md transition-shadow"
            >
              <div className={clsx('w-10 h-10 rounded-xl flex items-center justify-center text-xl', cat.bg)}>
                {cat.emoji}
              </div>
              <span className="text-[10px] font-semibold text-gray-700 dark:text-gray-300">{cat.label}</span>
            </button>
          ))}
        </div>
      </section>

      {/* ── Up Next ────────────────────────────────────────── */}
      {upNextPrograms.length > 0 && (
        <section className="px-4 mb-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base font-bold text-gray-900 dark:text-white">Następne</h2>
            <button
              onClick={() => setActiveView('epg')}
              className="flex items-center gap-0.5 text-xs text-primary-600 font-semibold"
            >
              Program TV <ChevronRight size={14} />
            </button>
          </div>
          <div className="flex flex-col gap-2">
            {upNextPrograms.slice(0, 4).map(({ channel, program }) => (
              <div
                key={program.id}
                onClick={() => setSelectedProgram(program)}
                className="flex items-center gap-3 bg-white dark:bg-slate-800 rounded-2xl p-3 border border-gray-100 dark:border-slate-700 shadow-sm hover:shadow-md transition-all cursor-pointer"
              >
                {/* Emoji kanału */}
                <div className="w-11 h-11 rounded-xl bg-gray-50 dark:bg-slate-700 flex items-center justify-center text-xl flex-shrink-0 border border-gray-100 dark:border-slate-600">
                  {channel.logoEmoji ?? '📺'}
                </div>

                {/* Treść */}
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm text-gray-900 dark:text-white truncate">{program.title}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                    {channel.name} · {formatTime(program.startTime)} – {formatTime(program.endTime)}
                  </p>
                </div>

                {/* Przycisk powiadomienia */}
                <button
                  onClick={e => {
                    e.stopPropagation();
                    if (!hasNotification(program.id)) addNotification(program, 10);
                  }}
                  className={clsx(
                    'p-2 rounded-xl flex-shrink-0 transition-colors',
                    hasNotification(program.id)
                      ? 'text-primary-600 bg-primary-50 dark:bg-primary-900/20'
                      : 'text-gray-400 hover:text-primary-600 hover:bg-primary-50 dark:hover:bg-primary-900/20'
                  )}
                >
                  <Bell size={16} />
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Padding na dole dla nawigacji */}
      <div className="h-4" />
    </div>

    {/* Smart Filter Modal */}
    {showSmartFilter && (
      <SmartFilterModal onClose={() => setShowSmartFilter(false)} />
    )}

    {/* Modal szczegółów filmu kinowego */}
    {selectedCinemaFilm && (
      <CinemaDetailModal film={selectedCinemaFilm} onClose={() => setSelectedCinemaFilm(null)} />
    )}
  </>
  );
}

// ── Karta kina ────────────────────────────────────────────

const FILMWEB_POSTER_BASE = 'https://fwcdn.pl/fpo';

function posterUrl(poster: string | null) {
  if (!poster) return null;
  const fixed = poster.replace('.$.','.3.');
  if (fixed.startsWith('http')) return fixed;
  return `${FILMWEB_POSTER_BASE}${fixed}`;
}

function CinemaCard({ film, onSelect }: { film: FilmwebData; onSelect: (f: FilmwebData) => void }) {
  const url = posterUrl(film.poster);

  return (
    <button
      onClick={() => onSelect(film)}
      className="flex-shrink-0 w-28 text-left group"
    >
      {/* Poster */}
      <div className="w-28 h-40 rounded-2xl overflow-hidden bg-gray-100 dark:bg-slate-700 relative mb-2 shadow-sm">
        {url ? (
          <img
            src={url}
            alt={film.title}
            className="w-full h-full object-cover"
            loading="lazy"
            onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Film size={32} className="text-gray-300 dark:text-slate-500" />
          </div>
        )}
        {film.rate != null && (
          <div className="absolute bottom-1.5 left-1.5 flex items-center gap-0.5 bg-black/70 rounded-lg px-1.5 py-0.5">
            <Star size={9} className="fill-amber-400 text-amber-400" />
            <span className="text-white text-[10px] font-bold">{film.rate.toFixed(1)}</span>
          </div>
        )}
      </div>
      <p className="text-xs font-semibold text-gray-800 dark:text-gray-200 line-clamp-2 leading-tight mb-0.5">
        {film.title}
      </p>
      {film.year && (
        <p className="text-[10px] text-gray-400">{film.year}</p>
      )}
    </button>
  );
}

// ── Modal szczegółów filmu kinowego ───────────────────────

function CinemaDetailModal({ film, onClose }: { film: FilmwebData; onClose: () => void }) {
  const url = posterUrl(film.poster);

  // Blokada scrolla tła
  useEffect(() => {
    const scrollY = window.scrollY;
    document.body.style.overflow = 'hidden';
    document.body.style.position = 'fixed';
    document.body.style.top = `-${scrollY}px`;
    document.body.style.width = '100%';
    return () => {
      document.body.style.overflow = '';
      document.body.style.position = '';
      document.body.style.top = '';
      document.body.style.width = '';
      window.scrollTo(0, scrollY);
    };
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        style={{ touchAction: 'none' }}
        onClick={onClose}
      />

      {/* Sheet */}
      <div
        className="relative w-full max-w-lg bg-white dark:bg-slate-900 rounded-t-3xl shadow-2xl flex flex-col"
        style={{ maxHeight: 'min(92svh, 92vh)', overscrollBehavior: 'contain' }}
      >
        {/* Uchwyt */}
        <div className="flex-shrink-0 pt-3 pb-0 flex justify-center">
          <div className="w-10 h-1 bg-gray-300 dark:bg-slate-600 rounded-full" />
        </div>

        {/* Przycisk zamknij */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 w-8 h-8 rounded-full bg-gray-100 dark:bg-slate-800 flex items-center justify-center text-gray-500"
        >
          <X size={16} />
        </button>

        {/* Treść scrollowalna */}
        <div className="flex-1 overflow-y-auto min-h-0" style={{ WebkitOverflowScrolling: 'touch' } as React.CSSProperties}>
          {/* Hero: poster + tytuł */}
          <div className="flex gap-4 px-5 pt-4 pb-4">
            {url ? (
              <img
                src={url}
                alt={film.title}
                className="w-24 h-36 object-cover rounded-2xl flex-shrink-0 shadow-md"
              />
            ) : (
              <div className="w-24 h-36 rounded-2xl bg-gray-100 dark:bg-slate-700 flex items-center justify-center flex-shrink-0">
                <Film size={28} className="text-gray-400" />
              </div>
            )}
            <div className="flex-1 min-w-0 pt-1">
              <h2 className="text-lg font-bold text-gray-900 dark:text-white leading-tight">
                {film.title}
              </h2>
              {film.originalTitle && film.originalTitle !== film.title && (
                <p className="text-sm text-gray-400 italic mt-0.5">{film.originalTitle}</p>
              )}

              {/* Ocena */}
              {film.rate != null && (
                <div className="flex items-center gap-1 mt-2">
                  <Star size={14} className="fill-amber-400 text-amber-400" />
                  <span className="text-lg font-bold text-gray-900 dark:text-white">{film.rate.toFixed(1)}</span>
                  <span className="text-xs text-gray-400">/ 10</span>
                  {film.rateCount > 0 && (
                    <span className="text-xs text-gray-400 ml-1">({film.rateCount.toLocaleString('pl-PL')} ocen)</span>
                  )}
                </div>
              )}

              {/* Meta */}
              <div className="flex flex-wrap gap-2 mt-2.5">
                {film.year && (
                  <span className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
                    <Calendar size={11} />
                    {film.year}
                  </span>
                )}
                {film.countries.length > 0 && (
                  <span className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
                    <Globe size={11} />
                    {film.countries.slice(0, 2).join(', ')}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Gatunki */}
          {film.genres.length > 0 && (
            <div className="px-5 pb-3">
              <div className="flex items-center gap-1.5 mb-2">
                <Tag size={13} className="text-primary-600" />
                <span className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Gatunek</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {film.genres.map(g => (
                  <span key={g} className="text-xs px-2.5 py-1 rounded-full bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-400 font-medium capitalize">
                    {g}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Opis */}
          {film.synopsis && (
            <div className="px-5 pb-4">
              <p className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1.5">Opis</p>
              <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">{film.synopsis}</p>
            </div>
          )}

          {/* Link do Filmweb */}
          <div className="px-5 pb-6">
            <a
              href={film.filmwebUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 w-full py-3 rounded-2xl border-2 border-primary-600 text-primary-600 font-bold text-sm transition-colors hover:bg-primary-50 dark:hover:bg-primary-900/20"
            >
              Zobacz na Filmweb
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
