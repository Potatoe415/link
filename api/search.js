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
    if (!dateInput) return { display: 'N/A', timestamp: 0 };
    try {
        const d = new Date(dateInput);
        if (isNaN(d.getTime())) return { display: dateInput, timestamp: 0 };
        return { display: d.toISOString().split('T')[0], timestamp: d.getTime() };
    } catch (e) {
        return { display: dateInput, timestamp: 0 };
    }
};

const parseSizeBytes = (sizeStr) => {
    if (!sizeStr) return 0;
    const s = sizeStr.toLowerCase();
    const val = parseFloat(s);
    if (s.includes('gb')) return val * 1024 * 1024 * 1024;
    if (s.includes('mb')) return val * 1024 * 1024;
    if (s.includes('kb')) return val * 1024;
    return val;
};

// Advanced headers to mimic a real high-end browser
const COMMON_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  'Accept': 'application/json, text/plain, */*',
  'Accept-Language': 'fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7',
  'Referer': 'https://www.google.com/',
  'Sec-Ch-Ua': '"Chromium";v="122", "Not(A:Brand";v="24", "Google Chrome";v="122"',
  'Sec-Ch-Ua-Mobile': '?0',
  'Sec-Ch-Ua-Platform': '"Windows"',
  'Sec-Fetch-Dest': 'empty',
  'Sec-Fetch-Mode': 'cors',
  'Sec-Fetch-Site': 'same-origin'
};

