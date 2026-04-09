// ============================================================
// SMART FILTER — Inteligentne wyszukiwanie filmów/seriali
// ============================================================

import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { X, Sparkles, Search, Star, Calendar, Tag, Tv, Globe, ChevronLeft, ChevronRight, Heart } from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';
import { batchSearchFilmweb, FilmwebData } from '../../api/filmwebApi';
import { Program, Channel } from '../../types';
import clsx from 'clsx';

// ── Typy ──────────────────────────────────────────────────

interface SmartFilterCriteria {
  types: ('film' | 'serial')[];
  excludedGenres: string[];
  excludedCountries: string[];
  minYear: number;
  minRating: number;
  // null = wszystkie dni tygodnia, string[] = wybrane dayLabel-e ("Dziś","Jutro","Poniedziałek"...)
  selectedDays: string[] | null;
}

interface FilteredProgram {
  program: Program;
  channel: Channel;
  filmweb: FilmwebData | null;
  dayLabel: string;
}

// ── Stałe ─────────────────────────────────────────────────

const RATING_TOLERANCE = 0.6;

const FILMWEB_GENRES = [
  'sci-fi', 'horror', 'animacja', 'dokumentalny', 'fantasy',
  'wojenny', 'western', 'musical', 'erotyczny', 'familijny',
  'thriller', 'komedia', 'dramat', 'romans', 'przygodowy',
  'akcja', 'kryminał', 'biograficzny', 'historyczny', 'sportowy',
  'sensacja', 'psychologiczny', 'czarny humor', 'katastroficzny',
];

const COUNTRIES = [
  'Francja', 'Niemcy', 'Wielka Brytania', 'Polska', 'Włochy',
  'Rosja', 'Hiszpania', 'Japonia', 'Korea Południowa', 'Chiny',
  'Indie', 'Australia', 'Meksyk', 'Brazylia', 'Szwecja',
  'Norwegia', 'Dania', 'Finlandia', 'Holandia', 'Belgia',
  'Szwajcaria', 'Austria', 'Czechy', 'Węgry', 'Ukraina',
  'Kanada', 'Argentyna', 'Izrael', 'Iran', 'Tajlandia',
  'Tajwan', 'Hongkong', 'RPA', 'Turcja', 'Grecja',
];

const DAY_NAMES = ['Niedziela', 'Poniedziałek', 'Wtorek', 'Środa', 'Czwartek', 'Piątek', 'Sobota'];
const SHORT_DAY = ['Nd', 'Pn', 'Wt', 'Śr', 'Cz', 'Pt', 'Sb'];

function formatTime(d: Date) {
  return d.toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' });
}

function getDayLabel(date: Date): string {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diff = Math.round((date.getTime() - today.getTime()) / 86400000);
  if (diff === 0) return 'Dziś';
  if (diff === 1) return 'Jutro';
  return DAY_NAMES[date.getDay()];
}

function pluralFilms(n: number): string {
  if (n === 1) return '1 film';
  if (n >= 2 && n <= 4) return `${n} filmy`;
  return `${n} filmów`;
}

// ── Persystencja preferencji (localStorage) ───────────────

const PREFS_KEY = 'smart-filter-prefs';

interface SavedPrefs {
  excludedGenres: string[];
  excludedCountries: string[];
}

function loadPrefs(): SavedPrefs {
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    if (!raw) return { excludedGenres: [], excludedCountries: [] };
    return JSON.parse(raw) as SavedPrefs;
  } catch {
    return { excludedGenres: [], excludedCountries: [] };
  }
}

function savePrefs(prefs: SavedPrefs) {
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
  } catch {}
}

// ── Główny komponent ──────────────────────────────────────

interface Props {
  onClose: () => void;
}

