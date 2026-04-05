// ============================================================
// PASEK FILTRÓW W WIDOKU EPG
// ============================================================

import { SlidersHorizontal, Heart, Zap, X } from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';
import { ProgramGenre } from '../../types';
import { GENRE_LABELS } from '../ui/Badge';
import clsx from 'clsx';

const QUICK_GENRES: ProgramGenre[] = ['movie', 'series', 'sport', 'documentary', 'news', 'kids'];

export function FilterBar() {
  const { filters, setFilters, resetFilters, categories } = useAppStore();

  const hasActiveFilters =
    filters.genres.length > 0 ||
    filters.showOnlyFavoriteChannels ||
    filters.showOnlyLive ||
    filters.categoryId;

  return (
    <div className="flex items-center gap-2 px-3 py-2 bg-white dark:bg-slate-900 border-b border-gray-100 dark:border-slate-800 overflow-x-auto no-scrollbar">
      {/* Ikona filtrów */}
      <SlidersHorizontal
        size={14}
        className={clsx(
          'flex-shrink-0 transition-colors',
          hasActiveFilters ? 'text-primary-600 dark:text-primary-400' : 'text-gray-400'
        )}
      />

      {/* Filtry szybkie: gatunki */}
      {QUICK_GENRES.map(genre => {
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
              'flex-shrink-0 px-2.5 py-1 rounded-full text-xs font-medium transition-all whitespace-nowrap',
              isActive
                ? 'bg-primary-600 text-white shadow-sm'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'
            )}
          >
            {GENRE_LABELS[genre]}
          </button>
        );
      })}

      {/* Separator */}
      <div className="w-px h-4 bg-gray-200 dark:bg-gray-600 flex-shrink-0" />

      {/* Tylko na żywo */}
      <button
        onClick={() => setFilters({ showOnlyLive: !filters.showOnlyLive })}
        className={clsx(
          'flex-shrink-0 flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium transition-all',
          filters.showOnlyLive
            ? 'bg-red-500 text-white shadow-sm'
            : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'
        )}
      >
        <Zap size={11} className={filters.showOnlyLive ? 'fill-current' : ''} />
        Live
      </button>

      {/* Tylko ulubione kanały */}
      <button
        onClick={() => setFilters({ showOnlyFavoriteChannels: !filters.showOnlyFavoriteChannels })}
        className={clsx(
          'flex-shrink-0 flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium transition-all',
          filters.showOnlyFavoriteChannels
            ? 'bg-amber-400 text-white shadow-sm'
            : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'
        )}
      >
        <Heart size={11} className={filters.showOnlyFavoriteChannels ? 'fill-current' : ''} />
        Ulubione
      </button>

      {/* Kategorie niestandardowe */}
      {categories.length > 0 && (
        <>
          <div className="w-px h-4 bg-gray-200 dark:bg-gray-600 flex-shrink-0" />
          {categories.map(cat => (
            <button
              key={cat.id}
              onClick={() => setFilters({ categoryId: filters.categoryId === cat.id ? undefined : cat.id })}
              className={clsx(
                'flex-shrink-0 flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-all whitespace-nowrap',
                filters.categoryId === cat.id
                  ? 'text-white shadow-sm'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'
              )}
              style={filters.categoryId === cat.id ? { backgroundColor: cat.color } : undefined}
            >
              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: cat.color }} />
              {cat.name}
            </button>
          ))}
        </>
      )}

      {/* Wyczyść filtry */}
      {hasActiveFilters && (
        <>
          <div className="w-px h-4 bg-gray-200 dark:bg-gray-600 flex-shrink-0" />
          <button
            onClick={resetFilters}
            className="flex-shrink-0 flex items-center gap-1 px-2 py-1 rounded-full text-xs text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
          >
            <X size={12} />
            Wyczyść
          </button>
        </>
      )}
    </div>
  );
}
