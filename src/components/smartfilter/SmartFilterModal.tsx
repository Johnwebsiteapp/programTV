// ============================================================
// SMART FILTER — Inteligentne wyszukiwanie filmów/seriali
// Filtruje tygodniowy program + weryfikuje oceny na Filmweb
// ============================================================

import { useState, useCallback, useMemo, useEffect } from 'react';
import { X, Sparkles, Search, Star, Calendar, Globe, Tag, Tv, ExternalLink, ChevronLeft, ChevronRight, ChevronDown } from 'lucide-react';
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
  minRating: number;   // 0 = bez oceny Filmweb
}

interface FilteredProgram {
  program: Program;
  channel: Channel;
  filmweb: FilmwebData | null;
  dayLabel: string;
}

// ── Stałe ─────────────────────────────────────────────────

// Tolerancja oceny: gdy użytkownik wybierze np. 7.0 → pokazujemy ≥ 6.4
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

// ── Główny komponent ──────────────────────────────────────

interface Props {
  onClose: () => void;
}

export function SmartFilterModal({ onClose }: Props) {
  const { programs, channels } = useAppStore();

  const [criteria, setCriteria] = useState<SmartFilterCriteria>({
    types: ['film', 'serial'],
    excludedGenres: [],
    excludedCountries: [],
    minYear: 2010,
    minRating: 0,
  });

  const [phase, setPhase] = useState<'filters' | 'loading' | 'results'>('filters');
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [results, setResults] = useState<FilteredProgram[]>([]);
  const [zeroResultsHint, setZeroResultsHint] = useState<string | null>(null);
  // 0 = bieżący tydzień (od dziś), 1 = następny tydzień
  const [weekOffset, setWeekOffset] = useState(0);

  // Zablokuj scroll tła gdy modal jest otwarty (działa na iOS i Android)
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

  // Zakres tygodnia: od początku dnia (00:00) do +7 dni
  const { searchStart, searchEnd, weekLabel } = useMemo(() => {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const start = new Date(todayStart.getTime() + weekOffset * 7 * 24 * 60 * 60 * 1000);
    const end   = new Date(start.getTime() + 7 * 24 * 60 * 60 * 1000);
    const label = weekOffset === 0 ? 'Ten tydzień' : 'Następny tydzień';
    return { searchStart: start, searchEnd: end, weekLabel: label };
  }, [weekOffset]);

  const candidatePrograms = useMemo(() => {
    return programs.filter(p => {
      // Sprawdzamy startTime w zakresie całego tygodnia (od 00:00 dziś do +7 dni)
      if (p.startTime < searchStart || p.startTime >= searchEnd) return false;
      if (criteria.types.includes('film') && p.genre === 'movie') return true;
      if (criteria.types.includes('serial') && p.genre === 'series') return true;
      return false;
    });
  }, [programs, criteria.types, searchStart, searchEnd]);

  // Pomocnicza: sprawdź czy program przechodzi przez filtry (poza ratingiem)
  const passesNonRatingFilters = useCallback((
    p: Program,
    fw: FilmwebData | null,
  ): boolean => {
    if (fw?.year && fw.year < criteria.minYear) return false;
    if (criteria.excludedGenres.length > 0 && fw?.genres?.length) {
      if (criteria.excludedGenres.some(eg =>
        fw.genres.some(g => g.toLowerCase().includes(eg.toLowerCase()))
      )) return false;
    }
    if (criteria.excludedCountries.length > 0 && fw?.countries?.length) {
      if (criteria.excludedCountries.some(ec =>
        fw.countries.some(c => c.toLowerCase().includes(ec.toLowerCase()))
      )) return false;
    }
    if (!channels.find(c => c.id === p.channelId)) return false;
    return true;
  }, [criteria.excludedCountries, criteria.excludedGenres, criteria.minYear, channels]);

  // ── Uruchom wyszukiwanie ──────────────────────────────────
  const runSearch = useCallback(async () => {
    setPhase('loading');
    setZeroResultsHint(null);
    setProgress({ done: 0, total: candidatePrograms.length });

    // Unikalne tytuły (żeby nie odpytywać wielokrotnie tego samego)
    const uniqueTitles = [...new Set(candidatePrograms.map(p => p.title))];
    setProgress({ done: 0, total: uniqueTitles.length });

    const filmwebResults = await batchSearchFilmweb(
      uniqueTitles,
      (done, total) => setProgress({ done, total })
    );

    // Filtruj wyniki
    const filtered: FilteredProgram[] = [];

    for (const program of candidatePrograms) {
      const fw = filmwebResults[program.title] ?? null;
      const ch = channels.find(c => c.id === program.channelId);
      if (!ch) continue;

      // Filtr: minimalna ocena Filmweb z tolerancją ±RATING_TOLERANCE (tylko w dół)
      // Np. wybranie 7.0 pokaże filmy z oceną ≥ 6.4
      // WAŻNE: jeśli Filmweb nie znalazł tytułu (fw=null), NIE wykluczamy programu —
      // pokazujemy go bez oceny, bo może to być polska produkcja nieznana Filmwebowi.
      if (criteria.minRating > 0 && fw?.rate != null) {
        const effectiveMin = criteria.minRating - RATING_TOLERANCE;
        if (fw.rate < effectiveMin) continue;
      }

      if (!passesNonRatingFilters(program, fw)) continue;

      filtered.push({
        program,
        channel: ch,
        filmweb: fw,
        dayLabel: getDayLabel(program.startTime),
      });
    }

    // Sortuj: wg oceny Filmweb (malejąco), potem wg czasu emisji
    filtered.sort((a, b) => {
      const ra = a.filmweb?.rate ?? 0;
      const rb = b.filmweb?.rate ?? 0;
      if (rb !== ra) return rb - ra;
      return a.program.startTime.getTime() - b.program.startTime.getTime();
    });

    // Hint dla 0 wyników: jaką ocenę obniżyć żeby coś się pojawiło
    if (filtered.length === 0 && criteria.minRating > 0) {
      let hint: string | null = null;
      for (const step of [0.5, 1.0, 1.5, 2.0, 3.0]) {
        const testRating = Math.max(0, criteria.minRating - step);
        const effectiveMin = testRating - RATING_TOLERANCE;
        const count = candidatePrograms.filter(p => {
          const fw = filmwebResults[p.title] ?? null;
          // Nowa logika: tylko wykluczamy gdy mamy ocenę I jest za niska
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
    setCriteria(c => ({
      ...c,
      excludedGenres: c.excludedGenres.includes(g)
        ? c.excludedGenres.filter(x => x !== g)
        : [...c.excludedGenres, g],
    }));

  const toggleExcludedCountry = (country: string) =>
    setCriteria(c => ({
      ...c,
      excludedCountries: c.excludedCountries.includes(country)
        ? c.excludedCountries.filter(x => x !== country)
        : [...c.excludedCountries, country],
    }));

  const toggleType = (t: 'film' | 'serial') =>
    setCriteria(c => ({
      ...c,
      types: c.types.includes(t) ? c.types.filter(x => x !== t) : [...c.types, t],
    }));

  // ── Render: panel filtrów ─────────────────────────────────
  const renderFilters = () => (
    <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden', flex: 1, minHeight: 0 }}>
      <div style={{ flex: 1, overflowY: 'auto', WebkitOverflowScrolling: 'touch', minHeight: 0, padding: '0 16px 16px' } as React.CSSProperties}>

        {/* Przełącznik tygodnia */}
        <div className="mt-4 flex items-center justify-between bg-gray-50 dark:bg-slate-800 rounded-2xl px-3 py-2.5">
          <button
            onClick={() => setWeekOffset(0)}
            disabled={weekOffset === 0}
            className="p-1 text-gray-400 disabled:opacity-30 hover:text-primary-600 transition-colors"
          >
            <ChevronLeft size={16} />
          </button>
          <div className="text-center">
            <p className="text-sm font-bold text-gray-900 dark:text-white">{weekLabel}</p>
            <p className="text-[10px] text-gray-400">
              {searchStart.toLocaleDateString('pl-PL', { day: 'numeric', month: 'short' })} –{' '}
              {new Date(searchEnd.getTime() - 1).toLocaleDateString('pl-PL', { day: 'numeric', month: 'short' })}
            </p>
          </div>
          <button
            onClick={() => setWeekOffset(1)}
            disabled={weekOffset === 1}
            className="p-1 text-gray-400 disabled:opacity-30 hover:text-primary-600 transition-colors"
          >
            <ChevronRight size={16} />
          </button>
        </div>

        {/* Typ treści */}
        <FilterSection title="Szukaj w" icon={<Tv size={16} />}>
          <div className="flex gap-2">
            {(['film', 'serial'] as const).map(t => (
              <Chip
                key={t}
                label={t === 'film' ? 'Filmy' : 'Seriale'}
                active={criteria.types.includes(t)}
                onClick={() => toggleType(t)}
                activeClass="bg-primary-600 text-white"
              />
            ))}
          </div>
        </FilterSection>

        {/* Minimalna ocena Filmweb */}
        <FilterSection title="Minimalna ocena Filmweb" icon={<Star size={16} />}>
          <div className="flex items-center gap-3">
            <input
              type="range"
              min={0}
              max={10}
              step={0.5}
              value={criteria.minRating}
              onChange={e => setCriteria(c => ({ ...c, minRating: Number(e.target.value) }))}
              className="flex-1 accent-primary-600"
            />
            <div className="flex items-center gap-1 w-16">
              {criteria.minRating > 0 ? (
                <>
                  <Star size={14} className="text-amber-400 fill-amber-400" />
                  <span className="text-lg font-bold text-gray-900 dark:text-white">
                    {criteria.minRating.toFixed(1)}
                  </span>
                </>
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
            <input
              type="range"
              min={1980}
              max={2025}
              step={1}
              value={criteria.minYear}
              onChange={e => setCriteria(c => ({ ...c, minYear: Number(e.target.value) }))}
              className="flex-1 accent-primary-600"
            />
            <span className="text-lg font-bold text-gray-900 dark:text-white w-14 text-right">
              {criteria.minYear}
            </span>
          </div>
        </FilterSection>

        {/* Wyklucz gatunki */}
        <FilterSection title="Wyklucz gatunki" icon={<Tag size={16} />}>
          <div className="flex flex-wrap gap-2">
            {FILMWEB_GENRES.map(g => (
              <Chip
                key={g}
                label={g}
                active={criteria.excludedGenres.includes(g)}
                onClick={() => toggleExcludedGenre(g)}
                activeClass="bg-red-100 text-red-700 border-red-300 dark:bg-red-900/30 dark:text-red-400"
                inactiveClass="bg-gray-50 dark:bg-slate-800"
              />
            ))}
          </div>
          {criteria.excludedGenres.length > 0 && (
            <p className="text-xs text-red-500 mt-1.5">
              Wykluczone: {criteria.excludedGenres.join(', ')}
            </p>
          )}
        </FilterSection>

        {/* Wyklucz kraje produkcji */}
        <FilterSection title="Wyklucz kraje produkcji" icon={<Globe size={16} />}>
          <div className="flex flex-wrap gap-2">
            {COUNTRIES.map(c => (
              <Chip
                key={c}
                label={c}
                active={criteria.excludedCountries.includes(c)}
                onClick={() => toggleExcludedCountry(c)}
                activeClass="bg-red-100 text-red-700 border-red-300 dark:bg-red-900/30 dark:text-red-400"
                inactiveClass="bg-gray-50 dark:bg-slate-800"
              />
            ))}
          </div>
        </FilterSection>
      </div>

      {/* Podsumowanie aktywnych filtrów + przycisk szukaj */}
      <div className="px-4 pt-3 border-t border-gray-100 dark:border-slate-800 flex-shrink-0"
           style={{ paddingBottom: 'max(16px, env(safe-area-inset-bottom))' }}>

        {/* Aktywne filtry jako chipy */}
        {(criteria.minRating > 0 || criteria.minYear > 1980 || criteria.excludedGenres.length > 0 || criteria.excludedCountries.length > 0) && (
          <div className="flex flex-wrap gap-1.5 mb-2.5">
            {criteria.minRating > 0 && (
              <span className="flex items-center gap-0.5 text-[11px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 border border-amber-300 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-700">
                <Star size={9} className="fill-amber-500 text-amber-500" />
                ≥ {criteria.minRating.toFixed(1)}
              </span>
            )}
            {criteria.minYear > 1980 && (
              <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 border border-blue-200 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-700">
                od {criteria.minYear}
              </span>
            )}
            {criteria.excludedGenres.map(g => (
              <span key={g} className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-red-100 text-red-700 border border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-700">
                ✕ {g}
              </span>
            ))}
            {criteria.excludedCountries.map(c => (
              <span key={c} className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-red-100 text-red-700 border border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-700">
                ✕ {c}
              </span>
            ))}
          </div>
        )}

        <p className="text-xs text-gray-400 text-center mb-2.5">
          {candidatePrograms.length} programów do sprawdzenia ({weekLabel.toLowerCase()})
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
        <p className="font-bold text-gray-900 dark:text-white text-lg mb-1">
          Sprawdzam Filmweb...
        </p>
        <p className="text-sm text-gray-500">
          {progress.done} / {progress.total} tytułów
        </p>
      </div>
      <div className="w-full bg-gray-100 dark:bg-slate-800 rounded-full h-2">
        <div
          className="h-2 bg-primary-600 rounded-full transition-all duration-300"
          style={{ width: progress.total ? `${(progress.done / progress.total) * 100}%` : '0%' }}
        />
      </div>
      <p className="text-xs text-gray-400 text-center">
        Pobieranie ocen i szczegółów z Filmweb.pl
      </p>
    </div>
  );

  // ── Render: wyniki ────────────────────────────────────────
  const renderResults = () => {
    // Grupuj po dniu
    const byDay: Record<string, FilteredProgram[]> = {};
    for (const item of results) {
      const key = item.dayLabel;
      if (!byDay[key]) byDay[key] = [];
      byDay[key].push(item);
    }

    return (
      <div className="flex-1 flex flex-col min-h-0">
        {/* Nagłówek wyników */}
        <div className="flex-shrink-0 px-4 py-3 bg-primary-50 dark:bg-primary-900/20 border-b border-primary-100 dark:border-primary-800">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles size={16} className="text-primary-600" />
              <span className="font-bold text-primary-700 dark:text-primary-400">
                {results.length} wyników · {weekLabel}
              </span>
            </div>
            <button
              onClick={() => setPhase('filters')}
              className="text-xs text-primary-600 font-semibold flex items-center gap-1"
            >
              Zmień filtry
            </button>
          </div>
          {criteria.minRating > 0 && (
            <p className="text-xs text-primary-600/70 mt-0.5">
              Ocena ≥ {(criteria.minRating - RATING_TOLERANCE).toFixed(1)}
              {criteria.minRating !== criteria.minRating - RATING_TOLERANCE && ` (tolerancja od ${criteria.minRating.toFixed(1)})`}
              {' · '}od {criteria.minYear} r.
              {criteria.excludedGenres.length > 0 && ` · bez: ${criteria.excludedGenres.join(', ')}`}
            </p>
          )}
        </div>

        {/* Lista wyników — scrollowalna */}
        <div
          className="flex-1 overflow-y-auto"
          style={{ WebkitOverflowScrolling: 'touch', overscrollBehavior: 'contain' } as React.CSSProperties}
        >
          {results.length === 0 ? (
            <div className="flex flex-col items-center justify-center min-h-[200px] px-8 text-center gap-3 py-8">
              <Search size={32} className="text-gray-300" />
              <p className="text-gray-500 font-medium">Brak wyników</p>
              <p className="text-xs text-gray-400">Spróbuj złagodzić kryteria filtrowania</p>
              {zeroResultsHint && (
                <div className="mt-1 px-4 py-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-2xl">
                  <p className="text-xs text-amber-700 dark:text-amber-400 font-semibold">
                    💡 {zeroResultsHint}
                  </p>
                </div>
              )}
            </div>
          ) : (
            <>
              {Object.entries(byDay).map(([day, items]) => (
                <div key={day}>
                  <div className="px-4 py-2 bg-gray-50 dark:bg-slate-900 sticky top-0 z-10">
                    <span className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      {day} — {pluralFilms(items.length)}
                    </span>
                  </div>
                  <div className="px-4 pb-2 flex flex-col gap-2">
                    {items.map(item => (
                      <ResultCard key={`${item.program.id}-${item.program.startTime.getTime()}`} item={item} />
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
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        style={{ touchAction: 'none' }}
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-lg bg-white dark:bg-slate-900 rounded-t-3xl shadow-2xl flex flex-col"
           style={{ maxHeight: 'min(92svh, 92vh)', overscrollBehavior: 'contain' }}>

        {/* Uchwyt + nagłówek */}
        <div className="flex-shrink-0 px-4 pt-3 pb-3 border-b border-gray-100 dark:border-slate-800">
          <div className="w-10 h-1 bg-gray-300 dark:bg-slate-600 rounded-full mx-auto mb-3" />
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-primary-600 flex items-center justify-center">
                <Sparkles size={16} className={clsx("text-white", phase === 'loading' && "animate-spin-slow")} />
              </div>
              <div>
                <h2 className="text-base font-bold text-gray-900 dark:text-white leading-tight">
                  Smart Filter
                </h2>
                <p className="text-[10px] text-gray-400">
                  {phase === 'results' ? `${results.length} wyników` : 'Filtruj z Filmweb'}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-gray-100 dark:bg-slate-800 flex items-center justify-center text-gray-500 hover:text-gray-700 transition-colors"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Treść — flex-1 bez overflow:hidden żeby scroll działał */}
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

function FilterSection({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="mt-5 first:mt-4">
      <div className="flex items-center gap-1.5 mb-2.5">
        <span className="text-primary-600">{icon}</span>
        <h3 className="text-sm font-bold text-gray-700 dark:text-gray-300">{title}</h3>
      </div>
      {children}
    </div>
  );
}

function Chip({
  label, active, onClick, activeClass, inactiveClass,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  activeClass?: string;
  inactiveClass?: string;
}) {
  return (
    <button
      onClick={onClick}
      className={clsx(
        'px-3 py-1.5 rounded-full text-xs font-semibold border transition-all capitalize',
        active
          ? (activeClass ?? 'bg-primary-600 text-white border-primary-600')
          : (inactiveClass ?? 'bg-gray-50 dark:bg-slate-800') +
            ' text-gray-600 dark:text-gray-400 border-gray-200 dark:border-slate-700 hover:border-primary-400'
      )}
    >
      {label}
    </button>
  );
}

function ResultCard({ item }: { item: FilteredProgram }) {
  const [expanded, setExpanded] = useState(false);
  const { program, channel, filmweb } = item;

  return (
    <div
      className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-100 dark:border-slate-700 shadow-sm hover:shadow-md transition-all overflow-hidden"
    >
      {/* Główna karta — kliknij żeby rozwinąć */}
      <div
        className="flex gap-3 p-3 cursor-pointer"
        onClick={() => setExpanded(e => !e)}
      >
        {/* Kanał emoji */}
        <div className="w-11 h-14 rounded-xl bg-gray-50 dark:bg-slate-700 flex items-center justify-center text-2xl flex-shrink-0 border border-gray-100 dark:border-slate-600">
          {channel.logoEmoji ?? '📺'}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <p className="font-bold text-sm text-gray-900 dark:text-white leading-tight truncate">
            {program.title}
          </p>

          {filmweb?.originalTitle && filmweb.originalTitle !== program.title && (
            <p className="text-[11px] text-gray-400 truncate italic">{filmweb.originalTitle}</p>
          )}

          <div className="flex items-center gap-2 mt-1 flex-wrap">
            {/* Ocena */}
            {filmweb?.rate != null && (
              <span className="flex items-center gap-0.5 text-xs font-bold text-amber-600 dark:text-amber-400">
                <Star size={11} className="fill-amber-400 text-amber-400" />
                {filmweb.rate.toFixed(1)}
              </span>
            )}

            {/* Rok */}
            {filmweb?.year && (
              <span className="text-xs text-gray-400">{filmweb.year}</span>
            )}

            {/* Kraj */}
            {filmweb?.countries?.[0] && (
              <span className="text-xs text-gray-400">{filmweb.countries[0]}</span>
            )}

            {/* Gatunek */}
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

        {/* Rozwiń / zwiń */}
        <div className="flex-shrink-0 flex flex-col items-center gap-1 self-start mt-0.5">
          <ChevronDown
            size={16}
            className={clsx(
              'text-gray-300 transition-transform',
              expanded && 'rotate-180'
            )}
          />
        </div>
      </div>

      {/* Rozwinięte szczegóły */}
      {expanded && (
        <div className="px-3 pb-3 border-t border-gray-100 dark:border-slate-700">
          <div className="pt-3 flex flex-col gap-2">
            {/* Wszystkie kraje */}
            {filmweb?.countries && filmweb.countries.length > 0 && (
              <div className="flex items-start gap-1.5">
                <Globe size={12} className="text-gray-400 mt-0.5 flex-shrink-0" />
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  {filmweb.countries.join(', ')}
                </span>
              </div>
            )}

            {/* Wszystkie gatunki */}
            {filmweb?.genres && filmweb.genres.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {filmweb.genres.map(g => (
                  <span key={g} className="text-[10px] px-1.5 py-0.5 bg-gray-100 dark:bg-slate-700 rounded-full text-gray-500 dark:text-gray-400 capitalize">
                    {g}
                  </span>
                ))}
              </div>
            )}

            {/* Opis/synopsis */}
            {(filmweb?.synopsis || program.description) && (
              <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed line-clamp-4">
                {filmweb?.synopsis || program.description}
              </p>
            )}

            {/* Link do Filmweb */}
            {filmweb?.filmwebUrl && (
              <a
                href={filmweb.filmwebUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={e => e.stopPropagation()}
                className="flex items-center gap-1.5 text-xs text-primary-600 font-semibold hover:underline w-fit mt-0.5"
              >
                <ExternalLink size={12} />
                Otwórz na Filmweb
              </a>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
