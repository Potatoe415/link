import axios from 'axios';
import * as cheerio from 'cheerio';
import he from 'he';

const formatSize = (bytes) => {
  if (!bytes || isNaN(bytes)) return '0 B';
  const KB = 1024;
  const MB = KB * 1024;
  const GB = MB * 1024;
  const b = parseInt(bytes);
  if (b >= GB) return (b / GB).toFixed(2) + ' GB';
  if (b >= MB) return (b / MB).toFixed(2) + ' MB';
  if (b >= KB) return (b / KB).toFixed(2) + ' KB';
  return b + ' B';
};

const cleanTitle = (str) => {
  if (!str) return 'Unknown';
  return he.decode(str).trim();
};

const formatDate = (dateInput) => {
    if (!dateInput) return 'N/A';
    try {
        const d = new Date(dateInput);
        if (isNaN(d.getTime())) return dateInput;
        return d.toISOString().split('T')[0];
    } catch (e) {
        return dateInput;
    }
};

const COMMON_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9,fr-FR;q=0.8,fr;q=0.7',
  'Cache-Control': 'no-cache',
  'Pragma': 'no-cache'
};

const engines = {
  apibay: async (q) => {
    const resp = await axios.get(`https://apibay.org/q.php?q=${encodeURIComponent(q)}`, { 
        timeout: 8000,
        headers: COMMON_HEADERS
    });
    return (Array.isArray(resp.data) ? resp.data : [])
      .filter(item => item.info_hash && item.info_hash !== '0000000000000000000000000000000000000000')
      .map(item => {
        const title = cleanTitle(item.name);
        return {
          title: title,
          magnetUrl: `magnet:?xt=urn:btih:${item.info_hash}&dn=${encodeURIComponent(title)}`,
          size: formatSize(item.size),
          seeders: parseInt(item.seeders) || 0,
          date: item.added ? formatDate(parseInt(item.added) * 1000) : 'N/A',
          source: 'Apibay'
        };
      });
  },
  limetorrents: async (q) => {
    const resp = await axios.get(`https://www.limetorrents.to/search/all/${encodeURIComponent(q)}/`, { 
      timeout: 8000,
      headers: COMMON_HEADERS
    });
    const $ = cheerio.load(resp.data);
    const results = [];
    $('table.table2 tr.table-toggle').each((i, el) => {
      const rawTitle = $(el).find('div.tt-name a:nth-child(2)').text();
      const title = cleanTitle(rawTitle);
      const magnetUrl = $(el).find('td.tdnormal:nth-of-type(3) a.csbuttons[href^="magnet:"]').attr('href');
      const size = $(el).find('td.tdnormal:nth-of-type(2)').text().trim();
      const date = $(el).find('td.tdnormal:nth-of-type(1)').text().trim().split(' - ')[0] || 'N/A';
      const seeders = parseInt($(el).find('td.tdseed').text().trim()) || 0;
      if (title && magnetUrl) results.push({ title, magnetUrl, size, seeders, date, source: 'LimeTorrents' });
    });
    return results;
  },
  yts: async (q) => {
    const resp = await axios.get(`https://yts.mx/api/v2/list_movies.json?query_term=${encodeURIComponent(q)}`, { 
        timeout: 8000,
        headers: COMMON_HEADERS
    });
    if (!resp.data.data.movies) return [];
    const results = [];
    resp.data.data.movies.forEach(movie => {
      movie.torrents.forEach(t => {
        const title = cleanTitle(`${movie.title_long} [${t.quality}] [${t.type}]`);
        results.push({
          title: title,
          magnetUrl: `magnet:?xt=urn:btih:${t.hash}&dn=${encodeURIComponent(title)}`,
          size: t.size,
          seeders: t.seeds,
          date: movie.date_uploaded ? movie.date_uploaded.split(' ')[0] : 'N/A',
          source: 'YTS'
        });
      });
    });
    return results;
  },
  solid: async (q) => {
    const resp = await axios.get(`https://solidtorrents.net/api/v1/search?q=${encodeURIComponent(q)}`, { 
        timeout: 8000,
        headers: COMMON_HEADERS
    });
    return (resp.data.results || []).map(item => ({
      title: cleanTitle(item.title),
      magnetUrl: item.magnet,
      size: formatSize(item.size),
      seeders: item.swarm.seeders,
      date: formatDate(item.createdAt),
      source: 'Solid'
    }));
  },
  nyaa: async (q) => {
    const resp = await axios.get(`https://nyaa.si/?f=0&c=0_0&q=${encodeURIComponent(q)}`, { 
        timeout: 8000,
        headers: COMMON_HEADERS
    });
    const $ = cheerio.load(resp.data);
    const results = [];
    $('tr.default, tr.success, tr.danger').each((i, el) => {
        const title = cleanTitle($(el).find('td:nth-child(2) a:last-child').text());
        const magnetUrl = $(el).find('td:nth-child(3) a[href^="magnet:"]').attr('href');
        const size = $(el).find('td:nth-child(4)').text().trim();
        const date = $(el).find('td:nth-child(5)').text().trim().split(' ')[0] || 'N/A';
        const seeders = parseInt($(el).find('td:nth-child(6)').text().trim()) || 0;
        if (title && magnetUrl) results.push({ title, magnetUrl, size, seeders, date, source: 'Nyaa' });
    });
    return results;
  },
  "1337x": async (q) => {
    const resp = await axios.get(`https://1337x.to/search/${encodeURIComponent(q)}/1/`, { timeout: 8000, headers: COMMON_HEADERS });
    const $ = cheerio.load(resp.data);
    const links = [];
    $('table.table-list tbody tr').each((i, el) => {
        const title = cleanTitle($(el).find('td.coll-1.name a:last-child').text());
        const detailUrl = "https://1337x.to" + $(el).find('td.coll-1.name a:last-child').attr('href');
        const size = $(el).find('td.coll-4.size').contents().first().text().trim();
        const date = $(el).find('td.coll-date').text().trim() || 'N/A';
        const seeders = parseInt($(el).find('td.coll-2.seeds').text().trim()) || 0;
        if (title && detailUrl) links.push({ title, detailUrl, size, seeders, date });
    });

    const results = [];
    for (const link of links.slice(0, 3)) {
        try {
            const detailResp = await axios.get(link.detailUrl, { timeout: 5000, headers: COMMON_HEADERS });
            const $$ = cheerio.load(detailResp.data);
            const magnetUrl = $$('a[href^="magnet:"]').first().attr('href');
            if (magnetUrl) results.push({ ...link, magnetUrl, source: '1337x' });
        } catch (e) {}
    }
    return results;
  },
  torrent9: async (q) => {
    const resp = await axios.get(`https://www.torrent9.to/recherche/${encodeURIComponent(q)}`, { timeout: 8000, headers: COMMON_HEADERS });
    const $ = cheerio.load(resp.data);
    const detailLinks = [];
    $('table.table-hover tbody tr').each((i, el) => {
        const title = cleanTitle($(el).find('a').text());
        const detailUrl = "https://www.torrent9.to" + $(el).find('a').attr('href');
        const size = $(el).find('td:nth-child(2)').text().trim();
        const seeders = parseInt($(el).find('td:nth-child(3)').text().trim()) || 0;
        if (title && detailUrl) detailLinks.push({ title, detailUrl, size, seeders, date: 'N/A' });
    });
    const results = [];
    for (const link of detailLinks.slice(0, 3)) {
        try {
            const detailResp = await axios.get(link.detailUrl, { timeout: 5000, headers: COMMON_HEADERS });
            const $$ = cheerio.load(detailResp.data);
            const magnetUrl = $$('a[href^="magnet:"]').attr('href');
            const date = $$('.start-session').text().split(':').pop().trim() || 'N/A';
            if (magnetUrl) results.push({ ...link, magnetUrl, date, source: 'Torrent9 (FR)' });
        } catch (e) {}
    }
    return results;
  },
  oxtorrent: async (q) => {
    const resp = await axios.get(`https://www.oxtorrent.town/recherche/${encodeURIComponent(q)}`, { timeout: 8000, headers: COMMON_HEADERS });
    const $ = cheerio.load(resp.data);
    const detailLinks = [];
    $('table.table-hover tbody tr').each((i, el) => {
        const title = cleanTitle($(el).find('a').text());
        const detailUrl = "https://www.oxtorrent.town" + $(el).find('a').attr('href');
        const size = $(el).find('td:nth-child(2)').text().trim();
        const seeders = parseInt($(el).find('td:nth-child(3)').text().trim()) || 0;
        if (title && detailUrl) detailLinks.push({ title, detailUrl, size, seeders, date: 'N/A' });
    });
    const results = [];
    for (const link of detailLinks.slice(0, 3)) {
        try {
            const detailResp = await axios.get(link.detailUrl, { timeout: 5000, headers: COMMON_HEADERS });
            const $$ = cheerio.load(detailResp.data);
            const magnetUrl = $$('a[href^="magnet:"]').attr('href');
            const date = $$('.start-session').text().split(':').pop().trim() || 'N/A';
            if (magnetUrl) results.push({ ...link, magnetUrl, date, source: 'OxTorrent (FR)' });
        } catch (e) {}
    }
    return results;
  }
};

export default async function handler(req, res) {
  const startTime = Date.now();
  const { q, selectedEngines } = req.query;
  
  if (!q) {
    return res.status(400).json({ error: 'Query is required' });
  }

  const activeEngines = selectedEngines ? selectedEngines.split(',') : Object.keys(engines);
  const logs = [];

  const searchPromises = activeEngines
    .filter(name => engines[name])
    .map(async (name) => {
      const engineStart = Date.now();
      try {
        const results = await engines[name](q);
        logs.push({ engine: name, status: 'success', time: Date.now() - engineStart, count: results.length });
        return results;
      } catch (err) {
        logs.push({ engine: name, status: 'error', time: Date.now() - engineStart, error: err.message });
        return [];
      }
    });

  const allResults = (await Promise.all(searchPromises)).flat();
  
  return res.status(200).json({
    results: allResults.sort((a, b) => b.seeders - a.seeders),
    debug: {
        totalTime: Date.now() - startTime,
        logs: logs
    }
  });
}
