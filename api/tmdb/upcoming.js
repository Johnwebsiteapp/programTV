// ============================================================
// VERCEL SERVERLESS FUNCTION — Zapowiedzi filmowe (Filmweb)
// GET /api/tmdb/upcoming
// Pobiera zapowiedzi z Filmweb bez potrzeby API key
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
  return `${POSTER_BASE}${p}`;
}

// Pobierz szczegóły jednego filmu Filmweb po ID
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

    const genres    = (preview.genres   ?? []).map(g => (g?.name?.text ?? g?.name ?? '').toLowerCase()).filter(Boolean);
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
      releaseDate: preview.releaseWorldDate ?? preview.releaseDate ?? null,
      rating: typeof rating.rate === 'number' ? Math.round(rating.rate * 10) / 10 : null,
      rateCount: rating.count ?? 0,
      genres,
      countries,
      poster: buildPosterUrl(preview.poster),
      synopsis,
      filmwebUrl: `https://www.filmweb.pl/film/${title.replace(/ /g, '+')}`,
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

  // Oblicz datę za tydzień i za 12 miesięcy
  const today = new Date();
  const in7d  = new Date(today.getTime() + 7   * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  const in12m = new Date(today.getTime() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  try {
    // Próba 1: endpoint /api/v1/film/comingSoon — filmy nadchodzące
    let filmIds = [];
    const endpoints = [
      `https://www.filmweb.pl/api/v1/film/comingSoon?page=0&pageSize=40`,
      `https://www.filmweb.pl/api/v1/film/anticipated?page=0&pageSize=40`,
      `https://www.filmweb.pl/api/v1/film/mostAnticipated?page=0&pageSize=40`,
      `https://www.filmweb.pl/api/v1/film/wantToSee?page=0&pageSize=40`,
    ];

    for (const url of endpoints) {
      try {
        const r = await fetch(url, {
          headers: FILMWEB_HEADERS,
          signal: AbortSignal.timeout(8000),
        });
        if (!r.ok) continue;
        const json = await r.json();

        // Różne formaty odpowiedzi Filmweb
        const items =
          json?.items ?? json?.films ?? json?.data?.items ?? json?.results ??
          (Array.isArray(json) ? json : null);

        if (Array.isArray(items) && items.length > 0) {
          filmIds = items
            .map(i => i?.id ?? i?.filmId ?? i?.film?.id ?? (typeof i === 'number' ? i : null))
            .filter(Boolean)
            .slice(0, 40);
          console.log(`[tmdb/upcoming] Użyto endpoint: ${url} — ${filmIds.length} filmów`);
          break;
        }
      } catch (e) {
        console.warn(`[tmdb/upcoming] Endpoint ${url} failed:`, e.message);
      }
    }

    // Próba 2: scraping strony HTML Filmweb z zapowiedziami
    if (filmIds.length === 0) {
      const pageUrls = [
        'https://www.filmweb.pl/films/coming-soon',
        'https://www.filmweb.pl/films/soon',
        'https://www.filmweb.pl/filmy/wkrotce',
      ];
      for (const pageUrl of pageUrls) {
        try {
          const r = await fetch(pageUrl, {
            headers: {
              ...FILMWEB_HEADERS,
              'Accept': 'text/html,application/xhtml+xml',
            },
            signal: AbortSignal.timeout(12000),
          });
          if (!r.ok) continue;
          const html = await r.text();

          // Szukaj ID filmów w JSON osadzonym w HTML
          const dataMatch = html.match(/"entity":(\{[^}]{10,}\})/g);
          if (dataMatch) {
            const ids = dataMatch
              .map(s => { try { return JSON.parse(s.replace('"entity":', '')); } catch { return null; } })
              .filter(o => o?.id && o?.type === 'film')
              .map(o => o.id)
              .slice(0, 40);
            if (ids.length > 0) {
              filmIds = ids;
              console.log(`[tmdb/upcoming] HTML scrape ${pageUrl}: ${ids.length} filmów`);
              break;
            }
          }

          // Alternatywnie — szukaj wzorca /film/TITLE-YEAR-ID
          const linkMatches = [...html.matchAll(/\/film\/[^/"?]+-(\d{6,8})/g)];
          if (linkMatches.length > 0) {
            const seen = new Set();
            filmIds = linkMatches
              .map(m => parseInt(m[1]))
              .filter(id => !seen.has(id) && seen.add(id))
              .slice(0, 40);
            console.log(`[tmdb/upcoming] HTML links scrape: ${filmIds.length} filmów`);
            break;
          }
        } catch (e) {
          console.warn(`[tmdb/upcoming] HTML scrape failed:`, e.message);
        }
      }
    }

    if (filmIds.length === 0) {
      console.warn('[tmdb/upcoming] Brak wyników ze wszystkich źródeł');
      return res.json({ films: [] });
    }

    // Pobierz szczegóły filmów (po 6 równolegle)
    const details = [];
    const CONC = 6;
    for (let i = 0; i < filmIds.length; i += CONC) {
      const batch = filmIds.slice(i, i + CONC);
      const results = await Promise.all(batch.map(fetchFilmDetails));
      details.push(...results.filter(Boolean));
    }

    // Filtruj: tylko filmy z datą premiery w przyszłości lub bez daty
    const todayStr = today.toISOString().split('T')[0];
    const films = details
      .filter(f => !f.releaseDate || f.releaseDate >= todayStr)
      .sort((a, b) => {
        const da = a.releaseDate ? new Date(a.releaseDate).getTime() : 9e15;
        const db = b.releaseDate ? new Date(b.releaseDate).getTime() : 9e15;
        return da - db;
      });

    cache = films;
    cacheTime = Date.now();
    res.json({ films });
  } catch (err) {
    console.error('[tmdb/upcoming]', err.message);
    res.status(502).json({ films: [] });
  }
}
