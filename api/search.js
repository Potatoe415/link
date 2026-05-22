import axios from 'axios';
import * as cheerio from 'cheerio';
import he from 'he';
import https from 'https';
import { ENGINE_CONFIGS } from './engines/index.js';

// For TPB mirror requests: ignore self-signed / expired SSL certs on proxy sites
const INSECURE_AGENT = new https.Agent({ rejectUnauthorized: false });

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
  if (!str || typeof str !== 'string') return '';
  try {
      let decoded = he.decode(he.decode(str));
      decoded = decoded.replace(/[\n\r\t]/g, ' ').replace(/\s\s+/g, ' ').trim();
      if (decoded.startsWith('magnet:?')) return '';
      return decoded;
  } catch (e) {
      return str.trim();
  }
};

const parseDate = (dateStr) => {
    if (!dateStr) return { display: 'N/A', timestamp: 0 };
    const now = new Date();
    const currentYear = now.getFullYear();
    const s = dateStr.toLowerCase().trim();
    let d = new Date(s);

    if (!isNaN(s) && !isNaN(parseFloat(s))) {
        // Unix timestamp in ms
        d = new Date(parseInt(s));
    }
    else if (s === 'today') d = now;
    else if (s.startsWith('today')) d = now;
    else if (s === 'yesterday') d = new Date(now.getTime() - 86400000);
    else if (s.startsWith('y-day') || s.startsWith('yest')) d = new Date(now.getTime() - 86400000);
    else {
        // MM-DD or MM-DD HH:MM  (TPB mirrors omit the year in their description text)
        // Use $ anchor so "05-20-2025" and "05-20 2025" don't match (they already parse fine)
        const mmdd = s.match(/^(\d{1,2})-(\d{1,2})(?:\s+\d{1,2}:\d{2})?$/);
        if (mmdd) {
            const month = parseInt(mmdd[1]) - 1;
            const day   = parseInt(mmdd[2]);
            d = new Date(currentYear, month, day);
            // If the resulting date is in the future by more than 7 days, it's last year
            if (d.getTime() > now.getTime() + 7 * 86400000) {
                d = new Date(currentYear - 1, month, day);
            }
        } else {
            // Match relative ("7y ago", "3mo ago", "5d ago", "2 hours ago")
            const relMatch = s.match(/(\d+)\s*(y(?:r|ear)?s?|mo(?:nth)?s?|w(?:k|eek)?s?|d(?:ay)?s?|h(?:r|our)?s?|min(?:ute)?s?)/);
            if (relMatch) {
                const num = parseInt(relMatch[1]);
                const unit = relMatch[2];
                if (/^y/.test(unit))       d = new Date(now.getTime() - num * 31536000000);
                else if (/^mo/.test(unit)) d = new Date(now.getTime() - num * 2592000000);
                else if (/^w/.test(unit))  d = new Date(now.getTime() - num * 604800000);
                else if (/^d/.test(unit))  d = new Date(now.getTime() - num * 86400000);
                else if (/^h/.test(unit))  d = new Date(now.getTime() - num * 3600000);
                else if (/^mi/.test(unit)) d = new Date(now.getTime() - num * 60000);
            } else {
                // Try fixing short year: '25 → 2025
                const fixedYear = s.replace(/'(\d{2})/, '20$1');
                d = new Date(fixedYear);
            }
        }
    }

    if (isNaN(d.getTime())) return { display: dateStr, timestamp: 0 };
    return { display: d.toISOString().split('T')[0], timestamp: d.getTime() };
};

const parseSizeBytes = (sizeStr) => {
    if (!sizeStr) return 0;
    const s = sizeStr.toLowerCase().replace(/,/g, '');
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

const TRACKERS = [
    'udp://tracker.opentrackr.org:1337/announce',
    'udp://open.stealth.si:80/announce',
    'udp://tracker.torrent.eu.org:451/announce',
    'udp://tracker.bittor.pw:1337/announce',
    'udp://public.popcorn-tracker.org:6969/announce',
    'udp://tracker.cyberia.is:6969/announce',
    'udp://exodus.desync.com:6969/announce',
    'udp://open.demonii.com:1337/announce'
].map(t => `&tr=${encodeURIComponent(t)}`).join('');

const engines = {
  apibay: async (q) => {
    const config = ENGINE_CONFIGS.apibay;
    try {
        const resp = await axios.get(config.urls.primary.replace('{{q}}', encodeURIComponent(q)), { timeout: 4000, headers: COMMON_HEADERS });
        if (Array.isArray(resp.data) && resp.data.length > 0 && resp.data[0].id !== "0") {
            const results = resp.data
                .filter(item => item.info_hash && item.info_hash !== '0000000000000000000000000000000000000000')
                .map(item => {
                    const title = cleanTitle(item.name) || 'Unknown TPB Item';
                    const { display, timestamp } = parseDate(item.added ? parseInt(item.added) * 1000 : null);
                    return {
                        title, magnetUrl: `magnet:?xt=urn:btih:${item.info_hash}&dn=${encodeURIComponent(title)}${TRACKERS}`,
                        size: formatSize(item.size), sizeBytes: parseInt(item.size) || 0,
                        seeders: parseInt(item.seeders) || 0, date: display, timestamp, source: 'PirateBay (API)'
                    };
                });
            return { results, method: 'api' };
        }
    } catch (e) {}

    for (const mirrorBase of config.urls.mirrors) {
        try {
            const url = mirrorBase.replace('{{q}}', encodeURIComponent(q));
            const proxyResp = await axios.get(url, {
                timeout: 8000,
                headers: COMMON_HEADERS,
                httpsAgent: INSECURE_AGENT   // accept self-signed / expired certs on proxy sites
            });
            if (typeof proxyResp.data !== 'string' || proxyResp.data.length < 500) continue;
            const $ = cheerio.load(proxyResp.data);
            const results = [];
            $(config.selectors.rows).each((i, el) => {
                if (i === 0) return; // skip header row
                const linkEl = $(el).find(config.selectors.title).first();
                const title = cleanTitle(linkEl.text());
                const magnetRaw = $(el).find(config.selectors.magnet).attr('href');
                const seeders = parseInt($(el).find(config.selectors.seeders).text()) || 0;
                const descText = $(el).find(config.selectors.description).text();

                const sizeMatch = descText.match(/Size\s+([\d.,]+\s*[KMGTkmgt]i?B)/i);
                const sizeStr = sizeMatch ? sizeMatch[1].replace(/iB/i, 'B').trim() : null;
                const sizeBytes = parseSizeBytes(sizeStr);
                const dateMatch = descText.match(/Uploaded\s+([^,]+)/i);
                const { display, timestamp } = parseDate(dateMatch ? dateMatch[1].trim() : null);

                // Only hard-require magnet + title; size/date are optional
                const magnetOk = typeof magnetRaw === 'string'
                    && magnetRaw.startsWith('magnet:?xt=urn:btih:')
                    && magnetRaw.length >= 52;
                const titleOk = typeof title === 'string'
                    && title.length >= 3
                    && !title.toLowerCase().startsWith('magnet:');

                if (magnetOk && titleOk) {
                    results.push({
                        title,
                        magnetUrl: magnetRaw + TRACKERS,
                        size: sizeStr || 'N/A',
                        sizeBytes: sizeBytes || 0,
                        seeders,
                        date: display,
                        timestamp,
                        source: 'PirateBay (Mirror)'
                    });
                }
            });
            if (results.length > 0) return { results, method: 'scraping' };
        } catch (e) { continue; }
    }
    return { results: [], method: 'api' };
  },
  limetorrents: async (q) => {
    const config = ENGINE_CONFIGS.limetorrents;
    try {
        const resp = await axios.get(config.urls.primary.replace('{{q}}', encodeURIComponent(q)), { timeout: 8000, headers: COMMON_HEADERS });
        const $ = cheerio.load(resp.data);
        const results = [];
        $(config.selectors.rows).each((i, el) => {
            const title = cleanTitle($(el).find(config.selectors.title).text());
            const magnetUrl = $(el).find(config.selectors.magnet).attr('href');
            const sizeStr = $(el).find(config.selectors.size).text().trim();
            const rawDate = $(el).find(config.selectors.date).text().trim().split(' - ')[0];
            const { display, timestamp } = parseDate(rawDate);
            const seeders = parseInt($(el).find(config.selectors.seeders).text().trim()) || 0;
            if (title && magnetUrl) {
                results.push({
                    title, magnetUrl: magnetUrl + TRACKERS, size: sizeStr, sizeBytes: parseSizeBytes(sizeStr),
                    seeders, date: display, timestamp, source: 'LimeTorrents'
                });
            }
        });
        return { results, method: 'scraping' };
    } catch (e) { return { results: [], method: 'scraping' }; }
  },
  yts: async (q) => {
    const config = ENGINE_CONFIGS.yts;
    // --- API pass ---
    try {
        const resp = await axios.get(config.urls.primary.replace('{{q}}', encodeURIComponent(q)), { timeout: 8000, headers: COMMON_HEADERS });
        const movies = resp.data?.data?.movies;
        if (movies && movies.length > 0) {
            const results = [];
            movies.forEach(movie => {
                movie.torrents.forEach(t => {
                    const title = cleanTitle(`${movie.title_long} [${t.quality}] [${t.type}]`);
                    const { display, timestamp } = parseDate(movie.date_uploaded);
                    results.push({
                        title, magnetUrl: `magnet:?xt=urn:btih:${t.hash}&dn=${encodeURIComponent(title)}${TRACKERS}`,
                        size: t.size, sizeBytes: t.size_bytes || parseSizeBytes(t.size),
                        seeders: t.seeds, date: display, timestamp, source: 'YTS'
                    });
                });
            });
            return { results, method: 'api' };
        }
    } catch (e) {}
    // --- HTML fallback (two-pass: browse page → movie detail) ---
    try {
        const browseUrl = `https://yts.mx/browse-movies/${encodeURIComponent(q)}/all/all/0/latest/0/all`;
        const listResp = await axios.get(browseUrl, { timeout: 8000, headers: COMMON_HEADERS });
        const $ = cheerio.load(listResp.data);
        const detailUrls = [];
        $('div.browse-movie-wrap').each((i, el) => {
            const href = $(el).find('a.browse-movie-link').attr('href');
            if (href) detailUrls.push(href);
        });
        const settled = await Promise.all(detailUrls.slice(0, 5).map(async (detailUrl) => {
            try {
                const detailResp = await axios.get(detailUrl, { timeout: 5000, headers: COMMON_HEADERS });
                const $$ = cheerio.load(detailResp.data);
                const titleRaw = $$('h1[itemprop="name"]').first().text().trim() || $$('h1').first().text().trim();
                const year = $$('span[itemprop="dateCreated"]').first().text().trim();
                const { display, timestamp } = parseDate(year);
                const items = [];
                $$('a.download-torrent[data-hash]').each((i, el) => {
                    const hash = $$(el).attr('data-hash');
                    const quality = $$(el).closest('.modal-torrent').find('.modal-quality span').text().trim() || '?';
                    const sizeStr = $$(el).closest('.modal-torrent').find('.quality-size').text().trim();
                    if (hash) {
                        const title = cleanTitle(`${titleRaw} [${quality}]`);
                        items.push({
                            title, magnetUrl: `magnet:?xt=urn:btih:${hash}&dn=${encodeURIComponent(title)}${TRACKERS}`,
                            size: sizeStr, sizeBytes: parseSizeBytes(sizeStr),
                            seeders: 0, date: display, timestamp, source: 'YTS (HTML)'
                        });
                    }
                });
                return items;
            } catch (e) { return []; }
        }));
        const results = settled.flat();
        return { results, method: 'scraping' };
    } catch (e) { return { results: [], method: 'api' }; }
  },
  solid: async (q) => {
    const config = ENGINE_CONFIGS.solid;
    // --- API pass (bitsearch.eu — solidtorrents.net now redirects there) ---
    try {
        const resp = await axios.get(config.urls.primary.replace('{{q}}', encodeURIComponent(q)), { timeout: 8000, headers: COMMON_HEADERS });
        const items = resp.data?.results || [];
        if (items.length > 0) {
            const results = items.map(item => {
                const title = cleanTitle(item.title);
                const { display, timestamp } = parseDate(item.updatedAt);
                return {
                    title,
                    magnetUrl: `magnet:?xt=urn:btih:${item.infohash}&dn=${encodeURIComponent(title)}${TRACKERS}`,
                    size: formatSize(item.size), sizeBytes: item.size || 0,
                    seeders: item.seeders || 0, date: display, timestamp, source: 'Bitsearch'
                };
            });
            return { results, method: 'api' };
        }
    } catch (e) {}
    // --- HTML fallback ---
    try {
        const htmlUrl = config.urls.html.replace('{{q}}', encodeURIComponent(q));
        const resp = await axios.get(htmlUrl, { timeout: 8000, headers: COMMON_HEADERS });
        const $ = cheerio.load(resp.data);
        const results = [];
        $(config.selectors.rows).each((i, el) => {
            const title = cleanTitle($(el).find(config.selectors.title).text());
            const magnetUrl = $(el).find(config.selectors.magnet).attr('href');
            const sizeStr = $(el).find(config.selectors.size).text().trim();
            const seeders = parseInt($(el).find(config.selectors.seeders).text()) || 0;
            if (title && magnetUrl) {
                results.push({
                    title, magnetUrl: magnetUrl + TRACKERS, size: sizeStr, sizeBytes: parseSizeBytes(sizeStr),
                    seeders, date: 'N/A', timestamp: 0, source: 'Bitsearch (HTML)'
                });
            }
        });
        return { results, method: 'scraping' };
    } catch (e) { return { results: [], method: 'api' }; }
  },
  nyaa: async (q) => {
    const config = ENGINE_CONFIGS.nyaa;
    try {
        const resp = await axios.get(config.urls.primary.replace('{{q}}', encodeURIComponent(q)), { timeout: 8000, headers: COMMON_HEADERS });
        const $ = cheerio.load(resp.data);
        const results = [];
        $(config.selectors.rows).each((i, el) => {
            const title = cleanTitle($(el).find(config.selectors.title).text());
            const magnetUrl = $(el).find(config.selectors.magnet).attr('href');
            const sizeStr = $(el).find(config.selectors.size).text().trim();
            const rawDate = $(el).find(config.selectors.date).text().trim().split(' ')[0];
            const { display, timestamp } = parseDate(rawDate);
            const seeders = parseInt($(el).find(config.selectors.seeders).text().trim()) || 0;
            if (title && magnetUrl) {
                results.push({
                    title, magnetUrl: magnetUrl + TRACKERS, size: sizeStr, sizeBytes: parseSizeBytes(sizeStr),
                    seeders, date: display, timestamp, source: 'Nyaa'
                });
            }
        });
        return { results, method: 'scraping' };
    } catch (e) { return { results: [], method: 'scraping' }; }
  },
  "1337x": async (q) => {
    const config = ENGINE_CONFIGS['1337x'];
    try {
        const resp = await axios.get(config.urls.primary.replace('{{q}}', encodeURIComponent(q)), { timeout: 8000, headers: COMMON_HEADERS });
        const $ = cheerio.load(resp.data);
        const links = [];
        $(config.selectors.rows).each((i, el) => {
            const nameEl = $(el).find(config.selectors.title);
            const title = cleanTitle(nameEl.text());
            const detailUrl = config.urls.base + nameEl.attr('href');
            const sizeStr = $(el).find(config.selectors.size).contents().first().text().trim();
            const rawDate = $(el).find(config.selectors.date).text().trim();
            const seeders = parseInt($(el).find(config.selectors.seeders).text().trim()) || 0;
            if (title && detailUrl) links.push({ title, detailUrl, sizeStr, seeders, rawDate });
        });
        const results = [];
        for (const link of links.slice(0, 3)) {
            try {
                const detailResp = await axios.get(link.detailUrl, { timeout: 5000, headers: COMMON_HEADERS });
                const $$ = cheerio.load(detailResp.data);
                const magnetUrl = $$('a[href^="magnet:"]').first().attr('href');
                const fullDate = $$('.list-inline li:contains("Date uploaded")').text().replace("Date uploaded", "").trim() || link.rawDate;
                const { display, timestamp } = parseDate(fullDate);
                if (magnetUrl) {
                    results.push({
                        title: link.title, magnetUrl: magnetUrl + TRACKERS, size: link.sizeStr, sizeBytes: parseSizeBytes(link.sizeStr),
                        seeders: link.seeders, date: display, timestamp, source: '1337x'
                    });
                }
            } catch (e) {}
        }
        return { results, method: 'scraping' };
    } catch (e) { return { results: [], method: 'scraping' }; }
  },
  torrentz2: async (q) => {
    const config = ENGINE_CONFIGS.torrentz2;
    try {
        const resp = await axios.get(config.urls.primary.replace('{{q}}', encodeURIComponent(q)), { timeout: 8000, headers: COMMON_HEADERS });
        const $ = cheerio.load(resp.data);
        const links = [];
        $(config.selectors.rows).each((i, el) => {
            const linkEl = $(el).find(config.selectors.title);
            const title = cleanTitle(linkEl.text());
            const href = linkEl.attr('href') || '';
            const detailUrl = href ? config.urls.base + href : null;
            const sizeStr = $(el).find(config.selectors.size).text().trim();
            const seeders = parseInt($(el).find(config.selectors.seeders).text()) || 0;
            const rawDate = $(el).find(config.selectors.date).text().trim();
            const { display, timestamp } = parseDate(rawDate);
            if (title && detailUrl) links.push({ title, detailUrl, sizeStr, seeders, display, timestamp });
        });
        // Fetch detail pages in parallel to get the real magnet link (truncated ID in URL ≠ full info_hash)
        const settled = await Promise.all(links.slice(0, 5).map(async (link) => {
            try {
                const detailResp = await axios.get(link.detailUrl, { timeout: 5000, headers: COMMON_HEADERS });
                const $$ = cheerio.load(detailResp.data);
                const magnetUrl = $$(config.selectors.magnet).first().attr('href');
                if (magnetUrl && magnetUrl.startsWith('magnet:?xt=urn:btih:')) {
                    return {
                        title: link.title, magnetUrl: magnetUrl + TRACKERS,
                        size: link.sizeStr, sizeBytes: parseSizeBytes(link.sizeStr),
                        seeders: link.seeders, date: link.display, timestamp: link.timestamp,
                        source: 'Torrentz2'
                    };
                }
            } catch (e) {}
            return null;
        }));
        return { results: settled.filter(Boolean), method: 'scraping' };
    } catch (e) { return { results: [], method: 'scraping' }; }
  },
  kickass: async (q) => {
    const config = ENGINE_CONFIGS.kickass;
    try {
        const resp = await axios.get(config.urls.primary.replace('{{q}}', encodeURIComponent(q)), { timeout: 8000, headers: COMMON_HEADERS });
        const $ = cheerio.load(resp.data);
        const results = [];
        $(config.selectors.rows).each((i, el) => {
            const title = cleanTitle($(el).find(config.selectors.title).text());
            const magnetUrl = $(el).find(config.selectors.magnet).attr('href');
            const sizeStr = $(el).find(config.selectors.size).text().trim();
            const rawDate = $(el).find(config.selectors.date).text().trim();
            const { display, timestamp } = parseDate(rawDate);
            const seeders = parseInt($(el).find(config.selectors.seeders).text()) || 0;
            if (title && magnetUrl) {
                results.push({
                    title, magnetUrl: magnetUrl + TRACKERS, size: sizeStr, sizeBytes: parseSizeBytes(sizeStr),
                    seeders, date: display, timestamp, source: 'Kickass'
                });
            }
        });
        return { results, method: 'scraping' };
    } catch (e) { return { results: [], method: 'scraping' }; }
  },
  fitgirl: async (q) => {
    const config = ENGINE_CONFIGS.fitgirl;
    try {
        const resp = await axios.get(config.urls.primary.replace('{{q}}', encodeURIComponent(q)), { timeout: 8000, headers: COMMON_HEADERS });
        const $ = cheerio.load(resp.data);
        const results = [];
        $(config.selectors.rows).each((i, el) => {
            const title = cleanTitle($(el).find(config.selectors.title).text());
            const magnetUrl = $(el).find(config.selectors.magnet).first().attr('href');
            const rawDate = $(el).find(config.selectors.date).attr('datetime');
            const { display, timestamp } = parseDate(rawDate);
            if (title && magnetUrl) {
                results.push({
                    title, magnetUrl: magnetUrl + TRACKERS, size: 'Game Repack', sizeBytes: 0,
                    seeders: 999, date: display, timestamp, source: 'FitGirl (Games)'
                });
            }
        });
        return { results, method: 'scraping' };
    } catch (e) { return { results: [], method: 'scraping' }; }
  },
  torrent9: async (q) => {
    const config = ENGINE_CONFIGS.torrent9;
    try {
        const resp = await axios.get(config.urls.primary.replace('{{q}}', encodeURIComponent(q)), { timeout: 8000, headers: COMMON_HEADERS });
        const $ = cheerio.load(resp.data);
        const detailLinks = [];
        $(config.selectors.rows).each((i, el) => {
            const linkEl = $(el).find(config.selectors.title).first();
            const title = cleanTitle(linkEl.text());
            const detailUrl = config.urls.base + linkEl.attr('href');
            const sizeStr = $(el).find(config.selectors.size).text().trim();
            const seeders = parseInt($(el).find(config.selectors.seeders).text().trim()) || 0;
            if (title && detailUrl) detailLinks.push({ title, detailUrl, sizeStr, seeders });
        });
        const results = [];
        for (const link of detailLinks.slice(0, 3)) {
            try {
                const detailResp = await axios.get(link.detailUrl, { timeout: 5000, headers: COMMON_HEADERS });
                const $$ = cheerio.load(detailResp.data);
                const magnetUrl = $$(config.selectors.magnet).attr('href');
                const rawDate = $$('.start-session').text().split(':').pop().trim();
                const { display, timestamp } = parseDate(rawDate);
                if (magnetUrl) {
                    results.push({
                        title: link.title, magnetUrl: magnetUrl + TRACKERS, size: link.sizeStr, sizeBytes: parseSizeBytes(link.sizeStr),
                        date: display, timestamp, seeders: link.seeders, source: 'Torrent9 (FR)'
                    });
                }
            } catch (e) {}
        }
        return { results, method: 'scraping' };
    } catch (e) { return { results: [], method: 'scraping' }; }
  },
  oxtorrent: async (q) => {
    const config = ENGINE_CONFIGS.oxtorrent;
    try {
        const resp = await axios.get(config.urls.primary.replace('{{q}}', encodeURIComponent(q)), { timeout: 8000, headers: COMMON_HEADERS });
        const $ = cheerio.load(resp.data);
        const detailLinks = [];
        $(config.selectors.rows).each((i, el) => {
            const linkEl = $(el).find(config.selectors.title).first();
            const title = cleanTitle(linkEl.text());
            const detailUrl = config.urls.base + linkEl.attr('href');
            const sizeStr = $(el).find(config.selectors.size).text().trim();
            const seeders = parseInt($(el).find(config.selectors.seeders).text().trim()) || 0;
            if (title && detailUrl) detailLinks.push({ title, detailUrl, sizeStr, seeders });
        });
        const results = [];
        for (const link of detailLinks.slice(0, 3)) {
            try {
                const detailResp = await axios.get(link.detailUrl, { timeout: 5000, headers: COMMON_HEADERS });
                const $$ = cheerio.load(detailResp.data);
                const magnetUrl = $$(config.selectors.magnet).attr('href');
                const rawDate = $$('.start-session').text().split(':').pop().trim();
                const { display, timestamp } = parseDate(rawDate);
                if (magnetUrl) {
                    results.push({
                        title: link.title, magnetUrl: magnetUrl + TRACKERS, size: link.sizeStr, sizeBytes: parseSizeBytes(link.sizeStr),
                        date: display, timestamp, seeders: link.seeders, source: 'OxTorrent (FR)'
                    });
                }
            } catch (e) {}
        }
        return { results, method: 'scraping' };
    } catch (e) { return { results: [], method: 'scraping' }; }
  }
};

export default async function handler(req, res) {
  const startTime = Date.now();
  try {
    const { q, selectedEngines } = req.query;
    if (!q) return res.status(400).json({ error: 'Query is required' });
    const activeEngines = selectedEngines ? selectedEngines.split(',') : Object.keys(engines);
    const logs = [];
    const searchPromises = activeEngines
      .filter(name => engines[name])
      .map(async (name) => {
        const engineStart = Date.now();
        try {
          const { results, method } = await engines[name](q);
          logs.push({ engine: name, status: 'success', time: Date.now() - engineStart, count: results.length, method });
          return results;
        } catch (err) {
          logs.push({ engine: name, status: 'error', time: Date.now() - engineStart, error: err.message, method: 'unknown' });
          return [];
        }
      });
    const allResults = (await Promise.all(searchPromises)).flat();
    return res.status(200).json({
      results: allResults,
      debug: { totalTime: Date.now() - startTime, logs }
    });
  } catch (err) {
    console.error('[MagnetFinder] Unhandled handler error:', err);
    return res.status(500).json({ error: `Internal server error: ${err.message}` });
  }
}
