// ============================================================
// VERCEL SERVERLESS FUNCTION — Zapowiedzi filmowe
// GET /api/tmdb/upcoming
// Pobiera nadchodzące premiery kinowe z Filmweb showtimes
// Bez potrzeby klucza API / rejestracji
// ============================================================

import { FILMWEB_HEADERS, COUNTRY_CODES } from '../_filmweb.js';

let cache = null;
let cacheTime = 0;
const CACHE_TTL = 6 * 60 * 60 * 1000; // 6h

const POSTER_BASE = 'https://fwcdn.pl/fpo';

function buildPosterUrl(poster) {
  if (!poster) return null;
  const p = typeof poster === 'object' ? (poster.path ?? poster.url ?? null) : poster;
  if (!p) return null;
  const fixed = p.replace('.$.','.3.');
  return fixed.startsWith('http') ? fixed : `${POSTER_BASE}${fixed}`;
}

async function fetchFilmDetails(filmId) {
  try {
    const [prevRes, ratingRes] = await Promise.all([
      fetch(`https://www.filmweb.pl/api/v1/film/${filmId}/preview`, {
        headers: FILMWEB_HEADERS, signal: AbortSignal.timeout(8000),
      }),
      fetch(`https://www.filmweb.pl/api/v1/film/${filmId}/rating`, {
        headers: FILMWEB_HEADERS, signal: AbortSignal.timeout(8000),
      }),
    ]);
    if (!prevRes.ok) return null;

    const preview = await prevRes.json();
    const rating  = ratingRes.ok ? await ratingRes.json() : {};

    const rawTitle = typeof preview.title === 'object'
      ? (preview.title?.title ?? preview.title?.pl ?? preview.title?.text ?? '')
      : (preview.title ?? '');
    const origTitle = typeof preview.originalTitle === 'object'
      ? (preview.originalTitle?.title ?? preview.originalTitle?.text ?? null)
      : (preview.originalTitle ?? null);
    const title = rawTitle || origTitle || String(filmId);

    const genres    = (preview.genres ?? []).map(g => (g?.name?.text ?? g?.name ?? '').toLowerCase()).filter(Boolean);
    const countries = (preview.countries ?? []).map(c => COUNTRY_CODES[c?.code] ?? c?.code ?? '').filter(Boolean);
    const synopsis  = (() => {
      const s = preview.plot?.synopsis ?? preview.description ?? null;
      return s && typeof s === 'object' ? (s.synopsis ?? null) : s;
    })();

    return {
      id: filmId,
      title,
      originalTitle: origTitle !== title ? origTitle : null,
      year: preview.year ?? null,
      releaseDate: null, // uzupełniane poniżej z showtimes
      rating: typeof rating.rate === 'number' ? Math.round(rating.rate * 10) / 10 : null,
      rateCount: rating.count ?? 0,
      genres,
      countries,
      poster: buildPosterUrl(preview.poster),
      synopsis,
      filmwebUrl: `https://www.filmweb.pl/film/${encodeURIComponent(title)}-${preview.year ?? ''}-${filmId}`,
    };
  } catch {
    return null;
  }
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 'public, s-maxage=21600, stale-while-revalidate=3600');

  if (cache && Date.now() - cacheTime < CACHE_TTL) {
    return res.json({ films: cache });
  }

  try {
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];

    // Pobierz seanse dla dzisiaj + 7 + 14 + 21 dni
    const offsets = [0, 7, 14, 21];
    const dates = offsets.map(n => {
      const d = new Date(today.getTime() + n * 24 * 60 * 60 * 1000);
      return d.toISOString().split('T')[0];
    });

    const responses = await Promise.all(
      dates.map(date =>
        fetch(`https://www.filmweb.pl/api/v1/showtimes?date=${date}`, {
          headers: FILMWEB_HEADERS,
          signal: AbortSignal.timeout(10000),
        }).then(r => r.ok ? r.json() : null).catch(() => null)
      )
    );

    // Zbuduj mapę filmId → najwcześniejsza przyszła data seansu
    const filmDateMap = new Map();
    for (const data of responses) {
      if (!data?.filmDates) continue;
      for (const [idStr, datelist] of Object.entries(data.filmDates)) {
        const filmId = parseInt(idStr);
        if (!filmId) continue;
        const future = (Array.isArray(datelist) ? datelist : [])
          .filter(d => d > todayStr)
          .sort();
        if (!future.length) continue;
        const earliest = future[0];
        if (!filmDateMap.has(filmId) || earliest < filmDateMap.get(filmId)) {
          filmDateMap.set(filmId, earliest);
        }
      }
    }

    // Filmy grające dziś
    const todayData = responses[0];
    const playingToday = new Set(
      Object.entries(todayData?.filmDates ?? {})
        .filter(([, dates]) => Array.isArray(dates) && dates.includes(todayStr))
        .map(([id]) => parseInt(id))
    );

    // Nadchodzące = mają przyszłe seanse ale NIE grają dziś
    let entries = [...filmDateMap.entries()]
      .filter(([id]) => !playingToday.has(id))
      .sort(([, a], [, b]) => a.localeCompare(b))
      .slice(0, 40);

    // Fallback: wszystkie przyszłe jeśli nic nie ma
    if (!entries.length) {
      entries = [...filmDateMap.entries()]
        .sort(([, a], [, b]) => a.localeCompare(b))
        .slice(0, 40);
    }

    if (!entries.length) return res.json({ films: [] });

    // Pobierz szczegóły (6 równolegle)
    const details = [];
    for (let i = 0; i < entries.length; i += 6) {
      const batch = entries.slice(i, i + 6);
      const results = await Promise.all(
        batch.map(async ([id, date]) => {
          const film = await fetchFilmDetails(id);
          if (film) film.releaseDate = date;
          return film;
        })
      );
      details.push(...results.filter(Boolean));
    }

    const films = details.sort((a, b) =>
      (a.releaseDate ?? '9999').localeCompare(b.releaseDate ?? '9999')
    );

    cache = films;
    cacheTime = Date.now();
    res.json({ films });
  } catch (err) {
    console.error('[upcoming]', err.message);
    res.status(502).json({ films: [] });
  }
}
