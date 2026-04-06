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

export interface FilmwebBatchResult {
  [title: string]: FilmwebData | null;
}

// ─── Filmy aktualnie w kinach w Polsce ───────────────────

export async function getCinemaMovies(): Promise<FilmwebData[]> {
  try {
    const res = await fetch('/api/filmweb/cinema', {
      signal: AbortSignal.timeout(30000),
    });
    if (!res.ok) return [];
    const json = await res.json();
    return json.films ?? [];
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
