// ============================================================
// VERCEL SERVERLESS FUNCTION — TMDB Upcoming Movies
// GET /api/tmdb/upcoming
// Zwraca zapowiedziane filmy z The Movie Database (TMDB)
// ============================================================

// Module-level cache (persists across warm invocations)
let tmdbCache = null;
let tmdbCacheTime = 0;
const TMDB_TTL = 6 * 60 * 60 * 1000; // 6 godzin

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 'public, s-maxage=21600, stale-while-revalidate=3600');

  const TMDB_KEY = process.env.TMDB_API_KEY;
  if (!TMDB_KEY) {
    return res.status(503).json({ error: 'Brak TMDB_API_KEY w zmiennych środowiskowych', films: [] });
  }

  // Zwróć z cache jeśli świeże
  if (tmdbCache && Date.now() - tmdbCacheTime < TMDB_TTL) {
    return res.json({ films: tmdbCache });
  }

  try {
    const in1week = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const in9months = new Date(Date.now() + 270 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    const TMDB_BASE = 'https://api.themoviedb.org/3';
    const lang = 'pl-PL';

    const [upcomingRes, discover1Res, discover2Res] = await Promise.all([
      // Potwierdzone premiery — najbliższe tygodnie
      fetch(`${TMDB_BASE}/movie/upcoming?api_key=${TMDB_KEY}&language=${lang}&region=PL&page=1`, {
        signal: AbortSignal.timeout(10000),
      }),
      // Zapowiedziane filmy — 1–9 miesięcy
      fetch(`${TMDB_BASE}/discover/movie?api_key=${TMDB_KEY}&language=${lang}&sort_by=popularity.desc&primary_release_date.gte=${in1week}&primary_release_date.lte=${in9months}&page=1`, {
        signal: AbortSignal.timeout(10000),
      }),
      // Strona 2 zapowiedzi
      fetch(`${TMDB_BASE}/discover/movie?api_key=${TMDB_KEY}&language=${lang}&sort_by=popularity.desc&primary_release_date.gte=${in1week}&primary_release_date.lte=${in9months}&page=2`, {
        signal: AbortSignal.timeout(10000),
      }),
    ]);

    const [upcoming, discover1, discover2] = await Promise.all([
      upcomingRes.ok ? upcomingRes.json() : { results: [] },
      discover1Res.ok ? discover1Res.json() : { results: [] },
      discover2Res.ok ? discover2Res.json() : { results: [] },
    ]);

    // Połącz i usuń duplikaty (incoming ma pierwszeństwo)
    const seen = new Set();
    const raw = [
      ...(upcoming.results ?? []),
      ...(discover1.results ?? []),
      ...(discover2.results ?? []),
    ].filter(f => {
      if (!f?.id || seen.has(f.id)) return false;
      seen.add(f.id);
      return true;
    });

    const films = raw
      .map(f => ({
        id: f.id,
        title: f.title || f.original_title || '',
        originalTitle: (f.original_title && f.original_title !== f.title) ? f.original_title : null,
        overview: f.overview || null,
        releaseDate: f.release_date || null,
        rating: f.vote_average > 0 ? Math.round(f.vote_average * 10) / 10 : null,
        voteCount: f.vote_count ?? 0,
        poster: f.poster_path ? `https://image.tmdb.org/t/p/w300${f.poster_path}` : null,
        backdrop: f.backdrop_path ? `https://image.tmdb.org/t/p/w500${f.backdrop_path}` : null,
        popularity: f.popularity ?? 0,
        tmdbUrl: `https://www.themoviedb.org/movie/${f.id}`,
      }))
      .filter(f => f.title)
      .sort((a, b) => {
        // Sortuj po dacie premiery rosnąco, potem po popularności malejąco
        const da = a.releaseDate ? new Date(a.releaseDate).getTime() : 9e15;
        const db = b.releaseDate ? new Date(b.releaseDate).getTime() : 9e15;
        if (da !== db) return da - db;
        return b.popularity - a.popularity;
      })
      .slice(0, 40);

    tmdbCache = films;
    tmdbCacheTime = Date.now();

    res.json({ films });
  } catch (err) {
    console.error('[tmdb/upcoming]', err.message);
    res.status(502).json({ films: [] });
  }
}
