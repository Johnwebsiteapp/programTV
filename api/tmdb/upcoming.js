// ============================================================
// VERCEL SERVERLESS FUNCTION — Zapowiedzi filmowe (TMDB)
// GET /api/tmdb/upcoming
// ============================================================

let cache = null;
let cacheTime = 0;
const CACHE_TTL = 6 * 60 * 60 * 1000; // 6h

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 'public, s-maxage=21600, stale-while-revalidate=3600');

  const TMDB_KEY = process.env.TMDB_API_KEY || 'e547e17d4e91f3e62a571655cd1ccaff';

  if (cache && Date.now() - cacheTime < CACHE_TTL) {
    return res.json({ films: cache });
  }

  try {
    const today = new Date().toISOString().split('T')[0];
    const in9months = new Date(Date.now() + 270 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    const BASE = 'https://api.themoviedb.org/3';
    const lang = 'pl-PL';

    // Pobierz równolegle: nadchodzące + popularne w przyszłości (2 strony)
    const [r1, r2, r3] = await Promise.all([
      fetch(`${BASE}/movie/upcoming?api_key=${TMDB_KEY}&language=${lang}&region=PL&page=1`, { signal: AbortSignal.timeout(10000) }),
      fetch(`${BASE}/discover/movie?api_key=${TMDB_KEY}&language=${lang}&sort_by=popularity.desc&primary_release_date.gte=${today}&primary_release_date.lte=${in9months}&page=1`, { signal: AbortSignal.timeout(10000) }),
      fetch(`${BASE}/discover/movie?api_key=${TMDB_KEY}&language=${lang}&sort_by=popularity.desc&primary_release_date.gte=${today}&primary_release_date.lte=${in9months}&page=2`, { signal: AbortSignal.timeout(10000) }),
    ]);

    const [d1, d2, d3] = await Promise.all([
      r1.ok ? r1.json() : { results: [] },
      r2.ok ? r2.json() : { results: [] },
      r3.ok ? r3.json() : { results: [] },
    ]);

    // Połącz i usuń duplikaty
    const seen = new Set();
    const films = [...(d1.results ?? []), ...(d2.results ?? []), ...(d3.results ?? [])]
      .filter(f => {
        if (!f?.id || seen.has(f.id)) return false;
        seen.add(f.id);
        return true;
      })
      .map(f => ({
        id: f.id,
        title: f.title || f.original_title || '',
        originalTitle: (f.original_title && f.original_title !== f.title) ? f.original_title : null,
        synopsis: f.overview || null,
        releaseDate: f.release_date || null,
        year: f.release_date ? parseInt(f.release_date.slice(0, 4)) : null,
        rating: f.vote_average > 0 ? Math.round(f.vote_average * 10) / 10 : null,
        rateCount: f.vote_count ?? 0,
        genres: [],
        countries: [],
        poster: f.poster_path ? `https://image.tmdb.org/t/p/w300${f.poster_path}` : null,
        filmwebUrl: `https://www.themoviedb.org/movie/${f.id}`,
        popularity: f.popularity ?? 0,
      }))
      .filter(f => f.title)
      .sort((a, b) => {
        const da = a.releaseDate ? new Date(a.releaseDate).getTime() : 9e15;
        const db = b.releaseDate ? new Date(b.releaseDate).getTime() : 9e15;
        if (da !== db) return da - db;
        return b.popularity - a.popularity;
      })
      .slice(0, 40);

    cache = films;
    cacheTime = Date.now();
    res.json({ films });
  } catch (err) {
    console.error('[tmdb/upcoming]', err.message);
    res.status(502).json({ films: [] });
  }
}
