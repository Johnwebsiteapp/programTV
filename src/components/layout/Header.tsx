// ============================================================
// NAGŁÓWEK APLIKACJI — TV Stream design
// ============================================================

import { Tv, Search, User } from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';
import clsx from 'clsx';

export function Header() {
  const { setActiveView, activeView, notifications } = useAppStore();

  const pendingNotifications = notifications.filter(n => !n.fired && !n.dismissed).length;

  return (
    <header className="sticky top-0 z-50 bg-white dark:bg-slate-900 border-b border-gray-100 dark:border-slate-800">
      <div className="flex items-center h-14 px-4 gap-3">
        {/* Logo */}
        <button
          onClick={() => setActiveView('home' as any)}
          className="flex items-center gap-2 flex-shrink-0"
        >
          <div className="w-8 h-8 bg-primary-600 rounded-lg flex items-center justify-center shadow-sm">
            <Tv size={16} className="text-white" />
          </div>
          <span className="text-base font-bold text-gray-900 dark:text-white tracking-tight">
            TV<span className="text-primary-600">Stream</span>
          </span>
        </button>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Akcje */}
        <div className="flex items-center gap-1">
          {/* Wyszukiwarka */}
          <button
            onClick={() => setActiveView('search')}
            className={clsx(
              'p-2 rounded-xl transition-colors',
              activeView === 'search'
                ? 'bg-primary-50 text-primary-600 dark:bg-primary-900/30 dark:text-primary-400'
                : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-slate-800'
            )}
          >
            <Search size={20} />
          </button>

          {/* Avatar użytkownika */}
          <button
            onClick={() => setActiveView('profile' as any)}
            className={clsx(
              'relative p-1 rounded-xl transition-colors',
              (activeView as string) === 'profile'
                ? 'bg-primary-50 dark:bg-primary-900/30'
                : 'hover:bg-gray-100 dark:hover:bg-slate-800'
            )}
          >
            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-primary-400 to-primary-700 flex items-center justify-center">
              <User size={14} className="text-white" />
            </div>
            {pendingNotifications > 0 && (
              <span className="absolute top-1 right-1 w-2 h-2 bg-primary-600 rounded-full border border-white dark:border-slate-900" />
            )}
          </button>
        </div>
      </div>
    </header>
  );
}
