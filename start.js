import express from 'express';
import cors from 'cors';
import axios from 'axios';
import * as cheerio from 'cheerio';
import he from 'he';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'dist')));

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
  if (!str || typeof str !== 'string') return 'Unknown Title';
  try {
      let decoded = he.decode(he.decode(str));
      decoded = decoded.replace(/[\n\r\t]/g, ' ').replace(/\s\s+/g, ' ').trim();
      return decoded || 'Unknown Title';
  } catch (e) {
      return str.trim() || 'Unknown Title';
  }
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
    if (s.includes('gb') || s.includes('go') || s.includes('gib')) return val * 1024 * 1024 * 1024;
    if (s.includes('mb') || s.includes('mo') || s.includes('mib')) return val * 1024 * 1024;
    if (s.includes('kb') || s.includes('ko') || s.includes('kib')) return val * 1024;
    return val;
};

const COMMON_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/json,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
  'Accept-Language': 'fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7',
  'Referer': 'https://www.google.com/'
};

const engines = {
  apibay: async (q) => {
    try {
        const resp = await axios.get(`https://apibay.org/q.php?q=${encodeURIComponent(q)}`, { timeout: 4000, headers: COMMON_HEADERS });
        if (Array.isArray(resp.data) && resp.data.length > 0 && resp.data[0].id !== "0") {
            return resp.data
                .filter(item => item.info_hash && item.info_hash !== '0000000000000000000000000000000000000000')
                .map(item => {
                    const title = cleanTitle(item.name);
                    const { display, timestamp } = formatDate(item.added ? parseInt(item.added) * 1000 : null);
                    return {
                        title, magnetUrl: `magnet:?xt=urn:btih:${item.info_hash}&dn=${encodeURIComponent(title)}`,
                        size: formatSize(item.size), sizeBytes: parseInt(item.size) || 0,
                        seeders: parseInt(item.seeders) || 0, date: display, timestamp, source: 'Apibay'
                    };
                });
        }
    } catch (e) {}

    const mirrors = [
        'https://tpb.party',
        'https://thepiratebay10.org',
        'https://piratebayproxy.net',
        'https://thepiratebay.zone'
    ];

    for (const mirror of mirrors) {
        try {
            const url = `${mirror}/search/${encodeURIComponent(q)}/1/99/0`;
            const proxyResp = await axios.get(url, { timeout: 6000, headers: COMMON_HEADERS });
            const $ = cheerio.load(proxyResp.data);
            const results = [];
            $('table#searchResult tr').each((i, el) => {
                if (i === 0) return;
                const linkEl = $(el).find('div.detName a');
                const title = cleanTitle(linkEl.text());
                const magnetUrl = $(el).find('a[href^="magnet:"]').attr('href');
                const seeders = parseInt($(el).find('td:nth-last-child(2)').text()) || 0;
                const descText = $(el).find('font.detDesc').text();
                const sizeMatch = descText.match(/Size ([\d.]+\s+[KMG]iB)/i);
                const sizeStr = sizeMatch ? sizeMatch[1].replace(/iB/i, 'B') : 'N/A';
                const dateMatch = descText.match(/Uploaded ([\d-]+)/i);
                const { display, timestamp } = formatDate(dateMatch ? dateMatch[1] : null);
                if (title && magnetUrl && title !== 'Unknown Title') {
                    results.push({
                        title, magnetUrl, size: sizeStr, sizeBytes: parseSizeBytes(sizeStr),
                        seeders, date: display, timestamp, source: `PirateBay (Mirror)`
                    });
                }
            });
            if (results.length > 0) return results;
        } catch (e) { continue; }
    }
    return [];
  },
  limetorrents: async (q) => {
    try {
        const resp = await axios.get(`https://www.limetorrents.to/search/all/${encodeURIComponent(q)}/`, { timeout: 8000, headers: COMMON_HEADERS });
        const $ = cheerio.load(resp.data);
        const results = [];
        $('table.table2 tr.table-toggle').each((i, el) => {
            const title = cleanTitle($(el).find('div.tt-name a:nth-child(2)').text());
            const magnetUrl = $(el).find('td.tdnormal:nth-of-type(3) a.csbuttons[href^="magnet:"]').attr('href');
            const sizeStr = $(el).find('td.tdnormal:nth-of-type(2)').text().trim();
            const rawDate = $(el).find('td.tdnormal:nth-of-type(1)').text().trim().split(' - ')[0];
            const { display, timestamp } = formatDate(rawDate);
            const seeders = parseInt($(el).find('td.tdseed').text().trim()) || 0;
            if (title && magnetUrl && title !== 'Unknown Title') {
                results.push({ 
                    title, magnetUrl, size: sizeStr, sizeBytes: parseSizeBytes(sizeStr),
                    seeders, date: display, timestamp, source: 'LimeTorrents' 
                });
            }
        });
        return results;
    } catch (e) { return []; }
  },
  yts: async (q) => {
    try {
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
    } catch (e) { return []; }
  },
  solid: async (q) => {
    try {
        const resp = await axios.get(`https://solidtorrents.net/api/v1/search?q=${encodeURIComponent(q)}`, { timeout: 8000, headers: COMMON_HEADERS });
        return (resp.data.results || []).map(item => {
            const { display, timestamp } = formatDate(item.createdAt);
            const title = cleanTitle(item.title);
            return {
                title, magnetUrl: item.magnet, size: formatSize(item.size), sizeBytes: item.size || 0,
                seeders: item.swarm.seeders, date: display, timestamp, source: 'Solid'
            };
        });
    } catch (e) { return []; }
  },
  nyaa: async (q) => {
    try {
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
            if (title && magnetUrl && title !== 'Unknown Title') {
                results.push({ 
                    title, magnetUrl, size: sizeStr, sizeBytes: parseSizeBytes(sizeStr),
                    seeders, date: display, timestamp, source: 'Nyaa' 
                });
            }
        });
        return results;
    } catch (e) { return []; }
  },
  "1337x": async (q) => {
    try {
        const resp = await axios.get(`https://1337x.to/search/${encodeURIComponent(q)}/1/`, { timeout: 8000, headers: COMMON_HEADERS });
        const $ = cheerio.load(resp.data);
        const links = [];
        $('table.table-list tbody tr').each((i, el) => {
            const nameEl = $(el).find('td.coll-1.name a:last-child');
            const title = cleanTitle(nameEl.text());
            const detailUrl = "https://1337x.to" + nameEl.attr('href');
            const sizeStr = $(el).find('td.coll-4.size').contents().first().text().trim();
            const rawDate = $(el).find('td.coll-date').text().trim();
            const seeders = parseInt($(el).find('td.coll-2.seeds').text().trim()) || 0;
            if (title && detailUrl && title !== 'Unknown Title') links.push({ title, detailUrl, sizeStr, seeders, rawDate });
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
    } catch (e) { return []; }
  },
  torrentz2: async (q) => {
    try {
        const resp = await axios.get(`https://torrentz2.nz/search?q=${encodeURIComponent(q)}`, { timeout: 8000, headers: COMMON_HEADERS });
        const $ = cheerio.load(resp.data);
        const results = [];
        $('div.results dl').each((i, el) => {
            const title = cleanTitle($(el).find('dt a').text());
            const hash = $(el).find('dt a').attr('href')?.split('/')[1];
            const sizeStr = $(el).find('span.s').text().trim();
            const seeders = parseInt($(el).find('span.u').text()) || 0;
            const rawDate = $(el).find('span.d').text().trim();
            const { display, timestamp } = formatDate(rawDate);
            if (title && hash) {
                results.push({
                    title, magnetUrl: `magnet:?xt=urn:btih:${hash}&dn=${encodeURIComponent(title)}`,
                    size: sizeStr, sizeBytes: parseSizeBytes(sizeStr),
                    seeders, date: display, timestamp, source: 'Torrentz2'
                });
            }
        });
        return results;
    } catch (e) { return []; }
  },
  kickass: async (q) => {
    try {
        const resp = await axios.get(`https://kickasstorrents.to/usearch/${encodeURIComponent(q)}/`, { timeout: 8000, headers: COMMON_HEADERS });
        const $ = cheerio.load(resp.data);
        const results = [];
        $('table.data tr.odd, table.data tr.even').each((i, el) => {
            const title = cleanTitle($(el).find('a.cellMainLink').text());
            const magnetUrl = $(el).find('a[title="Torrent magnet link"]').attr('href');
            const sizeStr = $(el).find('td:nth-child(2)').text().trim();
            const rawDate = $(el).find('td:nth-child(4)').text().trim();
            const { display, timestamp } = formatDate(rawDate);
            const seeders = parseInt($(el).find('td:nth-child(5)').text()) || 0;
            if (title && magnetUrl) {
                results.push({
                    title, magnetUrl, size: sizeStr, sizeBytes: parseSizeBytes(sizeStr),
                    seeders, date: display, timestamp, source: 'Kickass'
                });
            }
        });
        return results;
    } catch (e) { return []; }
  },
  fitgirl: async (q) => {
    try {
        const resp = await axios.get(`https://fitgirl-repacks.site/?s=${encodeURIComponent(q)}`, { timeout: 8000, headers: COMMON_HEADERS });
        const $ = cheerio.load(resp.data);
        const results = [];
        $('article').each((i, el) => {
            const title = cleanTitle($(el).find('h1.entry-title a').text());
            const magnetUrl = $(el).find('a[href^="magnet:"]').first().attr('href');
            const rawDate = $(el).find('time.entry-date').attr('datetime');
            const { display, timestamp } = formatDate(rawDate);
            if (title && magnetUrl) {
                results.push({
                    title, magnetUrl, size: 'Game Repack', sizeBytes: 0,
                    seeders: 999, date: display, timestamp, source: 'FitGirl (Games)'
                });
            }
        });
        return results;
    } catch (e) { return []; }
  },
  torrent9: async (q) => {
    try {
        const resp = await axios.get(`https://www.torrent9.to/recherche/${encodeURIComponent(q)}`, { timeout: 8000, headers: COMMON_HEADERS });
        const $ = cheerio.load(resp.data);
        const detailLinks = [];
        $('table.table-hover tbody tr').each((i, el) => {
            const linkEl = $(el).find('a').first();
            const title = cleanTitle(linkEl.text());
            const detailUrl = "https://www.torrent9.to" + linkEl.attr('href');
            const sizeStr = $(el).find('td:nth-child(2)').text().trim();
            const seeders = parseInt($(el).find('td:nth-child(3)').text().trim()) || 0;
            if (title && detailUrl && title !== 'Unknown Title') detailLinks.push({ title, detailUrl, sizeStr, seeders });
        });
        const results = [];
        for (const link of detailLinks.slice(0, 3)) {
            try {
                const detailResp = await axios.get(link.detailUrl, { timeout: 5000, headers: COMMON_HEADERS });
                const $$ = cheerio.load(detailResp.data);
                const magnetUrl = $$('a[href^="magnet:"]').attr('href');
                const rawDate = $$('.start-session').text().split(':').pop().trim();
                const { display, timestamp } = formatDate(rawDate);
                if (magnetUrl) {
                    results.push({ 
                        title: link.title, magnetUrl, size: link.sizeStr, sizeBytes: parseSizeBytes(link.sizeStr),
                        date: display, timestamp, seeders: link.seeders, source: 'Torrent9 (FR)' 
                    });
                }
            } catch (e) {}
        }
        return results;
    } catch (e) { return []; }
  },
  oxtorrent: async (q) => {
    try {
        const resp = await axios.get(`https://www.oxtorrent.town/recherche/${encodeURIComponent(q)}`, { timeout: 8000, headers: COMMON_HEADERS });
        const $ = cheerio.load(resp.data);
        const detailLinks = [];
        $('table.table-hover tbody tr').each((i, el) => {
            const linkEl = $(el).find('a').first();
            const title = cleanTitle(linkEl.text());
            const detailUrl = "https://www.oxtorrent.town" + linkEl.attr('href');
            const sizeStr = $(el).find('td:nth-child(2)').text().trim();
            const seeders = parseInt($(el).find('td:nth-child(3)').text().trim()) || 0;
            if (title && detailUrl && title !== 'Unknown Title') detailLinks.push({ title, detailUrl, sizeStr, seeders });
        });
        const results = [];
        for (const link of detailLinks.slice(0, 3)) {
            try {
                const detailResp = await axios.get(link.detailUrl, { timeout: 5000, headers: COMMON_HEADERS });
                const $$ = cheerio.load(detailResp.data);
                const magnetUrl = $$('a[href^="magnet:"]').attr('href');
                const rawDate = $$('.start-session').text().split(':').pop().trim();
                const { display, timestamp } = formatDate(rawDate);
                if (magnetUrl) {
                    results.push({ 
                        title: link.title, magnetUrl, size: link.sizeStr, sizeBytes: parseSizeBytes(link.sizeStr),
                        date: display, timestamp, seeders: link.seeders, source: 'OxTorrent (FR)' 
                    });
                }
            } catch (e) {}
        }
        return results;
    } catch (e) { return []; }
  }
};

app.get('/api/search', async (req, res) => {
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
  res.json({
    results: allResults,
    debug: {
        totalTime: Date.now() - startTime,
        logs: logs
    }
  });
});

app.use((req, res, next) => {
  res.sendFile(path.join(__dirname, 'dist/index.html'));
});

app.listen(PORT, () => {
  console.log(`==========================================`);
  console.log(`MagnetFinder is ready!`);
  console.log(`Open your browser at: http://localhost:${PORT}`);
  console.log(`==========================================`);
});
