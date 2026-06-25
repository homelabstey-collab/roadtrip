// ─────────────────────────────────────────────────────────────
//  Road-trip Pyrénées — serveur minimal (Node pur, 0 dépendance)
//  Sert les pages statiques + une petite API de suivi de voyage.
//  L'état est persisté dans data/state.json (monté en volume Docker).
// ─────────────────────────────────────────────────────────────
const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 80;
const PUBLIC_DIR = path.join(__dirname, 'public');
const DATA_DIR = path.join(__dirname, 'data');
const STATE_FILE = path.join(DATA_DIR, 'state.json');
// Mot de passe d'édition partagé (les gars du van). Modifiable via env.
const EDIT_PASSWORD = process.env.EDIT_PASSWORD || 'pyrenees2026';

// ── État par défaut (itinéraire Option B) ───────────────────
const DEFAULT_STATE = {
  updatedAt: null,
  days: [
    { id: 1, date: 'Lun. 10 août', title: 'Josse → Gavarnie', status: 'todo' },
    { id: 2, date: 'Mar. 11 août', title: 'Brèche de Roland (2807 m)', status: 'todo' },
    { id: 3, date: 'Mer. 12 août', title: 'Lacs de Néouvielle', status: 'todo' },
    { id: 4, date: 'Jeu. 13 août', title: 'Retour Josse', status: 'todo' },
  ],
  current: { label: 'Pas encore parti', lat: 43.6409, lng: -1.2243, note: '', at: null },
  stops: [], // historique des points d'arrêt {label, lat, lng, note, at}
};

// ── Helpers état ────────────────────────────────────────────
function ensureData() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(STATE_FILE)) {
    fs.writeFileSync(STATE_FILE, JSON.stringify(DEFAULT_STATE, null, 2));
  }
}
function readState() {
  try { return JSON.parse(fs.readFileSync(STATE_FILE, 'utf-8')); }
  catch { return { ...DEFAULT_STATE }; }
}
function writeState(s) {
  s.updatedAt = new Date().toISOString();
  fs.writeFileSync(STATE_FILE, JSON.stringify(s, null, 2));
  return s;
}

// ── Static ──────────────────────────────────────────────────
const MIME = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png',
  '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.webmanifest': 'application/manifest+json',
};
function serveStatic(req, res) {
  let urlPath = decodeURIComponent(req.url.split('?')[0]);
  if (urlPath === '/') urlPath = '/index.html';
  const filePath = path.join(PUBLIC_DIR, path.normalize(urlPath));
  if (!filePath.startsWith(PUBLIC_DIR)) { res.writeHead(403); return res.end('Forbidden'); }
  fs.readFile(filePath, (err, data) => {
    if (err) {
      // SPA-ish : pages sans extension → essaie .html
      if (!path.extname(filePath)) {
        return fs.readFile(filePath + '.html', (e2, d2) => {
          if (e2) { res.writeHead(404); return res.end('Not found'); }
          res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
          res.end(d2);
        });
      }
      res.writeHead(404); return res.end('Not found');
    }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(filePath)] || 'application/octet-stream' });
    res.end(data);
  });
}

function sendJson(res, code, obj) {
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(obj));
}
function readBody(req) {
  return new Promise((resolve) => {
    let b = '';
    req.on('data', (c) => { b += c; if (b.length > 1e6) req.destroy(); });
    req.on('end', () => { try { resolve(JSON.parse(b || '{}')); } catch { resolve({}); } });
  });
}

// ── Serveur ─────────────────────────────────────────────────
ensureData();
const server = http.createServer(async (req, res) => {
  const url = req.url.split('?')[0];

  // GET état (public, lecture seule)
  if (req.method === 'GET' && url === '/api/state') {
    return sendJson(res, 200, readState());
  }

  // POST mise à jour (protégé par mot de passe)
  if (req.method === 'POST' && url === '/api/update') {
    const body = await readBody(req);
    if (body.password !== EDIT_PASSWORD) {
      return sendJson(res, 401, { ok: false, error: 'Mot de passe incorrect' });
    }
    const s = readState();
    const a = body.action;

    if (a === 'setDayStatus') {
      const d = s.days.find((x) => x.id === Number(body.id));
      if (d && ['todo', 'current', 'done'].includes(body.status)) d.status = body.status;
    } else if (a === 'setCurrent') {
      s.current = {
        label: String(body.label || '').slice(0, 80),
        lat: Number(body.lat), lng: Number(body.lng),
        note: String(body.note || '').slice(0, 280),
        at: new Date().toISOString(),
      };
      // archive dans l'historique
      s.stops.unshift({ ...s.current });
      s.stops = s.stops.slice(0, 50);
    } else if (a === 'reset') {
      return sendJson(res, 200, writeState({ ...DEFAULT_STATE }));
    } else {
      return sendJson(res, 400, { ok: false, error: 'Action inconnue' });
    }
    return sendJson(res, 200, { ok: true, state: writeState(s) });
  }

  // Vérif mot de passe (pour débloquer l'UI d'édition côté client)
  if (req.method === 'POST' && url === '/api/auth') {
    const body = await readBody(req);
    return sendJson(res, 200, { ok: body.password === EDIT_PASSWORD });
  }

  return serveStatic(req, res);
});
server.listen(PORT, () => console.log(`Road-trip server on :${PORT}`));
