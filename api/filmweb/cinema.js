import { FILMWEB_HEADERS, COUNTRY_CODES } from '../_filmweb.js';

// Module-level cache (persists on warm invocations)
let cinemaCache = null;
let cinemaCacheTime = 0;
const CINEMA_TTL = 6 * 60 * 60 * 1000; // 6 hours

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 'public, s-maxage=21600, stale-while-revalidate=3600');

  if (cinemaCache && Date.now() - cinemaCacheTime < CINEMA_TTL) {
    return res.json({ films: cinemaCache });
  }

  try {
    const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const showtimesRes = await fetch(
      `https://www.filmweb.pl/api/v1/showtimes?date=${tomorrow}`,
      { headers: FILMWEB_HEADERS, signal: AbortSignal.timeout(10000) }
    );
    if (!showtimesRes.ok) return res.status(502).json({ films: [] });

    const showtimesJson = await showtimesRes.json();
    const seanceCounts = showtimesJson.filmSeanceCounts ?? {};
    const filmIds = Object.keys(showtimesJson.filmDates ?? {})
      .map(Number)
      .sort((a, b) => (seanceCounts[b] ?? 0) - (seanceCounts[a] ?? 0))
      .slice(0, 50);

    const CONCURRENCY = 8;
    const details = [];
    for (let i = 0; i < filmIds.length; i += CONCURRENCY) {
      const batch = filmIds.slice(i, i + CONCURRENCY);
      const batchResults = await Promise.all(batch.map(async (id) => {
        try {
          const [prevRes, ratingRes] = await Promise.all([
            fetch(`https://www.filmweb.pl/api/v1/film/${id}/preview`, { headers: FILMWEB_HEADERS, signal: AbortSignal.timeout(8000) }),
            fetch(`https://www.filmweb.pl/api/v1/film/${id}/rating`,  { headers: FILMWEB_HEADERS, signal: AbortSignal.timeout(8000) }),
          ]);
          if (!prevRes.ok) return null;
          const preview = await prevRes.json();
          const rating  = ratingRes.ok ? await ratingRes.json() : {};

          const rawTitle = typeof preview.title === 'object'
            ? (preview.title?.title ?? preview.title?.pl ?? preview.title?.text ?? '')
            : (preview.title ?? '');
          const originalTitle = typeof preview.originalTitle === 'object'
            ? (preview.originalTitle?.title ?? preview.originalTitle?.text ?? null)
            : (preview.originalTitle ?? null);
          const title = rawTitle || originalTitle || String(id);
          const poster = typeof preview.poster === 'object'
            ? (preview.poster?.path ?? preview.poster?.url ?? null)
            : (preview.poster ?? null);

          return {
            id,
            title,
            originalTitle: originalTitle !== title ? originalTitle : null,
            year:      preview.year ?? null,
            rate:      typeof rating.rate === 'number' ? Math.round(rating.rate * 10) / 10 : null,
            rateCount: rating.count ?? 0,
            genres:    (preview.genres ?? []).map(g => g?.name?.text?.toLowerCase?.() ?? '').filter(Boolean),
            countries: (preview.countries ?? []).map(c => COUNTRY_CODES[c?.code] ?? c?.code ?? '').filter(Boolean),
            type:      preview.entityName ?? 'film',
            filmwebUrl: `https://www.filmweb.pl/film/${id}`,
            poster:    poster ? `https://fwcdn.pl${poster}` : null,
            synopsis:  preview.plot?.synopsis ?? preview.description ?? null,
          };
        } catch { return null; }
      }));
      details.push(...batchResults.filter(Boolean));
    }

    const films = details.sort((a, b) => (b.rate ?? 0) - (a.rate ?? 0));
    cinemaCache = films;
    cinemaCacheTime = Date.now();
    return res.json({ films });
  } catch (err) {
    return res.status(502).json({ films: [] });
  }
}
