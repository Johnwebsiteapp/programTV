// Shared Filmweb logic for Vercel functions
// Module-level cache persists across warm invocations

export const FILMWEB_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept': 'application/json',
  'Accept-Language': 'pl-PL,pl;q=0.9',
  'X-Locale': 'pl_PL',
};

export const COUNTRY_CODES = {
  US: 'USA', GB: 'Wielka Brytania', PL: 'Polska', FR: 'Francja', DE: 'Niemcy',
  IT: 'Włochy', RU: 'Rosja', ES: 'Hiszpania', JP: 'Japonia', KR: 'Korea Południowa',
  CN: 'Chiny', IN: 'Indie', AU: 'Australia', MX: 'Meksyk', BR: 'Brazylia',
  SE: 'Szwecja', NO: 'Norwegia', DK: 'Dania', FI: 'Finlandia', NL: 'Holandia',
  BE: 'Belgia', CH: 'Szwajcaria', AT: 'Austria', CZ: 'Czechy', HU: 'Węgry',
  SK: 'Słowacja', UA: 'Ukraina', CA: 'Kanada', AR: 'Argentyna', ZA: 'RPA',
  IE: 'Irlandia', PT: 'Portugalia', GR: 'Grecja', TR: 'Turcja', IL: 'Izrael',
  IR: 'Iran', TH: 'Tajlandia', TW: 'Tajwan', HK: 'Hongkong',
};

const filmwebCache = new Map();
const CACHE_TTL = 24 * 60 * 60 * 1000;

export async function searchFilmweb(title) {
  const key = title.toLowerCase().trim();
  const cached = filmwebCache.get(key);
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL) return cached.data;

  try {
    let filmId = null;
    let filmType = 'film';

    for (const type of ['film', 'serial']) {
      const res = await fetch(
        `https://www.filmweb.pl/api/v1/search?query=${encodeURIComponent(title)}&type=${type}`,
        { headers: FILMWEB_HEADERS, signal: AbortSignal.timeout(8000) }
      );
      if (!res.ok) continue;
      const json = await res.json();
      const hits = json?.searchHits ?? [];
      if (hits.length > 0) { filmId = hits[0].id; filmType = type; break; }
    }

    if (!filmId) {
      filmwebCache.set(key, { data: null, fetchedAt: Date.now() });
      return null;
    }

    const [previewRes, ratingRes] = await Promise.all([
      fetch(`https://www.filmweb.pl/api/v1/film/${filmId}/preview`, { headers: FILMWEB_HEADERS, signal: AbortSignal.timeout(8000) }),
      fetch(`https://www.filmweb.pl/api/v1/film/${filmId}/rating`,  { headers: FILMWEB_HEADERS, signal: AbortSignal.timeout(8000) }),
    ]);

    const preview = previewRes.ok ? await previewRes.json() : {};
    const rating  = ratingRes.ok  ? await ratingRes.json()  : {};

    const genres    = (preview.genres   ?? []).map(g => (g.name?.text ?? '').toLowerCase()).filter(Boolean);
    const countries = (preview.countries ?? []).map(c => COUNTRY_CODES[c.code] ?? c.code).filter(Boolean);
    const origTitle = typeof preview.originalTitle === 'object' ? preview.originalTitle?.title : preview.originalTitle;
    const posterPath = typeof preview.poster === 'object' ? (preview.poster?.path ?? preview.poster?.url ?? null) : preview.poster;

    const data = {
      id: filmId,
      title: preview.title?.title ?? origTitle ?? title,
      originalTitle: origTitle ?? null,
      year: preview.year ?? null,
      rate: rating.rate != null ? Math.round(rating.rate * 10) / 10 : null,
      rateCount: rating.count ?? 0,
      genres,
      countries,
      type: filmType.toUpperCase(),
      filmwebUrl: `https://www.filmweb.pl/${filmType}/${filmId}`,
      poster: posterPath || null,
      synopsis: preview.plot?.synopsis ?? preview.description ?? null,
    };

    filmwebCache.set(key, { data, fetchedAt: Date.now() });
    return data;
  } catch (err) {
    filmwebCache.set(key, { data: null, fetchedAt: Date.now() });
    return null;
  }
}
