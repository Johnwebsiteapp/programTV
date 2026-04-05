// ============================================================
// NARZĘDZIA DO OBSŁUGI DAT I CZASU
// ============================================================

import { format, differenceInMinutes, isSameDay, addDays, startOfDay } from 'date-fns';
import { pl } from 'date-fns/locale';

/** Formatuje czas jako "HH:mm" */
export function formatTime(date: Date): string {
  return format(date, 'HH:mm');
}

/** Formatuje datę jako "dd.MM.yyyy" */
export function formatDate(date: Date): string {
  return format(date, 'dd.MM.yyyy');
}

/** Formatuje czas trwania programu, np. "1 godz. 30 min" */
export function formatDuration(startTime: Date, endTime: Date): string {
  const mins = differenceInMinutes(endTime, startTime);
  if (mins < 60) return `${mins} min`;
  const hours = Math.floor(mins / 60);
  const remaining = mins % 60;
  if (remaining === 0) return `${hours} godz.`;
  return `${hours} godz. ${remaining} min`;
}

/**
 * Zwraca tablicę dat dla N następnych dni (zaczynając od today).
 * Używane do renderowania zakładek dni w EPG.
 */
export function getDateRange(days = 7, startOffset = -1): Date[] {
  const dates: Date[] = [];
  for (let i = startOffset; i < days + startOffset; i++) {
    dates.push(addDays(new Date(), i));
  }
  return dates;
}

/** Formatuje datę w ludzki sposób po polsku */
export function formatDatePolish(date: Date): string {
  const today = new Date();
  const tomorrow = addDays(today, 1);
  const yesterday = addDays(today, -1);

  if (isSameDay(date, today))     return 'Dzisiaj';
  if (isSameDay(date, tomorrow))  return 'Jutro';
  if (isSameDay(date, yesterday)) return 'Wczoraj';

  return format(date, 'EEEE, d MMM', { locale: pl });
}

/** Formatuje krótką etykietę daty (dla zakładek) */
export function formatDateShort(date: Date): string {
  const today = new Date();
  const tomorrow = addDays(today, 1);

  if (isSameDay(date, today))    return 'Dziś';
  if (isSameDay(date, tomorrow)) return 'Jutro';

  return format(date, 'EEE d.MM', { locale: pl });
}

/**
 * Oblicza pozycję X (w pikselach) dla danego czasu w siatce EPG.
 * @param time - czas do obliczenia pozycji
 * @param dayStart - początek doby (00:00)
 * @param pixelsPerMinute - piksele na minutę (domyślnie 3)
 */
export function timeToPixels(time: Date, dayStart: Date, pixelsPerMinute = 3): number {
  const minutes = differenceInMinutes(time, dayStart);
  return Math.max(0, minutes * pixelsPerMinute);
}

/**
 * Oblicza szerokość programu w pikselach.
 */
export function durationToPixels(startTime: Date, endTime: Date, pixelsPerMinute = 3): number {
  const minutes = differenceInMinutes(endTime, startTime);
  return Math.max(minutes * pixelsPerMinute, 2); // minimum 2px
}

/** Zwraca procent postępu trwającego programu (0-100) */
export function getProgramProgress(startTime: Date, endTime: Date, now = new Date()): number {
  const total = differenceInMinutes(endTime, startTime);
  const elapsed = differenceInMinutes(now, startTime);
  return Math.min(100, Math.max(0, (elapsed / total) * 100));
}

/** Sprawdza czy program jest teraz emitowany */
export function isNowPlaying(startTime: Date, endTime: Date, now = new Date()): boolean {
  return startTime <= now && endTime > now;
}

/** Sprawdza czy program już się skończył */
export function isFinished(endTime: Date, now = new Date()): boolean {
  return endTime <= now;
}

/** Sprawdza czy program będzie emitowany dziś */
export function isToday(date: Date): boolean {
  return isSameDay(date, new Date());
}

/** Formatuje godziny w siatce czasu (co pół godziny) */
export function generateTimeSlots(dayStart: Date, intervalMinutes = 30): Date[] {
  const slots: Date[] = [];
  const dayEnd = addDays(startOfDay(dayStart), 1);
  let current = startOfDay(dayStart);

  while (current < dayEnd) {
    slots.push(current);
    current = new Date(current.getTime() + intervalMinutes * 60 * 1000);
  }
  return slots;
}

/** Formatuje czas do powiadomień: "15 minut przed", "1 godzinę przed" itd. */
export function formatNotificationTime(minutesBefore: number): string {
  if (minutesBefore < 60) return `${minutesBefore} minut przed`;
  if (minutesBefore === 60) return '1 godzinę przed';
  const hours = Math.floor(minutesBefore / 60);
  const mins = minutesBefore % 60;
  if (mins === 0) return `${hours} godziny przed`;
  return `${hours} godz. ${mins} min przed`;
}

/** Opcje czasu powiadomień (do selecta) */
export const NOTIFICATION_OPTIONS = [
  { value: 10,  label: '10 minut przed' },
  { value: 15,  label: '15 minut przed' },
  { value: 30,  label: '30 minut przed' },
  { value: 60,  label: '1 godzinę przed' },
  { value: 120, label: '2 godziny przed' },
  { value: 240, label: '4 godziny przed' },
  { value: 720, label: '12 godzin przed' },
  { value: 1440, label: '24 godziny przed' },
] as const;
