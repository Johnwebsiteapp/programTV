// ============================================================
// WARSTWA API — pobieranie danych EPG z backendu
//
// Backend (server.mjs) scrape'uje programtv.onet.pl i zwraca
// dane w formacie JSON. Ta warstwa je pobiera i konwertuje
// na obiekty Program[] używane przez aplikację.
// ============================================================

import { Program, Channel } from '../types';
import { generateMockPrograms } from '../data/mockGenerator';
import { addDays } from 'date-fns';

// ─── TYPY ODPOWIEDZI API ──────────────────────────────────

interface ApiProgram {
  id: string;
  channelId: string;
  title: string;
  description: string;
  startTime: string; // ISO string
  endTime: string;   // ISO string
  genre: string;
  onetUrl?: string;
}

interface ApiResponse {
  programs: ApiProgram[];
  errors?: string[];
  total?: number;
}

// ─── KONWERSJA ────────────────────────────────────────────

function apiProgramToProgram(p: ApiProgram): Program {
  return {
    id: p.id,
    channelId: p.channelId,
    title: p.title,
    originalTitle: undefined,
    description: p.description || '',
    startTime: new Date(p.startTime),
    endTime: new Date(p.endTime),
    genre: p.genre as Program['genre'],
    country: undefined,
    year: undefined,
    rating: undefined,
    isLive: false,
    isPremiere: false,
    isRepeat: false,
  };
}

// ─── GŁÓWNA FUNKCJA ───────────────────────────────────────

/**
 * Pobiera programy z backendu (który scrape'uje onet.pl).
 * Dla kanałów bez mapowania onet — używa danych mock jako fallback.
 */
export async function fetchPrograms(
  channels: Channel[],
  _startDate: Date = new Date(),
  _days = 7
): Promise<Program[]> {
  // Przygotuj parametry
  const channelIds = channels.map(ch => ch.id).join(',');
  // Dni: wczoraj (-1) + dziś (0) + 6 naprzód (1..6)
  const dayOffsets = '-1,0,1,2,3,4,5,6';

  try {
    const response = await fetch(
      `/api/epg?channelId=${encodeURIComponent(channelIds)}&dayOffset=${dayOffsets}`,
      { signal: AbortSignal.timeout(30000) }
    );

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data: ApiResponse = await response.json();

    if (data.errors?.length) {
      console.warn('[EPG API] Błędy częściowe:', data.errors.slice(0, 5));
    }

    const realPrograms = data.programs.map(apiProgramToProgram);

    // Dla kanałów bez danych z onet — dodaj mock jako fallback
    const channelsWithData = new Set(realPrograms.map(p => p.channelId));
    const channelsWithoutData = channels.filter(ch => !channelsWithData.has(ch.id));

    let mockPrograms: Program[] = [];
    if (channelsWithoutData.length > 0) {
      const startDate = addDays(new Date(), -1);
      const allMock = generateMockPrograms(startDate, 8);
      mockPrograms = allMock.filter(p =>
        channelsWithoutData.some(ch => ch.id === p.channelId)
      );
    }

    console.log(`[EPG API] Załadowano ${realPrograms.length} programów z onet.pl` +
      (mockPrograms.length ? ` + ${mockPrograms.length} mock` : ''));

    return [...realPrograms, ...mockPrograms];

  } catch (err) {
    console.error('[EPG API] Błąd połączenia z backendem, używam danych mock:', err);
    // Fallback: pełne dane mock
    const startDate = addDays(new Date(), -1);
    return generateMockPrograms(startDate, 8);
  }
}
