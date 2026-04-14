import express from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3000;

// Serve static assets (JS, CSS, images) — these never contain secrets
app.use(express.static(path.join(__dirname, 'dist'), { index: false }));
app.use(express.static(path.join(__dirname, 'public'), { index: false }));

// Inject runtime env vars into index.html for the SPA
function injectEnv(html) {
  const envScript = `<script>window.__DOME_ENV__ = ${JSON.stringify({
    ORACLE_KEY: process.env.VITE_ORACLE_KEY || '',
  })};</script>`;
  return html.replace('</head>', envScript + '</head>');
}

// Explicit routes for legal pages
app.get('/terms', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'terms.html'));
});

app.get('/privacy', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'privacy.html'));
});

// SPA fallback — inject env vars then serve index.html
app.get('/{*splat}', (req, res) => {
  const indexPath = path.join(__dirname, 'dist', 'index.html');
  const html = fs.readFileSync(indexPath, 'utf8');
  res.setHeader('Content-Type', 'text/html');
  res.send(injectEnv(html));
});

app.listen(PORT, () => {
  console.log(`DOME Mission Control running on port ${PORT}`);
});
