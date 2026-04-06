// EPG scraper — Vercel serverless function
// Scrapes programtv.onet.pl for TV schedule data

const CHANNEL_ONET_SLUGS = {
  tvp1:          'tvp-1-321',
  tvp2:          'tvp-2-323',
  tvn:           'tvn-357',
  polsat:        'polsat-38',
  ttv:           'ttv-33',
  tvpinfo:       'tvp-info-462',
  tvn24:         'tvn-24-347',
  tvn7:          'tvn-7-326',
  polsat2:       'polsat-2-327',
  tvpseriale:    'tvp-seriale-130',
  axn:           'axn-249',
  fox:           'fox-127',
  comedycentral: 'comedy-central-63',
  hbo:           'hbo-23',
  hbo2:          'hbo2-24',
  tvpsport:      'tvp-sport-40',
  eurosport1:    'eurosport-1-93',
  eurosport2:    'eurosport-2-76',
  natgeo:        'national-geographic-channel-32',
  discovery:     'discovery-channel-202',
  animalplanet:  'animal-planet-hd-284',
  history:       'history-91',
  tvphistoria:   'tvp-historia-74',
  tvpkultura:    'tvp-kultura-477',
  tvprozrywka:   'tvp-rozrywka-159',
};

function mapCategory(cat) {
  if (!cat) return 'other';
  const c = cat.toLowerCase();
  if (c.includes('film') || c.includes('dramat') || c.includes('komedia') || c.includes('kryminał') || c.includes('horror') || c.includes('thriller') || c.includes('western') || c.includes('przygodowy') || c.includes('animowany') || c.includes('sci-fi') || c.includes('fantasy') || c.includes('romans')) return 'movie';
  if (c.includes('serial') || c.includes('sitcom') || c.includes('opera') || c.includes('telenowela')) return 'series';
  if (c.includes('sport') || c.includes('piłka') || c.includes('wyścig') || c.includes('mecz')) return 'sport';
  if (c.includes('dokument') || c.includes('przyroda') || c.includes('podróże')) return 'documentary';
  if (c.includes('wiadomo') || c.includes('aktual') || c.includes('info') || c.includes('serwis')) return 'news';
  if (c.includes('dziec') || c.includes('bajk') || c.includes('kreskówk') || c.includes('animacja')) return 'kids';
  if (c.includes('rozrywk') || c.includes('show') || c.includes('talent') || c.includes('kabaret') || c.includes('reality') || c.includes('quiz')) return 'entertainment';
  if (c.includes('muzyk') || c.includes('koncert')) return 'music';
  return 'other';
}

async function fetchOnetPage(onetSlug, dayOffset) {
  const url = `https://programtv.onet.pl/program-tv/${onetSlug}?dzien=${dayOffset}`;
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'pl-PL,pl;q=0.9',
    },
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.text();
}

function parseProgramsFromHtml(html, channelId) {
  const jsonLdMatches = [...html.matchAll(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)];
  let jsonLdItems = [];

  for (const match of jsonLdMatches) {
    try {
      let data = JSON.parse(match[1]);
      if (Array.isArray(data)) data = data.find(d => d['@type'] === 'ItemList') || {};
      if (data['@type'] === 'ItemList') {
        jsonLdItems = (data.itemListElement || []).map(item => ({
          position: item.position,
          title: item.name,
          startDate: item?.item?.startDate || null,
        }));
        break;
      }
    } catch (_) {}
  }

  if (!jsonLdItems.length) return [];

  const liMatches = [...html.matchAll(/<li class="(hh[^"]+)"[^>]*>([\s\S]*?)<\/li>/g)];
  const htmlCategories = liMatches.map(liMatch => {
    const body = liMatch[2];
    const catMatch = body.match(/class="type[^"]*">([^<]+)/);
    return catMatch ? catMatch[1].trim() : null;
  });

  const rawPrograms = jsonLdItems
    .filter(item => item.startDate)
    .map((item, idx) => ({
      title: item.title,
      startDate: item.startDate,
      category: htmlCategories[idx] || null,
    }));

  rawPrograms.sort((a, b) => new Date(a.startDate) - new Date(b.startDate));

  const programs = [];
  for (let i = 0; i < rawPrograms.length; i++) {
    const p = rawPrograms[i];
    const next = rawPrograms[i + 1];
    const startTime = new Date(p.startDate);
    let endTime = next
      ? new Date(next.startDate)
      : new Date(startTime.getTime() + 60 * 60 * 1000);

    if (next && endTime < startTime) {
      endTime = new Date(endTime.getTime() + 24 * 60 * 60 * 1000);
    }

    programs.push({
      id: `${channelId}_${startTime.getTime()}_${i}`,
      channelId,
      title: p.title,
      description: '',
      startTime: startTime.toISOString(),
      endTime: endTime.toISOString(),
      genre: mapCategory(p.category),
    });
  }

  return programs;
}

// Module-level cache
const cache = new Map();
const CACHE_TTL_MS = 60 * 60 * 1000;

function getPolandDateStr(dayOffset = 0) {
  const d = new Date(Date.now() + dayOffset * 24 * 60 * 60 * 1000);
  return d.toLocaleDateString('sv-SE', { timeZone: 'Europe/Warsaw' });
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=600');

  const channelIds = (req.query.channelId || '').split(',').filter(Boolean);
  const dayOffsets = (req.query.dayOffset || '0').split(',').map(Number).filter(n => !isNaN(n));

  if (!channelIds.length) {
    return res.status(400).json({ error: 'channelId is required' });
  }

  const allPrograms = [];
  const errors = [];

  const tasks = [];
  for (const channelId of channelIds) {
    const onetSlug = CHANNEL_ONET_SLUGS[channelId];
    if (!onetSlug) {
      errors.push(`No onet mapping for channel: ${channelId}`);
      continue;
    }
    for (const dayOffset of dayOffsets) {
      tasks.push({ channelId, onetSlug, dayOffset });
    }
  }

  // Higher concurrency for Vercel (no persistent state to worry about)
  const CONCURRENCY = 8;
  for (let i = 0; i < tasks.length; i += CONCURRENCY) {
    const batch = tasks.slice(i, i + CONCURRENCY);
    await Promise.all(batch.map(async ({ channelId, onetSlug, dayOffset }) => {
      const cacheKey = `${onetSlug}_${getPolandDateStr(dayOffset)}`;
      const cached = cache.get(cacheKey);
      if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
        allPrograms.push(...cached.data);
        return;
      }
      try {
        const html = await fetchOnetPage(onetSlug, dayOffset);
        const programs = parseProgramsFromHtml(html, channelId);
        cache.set(cacheKey, { data: programs, fetchedAt: Date.now() });
        allPrograms.push(...programs);
      } catch (err) {
        errors.push(`${channelId} day ${dayOffset}: ${err.message}`);
      }
    }));
  }

  return res.json({
    programs: allPrograms,
    errors: errors.length ? errors : undefined,
    total: allPrograms.length,
  });
}
