// ── Komponent Badge (etykietka) ───────────────────────────
import clsx from 'clsx';

interface BadgeProps {
  children: React.ReactNode;
  variant?: 'genre' | 'live' | 'premiere' | 'default' | 'custom';
  className?: string;
  color?: string; // dla variant='custom'
}

/** Mapowanie gatunku na kolor etykietki */
export const GENRE_COLORS: Record<string, string> = {
  movie:         'bg-purple-100 text-purple-700 dark:bg-purple-900/50 dark:text-purple-300',
  series:        'bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300',
  sport:         'bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300',
  documentary:   'bg-orange-100 text-orange-700 dark:bg-orange-900/50 dark:text-orange-300',
  news:          'bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300',
  kids:          'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/50 dark:text-yellow-300',
  entertainment: 'bg-pink-100 text-pink-700 dark:bg-pink-900/50 dark:text-pink-300',
  music:         'bg-teal-100 text-teal-700 dark:bg-teal-900/50 dark:text-teal-300',
  magazin:       'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300',
  other:         'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300',
};

export const GENRE_LABELS: Record<string, string> = {
  movie:         'Film',
  series:        'Serial',
  sport:         'Sport',
  documentary:   'Dokument',
  news:          'Wiadomości',
  kids:          'Dla dzieci',
  entertainment: 'Rozrywka',
  music:         'Muzyka',
  magazin:       'Magazyn',
  other:         'Inne',
};

export function Badge({ children, variant = 'default', className, color }: BadgeProps) {
  return (
    <span
      className={clsx(
        'inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium',
        variant === 'live' && 'bg-red-500 text-white animate-live-pulse',
        variant === 'premiere' && 'bg-amber-500 text-white',
        variant === 'default' && 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300',
        variant === 'genre' && 'text-xs',
        variant === 'custom' && 'text-white',
        className
      )}
      style={variant === 'custom' && color ? { backgroundColor: color } : undefined}
    >
      {children}
    </span>
  );
}

export function GenreBadge({ genre }: { genre: string }) {
  return (
    <span className={clsx(
      'inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium',
      GENRE_COLORS[genre] || GENRE_COLORS.other
    )}>
      {GENRE_LABELS[genre] || genre}
    </span>
  );
}
