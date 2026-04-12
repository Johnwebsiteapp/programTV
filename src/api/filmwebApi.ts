// ============================================================
// FILMWEB API — warstwa frontendowa
// Proxy do Filmweb przez nasz backend (server.mjs)
// ============================================================

export interface FilmwebData {
  id: number;
  title: string;
  originalTitle?: string | null;
  year: number | null;
  rate: number | null;        // ocena 1-10
  rateCount: number;
  genres: string[];           // np. ["dramat", "sci-fi", "komedia"]
  countries: string[];        // np. ["USA", "Polska", "Francja"]
  type: 'FILM' | 'SERIAL' | string;
  filmwebUrl: string;
  poster: string | null;
  synopsis?: string | null;   // streszczenie fabuły
}

// ─── Zapowiedzi filmowe (TMDB) ───────────────────────────

export interface TmdbMovie {
  id: number;
  title: string;
  originalTitle: string | null;
  synopsis?: string | null;     // opis fabuły
  releaseDate: string | null;   // "2026-07-15" lub null
  year: number | null;
  rating: number | null;        // 0-10
  rateCount: number;
  genres: string[];
  countries: string[];
  poster: string | null;
  filmwebUrl: string;
  popularity?: number;
  isPolish?: boolean;        // true jeśli produkcja polska (original_language === 'pl')
}

