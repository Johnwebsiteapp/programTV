// ============================================================
// VERCEL SERVERLESS FUNCTION — Zapowiedzi filmowe
// GET /api/tmdb/upcoming
// Pobiera nadchodzące premiery kinowe z Filmweb showtimes
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
  if (p.startsWith('http')) return p;
  // Filmweb poster path: /po/03/45/345.3.jpg → replace .$. with .3.
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
      releaseDate: null, // zostanie uzupełniona z showtimes
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

    // Pobierz seanse dla dzisiaj i kilku przyszłych dat
    const dates = [0, 7, 14, 21].map(offset => {
      const d = new Date(today.getTime() + offset * 24 * 60 * 60 * 1000);
      return d.toISOString().split('T')[0];
    });

    const showtimeResponses = await Promise.all(
      dates.map(date =>
        fetch(`https://www.filmweb.pl/api/v1/showtimes?date=${date}`, {
          headers: FILMWEB_HEADERS,
          signal: AbortSignal.timeout(10000),
        }).then(r => r.ok ? r.json() : null).catch(() => null)
      )
    );

    // Zbierz wszystkie filmy z datami seansów
    const filmDateMap = new Map(); // filmId → earliest future date

    for (const data of showtimeResponses) {
      if (!data) continue;
      const filmDates = data.filmDates ?? {};

      for (const [filmIdStr, datelist] of Object.entries(filmDates)) {
        const filmId = parseInt(filmIdStr);
        if (!filmId) continue;

        // Znajdź najwcześniejszą datę seansu w przyszłości
        const futureDates = (datelist ?? []).filter(d => d > todayStr).sort();
        if (futureDates.length === 0) continue;
        const earliest = futureDates[0];

        // Zachowaj najwcześniejszą ze wszystkich dat
        if (!filmDateMap.has(filmId) || earliest < filmDateMap.get(filmId)) {
          filmDateMap.set(filmId, earliest);
        }
      }
    }

    // Filmy które TYLKO grają w przyszłości (nie grają dzisiaj) = nadchodzące premiery
    const todayData = showtimeResponses[0];
    const todayFilmIds = new Set(
      Object.keys(todayData?.filmDates ?? {})
        .filter(id => {
          const dates = todayData.filmDates[id] ?? [];
          return dates.includes(todayStr);
        })
        .map(Number)
    );

    // Nowe filmy = te które mają przyszłe daty ale NIE grają dzisiaj
    const upcomingFilmIds = [...filmDateMap.entries()]
      .filter(([id]) => !todayFilmIds.has(id))
      .sort(([, da], [, db]) => da.localeCompare(db)) // rosnąco po dacie
      .slice(0, 40)
      .map(([id, date]) => ({ id, date }));

    if (upcomingFilmIds.length === 0) {
      // Fallback: weź wszystkie przyszłe filmy (nawet te grające dzisiaj)
      const allFuture = [...filmDateMap.entries()]
        .sort(([, da], [, db]) => da.localeCompare(db))
        .slice(0, 40)
        .map(([id, date]) => ({ id, date }));
      upcomingFilmIds.push(...allFuture);
    }

    // Pobierz szczegóły filmów (po 6 równolegle)
    const details = [];
    const CONC = 6;
    for (let i = 0; i < upcomingFilmIds.length; i += CONC) {
      const batch = upcomingFilmIds.slice(i, i + CONC);
      const results = await Promise.all(
        batch.map(async ({ id, date }) => {
          const film = await fetchFilmDetails(id);
          if (film) film.releaseDate = date;
          return film;
        })
      );
      details.push(...results.filter(Boolean));
    }

    const films = details.sort((a, b) => {
      const da = a.releaseDate ?? '9999';
      const db = b.releaseDate ?? '9999';
      return da.localeCompare(db);
    });

    cache = films;
    cacheTime = Date.now();
    res.json({ films });
  } catch (err) {
    console.error('[tmdb/upcoming]', err.message);
    res.status(502).json({ films: [] });
  }
}
