// ============================================================
// HOME VIEW — Ekran główny TV Stream
// ============================================================

import { useMemo, useState, useEffect } from 'react';
import { Bell, ChevronRight, Sparkles, Film, Star, X, Globe, Tag, Calendar, Bot } from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';
import { getCinemaMovies, FilmwebData, getUpcomingMovies, TmdbMovie } from '../../api/filmwebApi';
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
  const { channels, programs, nickname, setActiveView, setSelectedProgram, setSelectedChannel, addNotification, hasNotification, setShowSmartFilter, setShowAIChat } = useAppStore();
  const [cinemaMovies, setCinemaMovies] = useState<FilmwebData[]>([]);
  const [cinemaLoading, setCinemaLoading] = useState(true);
  const [selectedCinemaFilm, setSelectedCinemaFilm] = useState<FilmwebData | null>(null);

  const [upcomingMovies, setUpcomingMovies] = useState<TmdbMovie[]>([]);
  const [upcomingLoading, setUpcomingLoading] = useState(true);
  const [selectedUpcoming, setSelectedUpcoming] = useState<TmdbMovie | null>(null);

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

  useEffect(() => {
    let cancelled = false;
    getUpcomingMovies().then(films => {
      if (!cancelled) {
        setUpcomingMovies(films);
        setUpcomingLoading(false);
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
          {getGreeting()}{nickname ? `, ${nickname}` : ''} 👋
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

        {/* AI Chat button */}
        <button
          onClick={() => setShowAIChat(true)}
          className="mt-3 w-full flex items-center gap-3 bg-gradient-to-r from-violet-600 to-purple-700 text-white rounded-2xl px-4 py-3.5 shadow-lg shadow-violet-200 dark:shadow-violet-900/30 hover:from-violet-700 hover:to-purple-800 transition-all active:scale-95"
        >
          <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center flex-shrink-0">
            <Bot size={18} className="text-white" />
          </div>
          <div className="flex-1 text-left">
            <p className="font-bold text-sm leading-tight">Asystent AI</p>
            <p className="text-white/70 text-[11px]">Zapytaj o filmy i seriale w TV</p>
          </div>
          <ChevronRight size={18} className="text-white/70" />
        </button>
      </div>

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


      {/* ── Zapowiedzi filmowe ──────────────────────────────── */}
      <section className="px-4 mb-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-bold text-gray-900 dark:text-white">🎭 Zapowiedzi filmowe</h2>
          <span className="text-xs text-gray-400">TMDB</span>
        </div>

        {upcomingLoading ? (
          <div className="flex gap-3 overflow-x-auto pb-1 scrollbar-hide">
            {[1,2,3,4].map(i => (
              <div key={i} className="flex-shrink-0 w-32 animate-pulse">
                <div className="w-32 h-44 rounded-2xl bg-gray-200 dark:bg-slate-700 mb-2" />
                <div className="h-3 bg-gray-200 dark:bg-slate-700 rounded w-4/5 mb-1" />
                <div className="h-3 bg-gray-200 dark:bg-slate-700 rounded w-2/5" />
              </div>
            ))}
          </div>
        ) : upcomingMovies.length === 0 ? (
          <p className="text-sm text-gray-400 py-4 text-center">Brak zapowiedzi</p>
        ) : (() => {
          const polish  = upcomingMovies.filter(f => f.isPolish);
          const foreign = upcomingMovies.filter(f => !f.isPolish);
          return (
            <div className="space-y-4">
              {polish.length > 0 && (
                <div>
                  <p className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">🇵🇱 Polskie</p>
                  <div className="flex gap-3 overflow-x-auto pb-1 scrollbar-hide">
                    {polish.map(film => (
                      <UpcomingCard key={film.id} film={film} onSelect={setSelectedUpcoming} />
                    ))}
                  </div>
                </div>
              )}
              {foreign.length > 0 && (
                <div>
                  {polish.length > 0 && (
                    <p className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">🌍 Zagraniczne</p>
                  )}
                  <div className="flex gap-3 overflow-x-auto pb-1 scrollbar-hide">
                    {foreign.map(film => (
                      <UpcomingCard key={film.id} film={film} onSelect={setSelectedUpcoming} />
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })()}
      </section>

      {/* Padding na dole dla nawigacji */}
      <div className="h-4" />
    </div>

    {/* Modal szczegółów filmu kinowego */}
    {selectedCinemaFilm && (
      <CinemaDetailModal film={selectedCinemaFilm} onClose={() => setSelectedCinemaFilm(null)} />
    )}

    {/* Modal zapowiedzi filmowej */}
    {selectedUpcoming && (
      <UpcomingDetailModal film={selectedUpcoming} onClose={() => setSelectedUpcoming(null)} />
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

// ── Helpers dla daty premiery ─────────────────────────────

function formatReleaseDate(dateStr: string | null): { label: string; color: string } {
  if (!dateStr) return { label: 'Wkrótce', color: 'bg-gray-500' };
  const now = new Date();
  const rel = new Date(dateStr);
  const diffDays = Math.round((rel.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  const formatted = rel.toLocaleDateString('pl-PL', { day: 'numeric', month: 'short', year: 'numeric' });

  if (diffDays < 0) return { label: formatted, color: 'bg-gray-500' };
  if (diffDays <= 14) return { label: `Za ${diffDays} dni`, color: 'bg-green-600' };
  if (diffDays <= 60) return { label: formatted, color: 'bg-blue-600' };
  if (diffDays <= 180) return { label: formatted, color: 'bg-violet-600' };
  return { label: formatted, color: 'bg-purple-800' };
}

// ── Karta zapowiedzi ──────────────────────────────────────

function UpcomingCard({ film, onSelect }: { film: TmdbMovie; onSelect: (f: TmdbMovie) => void }) {
  const { label, color } = formatReleaseDate(film.releaseDate);
  return (
    <button
      onClick={() => onSelect(film)}
      className="flex-shrink-0 w-28 text-left group"
    >
      <div className="w-28 h-40 rounded-2xl overflow-hidden bg-gray-100 dark:bg-slate-700 relative mb-2 shadow-sm">
        {film.poster ? (
          <img
            src={film.poster}
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
        {/* Badge daty premiery */}
        <div className={`absolute bottom-1.5 left-1 right-1 flex items-center justify-center ${color} rounded-lg px-1 py-0.5`}>
          <span className="text-white text-[9px] font-bold text-center leading-tight">{label}</span>
        </div>
      </div>
      <p className="text-xs font-semibold text-gray-800 dark:text-gray-200 line-clamp-2 leading-tight mb-0.5">
        {film.title}
      </p>
      {film.originalTitle && (
        <p className="text-[10px] text-gray-400 truncate">{film.originalTitle}</p>
      )}
    </button>
  );
}

// ── Modal zapowiedzi ──────────────────────────────────────

function UpcomingDetailModal({ film, onClose }: { film: TmdbMovie; onClose: () => void }) {
  const [visible, setVisible] = useState(false);
  const [closing, setClosing] = useState(false);
  useEffect(() => {
    const f1 = requestAnimationFrame(() => {
      const f2 = requestAnimationFrame(() => setVisible(true));
      return () => cancelAnimationFrame(f2);
    });
    return () => cancelAnimationFrame(f1);
  }, []);
  const handleClose = () => { setClosing(true); setTimeout(onClose, 320); };
  const sheetVisible = visible && !closing;

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

  const { label, color } = formatReleaseDate(film.releaseDate);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      <div
        className={clsx('absolute inset-0 bg-black/60 backdrop-blur-sm modal-backdrop', sheetVisible ? 'modal-visible' : 'modal-hidden')}
        style={{ touchAction: 'none' }}
        onClick={handleClose}
      />
      <div
        className={clsx('relative w-full max-w-lg bg-white dark:bg-slate-900 rounded-t-3xl shadow-2xl flex flex-col sheet-panel', sheetVisible ? 'sheet-visible' : 'sheet-hidden')}
        style={{ maxHeight: 'min(92svh, 92vh)', overscrollBehavior: 'contain' }}
      >
        {/* Uchwyt + zamknij */}
        <div className="flex-shrink-0 pt-3 pb-0 flex items-center justify-center relative">
          <div className="w-10 h-1 bg-gray-300 dark:bg-slate-600 rounded-full" />
          <button
            onClick={handleClose}
            className="absolute right-4 w-8 h-8 rounded-full bg-gray-100 dark:bg-slate-800 flex items-center justify-center text-gray-500"
          >
            <X size={16} style={{ pointerEvents: 'none' }} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto min-h-0" style={{ WebkitOverflowScrolling: 'touch' } as React.CSSProperties}>
          {/* Poster + info */}
          <div className="flex gap-4 px-5 pt-4 pb-4">
            {film.poster ? (
              <img
                src={film.poster}
                alt={film.title}
                className="w-24 h-36 object-cover rounded-2xl flex-shrink-0 shadow-md"
              />
            ) : (
              <div className="w-24 h-36 rounded-2xl bg-gray-100 dark:bg-slate-700 flex items-center justify-center flex-shrink-0">
                <Film size={28} className="text-gray-400" />
              </div>
            )}
            <div className="flex-1 min-w-0 pt-1">
              <h2 className="text-lg font-bold text-gray-900 dark:text-white leading-tight">{film.title}</h2>
              {film.originalTitle && (
                <p className="text-sm text-gray-400 italic mt-0.5">{film.originalTitle}</p>
              )}

              {/* Ocena Filmweb */}
              {film.rating != null && film.rateCount > 10 && (
                <div className="flex items-center gap-1 mt-2">
                  <Star size={14} className="fill-amber-400 text-amber-400" />
                  <span className="text-lg font-bold text-gray-900 dark:text-white">{film.rating.toFixed(1)}</span>
                  <span className="text-xs text-gray-400">/ 10</span>
                  <span className="text-xs text-gray-400 ml-1">({film.rateCount.toLocaleString('pl-PL')} ocen)</span>
                </div>
              )}

              {/* Badge premiery */}
              <div className="mt-2.5">
                <span className={`inline-flex items-center gap-1 text-xs font-bold text-white px-2.5 py-1 rounded-full ${color}`}>
                  <Calendar size={11} />
                  {label}
                </span>
              </div>

              {/* Gatunki */}
              {film.genres.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {film.genres.slice(0, 3).map(g => (
                    <span key={g} className="text-[10px] px-2 py-0.5 rounded-full bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-400 font-medium capitalize">{g}</span>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Opis */}
          {film.synopsis && (
            <div className="px-5 pb-4">
              <p className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1.5">Opis</p>
              <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">{film.synopsis}</p>
            </div>
          )}

          {/* Przyciski */}
          <div className="px-5 pb-6 flex flex-col gap-3">
            <a
              href={film.filmwebUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 w-full py-3 rounded-2xl bg-gradient-to-r from-[#FFCD05] to-[#D89124] text-gray-900 font-bold text-sm shadow-sm active:scale-95 transition-all"
            >
              <img src="/filmweb-logo.svg" alt="Filmweb" className="w-5 h-5" />
              Szukaj na Filmweb
            </a>
            <a
              href={`https://www.themoviedb.org/movie/${film.id}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 w-full py-3 rounded-2xl border-2 border-slate-300 dark:border-slate-600 text-gray-600 dark:text-gray-400 font-semibold text-sm transition-colors hover:bg-gray-50 dark:hover:bg-slate-800"
            >
              Więcej na TMDB
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Modal szczegółów filmu kinowego ───────────────────────

function filmwebLink(film: FilmwebData): string {
  const type = film.type?.toLowerCase().includes('serial') ? 'serial' : 'film';
  const slug = film.title.replace(/ /g, '+');
  return `https://www.filmweb.pl/${type}/${slug}-${film.year}-${film.id}`;
}

function CinemaDetailModal({ film, onClose }: { film: FilmwebData; onClose: () => void }) {
  const url = posterUrl(film.poster);

  // Animacja wejścia/wyjścia
  const [visible, setVisible] = useState(false);
  const [closing, setClosing] = useState(false);
  useEffect(() => {
    const f1 = requestAnimationFrame(() => {
      const f2 = requestAnimationFrame(() => setVisible(true));
      return () => cancelAnimationFrame(f2);
    });
    return () => cancelAnimationFrame(f1);
  }, []);
  const handleClose = () => { setClosing(true); setTimeout(onClose, 320); };
  const sheetVisible = visible && !closing;

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
        className={clsx('absolute inset-0 bg-black/60 backdrop-blur-sm modal-backdrop', sheetVisible ? 'modal-visible' : 'modal-hidden')}
        style={{ touchAction: 'none' }}
        onClick={handleClose}
      />

      {/* Sheet */}
      <div
        className={clsx('relative w-full max-w-lg bg-white dark:bg-slate-900 rounded-t-3xl shadow-2xl flex flex-col sheet-panel', sheetVisible ? 'sheet-visible' : 'sheet-hidden')}
        style={{ maxHeight: 'min(92svh, 92vh)', overscrollBehavior: 'contain' }}
      >
        {/* Uchwyt + zamknij */}
        <div className="flex-shrink-0 pt-3 pb-0 flex items-center justify-center relative">
          <div className="w-10 h-1 bg-gray-300 dark:bg-slate-600 rounded-full" />
          <button
            onClick={handleClose}
            className="absolute right-4 w-8 h-8 rounded-full bg-gray-100 dark:bg-slate-800 flex items-center justify-center text-gray-500"
          >
            <X size={16} style={{ pointerEvents: 'none' }} />
          </button>
        </div>

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
          {film.synopsis && typeof film.synopsis === 'string' && (
            <div className="px-5 pb-4">
              <p className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1.5">Opis</p>
              <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">{film.synopsis}</p>
            </div>
          )}

          {/* Link do Filmweb */}
          <div className="px-5 pb-6">
            <a
              href={filmwebLink(film)}
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
