// ============================================================
// SMART FILTER — Inteligentne wyszukiwanie filmów/seriali
// Filtruje tygodniowy program + weryfikuje oceny na Filmweb
// ============================================================

import { useState, useCallback, useMemo, useEffect } from 'react';
import { X, Sparkles, Search, Star, Calendar, Globe, Tag, Loader2, Tv, ChevronRight, ExternalLink } from 'lucide-react';
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

const FILMWEB_GENRES = [
  'sci-fi', 'horror', 'animacja', 'dokumentalny', 'fantasy',
  'wojenny', 'western', 'musical', 'erotyczny', 'familijny',
];

const COUNTRIES = [
  'Francja', 'Niemcy', 'Wielka Brytania', 'Polska', 'Włochy',
  'Rosja', 'Hiszpania', 'Japonia', 'Korea Południowa', 'Chiny',
  'Indie', 'Australia', 'Meksyk', 'Brazylia', 'Szwecja',
];

const DAY_NAMES = ['Niedziela', 'Poniedziałek', 'Wtorek', 'Środa', 'Czwartek', 'Piątek', 'Sobota'];

function formatTime(d: Date) {
  return d.toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' });
}

function getDayLabel(date: Date): string {
  const today = new Date();
  const diff = Math.round((date.getTime() - today.setHours(0,0,0,0)) / 86400000);
  if (diff === 0) return 'Dziś';
  if (diff === 1) return 'Jutro';
  return DAY_NAMES[date.getDay()];
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

  // Programy filmowe/serialowe z całego tygodnia
  const candidatePrograms = useMemo(() => {
    const now = new Date();
    const weekEnd = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    return programs.filter(p => {
      if (p.startTime < now || p.startTime > weekEnd) return false;
      if (criteria.types.includes('film') && (p.genre === 'movie')) return true;
      if (criteria.types.includes('serial') && (p.genre === 'series')) return true;
      return false;
    });
  }, [programs, criteria.types]);

  // ── Uruchom wyszukiwanie ──────────────────────────────────
  const runSearch = useCallback(async () => {
    setPhase('loading');
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

      // Filtr: minimalna ocena Filmweb (pomijamy jeśli brak danych)
      if (criteria.minRating > 0) {
        if (!fw?.rate || fw.rate < criteria.minRating) continue;
      }

      // Filtr: rok produkcji
      if (fw?.year && fw.year < criteria.minYear) continue;
      // Jeśli Filmweb nie zwrócił roku, nie wykluczamy (może być nowy)

      // Filtr: wykluczone gatunki Filmweb
      if (criteria.excludedGenres.length > 0 && fw?.genres?.length) {
        const hasExcluded = criteria.excludedGenres.some(eg =>
          fw.genres.some(g => g.toLowerCase().includes(eg.toLowerCase()))
        );
        if (hasExcluded) continue;
      }

      // Filtr: wykluczone kraje produkcji
      if (criteria.excludedCountries.length > 0 && fw?.countries?.length) {
        const hasExcluded = criteria.excludedCountries.some(ec =>
          fw.countries.some(c => c.toLowerCase().includes(ec.toLowerCase()))
        );
        if (hasExcluded) continue;
      }

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

    setResults(filtered);
    setPhase('results');
  }, [candidatePrograms, channels, criteria]);

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
              Filmy z oceną ≥ {criteria.minRating.toFixed(1)} na Filmweb
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

      {/* Przycisk szukaj */}
      <div className="px-4 pt-3 border-t border-gray-100 dark:border-slate-800 flex-shrink-0"
           style={{ paddingBottom: 'max(16px, env(safe-area-inset-bottom))' }}>
        <p className="text-xs text-gray-400 text-center mb-3">
          {candidatePrograms.length} programów do sprawdzenia w tym tygodniu
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
        <Sparkles size={28} className="text-primary-600 animate-pulse" />
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
      <div className="flex flex-col h-full">
        {/* Nagłówek wyników */}
        <div className="px-4 py-3 bg-primary-50 dark:bg-primary-900/20 border-b border-primary-100 dark:border-primary-800">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles size={16} className="text-primary-600" />
              <span className="font-bold text-primary-700 dark:text-primary-400">
                {results.length} wyników
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
              Ocena ≥ {criteria.minRating.toFixed(1)} · od {criteria.minYear} r.
              {criteria.excludedGenres.length > 0 && ` · bez: ${criteria.excludedGenres.join(', ')}`}
            </p>
          )}
        </div>

        <div className="flex-1 overflow-y-auto" style={{ WebkitOverflowScrolling: 'touch' } as React.CSSProperties}>
          {results.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 px-8 text-center gap-3">
              <Search size={32} className="text-gray-300" />
              <p className="text-gray-500 font-medium">Brak wyników</p>
              <p className="text-xs text-gray-400">Spróbuj złagodzić kryteria filtrowania</p>
            </div>
          ) : (
            Object.entries(byDay).map(([day, items]) => (
              <div key={day}>
                <div className="px-4 py-2 bg-gray-50 dark:bg-slate-900 sticky top-0 z-10">
                  <span className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    {day} — {items.length} {items.length === 1 ? 'film' : 'filmy/filmów'}
                  </span>
                </div>
                <div className="px-4 pb-2 flex flex-col gap-2">
                  {items.map(item => (
                    <ResultCard key={item.program.id} item={item} />
                  ))}
                </div>
              </div>
            ))
          )}
          <div className="h-4" />
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
           style={{ maxHeight: 'min(90svh, 90vh)', overscrollBehavior: 'contain' }}>

        {/* Uchwyt + nagłówek */}
        <div className="flex-shrink-0 px-4 pt-3 pb-3 border-b border-gray-100 dark:border-slate-800">
          <div className="w-10 h-1 bg-gray-300 dark:bg-slate-600 rounded-full mx-auto mb-3" />
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-primary-600 flex items-center justify-center">
                <Sparkles size={16} className="text-white" />
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

        {/* Treść */}
        <div className="flex-1 flex flex-col min-h-0" style={{ touchAction: 'pan-y', overflow: 'hidden' }}>
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
  const { setSelectedProgram } = useAppStore();
  const { program, channel, filmweb } = item;

  return (
    <div
      onClick={() => setSelectedProgram(program)}
      className="flex gap-3 bg-white dark:bg-slate-800 rounded-2xl p-3 border border-gray-100 dark:border-slate-700 shadow-sm hover:shadow-md transition-all cursor-pointer"
    >
      {/* Kanał emoji */}
      <div className="w-11 h-16 rounded-xl bg-gray-50 dark:bg-slate-700 flex items-center justify-center text-2xl flex-shrink-0 border border-gray-100 dark:border-slate-600">
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

        <div className="flex items-center gap-1.5 mt-1.5">
          <span className="text-xs text-gray-500 dark:text-gray-400">
            {channel.shortName} · {formatTime(program.startTime)}–{formatTime(program.endTime)}
          </span>
        </div>
      </div>

      {/* Link do Filmweb */}
      {filmweb?.filmwebUrl && (
        <a
          href={filmweb.filmwebUrl}
          target="_blank"
          rel="noopener noreferrer"
          onClick={e => e.stopPropagation()}
          className="flex-shrink-0 self-start mt-0.5 p-1.5 rounded-lg text-gray-300 hover:text-primary-600 hover:bg-primary-50 dark:hover:bg-primary-900/20 transition-colors"
        >
          <ExternalLink size={14} />
        </a>
      )}
    </div>
  );
}
