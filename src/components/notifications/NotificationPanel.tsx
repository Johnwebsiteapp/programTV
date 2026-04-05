// ============================================================
// PANEL POWIADOMIEŃ
// Zarządzanie zaplanowanymi powiadomieniami o programach.
// ============================================================

import { useEffect, useState } from 'react';
import { Bell, BellOff, Trash2, Calendar, Clock, CheckCircle2, AlertCircle } from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';
import { GenreBadge } from '../ui/Badge';
import { formatTime, formatDate, formatNotificationTime } from '../../utils/dateUtils';
import {
  requestNotificationPermission, getNotificationPermission,
  scheduleNotification, cancelNotification, rescheduleAllNotifications
} from '../../utils/notificationUtils';
import { CHANNELS } from '../../data/channels';
import clsx from 'clsx';

export function NotificationPanel() {
  const { notifications, removeNotification, markNotificationFired, setSelectedProgram } = useAppStore();
  const [permission, setPermission] = useState(getNotificationPermission());
  const [isRequestingPermission, setIsRequestingPermission] = useState(false);

  // Przy ładowaniu panelu: przywróć zaplanowane powiadomienia
  useEffect(() => {
    const pending = notifications.filter(n => !n.fired && !n.dismissed);
    rescheduleAllNotifications(pending, markNotificationFired);
  }, []);

  // Prośba o uprawnienia
  const handleRequestPermission = async () => {
    setIsRequestingPermission(true);
    const granted = await requestNotificationPermission();
    setPermission(granted ? 'granted' : 'denied');
    setIsRequestingPermission(false);

    if (granted) {
      // Zaplanuj wszystkie oczekujące powiadomienia
      const pending = notifications.filter(n => !n.fired && !n.dismissed);
      rescheduleAllNotifications(pending, markNotificationFired);
    }
  };

  const handleRemove = (notifId: string) => {
    cancelNotification(notifId);
    removeNotification(notifId);
  };

  const pending = notifications.filter(n => !n.fired && !n.dismissed)
    .sort((a, b) => a.scheduledAt.getTime() - b.scheduledAt.getTime());

  const fired = notifications.filter(n => n.fired)
    .sort((a, b) => b.scheduledAt.getTime() - a.scheduledAt.getTime())
    .slice(0, 10);

  return (
    <div className="max-w-2xl mx-auto p-4">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
          Powiadomienia
        </h2>
        <span className="text-sm text-gray-500 dark:text-gray-400">
          {pending.length} zaplanowanych
        </span>
      </div>

      {/* Status zgody na powiadomienia */}
      <PermissionBanner
        permission={permission}
        isRequesting={isRequestingPermission}
        onRequest={handleRequestPermission}
      />

      {/* Oczekujące */}
      {pending.length > 0 && (
        <section className="mb-6">
          <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">
            Zaplanowane ({pending.length})
          </h3>
          <div className="space-y-2">
            {pending.map(notif => (
              <NotificationCard
                key={notif.id}
                notification={notif}
                onRemove={() => handleRemove(notif.id)}
                onOpen={() => setSelectedProgram(notif.program)}
              />
            ))}
          </div>
        </section>
      )}

      {/* Historia */}
      {fired.length > 0 && (
        <section className="opacity-60">
          <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">
            Historia ({fired.length})
          </h3>
          <div className="space-y-2">
            {fired.map(notif => (
              <NotificationCard
                key={notif.id}
                notification={notif}
                isFired
                onRemove={() => removeNotification(notif.id)}
                onOpen={() => setSelectedProgram(notif.program)}
              />
            ))}
          </div>
        </section>
      )}

      {/* Pusty stan */}
      {notifications.length === 0 && (
        <EmptyState />
      )}
    </div>
  );
}

// ─── STATUS UPRAWNIEŃ ─────────────────────────────────────