export function SmartFilterModal({ onClose }: Props) {
  const { programs, channels, addFavorite, isFavoriteProgram, setSelectedProgram } = useAppStore();

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
  const handleClose = () => {
    setClosing(true);
    setTimeout(onClose, 320);
  };
  const sheetVisible = visible && !closing;

  const [criteria, setCriteria] = useState<SmartFilterCriteria>(() => {
    const prefs = loadPrefs();
    return {
      types: ['film', 'serial'],
      excludedGenres: prefs.excludedGenres,
      excludedCountries: prefs.excludedCountries,
      minYear: 2010,
      minRating: 0,
      selectedDays: null,
    };
  });

  const [phase, setPhase] = useState<'filters' | 'loading' | 'results'>('filters');
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [results, setResults] = useState<FilteredProgram[]>([]);
  const [zeroResultsHint, setZeroResultsHint] = useState<string | null>(null);
  const [weekOffset, setWeekOffset] = useState(0);
  // Aktywna zakładka dnia w widoku wyników (null = wszystkie)
  const [activeDay, setActiveDay] = useState<string | null>(null);

  // Refy do przewijania do sekcji gatunków
  const genreSectionRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const resultsScrollRef = useRef<HTMLDivElement>(null);

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

  // Zakres tygodnia + dostępne dni
  const { searchStart, searchEnd, weekLabel, availableDays } = useMemo(() => {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const start = new Date(todayStart.getTime() + weekOffset * 7 * 24 * 60 * 60 * 1000);
    const end   = new Date(start.getTime() + 7 * 24 * 60 * 60 * 1000);
    const label = weekOffset === 0 ? 'Ten tydzień' : 'Następny tydzień';

    // Wygeneruj etykiety dni dla tego tygodnia
    const days: { label: string; date: Date; short: string }[] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(start.getTime() + i * 24 * 60 * 60 * 1000);
      days.push({
        label: getDayLabel(d),
        short: weekOffset === 0 && i === 0 ? 'Dziś' : weekOffset === 0 && i === 1 ? 'Jutro' : SHORT_DAY[d.getDay()],
        date: d,
      });
    }

    return { searchStart: start, searchEnd: end, weekLabel: label, availableDays: days };
  }, [weekOffset]);

  const visibleChannelIds = useMemo(() => new Set(channels.filter(c => c.isVisible).map(c => c.id)), [channels]);

  const candidatePrograms = useMemo(() => {
    return programs.filter(p => {
      if (!visibleChannelIds.has(p.channelId)) return false;
      if (p.startTime < searchStart || p.startTime >= searchEnd) return false;
      // Filtr dni tygodnia
      if (criteria.selectedDays && criteria.selectedDays.length > 0) {
        const label = getDayLabel(p.startTime);
        if (!criteria.selectedDays.includes(label)) return false;
      }
      if (criteria.types.includes('film') && p.genre === 'movie') return true;
      if (criteria.types.includes('serial') && p.genre === 'series') return true;
      return false;
    });
  }, [programs, visibleChannelIds, criteria.types, criteria.selectedDays, searchStart, searchEnd]);

  const passesNonRatingFilters = useCallback((p: Program, fw: FilmwebData | null): boolean => {
    if (fw?.year && fw.year < criteria.minYear) return false;
    if (criteria.excludedGenres.length > 0 && fw?.genres?.length) {
      if (criteria.excludedGenres.some(eg => fw.genres.some(g => g.toLowerCase().includes(eg.toLowerCase())))) return false;
    }
    if (criteria.excludedCountries.length > 0 && fw?.countries?.length) {
      if (criteria.excludedCountries.some(ec => fw.countries.some(c => c.toLowerCase().includes(ec.toLowerCase())))) return false;
    }
    if (!channels.find(c => c.id === p.channelId)) return false;
    return true;
  }, [criteria.excludedCountries, criteria.excludedGenres, criteria.minYear, channels]);

  // ── Uruchom wyszukiwanie ──────────────────────────────────
  const runSearch = useCallback(async () => {
    setPhase('loading');
    setZeroResultsHint(null);
    setActiveDay(null);
    setProgress({ done: 0, total: candidatePrograms.length });

    const uniqueTitles = [...new Set(candidatePrograms.map(p => p.title))];
    setProgress({ done: 0, total: uniqueTitles.length });

    const filmwebResults = await batchSearchFilmweb(
      uniqueTitles,
      (done, total) => setProgress({ done, total })
    );

    const filtered: FilteredProgram[] = [];

    for (const program of candidatePrograms) {
      const fw = filmwebResults[program.title] ?? null;
      const ch = channels.find(c => c.id === program.channelId);
      if (!ch) continue;

      if (criteria.minRating > 0) {
        // Brak danych Filmweb = brak oceny → wyklucz gdy wymagana minimalna ocena
        if (fw?.rate == null) continue;
        if (fw.rate < criteria.minRating - RATING_TOLERANCE) continue;
      }

      if (!passesNonRatingFilters(program, fw)) continue;

      filtered.push({ program, channel: ch, filmweb: fw, dayLabel: getDayLabel(program.startTime) });
    }

    filtered.sort((a, b) => {
      const ra = a.filmweb?.rate ?? 0;
      const rb = b.filmweb?.rate ?? 0;
      if (rb !== ra) return rb - ra;
      return a.program.startTime.getTime() - b.program.startTime.getTime();
    });

    if (filtered.length === 0 && criteria.minRating > 0) {
      let hint: string | null = null;
      for (const step of [0.5, 1.0, 1.5, 2.0, 3.0]) {
        const testRating = Math.max(0, criteria.minRating - step);
        const effectiveMin = testRating - RATING_TOLERANCE;
        const count = candidatePrograms.filter(p => {
          const fw = filmwebResults[p.title] ?? null;
          if (testRating > 0 && fw?.rate != null && fw.rate < effectiveMin) return false;
          return passesNonRatingFilters(p, fw);
        }).length;
        if (count > 0) {
          hint = `Obniż ocenę do ${testRating.toFixed(1)}★ → pojawi się ${pluralFilms(count)}`;
          break;
        }
      }
      setZeroResultsHint(hint);
    }

    setResults(filtered);
    setPhase('results');
  }, [candidatePrograms, channels, criteria, passesNonRatingFilters]);

  // ── Helpers ───────────────────────────────────────────────

  const toggleExcludedGenre = (g: string) =>
    setCriteria(c => {
      const next = c.excludedGenres.includes(g) ? c.excludedGenres.filter(x => x !== g) : [...c.excludedGenres, g];
      savePrefs({ excludedGenres: next, excludedCountries: c.excludedCountries });
      return { ...c, excludedGenres: next };
    });

  const toggleExcludedCountry = (country: string) =>
    setCriteria(c => {
      const next = c.excludedCountries.includes(country) ? c.excludedCountries.filter(x => x !== country) : [...c.excludedCountries, country];
      savePrefs({ excludedGenres: c.excludedGenres, excludedCountries: next });
      return { ...c, excludedCountries: next };
    });

  const toggleType = (t: 'film' | 'serial') =>
    setCriteria(c => ({ ...c, types: c.types.includes(t) ? c.types.filter(x => x !== t) : [...c.types, t] }));

  const toggleDay = (label: string) =>
    setCriteria(c => {
      const cur = c.selectedDays ?? [];
      const next = cur.includes(label) ? cur.filter(x => x !== label) : [...cur, label];
      return { ...c, selectedDays: next.length === 0 ? null : next };
    });

  // ── Render: panel filtrów ─────────────────────────────────
  const renderFilters = () => (
    <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden', flex: 1, minHeight: 0 }}>
      <div style={{ flex: 1, overflowY: 'auto', WebkitOverflowScrolling: 'touch', minHeight: 0, padding: '0 16px 16px' } as React.CSSProperties}>

        {/* Przełącznik tygodnia */}
        <div className="mt-4 flex items-center justify-between bg-gray-50 dark:bg-slate-800 rounded-2xl px-3 py-2.5">
          <button onClick={() => setWeekOffset(0)} disabled={weekOffset === 0} className="p-1 text-gray-400 disabled:opacity-30 hover:text-primary-600 transition-colors">
            <ChevronLeft size={16} />
          </button>
          <div className="text-center">
            <p className="text-sm font-bold text-gray-900 dark:text-white">{weekLabel}</p>
            <p className="text-[10px] text-gray-400">
              {searchStart.toLocaleDateString('pl-PL', { day: 'numeric', month: 'short' })} –{' '}
              {new Date(searchEnd.getTime() - 1).toLocaleDateString('pl-PL', { day: 'numeric', month: 'short' })}
            </p>
          </div>
          <button onClick={() => setWeekOffset(1)} disabled={weekOffset === 1} className="p-1 text-gray-400 disabled:opacity-30 hover:text-primary-600 transition-colors">
            <ChevronRight size={16} />
          </button>
        </div>

        {/* Wybór dni tygodnia */}
        <div className="mt-3">
          <div className="flex gap-1.5">
            {availableDays.map(({ label, short }) => {
              const selected = criteria.selectedDays?.includes(label) ?? false;
              return (
                <button
                  key={label}
                  onClick={() => toggleDay(label)}
                  className={clsx(
                    'flex-1 py-1.5 rounded-xl text-[11px] font-bold transition-all border',
                    selected
                      ? 'bg-primary-600 text-white border-primary-600'
                      : 'bg-gray-50 dark:bg-slate-800 text-gray-500 dark:text-gray-400 border-gray-200 dark:border-slate-700 hover:border-primary-400'
                  )}
                >
                  {short}
                </button>
              );
            })}
          </div>
          {criteria.selectedDays && criteria.selectedDays.length > 0 && (
            <div className="flex items-center justify-between mt-1.5">
              <p className="text-[10px] text-primary-600 font-medium">
                {criteria.selectedDays.join(', ')}
              </p>
              <button
                onClick={() => setCriteria(c => ({ ...c, selectedDays: null }))}
                className="text-[10px] text-gray-400 hover:text-red-500 transition-colors"
              >
                wyczyść
              </button>
            </div>
          )}
        </div>

        {/* Typ treści */}
        <FilterSection title="Szukaj w" icon={<Tv size={16} />}>
          <div className="flex gap-2">
            {(['film', 'serial'] as const).map(t => (
              <Chip key={t} label={t === 'film' ? 'Filmy' : 'Seriale'} active={criteria.types.includes(t)} onClick={() => toggleType(t)} activeClass="bg-primary-600 text-white" />
            ))}
          </div>
        </FilterSection>

        {/* Minimalna ocena Filmweb */}
        <FilterSection title="Minimalna ocena Filmweb" icon={<Star size={16} />}>
          <div className="flex items-center gap-3">
            <input type="range" min={0} max={10} step={0.5} value={criteria.minRating}
              onChange={e => setCriteria(c => ({ ...c, minRating: Number(e.target.value) }))}
              className="flex-1 accent-primary-600"
            />
            <div className="flex items-center gap-1 w-16">
              {criteria.minRating > 0 ? (
                <><Star size={14} className="text-amber-400 fill-amber-400" /><span className="text-lg font-bold text-gray-900 dark:text-white">{criteria.minRating.toFixed(1)}</span></>
              ) : (
                <span className="text-sm text-gray-400">brak</span>
              )}
            </div>
          </div>
          {criteria.minRating > 0 && (
            <p className="text-xs text-gray-400 mt-1">
              Filmy z oceną ≥ {(criteria.minRating - RATING_TOLERANCE).toFixed(1)}
              <span className="text-gray-300"> (tolerancja ±{RATING_TOLERANCE})</span>
            </p>
          )}
        </FilterSection>

        {/* Rok produkcji */}
        <FilterSection title="Rok produkcji (od)" icon={<Calendar size={16} />}>
          <div className="flex items-center gap-3">
            <input type="range" min={1980} max={2025} step={1} value={criteria.minYear}
              onChange={e => setCriteria(c => ({ ...c, minYear: Number(e.target.value) }))}
              className="flex-1 accent-primary-600"
            />
            <span className="text-lg font-bold text-gray-900 dark:text-white w-14 text-right">{criteria.minYear}</span>
          </div>
        </FilterSection>

        {/* Wyklucz gatunki */}
        <FilterSection
          title="Wyklucz gatunki" icon={<Tag size={16} />}
          onReset={criteria.excludedGenres.length > 0 ? () => {
            setCriteria(c => { savePrefs({ excludedGenres: [], excludedCountries: c.excludedCountries }); return { ...c, excludedGenres: [] }; });
          } : undefined}
        >
          <div className="flex flex-wrap gap-2">
            {FILMWEB_GENRES.map(g => (
              <Chip key={g} label={g} active={criteria.excludedGenres.includes(g)} onClick={() => toggleExcludedGenre(g)}
                activeClass="bg-red-100 text-red-700 border-red-300 dark:bg-red-900/30 dark:text-red-400"
                inactiveClass="bg-gray-50 dark:bg-slate-800"
              />
            ))}
          </div>
        </FilterSection>

        {/* Wyklucz kraje produkcji */}
        <FilterSection
          title="Wyklucz kraje produkcji" icon={<Globe size={16} />}
          onReset={criteria.excludedCountries.length > 0 ? () => {
            setCriteria(c => { savePrefs({ excludedGenres: c.excludedGenres, excludedCountries: [] }); return { ...c, excludedCountries: [] }; });
          } : undefined}
        >
          <div className="flex flex-wrap gap-2">
            {COUNTRIES.map(c => (
              <Chip key={c} label={c} active={criteria.excludedCountries.includes(c)} onClick={() => toggleExcludedCountry(c)}
                activeClass="bg-red-100 text-red-700 border-red-300 dark:bg-red-900/30 dark:text-red-400"
                inactiveClass="bg-gray-50 dark:bg-slate-800"
              />
            ))}
          </div>
        </FilterSection>
      </div>

      {/* Dół: podsumowanie + przycisk */}
      <div className="px-4 pt-3 border-t border-gray-100 dark:border-slate-800 flex-shrink-0"
           style={{ paddingBottom: 'max(16px, env(safe-area-inset-bottom))' }}>
        {(criteria.minRating > 0 || criteria.minYear > 1980 || criteria.excludedGenres.length > 0 || criteria.excludedCountries.length > 0) && (
          <div className="flex flex-wrap gap-1.5 mb-2.5">
            {criteria.minRating > 0 && (
              <span className="flex items-center gap-0.5 text-[11px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 border border-amber-300 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-700">
                <Star size={9} className="fill-amber-500 text-amber-500" /> ≥ {criteria.minRating.toFixed(1)}
              </span>
            )}
            {criteria.minYear > 1980 && (
              <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 border border-blue-200 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-700">od {criteria.minYear}</span>
            )}
            {criteria.excludedGenres.map(g => (
              <span key={g} className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-red-100 text-red-700 border border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-700">✕ {g}</span>
            ))}
            {criteria.excludedCountries.map(c => (
              <span key={c} className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-red-100 text-red-700 border border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-700">✕ {c}</span>
            ))}
          </div>
        )}
        <p className="text-xs text-gray-400 text-center mb-2.5">
          {candidatePrograms.length} programów do sprawdzenia ({weekLabel.toLowerCase()}{criteria.selectedDays ? `, ${criteria.selectedDays.join('/')}` : ''})
        </p>
        <button
          onClick={runSearch}
          disabled={criteria.types.length === 0}
          className="w-full flex items-center justify-center gap-2 bg-primary-600 hover:bg-primary-700 disabled:opacity-50 text-white font-bold py-3.5 rounded-2xl transition-colors text-base"
        >
          <Sparkles size={18} />
          Szukaj z Filmweb
        </button>
      </div>
    </div>
  );

  // ── Render: loading ───────────────────────────────────────
  const renderLoading = () => (
    <div className="flex flex-col items-center justify-center flex-1 px-8 gap-5">
      <div className="w-16 h-16 rounded-full bg-primary-50 dark:bg-primary-900/20 flex items-center justify-center">
        <Sparkles size={28} className="text-primary-600 animate-spin-slow" />
      </div>
      <div className="text-center">
        <p className="font-bold text-gray-900 dark:text-white text-lg mb-1">Sprawdzam Filmweb...</p>
        <p className="text-sm text-gray-500">{progress.done} / {progress.total} tytułów</p>
      </div>
      <div className="w-full bg-gray-100 dark:bg-slate-800 rounded-full h-2">
        <div className="h-2 bg-primary-600 rounded-full transition-all duration-300"
          style={{ width: progress.total ? `${(progress.done / progress.total) * 100}%` : '0%' }} />
      </div>
      <p className="text-xs text-gray-400 text-center">Pobieranie ocen i szczegółów z Filmweb.pl</p>
    </div>
  );

  // ── Render: wyniki ────────────────────────────────────────
  const renderResults = () => {
    const dayOrder = ['Dziś', 'Jutro', ...DAY_NAMES];
    const daysInResults = [...new Set(results.map(r => r.dayLabel))]
      .sort((a, b) => dayOrder.indexOf(a) - dayOrder.indexOf(b));

    const visibleResults = activeDay ? results.filter(r => r.dayLabel === activeDay) : results;

    // Grupuj po gatunku (pierwszy gatunek Filmweb)
    const genreGroups = new Map<string, FilteredProgram[]>();
    for (const item of visibleResults) {
      const raw = item.filmweb?.genres?.[0] ?? 'Inne';
      const genre = raw.charAt(0).toUpperCase() + raw.slice(1);
      if (!genreGroups.has(genre)) genreGroups.set(genre, []);
      genreGroups.get(genre)!.push(item);
    }
    const sortedGenres = [...genreGroups.keys()].sort((a, b) => {
      if (a === 'Inne') return 1;
      if (b === 'Inne') return -1;
      return genreGroups.get(b)!.length - genreGroups.get(a)!.length;
    });

    const scrollToGenre = (genre: string) => {
      const el = genreSectionRefs.current.get(genre);
      const container = resultsScrollRef.current;
      if (el && container) {
        container.scrollTo({ top: el.offsetTop, behavior: 'smooth' });
      }
    };

    // Buduj komunikat podsumowujący kryteria
    const buildSummary = (): string => {
      const parts: string[] = [];
      const typePart = criteria.types.length === 2 ? 'filmów i seriali'
        : criteria.types.includes('film') ? 'filmów' : 'seriali';
      if (criteria.minRating > 0) parts.push(`z oceną ${criteria.minRating.toFixed(1)}★ i wyżej`);
      if (criteria.minYear > 1980) parts.push(`od ${criteria.minYear} roku`);
      if (criteria.selectedDays?.length) parts.push(`w: ${criteria.selectedDays.join(', ')}`);
      const n = results.length;
      const countWord = n === 0 ? 'Nie znalazłem żadnych'
        : n === 1 ? 'Znalazłem 1'
        : n < 5 ? `Znalazłem ${n}`
        : `Znalazłem ${n}`;
      return parts.length > 0
        ? `${countWord} ${typePart} ${parts.join(', ')}`
        : `${countWord} ${typePart}`;
    };

    return (
      <div className="flex-1 flex flex-col min-h-0">
        {/* Nagłówek */}
        <div className="flex-shrink-0 px-4 py-2.5 bg-primary-50 dark:bg-primary-900/20 border-b border-primary-100 dark:border-primary-800">
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-2">
              <Sparkles size={15} className="text-primary-600" />
              <span className="font-bold text-primary-700 dark:text-primary-400 text-sm">
                {results.length} wyników · {weekLabel}
              </span>
            </div>
            <button onClick={() => setPhase('filters')} className="text-xs text-primary-600 font-semibold">
              Zmień filtry
            </button>
          </div>
          <p className="text-xs text-primary-600/80 dark:text-primary-400/80 mb-1.5 font-medium">
            {buildSummary()}
          </p>

          {/* Zakładki dni */}
          {daysInResults.length > 1 && (
            <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-hide">
              <button
                onClick={() => setActiveDay(null)}
                className={clsx(
                  'flex-shrink-0 px-3 py-1 rounded-full text-[11px] font-bold transition-all border',
                  activeDay === null
                    ? 'bg-primary-600 text-white border-primary-600'
                    : 'bg-white dark:bg-slate-800 text-gray-500 border-gray-200 dark:border-slate-700'
                )}
              >
                Wszystkie ({results.length})
              </button>
              {daysInResults.map(day => {
                const count = results.filter(r => r.dayLabel === day).length;
                return (
                  <button
                    key={day}
                    onClick={() => setActiveDay(day === activeDay ? null : day)}
                    className={clsx(
                      'flex-shrink-0 px-3 py-1 rounded-full text-[11px] font-bold transition-all border',
                      activeDay === day
                        ? 'bg-primary-600 text-white border-primary-600'
                        : 'bg-white dark:bg-slate-800 text-gray-500 border-gray-200 dark:border-slate-700'
                    )}
                  >
                    {day} ({count})
                  </button>
                );
              })}
            </div>
          )}

          {/* Przyciski gatunków — kotwice przewijania */}
          {sortedGenres.length > 1 && (
            <div className="flex gap-1.5 overflow-x-auto pt-1 scrollbar-hide">
              {sortedGenres.map(genre => (
                <button
                  key={genre}
                  onClick={() => scrollToGenre(genre)}
                  className="flex-shrink-0 px-2.5 py-0.5 rounded-full text-[10px] font-bold border bg-white dark:bg-slate-800 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-slate-600 hover:border-primary-500 hover:text-primary-600 dark:hover:text-primary-400 transition-all capitalize"
                >
                  {genre} <span className="text-gray-400">({genreGroups.get(genre)!.length})</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Lista wyników */}
        <div
          ref={resultsScrollRef}
          className="flex-1 overflow-y-auto"
          style={{ WebkitOverflowScrolling: 'touch', overscrollBehavior: 'contain' } as React.CSSProperties}
        >
          {visibleResults.length === 0 ? (
            <div className="flex flex-col items-center justify-center min-h-[200px] px-8 text-center gap-3 py-8">
              <Search size={32} className="text-gray-300" />
              <p className="text-gray-500 font-medium">Brak wyników</p>
              <p className="text-xs text-gray-400">Spróbuj złagodzić kryteria filtrowania</p>
              {zeroResultsHint && (
                <div className="mt-1 px-4 py-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-2xl">
                  <p className="text-xs text-amber-700 dark:text-amber-400 font-semibold">💡 {zeroResultsHint}</p>
                </div>
              )}
            </div>
          ) : (
            <>
              {sortedGenres.map(genre => (
                <div
                  key={genre}
                  ref={el => {
                    if (el) genreSectionRefs.current.set(genre, el);
                    else genreSectionRefs.current.delete(genre);
                  }}
                >
                  {/* Nagłówek gatunku */}
                  <div className="px-4 py-2 bg-gray-50 dark:bg-slate-900 sticky top-0 z-10 flex items-center gap-2 border-b border-gray-100 dark:border-slate-800">
                    <span className="text-xs font-bold text-gray-600 dark:text-gray-300 uppercase tracking-wider capitalize">{genre}</span>
                    <span className="text-[10px] text-gray-400">— {pluralFilms(genreGroups.get(genre)!.length)}</span>
                  </div>
                  <div className="px-4 pt-2 pb-3 flex flex-col gap-2">
                    {genreGroups.get(genre)!.map(item => (
                      <ResultCard
                        key={`${item.program.id}-${item.program.startTime.getTime()}`}
                        item={item}
                        isFavorite={isFavoriteProgram(item.program.id)}
                        onAddFavorite={() => addFavorite(item.program)}
                        onOpenProgram={setSelectedProgram}
                      />
                    ))}
                  </div>
                </div>
              ))}
              <div style={{ height: 'max(16px, env(safe-area-inset-bottom))' }} />
            </>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center"
         style={{ paddingTop: 'max(env(safe-area-inset-top), 48px)' }}>
      <div
        className={clsx('absolute inset-0 bg-black/50 backdrop-blur-sm modal-backdrop', sheetVisible ? 'modal-visible' : 'modal-hidden')}
        style={{ touchAction: 'none' }}
        onClick={handleClose}
      />
      <div
        className={clsx('relative w-full max-w-lg bg-white dark:bg-slate-900 rounded-t-3xl shadow-2xl flex flex-col sheet-panel', sheetVisible ? 'sheet-visible' : 'sheet-hidden')}
        style={{ maxHeight: '100%', overscrollBehavior: 'contain' }}
      >

        {/* Nagłówek */}
        <div className="flex-shrink-0 px-4 pt-3 pb-3 border-b border-gray-100 dark:border-slate-800">
          <div className="w-10 h-1 bg-gray-300 dark:bg-slate-600 rounded-full mx-auto mb-3" />
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-primary-600 flex items-center justify-center">
                <Sparkles size={16} className={clsx("text-white", phase === 'loading' && "animate-spin-slow")} />
              </div>
              <div>
                <h2 className="text-base font-bold text-gray-900 dark:text-white leading-tight">Smart Filter</h2>
                <p className="text-[10px] text-gray-400">{phase === 'results' ? `${results.length} wyników` : 'Filtruj z Filmweb'}</p>
              </div>
            </div>
            <button onClick={handleClose} className="w-8 h-8 rounded-full bg-gray-100 dark:bg-slate-800 flex items-center justify-center text-gray-500 hover:text-gray-700 transition-colors">
              <X size={16} />
            </button>
          </div>
        </div>

        <div className="flex-1 flex flex-col min-h-0" style={{ touchAction: 'pan-y' }}>
          {phase === 'filters' && renderFilters()}
          {phase === 'loading' && renderLoading()}
          {phase === 'results' && renderResults()}
        </div>
      </div>
    </div>
  );
}

// ── Komponenty pomocnicze ─────────────────────────────────

function FilterSection({ title, icon, children, onReset }: { title: string; icon: React.ReactNode; children: React.ReactNode; onReset?: () => void }) {
  return (
    <div className="mt-5 first:mt-4">
      <div className="flex items-center justify-between mb-2.5">
        <div className="flex items-center gap-1.5">
          <span className="text-primary-600">{icon}</span>
          <h3 className="text-sm font-bold text-gray-700 dark:text-gray-300">{title}</h3>
        </div>
        {onReset && (
          <button onClick={onReset} className="text-[11px] font-semibold text-red-500 hover:text-red-700 transition-colors px-2 py-0.5 rounded-full hover:bg-red-50 dark:hover:bg-red-900/20">
            Wyczyść
          </button>
        )}
      </div>
      {children}
    </div>
  );
}

function Chip({ label, active, onClick, activeClass, inactiveClass }: {
  label: string; active: boolean; onClick: () => void; activeClass?: string; inactiveClass?: string;
}) {
  return (
    <button
      onClick={onClick}
      className={clsx(
        'px-3 py-1.5 rounded-full text-xs font-semibold border transition-all capitalize',
        active
          ? (activeClass ?? 'bg-primary-600 text-white border-primary-600')
          : (inactiveClass ?? 'bg-gray-50 dark:bg-slate-800') + ' text-gray-600 dark:text-gray-400 border-gray-200 dark:border-slate-700 hover:border-primary-400'
      )}
    >
      {label}
    </button>
  );
}

function ResultCard({ item, isFavorite, onAddFavorite, onOpenProgram }: { item: FilteredProgram; isFavorite: boolean; onAddFavorite: () => void; onOpenProgram: (p: Program) => void }) {
  const { program, channel, filmweb } = item;

  return (
    <div
      className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-100 dark:border-slate-700 shadow-sm active:shadow-none transition-all overflow-hidden cursor-pointer"
      onClick={() => onOpenProgram(program)}
    >
      <div className="flex gap-3 p-3">
        <div className="w-11 h-14 rounded-xl bg-gray-50 dark:bg-slate-700 flex items-center justify-center text-2xl flex-shrink-0 border border-gray-100 dark:border-slate-600">
          {channel.logoEmoji ?? '📺'}
        </div>

        <div className="flex-1 min-w-0">
          <p className="font-bold text-sm text-gray-900 dark:text-white leading-tight truncate">{program.title}</p>
          {filmweb?.originalTitle && filmweb.originalTitle !== program.title && (
            <p className="text-[11px] text-gray-400 truncate italic">{filmweb.originalTitle}</p>
          )}
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            {filmweb?.rate != null && (
              <span className="flex items-center gap-0.5 text-xs font-bold text-amber-600 dark:text-amber-400">
                <Star size={11} className="fill-amber-400 text-amber-400" />{filmweb.rate.toFixed(1)}
              </span>
            )}
            {filmweb?.year && <span className="text-xs text-gray-400">{filmweb.year}</span>}
            {filmweb?.countries?.[0] && <span className="text-xs text-gray-400">{filmweb.countries[0]}</span>}
            {filmweb?.genres?.[0] && (
              <span className="text-[10px] px-1.5 py-0.5 bg-gray-100 dark:bg-slate-700 rounded-full text-gray-500 dark:text-gray-400 capitalize">
                {filmweb.genres[0]}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1.5 mt-1">
            <span className="text-xs text-gray-500 dark:text-gray-400">
              {channel.shortName} · {formatTime(program.startTime)}–{formatTime(program.endTime)}
            </span>
          </div>
        </div>

        {/* Ulubione — szybka akcja bez otwierania modala */}
        <button
          onClick={e => { e.stopPropagation(); if (!isFavorite) onAddFavorite(); }}
          className={clsx(
            'flex-shrink-0 self-center p-2 rounded-xl transition-colors',
            isFavorite
              ? 'text-red-500'
              : 'text-gray-300 hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20'
          )}
        >
          <Heart size={17} className={clsx(isFavorite && 'fill-red-500')} />
        </button>
      </div>
    </div>
  );
}
