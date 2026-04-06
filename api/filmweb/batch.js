import { searchFilmweb } from '../_filmweb.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const titles = req.body?.titles;
  if (!Array.isArray(titles) || !titles.length) {
    return res.status(400).json({ error: 'Required field: titles (array)' });
  }

  const results = {};
  // Przetwarzaj wszystkie tytuły równolegle (max 20 na raz — jeden chunk z frontu)
  const CONCURRENCY = 10;
  for (let i = 0; i < titles.length; i += CONCURRENCY) {
    const batch = titles.slice(i, i + CONCURRENCY);
    await Promise.all(batch.map(async (title) => {
      results[title] = await searchFilmweb(title);
    }));
  }

  return res.json({ results });
}