const engines = {
  apibay: async (q) => {
    // Mirror rotation for Apibay (The Pirate Bay)
    const mirrors = [
        `https://apibay.org/q.php?q=${encodeURIComponent(q)}`,
        `https://tpb.party/ajax/q.php?q=${encodeURIComponent(q)}`,
        `https://thepiratebay10.org/ajax/q.php?q=${encodeURIComponent(q)}`
    ];

    let lastError = null;
    for (const url of mirrors) {
        try {
            const resp = await axios.get(url, { timeout: 6000, headers: COMMON_HEADERS });
            if (Array.isArray(resp.data)) {
                return resp.data
                    .filter(item => item.info_hash && item.info_hash !== '0000000000000000000000000000000000000000')
                    .map(item => {
                        const title = cleanTitle(item.name);
                        const { display, timestamp } = formatDate(item.added ? parseInt(item.added) * 1000 : null);
                        return {
                            title,
                            magnetUrl: `magnet:?xt=urn:btih:${item.info_hash}&dn=${encodeURIComponent(title)}`,
                            size: formatSize(item.size),
                            sizeBytes: parseInt(item.size) || 0,
                            seeders: parseInt(item.seeders) || 0,
                            date: display,
                            timestamp,
                            source: 'Apibay'
                        };
                    });
            }
        } catch (e) {
            lastError = e;
            continue; // Try next mirror
        }
    }
    throw lastError || new Error("All mirrors failed");
  },
  limetorrents: async (q) => {
    const resp = await axios.get(`https://www.limetorrents.to/search/all/${encodeURIComponent(q)}/`, { 
      timeout: 8000,
      headers: { ...COMMON_HEADERS, 'Accept': 'text/html' }
    });
    const $ = cheerio.load(resp.data);
    const results = [];
    $('table.table2 tr.table-toggle').each((i, el) => {
      const title = cleanTitle($(el).find('div.tt-name a:nth-child(2)').text());
      const magnetUrl = $(el).find('td.tdnormal:nth-of-type(3) a.csbuttons[href^="magnet:"]').attr('href');
      const sizeStr = $(el).find('td.tdnormal:nth-of-type(2)').text().trim();
      const rawDate = $(el).find('td.tdnormal:nth-of-type(1)').text().trim().split(' - ')[0];
      const { display, timestamp } = formatDate(rawDate);
      const seeders = parseInt($(el).find('td.tdseed').text().trim()) || 0;
      if (title && magnetUrl) {
          results.push({ 
              title, magnetUrl, size: sizeStr, sizeBytes: parseSizeBytes(sizeStr),
              seeders, date: display, timestamp, source: 'LimeTorrents' 
          });
      }
    });
    return results;
  },
  yts: async (q) => {
    const resp = await axios.get(`https://yts.mx/api/v2/list_movies.json?query_term=${encodeURIComponent(q)}`, { timeout: 8000, headers: COMMON_HEADERS });
    if (!resp.data?.data?.movies) return [];
    const results = [];
    resp.data.data.movies.forEach(movie => {
      movie.torrents.forEach(t => {
        const title = cleanTitle(`${movie.title_long} [${t.quality}] [${t.type}]`);
        const { display, timestamp } = formatDate(movie.date_uploaded);
        results.push({
          title, magnetUrl: `magnet:?xt=urn:btih:${t.hash}&dn=${encodeURIComponent(title)}`,
          size: t.size, sizeBytes: t.size_bytes || parseSizeBytes(t.size),
          seeders: t.seeds, date: display, timestamp, source: 'YTS'
        });
      });
    });
    return results;
  },
  solid: async (q) => {
    const resp = await axios.get(`https://solidtorrents.net/api/v1/search?q=${encodeURIComponent(q)}`, { timeout: 8000, headers: COMMON_HEADERS });
    return (resp.data.results || []).map(item => {
        const { display, timestamp } = formatDate(item.createdAt);
        return {
            title: cleanTitle(item.title),
            magnetUrl: item.magnet,
            size: formatSize(item.size),
            sizeBytes: item.size || 0,
            seeders: item.swarm.seeders,
            date: display,
            timestamp,
            source: 'Solid'
        };
    });
  },
  nyaa: async (q) => {
    const resp = await axios.get(`https://nyaa.si/?f=0&c=0_0&q=${encodeURIComponent(q)}`, { timeout: 8000, headers: COMMON_HEADERS });
    const $ = cheerio.load(resp.data);
    const results = [];
    $('tr.default, tr.success, tr.danger').each((i, el) => {
        const title = cleanTitle($(el).find('td:nth-child(2) a:last-child').text());
        const magnetUrl = $(el).find('td:nth-child(3) a[href^="magnet:"]').attr('href');
        const sizeStr = $(el).find('td:nth-child(4)').text().trim();
        const rawDate = $(el).find('td:nth-child(5)').text().trim().split(' ')[0];
        const { display, timestamp } = formatDate(rawDate);
        const seeders = parseInt($(el).find('td:nth-child(6)').text().trim()) || 0;
        if (title && magnetUrl) {
            results.push({ 
                title, magnetUrl, size: sizeStr, sizeBytes: parseSizeBytes(sizeStr),
                seeders, date: display, timestamp, source: 'Nyaa' 
            });
        }
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
        const sizeStr = $(el).find('td.coll-4.size').contents().first().text().trim();
        const rawDate = $(el).find('td.coll-date').text().trim();
        const seeders = parseInt($(el).find('td.coll-2.seeds').text().trim()) || 0;
        if (title && detailUrl) links.push({ title, detailUrl, sizeStr, seeders, rawDate });
    });
    const results = [];
    for (const link of links.slice(0, 3)) {
        try {
            const detailResp = await axios.get(link.detailUrl, { timeout: 5000, headers: COMMON_HEADERS });
            const $$ = cheerio.load(detailResp.data);
            const magnetUrl = $$('a[href^="magnet:"]').first().attr('href');
            const fullDate = $$('.list-inline li:contains("Date uploaded")').text().replace("Date uploaded", "").trim() || link.rawDate;
            const { display, timestamp } = formatDate(fullDate);
            if (magnetUrl) {
                results.push({ 
                    title: link.title, magnetUrl, size: link.sizeStr, sizeBytes: parseSizeBytes(link.sizeStr),
                    seeders: link.seeders, date: display, timestamp, source: '1337x' 
                });
            }
        } catch (e) {}
    }
    return results;
  }
};

export default async function handler(req, res) {
  const startTime = Date.now();
  const { q, selectedEngines } = req.query;
  if (!q) return res.status(400).json({ error: 'Query is required' });
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
    results: allResults,
    debug: { totalTime: Date.now() - startTime, logs }
  });
}
