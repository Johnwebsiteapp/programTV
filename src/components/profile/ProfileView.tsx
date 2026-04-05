// ============================================================
// PROFIL UŻYTKOWNIKA — TV Stream design
// ============================================================

import { User, Heart, Bell, Moon, Sun, Globe, Shield, LogOut, ChevronRight, Star } from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';
import clsx from 'clsx';

export function ProfileView() {
  const { favorites, notifications, darkMode, toggleDarkMode, setActiveView } = useAppStore();

  const pendingNotifs = notifications.filter(n => !n.fired && !n.dismissed).length;
  const watchedCount = favorites.filter(f => f.watched).length;

  return (
    <div className="h-full overflow-y-auto bg-gray-50 dark:bg-slate-950">
      {/* ── Avatar + dane użytkownika ─────────────────────── */}
      <div className="flex flex-col items-center py-8 px-4">
        <div className="relative mb-3">
          <div className="w-20 h-20 rounded-full bg-gradient-to-br from-primary-400 to-primary-700 flex items-center justify-center shadow-lg">
            <User size={36} className="text-white" />
          </div>
          <div className="absolute bottom-0 right-0 w-6 h-6 bg-primary-600 rounded-full border-2 border-white dark:border-slate-950 flex items-center justify-center">
            <Star size={12} className="text-white fill-white" />
          </div>
        </div>
        <h2 className="text-xl font-bold text-gray-900 dark:text-white">Użytkownik TV</h2>
        <p className="text-sm text-primary-600 font-medium mt-0.5 flex items-center gap-1">
          <Star size={12} className="fill-primary-600" /> Premium Member
        </p>
      </div>

      {/* ── Statystyki ────────────────────────────────────── */}
      <div className="flex gap-3 px-4 mb-5">
        <button
          onClick={() => setActiveView('favorites')}
          className="flex-1 bg-white dark:bg-slate-800 rounded-2xl p-4 border border-gray-100 dark:border-slate-700 shadow-sm text-center"
        >
          <p className="text-2xl font-bold text-gray-900 dark:text-white">{favorites.length}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Ulubione</p>
        </button>
        <button
          onClick={() => setActiveView('favorites')}
          className="flex-1 bg-white dark:bg-slate-800 rounded-2xl p-4 border border-gray-100 dark:border-slate-700 shadow-sm text-center"
        >
          <p className="text-2xl font-bold text-gray-900 dark:text-white">{watchedCount}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Obejrzane</p>
        </button>
        <button
          onClick={() => setActiveView('notifications')}
          className="flex-1 bg-white dark:bg-slate-800 rounded-2xl p-4 border border-gray-100 dark:border-slate-700 shadow-sm text-center"
        >
          <p className="text-2xl font-bold text-gray-900 dark:text-white">{pendingNotifs}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Alerty</p>
        </button>
      </div>

      {/* ── Moje ulubione ─────────────────────────────────── */}
      <section className="px-4 mb-4">
        <h3 className="text-sm font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2 px-1">
          Moje treści
        </h3>
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-100 dark:border-slate-700 shadow-sm overflow-hidden">
          <ProfileRow
            icon={<Heart size={18} className="text-primary-600" />}
            label="Ulubione programy"
            badge={favorites.length > 0 ? String(favorites.length) : undefined}
            onClick={() => setActiveView('favorites')}
          />
          <Divider />
          <ProfileRow
            icon={<Bell size={18} className="text-primary-600" />}
            label="Alerty i powiadomienia"
            badge={pendingNotifs > 0 ? String(pendingNotifs) : undefined}
            onClick={() => setActiveView('notifications')}
          />
        </div>
      </section>

      {/* ── Preferencje aplikacji ─────────────────────────── */}
      <section className="px-4 mb-4">
        <h3 className="text-sm font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2 px-1">
          Preferencje
        </h3>
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-100 dark:border-slate-700 shadow-sm overflow-hidden">
          {/* Tryb ciemny — toggle */}
          <div className="flex items-center gap-3 px-4 py-3.5">
            <div className="w-8 h-8 rounded-xl bg-gray-100 dark:bg-slate-700 flex items-center justify-center flex-shrink-0">
              {darkMode ? <Moon size={16} className="text-gray-600 dark:text-gray-300" /> : <Sun size={16} className="text-gray-600 dark:text-gray-300" />}
            </div>
            <span className="flex-1 text-sm font-medium text-gray-900 dark:text-gray-100">
              {darkMode ? 'Tryb ciemny' : 'Tryb jasny'}
            </span>
            <button
              onClick={toggleDarkMode}
              className={clsx(
                'relative w-11 h-6 rounded-full transition-colors duration-200',
                darkMode ? 'bg-primary-600' : 'bg-gray-200 dark:bg-slate-600'
              )}
            >
              <span className={clsx(
                'absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform duration-200',
                darkMode ? 'translate-x-5' : 'translate-x-0.5'
              )} />
            </button>
          </div>
          <Divider />
          <ProfileRow
            icon={<Globe size={18} className="text-gray-500 dark:text-gray-400" />}
            label="Kategorie kanałów"
            onClick={() => setActiveView('categories')}
          />
          <Divider />
          <ProfileRow
            icon={<Shield size={18} className="text-gray-500 dark:text-gray-400" />}
            label="Ustawienia kanałów"
            onClick={() => setActiveView('channels')}
          />
        </div>
      </section>

      {/* ── Wyloguj ───────────────────────────────────────── */}
      <section className="px-4 mb-8">
        <button className="w-full flex items-center justify-center gap-2 bg-white dark:bg-slate-800 rounded-2xl border border-gray-100 dark:border-slate-700 shadow-sm py-3.5 text-sm font-semibold text-gray-500 dark:text-gray-400 hover:text-primary-600 hover:border-primary-200 dark:hover:border-primary-800 transition-colors">
          <LogOut size={17} />
          Wyloguj się
        </button>
      </section>

      {/* Padding na dole */}
      <div className="h-4" />
    </div>
  );
}

// ── Pomocnicze ──────────────────────────────────────────────

function ProfileRow({
  icon,
  label,
  badge,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  badge?: string;
  onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-3 px-4 py-3.5 w-full text-left hover:bg-gray-50 dark:hover:bg-slate-700/50 transition-colors"
    >
      <div className="w-8 h-8 rounded-xl bg-gray-100 dark:bg-slate-700 flex items-center justify-center flex-shrink-0">
        {icon}
      </div>
      <span className="flex-1 text-sm font-medium text-gray-900 dark:text-gray-100">{label}</span>
      {badge && (
        <span className="w-5 h-5 bg-primary-600 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
          {Number(badge) > 9 ? '9+' : badge}
        </span>
      )}
      <ChevronRight size={16} className="text-gray-400 dark:text-gray-500" />
    </button>
  );
}

function Divider() {
  return <div className="h-px bg-gray-100 dark:bg-slate-700 mx-4" />;
}
