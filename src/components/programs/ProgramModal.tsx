// ============================================================
// MODAL SZCZEGÓŁÓW PROGRAMU
// Wyświetla pełne informacje o wybranym programie.
// Pozwala dodać do ulubionych i ustawić powiadomienie.
// ============================================================

import { useState } from 'react';
import {
  Heart, Bell, BellOff, Clock, Calendar, Globe, Star,
  Play, Film, Repeat, X, ChevronDown
} from 'lucide-react';
import { Modal } from '../ui/Modal';
import { Badge, GenreBadge } from '../ui/Badge';
import { useAppStore } from '../../store/useAppStore';
import { formatTime, formatDate, formatDuration, getProgramProgress,
         isNowPlaying, isFinished, NOTIFICATION_OPTIONS } from '../../utils/dateUtils';
import { CHANNELS } from '../../data/channels';
import clsx from 'clsx';

export function ProgramModal() {
  const { selectedProgram, setSelectedProgram, isFavoriteProgram, addFavorite,
          favorites, removeFavorite, addNotification, removeNotification,
          hasNotification, notifications } = useAppStore();

  const [showNotifOptions, setShowNotifOptions] = useState(false);

  if (!selectedProgram) return null;

  const program = selectedProgram;
  const now = new Date();
  const isLive = isNowPlaying(program.startTime, program.endTime, now);
  const isDone = isFinished(program.endTime, now);
  const progress = isLive ? getProgramProgress(program.startTime, program.endTime, now) : 0;

  const isFav = isFavoriteProgram(program.id);
  const hasNotif = hasNotification(program.id);
  const channel = CHANNELS.find(c => c.id === program.channelId);

  const favorite = favorites.find(f => f.programId === program.id);
  const notification = notifications.find(n => n.programId === program.id && !n.fired);

  const handleFavoriteToggle = () => {
    if (isFav && favorite) {
      removeFavorite(favorite.id);
    } else {
      addFavorite(program);
    }
  };

  const handleNotificationToggle = (minutesBefore?: number) => {
    if (hasNotif && notification) {
      removeNotification(notification.id);
      setShowNotifOptions(false);
    } else if (minutesBefore !== undefined) {
      addNotification(program, minutesBefore);
      setShowNotifOptions(false);
    } else {
      setShowNotifOptions(v => !v);
    }
  };

  const durationText = formatDuration(program.startTime, program.endTime);

  return (
    <Modal isOpen={true} onClose={() => setSelectedProgram(null)} size="md">
      <div className="p-6">
        {/* Nagłówek z przyciskiem zamknięcia */}
        <div className="flex items-start justify-between gap-3 mb-4">
          <div className="flex-1 min-w-0">
            {/* Kanał */}
            <div className="flex items-center gap-2 mb-2">
              <span className="text-lg">{channel?.logoEmoji}</span>
              <span className="text-sm font-medium text-gray-500 dark:text-gray-400">
                {channel?.name}
              </span>
              {isLive && (
                <Badge variant="live">● NA ŻYWO</Badge>
              )}
              {program.isPremiere && (
                <Badge variant="premiere">⭐ Premiera</Badge>
              )}
              {program.isRepeat && (
                <span className="text-xs text-gray-400 flex items-center gap-0.5">
                  <Repeat size={10} /> Powtórka
                </span>
              )}
            </div>

            {/* Tytuł */}
            <h2 className="text-xl font-bold text-gray-900 dark:text-white leading-tight">
              {program.title}
            </h2>
            {program.originalTitle && program.originalTitle !== program.title && (
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                {program.originalTitle}
              </p>
            )}
          </div>

          <button
            onClick={() => setSelectedProgram(null)}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors flex-shrink-0"
          >
            <X size={18} />
          </button>
        </div>

        {/* Pasek postępu (dla aktualnie emitowanych) */}
        {isLive && (
          <div className="mb-4">
            <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400 mb-1">
              <span>{formatTime(program.startTime)}</span>
              <span className="text-red-500 font-medium">{Math.round(progress)}% obejrzane</span>
              <span>{formatTime(program.endTime)}</span>
            </div>
            <div className="h-1.5 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
              <div
                className="h-full bg-primary-500 rounded-full transition-all"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        )}

        {/* Metadane */}
        <div className="flex flex-wrap gap-2 mb-4">
          <GenreBadge genre={program.genre} />

          <span className="inline-flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
            <Clock size={12} />
            {formatTime(program.startTime)} – {formatTime(program.endTime)}
            <span className="ml-1 text-gray-400">({durationText})</span>
          </span>

          <span className="inline-flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
            <Calendar size={12} />
            {formatDate(program.startTime)}
          </span>

          {program.country && (
            <span className="inline-flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
              <Globe size={12} />
              {countryName(program.country)}
              {program.year && ` (${program.year})`}
            </span>
          )}

          {program.rating && (
            <span className="inline-flex items-center gap-1 text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 px-1.5 py-0.5 rounded">
              {program.rating}
            </span>
          )}

          {program.episode && (
            <span className="inline-flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
              <Film size={12} />
              {program.episode.season && `S${program.episode.season}`}
              {program.episode.episode && `E${program.episode.episode}`}
              {program.episode.title && ` — ${program.episode.title}`}
            </span>
          )}
        </div>

        {/* Opis */}
        <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed mb-6">
          {program.description}
        </p>

        {/* Akcje */}
        <div className="flex flex-col gap-2">
          {/* Ulubione */}
          <button
            onClick={handleFavoriteToggle}
            className={clsx(
              'flex items-center gap-3 w-full px-4 py-3 rounded-xl transition-all font-medium text-sm',
              isFav
                ? 'bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 hover:bg-red-100'
                : 'bg-gray-50 dark:bg-slate-700 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600'
            )}
          >
            <Heart size={16} className={isFav ? 'fill-current' : ''} />
            {isFav ? 'Usuń z ulubionych' : 'Dodaj do ulubionych'}
            {isFav && (
              <span className="ml-auto text-xs text-gray-400 dark:text-gray-500">
                Dodano {formatDate(favorite!.addedAt)}
              </span>
            )}
          </button>

          {/* Powiadomienie */}
          {!isDone && (
            <div className="relative">
              <button
                onClick={() => handleNotificationToggle()}
                className={clsx(
                  'flex items-center gap-3 w-full px-4 py-3 rounded-xl transition-all font-medium text-sm',
                  hasNotif
                    ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 hover:bg-blue-100'
                    : 'bg-gray-50 dark:bg-slate-700 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600'
                )}
              >
                {hasNotif ? <Bell size={16} className="fill-current" /> : <BellOff size={16} />}
                {hasNotif
                  ? `Powiadomienie: ${NOTIFICATION_OPTIONS.find(o => o.value === notification?.minutesBefore)?.label ?? '...'}`
                  : 'Ustaw powiadomienie'
                }
                {hasNotif
                  ? <span className="ml-auto text-xs text-gray-400">Kliknij aby usunąć</span>
                  : <ChevronDown size={14} className={clsx('ml-auto transition-transform', showNotifOptions && 'rotate-180')} />
                }
              </button>

              {/* Opcje czasu powiadomień */}
              {showNotifOptions && !hasNotif && (
                <div className="mt-1 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl shadow-lg overflow-hidden animate-slide-down">
                  {NOTIFICATION_OPTIONS.map(opt => {
                    const scheduledAt = new Date(program.startTime.getTime() - opt.value * 60 * 1000);
                    const isPast = scheduledAt < new Date();
                    return (
                      <button
                        key={opt.value}
                        onClick={() => !isPast && handleNotificationToggle(opt.value)}
                        disabled={isPast}
                        className={clsx(
                          'flex items-center gap-2 w-full px-4 py-2.5 text-sm text-left transition-colors',
                          isPast
                            ? 'text-gray-300 dark:text-gray-600 cursor-not-allowed'
                            : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                        )}
                      >
                        <Bell size={13} />
                        {opt.label}
                        {isPast && <span className="ml-auto text-xs text-gray-300">minął termin</span>}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Przycisk "Obejrzyj teraz" dla aktualnie emitowanych */}
          {isLive && (
            <div className="flex items-center gap-2 px-4 py-3 bg-primary-50 dark:bg-primary-900/20 rounded-xl">
              <Play size={16} className="text-primary-600 dark:text-primary-400 fill-current" />
              <span className="text-sm font-medium text-primary-700 dark:text-primary-300">
                Program jest teraz emitowany na {channel?.name}
              </span>
            </div>
          )}

          {isDone && (
            <div className="flex items-center gap-2 px-4 py-3 bg-gray-50 dark:bg-gray-800 rounded-xl">
              <Star size={16} className="text-gray-400" />
              <span className="text-sm text-gray-500 dark:text-gray-400">
                Program już się zakończył
              </span>
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}

/** Tłumaczy kod kraju na pełną nazwę */
function countryName(code: string): string {
  const names: Record<string, string> = {
    PL: 'Polska', USA: 'USA', GB: 'Wielka Brytania', DE: 'Niemcy',
    FR: 'Francja', ES: 'Hiszpania', IT: 'Włochy', AU: 'Australia',
    CA: 'Kanada', NZ: 'Nowa Zelandia', KR: 'Korea Płd.', EU: 'Europa',
    INT: 'Międzynarodowy',
  };
  return names[code] || code;
}
