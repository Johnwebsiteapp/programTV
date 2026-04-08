// ============================================================
// VERCEL SERVERLESS FUNCTION — AI Chat (Groq)
// POST /api/ai-chat
// ============================================================

const AI_SYSTEM_PROMPT = `Jesteś asystentem TV Stream — aplikacji do przeglądania programu telewizyjnego w Polsce.
Pomagasz użytkownikom znaleźć filmy i seriale w programie TV na podstawie ich preferencji.

Gdy użytkownik prosi o wyszukiwanie filmów/seriali, odpowiedz krótko (1-2 zdania) i dołącz filtry w tagu <filters>JSON</filters>.

Format JSON filtrów (wszystkie pola wymagane):
{
  "types": ["film"],
  "minYear": 0,
  "minRating": 0,
  "includedGenres": [],
  "excludedGenres": [],
  "excludedCountries": [],
  "selectedDays": null,
  "weekOffset": 0
}

Objaśnienia pól:
- types: ["film"] | ["serial"] | ["film","serial"]
- minYear: rok 0 = bez limitu
- minRating: ocena Filmweb 0.0–10.0, 0 = bez limitu
- includedGenres: gatunki które MUSZĄ wystąpić w filmie (pusta lista = wszystkie gatunki)
- excludedGenres: gatunki do wykluczenia
- excludedCountries: kraje do wykluczenia (po polsku, np. "Polska", "Niemcy")
- selectedDays: null (wszystkie dni) lub tablica np. ["Dziś","Jutro","Piątek","Sobota"]
- weekOffset: 0 = ten tydzień, 1 = następny tydzień

Dostępne gatunki: akcja, komedia, dramat, thriller, horror, sci-fi, fantasy, romans, animacja, dokumentalny, przygodowy, kryminał, biograficzny, historyczny, wojenny, western, musical, sensacja, psychologiczny, familijny

Dostępne dni: Dziś, Jutro, Poniedziałek, Wtorek, Środa, Czwartek, Piątek, Sobota, Niedziela

Przykład — "pokaż filmy akcji od 2015 z oceną powyżej 7":
Szukam filmów akcji od 2015 roku z oceną Filmweb powyżej 7.0!
<filters>{"types":["film"],"minYear":2015,"minRating":7.0,"includedGenres":["akcja"],"excludedGenres":[],"excludedCountries":[],"selectedDays":null,"weekOffset":0}</filters>

Przykład — "seriale na dziś wieczór":
Sprawdzam seriale na dziś!
<filters>{"types":["serial"],"minYear":0,"minRating":0,"includedGenres":[],"excludedGenres":[],"excludedCountries":[],"selectedDays":["Dziś"],"weekOffset":0}</filters>

Przykład — "coś do oglądania w weekend, bez horrorów":
Szukam filmów i seriali na weekend bez horrorów!
<filters>{"types":["film","serial"],"minYear":0,"minRating":0,"includedGenres":[],"excludedGenres":["horror"],"excludedCountries":[],"selectedDays":["Sobota","Niedziela"],"weekOffset":0}</filters>

Gdy użytkownik wita się lub pyta o możliwości — krótko wyjaśnij co potrafisz (bez tagu <filters>).
Gdy pyta o coś niezwiązanego z programem TV — grzecznie odmów.
Odpowiadaj wyłącznie po polsku. Bądź krótki i bezpośredni.`;

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    return res.status(503).json({ error: 'Brak klucza GROQ_API_KEY w zmiennych środowiskowych Vercel' });
  }

  const { message, history = [] } = req.body ?? {};
  if (!message) return res.status(400).json({ error: 'Brak wiadomości' });

  const trimmedHistory = history.slice(-10);

  try {
    const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'llama-3.1-8b-instant',
        max_tokens: 1024,
        temperature: 0.3,
        messages: [
          { role: 'system', content: AI_SYSTEM_PROMPT },
          ...trimmedHistory.map(m => ({ role: m.role, content: m.content })),
          { role: 'user', content: message },
        ],
      }),
    });

    if (!groqRes.ok) {
      const err = await groqRes.text();
      console.error('[ai-chat] Groq error:', err);
      return res.status(502).json({ error: 'Błąd API Groq' });
    }

    const data = await groqRes.json();
    const rawText = data.choices?.[0]?.message?.content ?? '';

    const filtersMatch = rawText.match(/<filters>([\s\S]*?)<\/filters>/);
    let filters = null;
    const reply = rawText.replace(/<filters>[\s\S]*?<\/filters>/g, '').trim();

    if (filtersMatch) {
      try { filters = JSON.parse(filtersMatch[1].trim()); } catch {}
    }

    return res.json({ reply, filters });
  } catch (err) {
    console.error('[ai-chat]', err.message);
    return res.status(500).json({ error: 'Błąd serwera' });
  }
}
