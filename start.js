import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import handler from './api/search.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'dist')));

// Delegate all search logic to the shared api/search.js handler
app.get('/api/search', (req, res) => handler(req, res));
// Region-specific endpoints (same handler locally, Vercel routes to correct datacenter)
app.get('/api/search-iad1', (req, res) => handler(req, res));
app.get('/api/search-cdg1', (req, res) => handler(req, res));
app.get('/api/search-fra1', (req, res) => handler(req, res));
app.get('/api/search-lhr1', (req, res) => handler(req, res));
app.get('/api/search-sin1', (req, res) => handler(req, res));
app.get('/api/search-syd1', (req, res) => handler(req, res));
app.get('/api/search-hnd1', (req, res) => handler(req, res));

// SPA fallback
app.use((req, res) => {
  res.sendFile(path.join(__dirname, 'dist/index.html'));
});

app.listen(PORT, () => {
  console.log(`==========================================`);
  console.log(`MagnetFinder is ready!`);
  console.log(`Open your browser at: http://localhost:${PORT}`);
  console.log(`==========================================`);
});
