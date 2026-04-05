// ============================================================
// WIDOK ULUBIONYCH PROGRAMÓW
// ============================================================

import { Heart, Calendar, Clock, Trash2, Eye, EyeOff } from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';
import { GenreBadge } from '../ui/Badge';
import { formatTime, formatDate, formatDuration } from '../../utils/dateUtils';
import { CHANNELS } from '../../data/channels';
import clsx from 'clsx';

export function FavoritesList() {
  const { favorites, removeFavorite, toggleFavoriteWatched, setSelectedProgram } = useAppStore();

  const sorted = [...favorites].sort(
    (a, b) => b.addedAt.getTime() - a.addedAt.getTime()
  );

  const unwatched = sorted.filter(f => !f.watched);
  const watched = sorted.filter(f => f.watched);

  if (favorites.length === 0) {
    return (
      <EmptyState />
    );
  }

  return (
    <div className="max-w-2xl mx-auto p-4">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
          Moje ulubione
        </h2>
        <span className="text-sm text-gray-500 dark:text-gray-400">
          {favorites.length} {favorites.length === 1 ? 'program' : 'programów'}
        </span>
      </div>

      {/* Do obejrzenia */}
      {unwatched.length > 0 && (
        <section className="mb-6">
          <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">
            Do obejrzenia ({unwatched.length})
          </h3>
          <div className="space-y-2">
            {unwatched.map(fav => (
              <FavoriteCard
                key={fav.id}
                favorite={fav}
                onRemove={() => removeFavorite(fav.id)}
                onToggleWatched={() => toggleFavoriteWatched(fav.id)}
                onOpen={() => setSelectedProgram(fav.program)}
              />
            ))}
          </div>
        </section>
      )}

      {/* Obejrzane */}
      {watched.length > 0 && (
        <section>
          <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">
            Obejrzane ({watched.length})
          </h3>
          <div className="space-y-2 opacity-60">
            {watched.map(fav => (
              <FavoriteCard
                key={fav.id}
                favorite={fav}
                onRemove={() => removeFavorite(fav.id)}
                onToggleWatched={() => toggleFavoriteWatched(fav.id)}
                onOpen={() => setSelectedProgram(fav.program)}
              />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function FavoriteCard({ favorite, onRemove, onToggleWatched, onOpen }: {
  favorite: import('../../types').Favorite;
  onRemove: () => void;
  onToggleWatched: () => void;
  onOpen: () => void;
}) {
  const { program } = favorite;
  const channel = CHANNELS.find(c => c.id === program.channelId);

  return (
    <div className={clsx(
      'bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700',
      'p-4 flex items-start gap-3 transition-all',
      favorite.watched && 'opacity-70'
    )}>
      {/* Ikona kanału */}
      <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-gray-50 dark:bg-gray-800 flex items-center justify-center text-xl">
        {channel?.logoEmoji}
      </div>

      {/* Treść */}
      <div className="flex-1 min-w-0 cursor-pointer" onClick={onOpen}>
        <div className="flex items-center gap-2 mb-1">
          <span className="text-xs text-gray-500 dark:text-gray-400">{channel?.name}</span>
          <GenreBadge genre={program.genre} />
        </div>

        <h3 className={clsx(
          'font-semibold text-gray-900 dark:text-white text-sm truncate',
          favorite.watched && 'line-through text-gray-500'
        )}>
          {program.title}
        </h3>

        <div className="flex items-center gap-3 mt-1 text-xs text-gray-500 dark:text-gray-400">
          <span className="flex items-center gap-1">
            <Calendar size={11} />
            {formatDate(program.startTime)}
          </span>
          <span className="flex items-center gap-1">
            <Clock size={11} />
            {formatTime(program.startTime)} – {formatTime(program.endTime)}
          </span>
          <span className="text-gray-400">
            {formatDuration(program.startTime, program.endTime)}
          </span>
        </div>

        <p className="text-xs text-gray-400 dark:text-gray-500 mt-1 line-clamp-1">
          Dodano: {formatDate(favorite.addedAt)}
        </p>
      </div>

      {/* Akcje */}
      <div className="flex items-center gap-1 flex-shrink-0">
        <button
          onClick={onToggleWatched}
          title={favorite.watched ? 'Oznacz jako nieobejrzane' : 'Oznacz jako obejrzane'}
          className={clsx(
            'p-1.5 rounded-lg transition-colors',
            favorite.watched
              ? 'text-primary-600 bg-primary-50 dark:bg-primary-900/20 hover:bg-primary-100'
              : 'text-gray-400 hover:text-primary-600 hover:bg-gray-100 dark:hover:bg-gray-700'
          )}
        >
          {favorite.watched ? <Eye size={15} /> : <EyeOff size={15} />}
        </button>

        <button
          onClick={onRemove}
          title="Usuń z ulubionych"
          className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
        >
          <Trash2 size={15} />
        </button>
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center px-6">
      <div className="w-16 h-16 bg-red-50 dark:bg-red-900/20 rounded-full flex items-center justify-center mb-4">
        <Heart size={28} className="text-red-300 dark:text-red-600" />
      </div>
      <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-2">
        Brak ulubionych programów
      </h3>
      <p className="text-sm text-gray-500 dark:text-gray-400 max-w-xs">
        Kliknij na dowolny program w siatce TV, aby zobaczyć szczegóły i dodać go do ulubionych.
      </p>
    </div>
  );
}
