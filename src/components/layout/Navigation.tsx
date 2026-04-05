// ============================================================
// NAWIGACJA DOLNA / BOCZNA — TV Stream design
// ============================================================

import { Home, Compass, Heart, User, Tv, Bell, Search, Tag, Settings } from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';
import { AppView } from '../../types';
import clsx from 'clsx';

interface NavItem {
  view: string;
  label: string;
  icon: React.ReactNode;
  badge?: number;
}

export function BottomNavigation() {
  const { activeView, setActiveView, favorites, notifications } = useAppStore();

  const pendingNotifs = notifications.filter(n => !n.fired && !n.dismissed).length;

  const items: NavItem[] = [
    { view: 'home',      label: 'Home',     icon: <Home size={22} /> },
    { view: 'epg',       label: 'Program',  icon: <Compass size={22} /> },
    { view: 'favorites', label: 'Ulubione', icon: <Heart size={22} />, badge: favorites.length || undefined },
    { view: 'profile',   label: 'Profil',   icon: <User size={22} />, badge: pendingNotifs || undefined },
  ];

  return (
    <nav className="bg-white dark:bg-slate-900 border-t border-gray-100 dark:border-slate-800 safe-area-bottom">
      <div className="flex justify-around items-center h-16 px-2">
        {items.map(item => {
          const isActive = activeView === item.view;
          return (
            <button
              key={item.view}
              onClick={() => setActiveView(item.view as AppView)}
              className="relative flex flex-col items-center justify-center gap-0.5 flex-1 h-full"
            >
              {/* Ikona z tłem */}
              <div className={clsx(
                'flex items-center justify-center w-10 h-7 rounded-full transition-all duration-200',
                isActive
                  ? 'bg-primary-600 text-white'
                  : 'text-gray-400 dark:text-gray-500'
              )}>
                {item.icon}
              </div>

              {/* Etykieta */}
              <span className={clsx(
                'text-[10px] font-medium',
                isActive ? 'text-primary-600 dark:text-primary-400' : 'text-gray-400 dark:text-gray-500'
              )}>
                {item.label}
              </span>

              {/* Badge */}
              {item.badge !== undefined && item.badge > 0 && (
                <span className="absolute top-1.5 right-[calc(50%-16px)] w-4 h-4 bg-primary-600 text-white text-[9px] font-bold rounded-full flex items-center justify-center">
                  {item.badge > 9 ? '9+' : item.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
}

/** Boczna nawigacja dla większych ekranów */
export function SideNavigation() {
  const { activeView, setActiveView, favorites, notifications } = useAppStore();
  const pendingNotifs = notifications.filter(n => !n.fired && !n.dismissed).length;

  const items: NavItem[] = [
    { view: 'home',          label: 'Home',          icon: <Home size={18} /> },
    { view: 'epg',           label: 'Program TV',    icon: <Tv size={18} /> },
    { view: 'search',        label: 'Wyszukaj',      icon: <Search size={18} /> },
    { view: 'favorites',     label: 'Ulubione',      icon: <Heart size={18} />, badge: favorites.length || undefined },
    { view: 'notifications', label: 'Powiadomienia', icon: <Bell size={18} />, badge: pendingNotifs || undefined },
    { view: 'categories',    label: 'Kategorie',     icon: <Tag size={18} /> },
    { view: 'channels',      label: 'Kanały',        icon: <Settings size={18} /> },
    { view: 'profile',       label: 'Profil',        icon: <User size={18} /> },
  ];

  return (
    <nav className="hidden md:flex flex-col w-52 bg-white dark:bg-slate-900 border-r border-gray-100 dark:border-slate-800 py-3">
      {items.map(item => (
        <button
          key={item.view}
          onClick={() => setActiveView(item.view as AppView)}
          className={clsx(
            'relative flex items-center gap-3 px-4 py-2.5 mx-2 rounded-xl text-sm font-medium transition-all',
            activeView === item.view
              ? 'bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300'
              : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-slate-800 hover:text-gray-900 dark:hover:text-gray-200'
          )}
        >
          <span className={clsx(
            activeView === item.view ? 'text-primary-600 dark:text-primary-400' : 'text-gray-400 dark:text-gray-500'
          )}>
            {item.icon}
          </span>
          <span>{item.label}</span>
          {item.badge !== undefined && item.badge > 0 && (
            <span className="ml-auto w-5 h-5 bg-primary-600 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
              {item.badge > 9 ? '9+' : item.badge}
            </span>
          )}
        </button>
      ))}
    </nav>
  );
}
