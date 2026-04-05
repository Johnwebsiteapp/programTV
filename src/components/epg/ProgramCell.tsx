// ============================================================
// KOMÓRKA PROGRAMU W SIATCE EPG
// Jeden prostokąt reprezentujący program na osi czasu.
// ============================================================

import { Heart, Bell, Zap } from 'lucide-react';
import { Program } from '../../types';
import { useAppStore } from '../../store/useAppStore';
import { formatTime, getProgramProgress, isNowPlaying, isFinished } from '../../utils/dateUtils';
import { GENRE_COLORS } from '../ui/Badge';
import clsx from 'clsx';

// Kolory tła komórek według gatunku
const CELL_COLORS: Record<string, string> = {
  movie:         'bg-purple-50 dark:bg-purple-900/25 hover:bg-purple-100 dark:hover:bg-purple-900/40',
  series:        'bg-blue-50 dark:bg-blue-900/25 hover:bg-blue-100 dark:hover:bg-blue-900/40',
  sport:         'bg-green-50 dark:bg-green-900/25 hover:bg-green-100 dark:hover:bg-green-900/40',
  documentary:   'bg-orange-50 dark:bg-orange-900/25 hover:bg-orange-100 dark:hover:bg-orange-900/40',
  news:          'bg-red-50 dark:bg-red-900/25 hover:bg-red-100 dark:hover:bg-red-900/40',
  kids:          'bg-yellow-50 dark:bg-yellow-900/25 hover:bg-yellow-100 dark:hover:bg-yellow-900/40',
  entertainment: 'bg-pink-50 dark:bg-pink-900/25 hover:bg-pink-100 dark:hover:bg-pink-900/40',
  music:         'bg-teal-50 dark:bg-teal-900/25 hover:bg-teal-100 dark:hover:bg-teal-900/40',
  magazin:       'bg-gray-50 dark:bg-gray-800/50 hover:bg-gray-100 dark:hover:bg-gray-700/50',
  other:         'bg-gray-50 dark:bg-gray-800/50 hover:bg-gray-100 dark:hover:bg-gray-700/50',
};

const CELL_BORDER: Record<string, string> = {
  movie:         'border-l-purple-400',
  series:        'border-l-blue-400',
  sport:         'border-l-green-400',
  documentary:   'border-l-orange-400',
  news:          'border-l-red-400',
  kids:          'border-l-yellow-400',
  entertainment: 'border-l-pink-400',
  music:         'border-l-teal-400',
  magazin:       'border-l-gray-400',
  other:         'border-l-gray-400',
};

interface ProgramCellProps {
  program: Program;
  leftPx: number;
  widthPx: number;
}

export function ProgramCell({ program, leftPx, widthPx }: ProgramCellProps) {
  const { setSelectedProgram, isFavoriteProgram, hasNotification } = useAppStore();

  const now = new Date();
  const isLive = isNowPlaying(program.startTime, program.endTime, now);
  const isDone = isFinished(program.endTime, now);
  const progress = isLive ? getProgramProgress(program.startTime, program.endTime, now) : 0;

  const isFav = isFavoriteProgram(program.id);
  const hasNotif = hasNotification(program.id);

  // Szerokość wyznacza ile szczegółów pokazujemy
  const isVeryNarrow = widthPx < 60;
  const isNarrow = widthPx < 120;
  const isMedium = widthPx < 200;

  const colorClass = CELL_COLORS[program.genre] || CELL_COLORS.other;
  const borderClass = CELL_BORDER[program.genre] || CELL_BORDER.other;

  return (
    <div
      className={clsx(
        'epg-program-cell px-2 border-l-2',
        colorClass,
        borderClass,
        isDone && 'opacity-50',
        isLive && 'ring-1 ring-inset ring-primary-400/50 shadow-sm',
      )}
      style={{
        left: leftPx + 1,
        width: widthPx - 2,
      }}
      onClick={() => setSelectedProgram(program)}
      title={`${program.title} (${formatTime(program.startTime)}–${formatTime(program.endTime)})`}
    >
      {/* Zawartość komórki */}
      {!isVeryNarrow && (
        <div className="flex flex-col h-full justify-center py-0.5 gap-0.5 overflow-hidden">
          {/* Czas i ikony statusu */}
          <div className="flex items-center gap-1 overflow-hidden">
            <span className="text-[10px] text-gray-500 dark:text-gray-400 tabular-nums flex-shrink-0">
              {formatTime(program.startTime)}
            </span>
            {isLive && (
              <span className="flex items-center gap-0.5 text-[9px] font-bold text-red-500 flex-shrink-0">
                <Zap size={8} className="fill-current" />
                LIVE
              </span>
            )}
            {isFav && <Heart size={9} className="text-red-400 fill-current flex-shrink-0" />}
            {hasNotif && <Bell size={9} className="text-primary-400 fill-current flex-shrink-0" />}
          </div>

          {/* Tytuł */}
          <p className={clsx(
            'font-medium text-gray-800 dark:text-gray-100 truncate leading-tight',
            isMedium ? 'text-xs' : 'text-xs'
          )}>
            {program.title}
          </p>

          {/* Czas trwania (tylko dla szerszych komórek) */}
          {!isNarrow && (
            <p className="text-[10px] text-gray-400 dark:text-gray-500 truncate">
              {formatTime(program.startTime)}–{formatTime(program.endTime)}
            </p>
          )}
        </div>
      )}

      {/* Pasek postępu (dla programu na żywo) */}
      {isLive && (
        <div
          className="progress-bar"
          style={{ width: `${progress}%` }}
        />
      )}
    </div>
  );
}
