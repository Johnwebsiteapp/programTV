// ============================================================
// WIDOK WYSZUKIWANIA I FILTROWANIA
// Wyniki wyszukiwania tekstowego i filtrów gatunków.
// ============================================================

import { useMemo, useEffect } from 'react';
import { Search, X, Filter, Zap } from 'lucide-react';
import { useAppStore, programMatchesFilters } from '../../store/useAppStore';
import { GenreBadge, GENRE_LABELS } from '../ui/Badge';
import { formatTime, formatDate } from '../../utils/dateUtils';
import { ProgramGenre } from '../../types';
import { CHANNELS } from '../../data/channels';
import clsx from 'clsx';

const ALL_GENRES: ProgramGenre[] = [
  'movie', 'series', 'sport', 'documentary', 'news',
  'kids', 'entertainment', 'music', 'magazin', 'other'
];

export function SearchView() {
  const { programs, filters, setFilters, resetFilters, setSelectedProgram, categories } = useAppStore();

  // Wyczyść searchQuery gdy widok jest opuszczany
  useEffect(() => {
    return () => setFilters({ searchQuery: '' });
  }, []);

  const results = useMemo(() => {
    if (!filters.searchQuery && filters.genres.length === 0 && !filters.categoryId && !filters.country) {
      return [];
    }
    const now = new Date();
    return programs
      .filter(p => programMatchesFilters(p, filters, categories, now))
      .sort((a, b) => a.startTime.getTime() - b.startTime.getTime())
      .slice(0, 100); // Limit wyników
  }, [programs, filters, categories]);

  const hasActiveFilters = filters.searchQuery || filters.genres.length > 0 || filters.categoryId || filters.country;

  return (
    <div className="flex flex-col h-full">
      {/* Pasek wyszukiwania */}
      <div className="p-4 bg-white dark:bg-slate-800 border-b border-gray-200 dark:border-slate-700">
        <div className="relative mb-3">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={filters.searchQuery}
            onChange={e => setFilters({ searchQuery: e.target.value })}
            placeholder="Szukaj programu, serialu, filmu..."
            className="w-full pl-9 pr-4 py-2.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-slate-700 rounded-xl text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
            autoFocus
          />
          {filters.searchQuery && (
            <button
              onClick={() => setFilters({ searchQuery: '' })}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              <X size={14} />
            </button>
          )}
        </div>

        {/* Filtry gatunków */}
        <div className="flex gap-1.5 overflow-x-auto no-scrollbar pb-1">
          {ALL_GENRES.map(genre => {
            const isActive = filters.genres.includes(genre);
            return (
              <button
                key={genre}
                onClick={() => {
                  const newGenres = isActive
                    ? filters.genres.filter(g => g !== genre)
                    : [...filters.genres, genre];
                  setFilters({ genres: newGenres });
                }}
                className={clsx(
                  'flex-shrink-0 px-2.5 py-1 rounded-full text-xs font-medium transition-all whitespace-nowrap border',
                  isActive
                    ? 'bg-primary-600 text-white border-primary-600'
                    : 'bg-white dark:bg-slate-800 text-gray-600 dark:text-gray-400 border-gray-200 dark:border-slate-700 hover:border-primary-400 hover:text-primary-600'
                )}
              >
                {GENRE_LABELS[genre]}
              </button>
            );
          })}
        </div>

        {/* Dodatkowe filtry */}
        <div className="flex items-center gap-3 mt-3 flex-wrap">
          {/* Tylko na żywo */}
          <button
            onClick={() => setFilters({ showOnlyLive: !filters.showOnlyLive })}
            className={clsx(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all border',
              filters.showOnlyLive
                ? 'bg-red-500 text-white border-red-500'
                : 'bg-white dark:bg-slate-800 text-gray-600 dark:text-gray-400 border-gray-200 dark:border-slate-700 hover:border-red-400 hover:text-red-500'
            )}
          >
            <Zap size={12} className={filters.showOnlyLive ? 'fill-current' : ''} />
            Na żywo
          </button>

          {/* Tylko ulubione kanały */}
          <button
            onClick={() => setFilters({ showOnlyFavoriteChannels: !filters.showOnlyFavoriteChannels })}
            className={clsx(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all border',
              filters.showOnlyFavoriteChannels
                ? 'bg-amber-500 text-white border-amber-500'
                : 'bg-white dark:bg-slate-800 text-gray-600 dark:text-gray-400 border-gray-200 dark:border-slate-700 hover:border-amber-400'
            )}
          >
            ❤️ Ulubione kanały
          </button>

          {/* Reset filtrów */}
          {hasActiveFilters && (
            <button
              onClick={resetFilters}
              className="ml-auto flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
            >
              <X size={12} />
              Wyczyść filtry
            </button>
          )}
        </div>
      </div>

      {/* Wyniki */}
      <div className="flex-1 overflow-y-auto p-4">
        {!hasActiveFilters && (
          <SearchTips />
        )}

        {hasActiveFilters && results.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <Search size={32} className="text-gray-300 dark:text-gray-600 mb-3" />
            <p className="text-gray-500 dark:text-gray-400 text-sm">Brak wyników dla podanych kryteriów.</p>
            <button onClick={resetFilters} className="mt-2 text-xs text-primary-600 hover:underline">
              Wyczyść filtry
            </button>
          </div>
        )}

        {results.length > 0 && (
          <>
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs text-gray-500 dark:text-gray-400">
                <span className="font-semibold text-gray-900 dark:text-white">{results.length}</span>
                {results.length === 100 ? '+ wyników (ograniczono do 100)' : ` wyników`}
              </p>
            </div>

            <div className="space-y-2">
              {results.map(program => {
                const channel = CHANNELS.find(c => c.id === program.channelId);
                const now = new Date();
                const isLive = program.startTime <= now && program.endTime > now;

                return (
                  <div
                    key={program.id}
                    onClick={() => setSelectedProgram(program)}
                    className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl p-3 cursor-pointer hover:border-primary-400 hover:shadow-sm transition-all flex items-start gap-3"
                  >
                    <div className="w-9 h-9 rounded-lg bg-gray-50 dark:bg-gray-800 flex items-center justify-center text-lg flex-shrink-0">
                      {channel?.logoEmoji}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                        <span className="text-xs text-gray-500 dark:text-gray-400">{channel?.name}</span>
                        <GenreBadge genre={program.genre} />
                        {isLive && (
                          <span className="text-[10px] font-bold text-red-500 flex items-center gap-0.5">
                            <span className="w-1 h-1 bg-red-500 rounded-full animate-live-pulse" />
                            LIVE
                          </span>
                        )}
                      </div>
                      <h3 className="font-semibold text-sm text-gray-900 dark:text-white truncate">
                        {program.title}
                        {program.originalTitle && program.originalTitle !== program.title && (
                          <span className="text-gray-400 font-normal text-xs ml-1">({program.originalTitle})</span>
                        )}
                      </h3>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                        {formatDate(program.startTime)} · {formatTime(program.startTime)}–{formatTime(program.endTime)}
                        {program.country && ` · ${program.country}`}
                        {program.year && ` · ${program.year}`}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function SearchTips() {
  return (
    <div className="text-center py-12 px-6">
      <div className="w-14 h-14 bg-primary-50 dark:bg-primary-900/20 rounded-full flex items-center justify-center mx-auto mb-4">
        <Filter size={22} className="text-primary-400" />
      </div>
      <h3 className="font-semibold text-gray-900 dark:text-white mb-2 text-sm">Szukaj i filtruj program</h3>
      <div className="text-xs text-gray-500 dark:text-gray-400 space-y-1 max-w-xs mx-auto">
        <p>🔍 Wpisz tytuł programu, serialu lub filmu</p>
        <p>🎬 Wybierz gatunek aby filtrować po typie</p>
        <p>⚡ Użyj filtru "Na żywo" aby znaleźć aktualne transmisje</p>
        <p>❤️ Pokaż program tylko z Twoich ulubionych kanałów</p>
      </div>
    </div>
  );
}
