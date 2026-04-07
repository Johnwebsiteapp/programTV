import { FILMWEB_HEADERS } from '../_filmweb.js';

// Module-level cache (persists on warm invocations)
let cinemaCache = null;
let cinemaCacheTime = 0;
const CINEMA_TTL = 6 * 60 * 60 * 1000; // 6 hours

const CC_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept': 'application/json',
  'Accept-Language': 'pl-PL,pl;q=0.9',
  'Referer': 'https://www.cinemacity.pl/',
};

async function fetchCinemaCityFilms() {
  const today = new Date().toISOString().split('T')[0];
  // Cinema City data API — Poland region (10107)
  const url = `https://www.cinemacity.pl/pl/data-api-service/v1/quickbook/10107/films/until/${today}/lang/pl_PL`;
  const res = await fetch(url, { headers: CC_HEADERS, signal: AbortSignal.timeout(10000) });
  if (!res.ok) throw new Error(`Cinema City API ${res.status}`);
  const json = await res.json();
  return json.body?.films ?? [];
}

// Search Filmweb by title to get rating + poster
async function enrichWithFilmweb(title, year) {
  try {
    const query = encodeURIComponent(title);
    const searchRes = await fetch(
      `https://www.filmweb.pl/api/v1/search/film?query=${query}&pageSize=5`,
      { headers: FILMWEB_HEADERS, signal: AbortSignal.timeout(6000) }
    );
    if (!searchRes.ok) return null;
    const searchJson = await searchRes.json();
    const items = searchJson.searchHits ?? searchJson.items ?? [];
    // Pick best match: same title (case-insensitive), prefer same year
    const normalise = s => s?.toLowerCase().replace(/[^a-z0-9]/g, '') ?? '';
    const needle = normalise(title);
    let best = items.find(i => normalise(i.title) === needle && (!year || i.year === year))
            ?? items.find(i => normalise(i.title) === needle)
            ?? items[0];
    if (!best) return null;
    const id = best.id ?? best.filmId;
    if (!id) return null;

    const [prevRes, ratingRes] = await Promise.all([
      fetch(`https://www.filmweb.pl/api/v1/film/${id}/preview`, { headers: FILMWEB_HEADERS, signal: AbortSignal.timeout(6000) }),
      fetch(`https://www.filmweb.pl/api/v1/film/${id}/rating`,  { headers: FILMWEB_HEADERS, signal: AbortSignal.timeout(6000) }),
    ]);
    if (!prevRes.ok) return null;
    const preview = await prevRes.json();
    const rating  = ratingRes.ok ? await ratingRes.json() : {};

    const poster = typeof preview.poster === 'object'
      ? (preview.poster?.path ?? preview.poster?.url ?? null)
      : (preview.poster ?? null);

    return {
      filmwebId: id,
      rate:      typeof rating.rate === 'number' ? Math.round(rating.rate * 10) / 10 : null,
      rateCount: rating.count ?? 0,
      poster:    poster || null,
      synopsis:  preview.plot?.synopsis ?? preview.description ?? null,
      filmwebUrl: `https://www.filmweb.pl/film/${id}`,
      genres:    (preview.genres ?? []).map(g => g?.name?.text?.toLowerCase?.() ?? '').filter(Boolean),
    };
  } catch { return null; }
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 'public, s-maxage=21600, stale-while-revalidate=3600');

  if (cinemaCache && Date.now() - cinemaCacheTime < CINEMA_TTL) {
    return res.json({ films: cinemaCache });
  }

  try {
    const ccFilms = await fetchCinemaCityFilms();
    if (!ccFilms.length) return res.status(502).json({ films: [] });

    // Deduplicate by name
    const seen = new Set();
    const unique = ccFilms.filter(f => {
      if (seen.has(f.name)) return false;
      seen.add(f.name);
      return true;
    });

    const CONCURRENCY = 6;
    const films = [];
    for (let i = 0; i < unique.length; i += CONCURRENCY) {
      const batch = unique.slice(i, i + CONCURRENCY);
      const results = await Promise.all(batch.map(async (ccFilm) => {
        const fw = await enrichWithFilmweb(ccFilm.name, null);
        return {
          id:          ccFilm.id,
          title:       ccFilm.name,
          originalTitle: null,
          year:        null,
          rate:        fw?.rate ?? null,
          rateCount:   fw?.rateCount ?? 0,
          genres:      fw?.genres ?? [],
          countries:   [],
          type:        'film',
          filmwebUrl:  fw?.filmwebUrl ?? null,
          // Prefer Cinema City poster; fall back to Filmweb
          poster:      ccFilm.posterLink ?? fw?.poster ?? null,
          synopsis:    fw?.synopsis ?? null,
        };
      }));
      films.push(...results);
    }

    const sorted = films.sort((a, b) => (b.rate ?? 0) - (a.rate ?? 0));
    cinemaCache = sorted;
    cinemaCacheTime = Date.now();
    return res.json({ films: sorted });
  } catch (err) {
    return res.status(502).json({ films: [], error: err.message });
  }
}