function PermissionBanner({ permission, isRequesting, onRequest }: {
  permission: ReturnType<typeof getNotificationPermission>;
  isRequesting: boolean;
  onRequest: () => void;
}) {
  if (permission === 'granted') {
    return (
      <div className="flex items-center gap-2 px-4 py-3 bg-green-50 dark:bg-green-900/20 rounded-xl border border-green-200 dark:border-green-800 mb-4">
        <CheckCircle2 size={16} className="text-green-600 dark:text-green-400 flex-shrink-0" />
        <p className="text-sm text-green-700 dark:text-green-300">
          Powiadomienia systemowe są włączone. Otrzymasz alert przed każdym programem.
        </p>
      </div>
    );
  }

  if (permission === 'denied') {
    return (
      <div className="flex items-center gap-2 px-4 py-3 bg-red-50 dark:bg-red-900/20 rounded-xl border border-red-200 dark:border-red-800 mb-4">
        <AlertCircle size={16} className="text-red-600 dark:text-red-400 flex-shrink-0" />
        <p className="text-sm text-red-700 dark:text-red-300">
          Powiadomienia są zablokowane. Włącz je w ustawieniach przeglądarki.
        </p>
      </div>
    );
  }

  if (permission === 'unsupported') {
    return (
      <div className="flex items-center gap-2 px-4 py-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-xl mb-4">
        <AlertCircle size={16} className="text-yellow-600 dark:text-yellow-400 flex-shrink-0" />
        <p className="text-sm text-yellow-700 dark:text-yellow-300">
          Twoja przeglądarka nie obsługuje powiadomień.
        </p>
      </div>
    );
  }

  // default: 'default' — nie zapytano jeszcze
  return (
    <div className="flex items-center justify-between gap-3 px-4 py-3 bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-200 dark:border-blue-800 mb-4">
      <div className="flex items-start gap-2">
        <Bell size={16} className="text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
        <p className="text-sm text-blue-700 dark:text-blue-300">
          Włącz powiadomienia systemowe, aby otrzymywać alerty przed ulubionymi programami.
        </p>
      </div>
      <button
        onClick={onRequest}
        disabled={isRequesting}
        className="flex-shrink-0 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium rounded-lg transition-colors disabled:opacity-50"
      >
        {isRequesting ? 'Pytam...' : 'Włącz'}
      </button>
    </div>
  );
}

// ─── KARTA POWIADOMIENIA ──────────────────────────────────

function NotificationCard({ notification, isFired = false, onRemove, onOpen }: {
  notification: import('../../types').Notification;
  isFired?: boolean;
  onRemove: () => void;
  onOpen: () => void;
}) {
  const { program } = notification;
  const channel = CHANNELS.find(c => c.id === program.channelId);

  return (
    <div className={clsx(
      'bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 p-4',
      'flex items-start gap-3 transition-all',
      isFired && 'opacity-60'
    )}>
      {/* Ikona */}
      <div className={clsx(
        'flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center',
        isFired
          ? 'bg-gray-100 dark:bg-gray-800'
          : 'bg-blue-50 dark:bg-blue-900/30'
      )}>
        {isFired
          ? <BellOff size={18} className="text-gray-400 dark:text-gray-600" />
          : <Bell size={18} className="text-blue-500 dark:text-blue-400" />
        }
      </div>

      {/* Treść */}
      <div className="flex-1 min-w-0 cursor-pointer" onClick={onOpen}>
        <div className="flex items-center gap-2 mb-1">
          <span className="text-xs text-gray-500 dark:text-gray-400">
            {channel?.logoEmoji} {channel?.name}
          </span>
          <GenreBadge genre={program.genre} />
        </div>

        <h3 className="font-semibold text-gray-900 dark:text-white text-sm truncate">
          {program.title}
        </h3>

        <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-1 text-xs text-gray-500 dark:text-gray-400">
          <span className="flex items-center gap-1">
            <Calendar size={10} />
            {formatDate(program.startTime)}
          </span>
          <span className="flex items-center gap-1">
            <Clock size={10} />
            {formatTime(program.startTime)}
          </span>
          <span className={clsx('font-medium', isFired ? 'text-gray-400' : 'text-blue-500 dark:text-blue-400')}>
            {isFired ? '✓ Wysłane' : `⏰ ${formatNotificationTime(notification.minutesBefore)}`}
          </span>
        </div>
      </div>

      {/* Usuń */}
      <button
        onClick={onRemove}
        className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors flex-shrink-0"
      >
        <Trash2 size={14} />
      </button>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center px-6">
      <div className="w-16 h-16 bg-blue-50 dark:bg-blue-900/20 rounded-full flex items-center justify-center mb-4">
        <Bell size={28} className="text-blue-300 dark:text-blue-600" />
      </div>
      <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-2">
        Brak zaplanowanych powiadomień
      </h3>
      <p className="text-sm text-gray-500 dark:text-gray-400 max-w-xs">
        Kliknij na program, aby otworzyć szczegóły, a następnie wybierz opcję powiadomienia.
      </p>
    </div>
  );
}