export async function getUpcomingMovies(): Promise<TmdbMovie[]> {
  // Wywołujemy TMDB bezpośrednio z przeglądarki (IP użytkownika, nie serwera)
  const KEY = 'e21080713ee1e49ed939be3b37d36943';
  const today = new Date().toISOString().split('T')[0];
  const in9m   = new Date(Date.now() + 270 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  const BASE   = 'https://api.themoviedb.org/3';

  try {
    const [r1, r2, r3] = await Promise.all([
      fetch(`${BASE}/movie/upcoming?api_key=${KEY}&language=pl-PL&region=PL&page=1`, { signal: AbortSignal.timeout(10000) }),
      fetch(`${BASE}/discover/movie?api_key=${KEY}&language=pl-PL&sort_by=popularity.desc&primary_release_date.gte=${today}&primary_release_date.lte=${in9m}&page=1`, { signal: AbortSignal.timeout(10000) }),
      fetch(`${BASE}/discover/movie?api_key=${KEY}&language=pl-PL&sort_by=popularity.desc&primary_release_date.gte=${today}&primary_release_date.lte=${in9m}&page=2`, { signal: AbortSignal.timeout(10000) }),
    ]);

    const [d1, d2, d3] = await Promise.all([
      r1.ok ? r1.json() : { results: [] },
      r2.ok ? r2.json() : { results: [] },
      r3.ok ? r3.json() : { results: [] },
    ]);

    const seen = new Set<number>();
    return [...(d1.results ?? []), ...(d2.results ?? []), ...(d3.results ?? [])]
      .filter((f: any) => {
        if (!f?.id || seen.has(f.id)) return false;
        seen.add(f.id);
        return true;
      })
      .map((f: any) => ({
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
        filmwebUrl: `https://www.filmweb.pl/search?q=${encodeURIComponent(f.title || f.original_title || '')}`,
        popularity: f.popularity ?? 0,
        isPolish: f.original_language === 'pl',
      }))
      .filter((f: TmdbMovie) => !!f.title)
      .sort((a: TmdbMovie, b: TmdbMovie) => {
        // Polskie na górze
        if (a.isPolish && !b.isPolish) return -1;
        if (!a.isPolish && b.isPolish) return 1;
        // W obrębie grupy: po dacie premiery, potem popularności
        const da = a.releaseDate ? new Date(a.releaseDate).getTime() : 9e15;
        const db = b.releaseDate ? new Date(b.releaseDate).getTime() : 9e15;
        if (da !== db) return da - db;
        return (b.popularity ?? 0) - (a.popularity ?? 0);
      })
      .slice(0, 40);
  } catch {
    return [];
  }
}

export interface FilmwebBatchResult {
  [title: string]: FilmwebData | null;
}

// ─── Filmy aktualnie w kinach w Polsce ───────────────────

const TMDB_KEY = 'e21080713ee1e49ed939be3b37d36943';
const TMDB_BASE = 'https://api.themoviedb.org/3';

const TMDB_GENRES: Record<number, string> = {
  28: 'akcja', 12: 'przygodowy', 16: 'animacja', 35: 'komedia',
  80: 'kryminał', 99: 'dokumentalny', 18: 'dramat', 10751: 'familijny',
  14: 'fantasy', 36: 'historyczny', 27: 'horror', 10402: 'muzyczny',
  9648: 'tajemnica', 10749: 'romans', 878: 'sci-fi', 53: 'thriller',
  10752: 'wojenny', 37: 'western',
};

export async function getCinemaMovies(): Promise<TmdbMovie[]> {
  try {
    const [r1, r2] = await Promise.all([
      fetch(`${TMDB_BASE}/movie/now_playing?api_key=${TMDB_KEY}&language=pl-PL&region=PL&page=1`, { signal: AbortSignal.timeout(10000) }),
      fetch(`${TMDB_BASE}/movie/now_playing?api_key=${TMDB_KEY}&language=pl-PL&region=PL&page=2`, { signal: AbortSignal.timeout(10000) }),
    ]);
    const [d1, d2] = await Promise.all([r1.json(), r2.json()]);
    const all = [...(d1.results ?? []), ...(d2.results ?? [])];
    const seen = new Set<number>();
    return all
      .filter(f => { if (seen.has(f.id)) return false; seen.add(f.id); return true; })
      .map(f => ({
        id: f.id,
        title: f.title || f.original_title || '',
        originalTitle: f.original_title !== f.title ? (f.original_title ?? null) : null,
        synopsis: f.overview || null,
        releaseDate: f.release_date || null,
        year: f.release_date ? new Date(f.release_date).getFullYear() : null,
        rating: f.vote_average ? Math.round(f.vote_average * 10) / 10 : null,
        rateCount: f.vote_count ?? 0,
        genres: (f.genre_ids ?? []).map((id: number) => TMDB_GENRES[id]).filter(Boolean),
        countries: [],
        poster: f.poster_path ? `https://image.tmdb.org/t/p/w300${f.poster_path}` : null,
        filmwebUrl: `https://www.themoviedb.org/movie/${f.id}`,
        popularity: f.popularity ?? 0,
        isPolish: f.original_language === 'pl',
      }))
      .sort((a, b) => (b.popularity ?? 0) - (a.popularity ?? 0));
  } catch {
    return [];
  }
}

// ─── Wyszukaj jeden tytuł ─────────────────────────────────

export async function searchFilmweb(title: string): Promise<FilmwebData | null> {
  try {
    const res = await fetch(`/api/filmweb/search?title=${encodeURIComponent(title)}`, {
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return null;
    const json = await res.json();
    return json.result ?? null;
  } catch {
    return null;
  }
}

// ─── Wyszukaj wiele tytułów naraz ─────────────────────────

export async function batchSearchFilmweb(
  titles: string[],
  onProgress?: (done: number, total: number) => void
): Promise<FilmwebBatchResult> {
  const CHUNK = 20; // ile tytułów na jeden request
  const result: FilmwebBatchResult = {};
  let done = 0;

  for (let i = 0; i < titles.length; i += CHUNK) {
    const chunk = titles.slice(i, i + CHUNK);
    try {
      const res = await fetch('/api/filmweb/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ titles: chunk }),
        signal: AbortSignal.timeout(30000),
      });
      if (res.ok) {
        const json = await res.json();
        Object.assign(result, json.results ?? {});
      }
    } catch {
      // Jeśli batch nie przejdzie, wyniki dla tego chunka = null
      chunk.forEach(t => { result[t] = null; });
    }
    done += chunk.length;
    onProgress?.(done, titles.length);
  }

  return result;
}
