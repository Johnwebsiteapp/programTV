// ============================================================
// NARZĘDZIA DO OBSŁUGI POWIADOMIEŃ PRZEGLĄDARKOWYCH
//
// Używamy Web Notifications API — natywnych powiadomień
// systemowych bez potrzeby zewnętrznych serwisów.
// Wymagają zgody użytkownika.
// ============================================================

import { Notification as TVNotification } from '../types';
import { formatTime, formatDate } from './dateUtils';

// Mapa aktywnych timerów (żeby móc je anulować)
const activeTimers = new Map<string, ReturnType<typeof setTimeout>>();

/**
 * Prosi użytkownika o zgodę na powiadomienia.
 * Zwraca true jeśli zgoda została udzielona.
 */
export async function requestNotificationPermission(): Promise<boolean> {
  if (!('Notification' in window)) {
    console.warn('Ten browser nie obsługuje powiadomień.');
    return false;
  }

  if (Notification.permission === 'granted') return true;
  if (Notification.permission === 'denied') return false;

  const permission = await Notification.requestPermission();
  return permission === 'granted';
}

/**
 * Sprawdza aktualny status zgody na powiadomienia.
 */
export function getNotificationPermission(): NotificationPermission | 'unsupported' {
  if (!('Notification' in window)) return 'unsupported';
  return Notification.permission;
}

/**
 * Wysyła natychmiastowe powiadomienie systemowe.
 */
export function sendBrowserNotification(
  title: string,
  body: string,
  icon = '/tv-icon.svg'
): void {
  if (!('Notification' in window) || Notification.permission !== 'granted') return;

  new Notification(title, {
    body,
    icon,
    badge: '/tv-icon.svg',
    tag: 'tv-guide', // Grupuje powiadomienia z tej samej aplikacji
  });
}

/**
 * Planuje powiadomienie dla programu TV.
 * @param notification - dane powiadomienia z store
 * @param onFire - callback wywoływany kiedy powiadomienie się odpali
 */
export function scheduleNotification(
  notification: TVNotification,
  onFire: (notificationId: string) => void
): void {
  // Anuluj poprzedni timer jeśli istnieje
  cancelNotification(notification.id);

  const now = new Date();
  const delay = notification.scheduledAt.getTime() - now.getTime();

  if (delay <= 0) {
    // Powiadomienie powinno było już pójść lub jest za przeszłością
    return;
  }

  const timerId = setTimeout(() => {
    const { program, minutesBefore } = notification;
    const timeStr = formatTime(program.startTime);
    const dateStr = formatDate(program.startTime);

    // Wyślij powiadomienie systemowe
    const title = `📺 Za chwilę: ${program.title}`;
    const body = minutesBefore <= 15
      ? `Zaczyna się o ${timeStr} na kanale ${program.channelId.toUpperCase()}!`
      : `Zaczyna się o ${timeStr} (${dateStr}) • ${minutesBefore} minut`;

    sendBrowserNotification(title, body);

    // Powiadom store że powiadomienie zostało wysłane
    onFire(notification.id);

    // Usuń timer z mapy
    activeTimers.delete(notification.id);
  }, delay);

  activeTimers.set(notification.id, timerId);
}

/**
 * Anuluje zaplanowane powiadomienie.
 */
export function cancelNotification(notificationId: string): void {
  const timerId = activeTimers.get(notificationId);
  if (timerId !== undefined) {
    clearTimeout(timerId);
    activeTimers.delete(notificationId);
  }
}

/**
 * Anuluje wszystkie zaplanowane powiadomienia.
 */
export function cancelAllNotifications(): void {
  for (const timerId of activeTimers.values()) {
    clearTimeout(timerId);
  }
  activeTimers.clear();
}

/**
 * Po powrocie do strony (odświeżeniu) przywraca zaplanowane powiadomienia.
 * Wywołaj tę funkcję przy starcie aplikacji.
 */
export function rescheduleAllNotifications(
  notifications: TVNotification[],
  onFire: (notificationId: string) => void
): void {
  const now = new Date();
  for (const notification of notifications) {
    if (!notification.fired && !notification.dismissed && notification.scheduledAt > now) {
      scheduleNotification(notification, onFire);
    }
  }
}
