import { searchFilmweb } from '../_filmweb.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');

  const { title } = req.query;
  if (!title) return res.status(400).json({ error: 'Required param: title' });

  const result = await searchFilmweb(title);
  return res.json({ result });
}
