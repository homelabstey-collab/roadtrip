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

// ── Étapes du parcours (1 carte = 1 jour/lieu, avec sous-tâches) ──
// task.type : destination | rando | manger | dodo | visite
// Chaque tâche a un libellé + des options (propositions au choix).
const STAGES = [
  {
    id: 1, day: 'Jour 1 · Lun. 10 août', place: 'Gavarnie', img: '/images/photo-13.jpg',
    lat: 42.7355, lng: -0.0110, program: { rando: 'Cirque → Grande Cascade', resto: 'La Kantine' },
    tasks: [
      { type: 'destination', label: 'Josse → Gavarnie', sub: '~190 km · ~3 h', options: ['Plein eau/gasoil/courses avant de monter'] },
      { type: 'rando', label: 'Cirque → Grande Cascade', sub: '~9–11 km · +400 m · facile', options: ['Rive ouest (forêt) à l\'aller', 'Retour par l\'Hôtellerie du Cirque'],
        links: [{ label: 'Départ rando', url: 'https://maps.google.com/?q=42.7355,-0.0110' }, { label: 'Topo', url: 'https://www.google.com/search?q=randonn%C3%A9e+cirque+de+Gavarnie+grande+cascade' }] },
      { type: 'manger', label: 'Dîner à Gavarnie', sub: 'choisir une adresse', options: ['La Kantine — la meilleure', 'La Chaumière — planches, tartes', 'Bar Claire Montagne — terrasse'] },
      { type: 'dodo', label: 'Nuit 1', sub: 'parking van', options: ['Gavarnie / Gèdre village (sûr)', 'Col des Tentes 2208 m (zéro route demain)'],
        links: [{ label: 'Spot Maps', url: 'https://maps.google.com/?q=42.7136,-0.0509' }, { label: 'Park4Night', url: 'https://park4night.com/fr/map?lat=42.7136&lng=-0.0509&zoom=13' }] },
    ],
  },
  {
    id: 2, day: 'Jour 2 · Mar. 11 août', place: 'Brèche de Roland', img: '/images/photo-09.jpg',
    lat: 42.6912, lng: -0.0343, program: { rando: 'Brèche de Roland (2807 m)', resto: 'Le Mouton Noir' },
    tasks: [
      { type: 'rando', label: 'Brèche de Roland (2807 m)', sub: '~12–14 km · +900 m · sportif+', options: ['Départ avant 8 h (parking + orages)', 'Bâtons — névé fréquent', 'Repli : Refuge des Espuguettes'],
        links: [{ label: 'Départ (Col des Tentes)', url: 'https://maps.google.com/?q=42.7136,-0.0509' }, { label: 'Topo', url: 'https://www.google.com/search?q=randonn%C3%A9e+br%C3%A8che+de+Roland+col+des+tentes' }] },
      { type: 'manger', label: 'Dîner J2', sub: 'Gavarnie ou Luz', options: ['La Kantine (Gavarnie)', 'Le Mouton Noir (Luz)', 'Orika (Luz, gastro)'] },
      { type: 'dodo', label: 'Nuit 2', sub: 'rester ou avancer', options: ['Col des Tentes / Gavarnie', 'Col du Tourmalet 2115 m', 'Aragnouet / Fabian'],
        links: [{ label: 'Col du Tourmalet', url: 'https://maps.google.com/?q=42.9083,0.1453' }, { label: 'Park4Night', url: 'https://park4night.com/fr/map?lat=42.9083&lng=0.1453&zoom=12' }] },
    ],
  },
  {
    id: 3, day: 'Jour 3 · Mer. 12 août', place: 'Néouvielle', img: '/images/photo-05.jpg',
    lat: 42.8436, lng: 0.1477, program: { rando: 'Lacs de Néouvielle', resto: 'Restaurant böbby' },
    tasks: [
      { type: 'rando', label: 'Lacs de Néouvielle', sub: '~10–12 km · +600 m · sportif', options: ['Boucle Aumar/Aubert/Laquettes', 'Version courte (~5 km)', 'Monter avant 9h30 (route régulée)'],
        links: [{ label: 'Lac d\'Orédon', url: 'https://maps.google.com/?q=42.8253,0.1618' }, { label: 'Topo', url: 'https://www.google.com/search?q=randonn%C3%A9e+lacs+du+N%C3%A9ouvielle+Aumar+Aubert' }] },
      { type: 'visite', label: 'Récup thermes', sub: 'Sensoria Rio, Saint-Lary', options: ['Ouvert mercredi 14h30–20h'],
        links: [{ label: 'Sensoria Rio', url: 'https://maps.google.com/?q=42.8196,0.3211' }] },
      { type: 'manger', label: 'Dîner Saint-Lary', sub: 'choisir une table', options: ['Restaurant böbby — la meilleure', 'Brasserie ICC — terrasse', 'Le Balthazar — viandes/poissons'] },
      { type: 'dodo', label: 'Nuit 3', sub: 'le plus à l\'ouest', options: ['Aragnouet / Fabian', 'Aire Saint-Lary ~10 € (douche)'],
        links: [{ label: 'Aire Saint-Lary', url: 'https://maps.google.com/?q=42.8100,0.3230' }, { label: 'Park4Night', url: 'https://park4night.com/fr/map?lat=42.8100&lng=0.3230&zoom=13' }] },
    ],
  },
  {
    id: 4, day: 'Jour 4 · Jeu. 13 août', place: 'Retour Josse', img: '/images/photo-10.jpg',
    lat: 43.6409, lng: -1.2243, program: { rando: 'Tour de lac (optionnel)', resto: '—' },
    tasks: [
      { type: 'rando', label: 'Petite rando matin', sub: 'optionnel · tour de lac Orédon', options: ['Avant de plier', 'Ou on file direct'],
        links: [{ label: 'Lac d\'Orédon', url: 'https://maps.google.com/?q=42.8253,0.1618' }] },
      { type: 'destination', label: 'Retour Josse + restitution', sub: '~200 km · ~2 h 30', options: ['Nettoyage + plein gasoil exigés', 'Prévoir ~1 h de battement'] },
    ],
  },
];

// ── Budget (estimation + suivi des dépenses) ────────────────
const BUDGET_ESTIMATE = [
  { cat: 'Van (location 4 j)', amount: 542 },
  { cat: 'Carburant', amount: 100 },
  { cat: 'Courses / picnics', amount: 120 },
  { cat: 'Restos (3 dîners)', amount: 180 },
  { cat: 'Thermes Sensoria', amount: 60 },
  { cat: 'Parkings / navettes', amount: 30 },
  { cat: 'Divers / marge', amount: 50 },
];

const DEFAULT_STATE = {
  updatedAt: null,
  tasksDone: {},   // { "stageId-taskIdx": true }
  choices: {},     // { "stageId-taskIdx": "option choisie" }
  note: '',
  noteAt: null,
  stages: STAGES,
  budget: {
    people: 4,
    estimate: BUDGET_ESTIMATE,
    expenses: [],  // { id, label, cat, amount, at }
  },
};

// ── Helpers état ────────────────────────────────────────────
function ensureData() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(STATE_FILE)) {
    fs.writeFileSync(STATE_FILE, JSON.stringify(DEFAULT_STATE, null, 2));
  }
}
function readState() {
  let raw;
  try { raw = JSON.parse(fs.readFileSync(STATE_FILE, 'utf-8')); }
  catch { raw = {}; }
  // Ancien format (avait "days"/"stops") → on repart propre
  if (raw.days || raw.stops || !raw.stages) {
    raw = {
      updatedAt: raw.updatedAt || null,
      tasksDone: raw.tasksDone && !raw.days ? raw.tasksDone : {},
      choices: raw.choices && !raw.days ? raw.choices : {},
      note: raw.note && !raw.days ? raw.note : '',
      noteAt: raw.noteAt || null,
      budget: { people: 4, estimate: BUDGET_ESTIMATE, expenses: [] },
    };
  }
  // Toujours injecter l'itinéraire + estimation à jour (source de vérité = le code)
  raw.stages = STAGES;
  raw.budget = raw.budget || {};
  raw.budget.people = raw.budget.people || 4;
  raw.budget.estimate = BUDGET_ESTIMATE;
  if (!Array.isArray(raw.budget.expenses)) raw.budget.expenses = [];
  if (!raw.tasksDone) raw.tasksDone = {};
  if (!raw.choices) raw.choices = {};
  return raw;
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
// Cache : html/js/css → toujours revalider (frais après chaque deploy) ; images → cache 1 j
function cacheHeader(ext) {
  if (['.jpg', '.jpeg', '.png', '.svg', '.ico'].includes(ext)) return 'public, max-age=86400';
  return 'no-cache, must-revalidate';
}
function serveStatic(req, res) {
  let urlPath = decodeURIComponent(req.url.split('?')[0]);
  if (urlPath === '/') urlPath = '/index.html';
  const filePath = path.join(PUBLIC_DIR, path.normalize(urlPath));
  if (!filePath.startsWith(PUBLIC_DIR)) { res.writeHead(403); return res.end('Forbidden'); }
  fs.readFile(filePath, (err, data) => {
    if (err) {
      // pages sans extension → essaie .html
      if (!path.extname(filePath)) {
        return fs.readFile(filePath + '.html', (e2, d2) => {
          if (e2) { res.writeHead(404); return res.end('Not found'); }
          res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-cache, must-revalidate' });
          res.end(d2);
        });
      }
      res.writeHead(404); return res.end('Not found');
    }
    const ext = path.extname(filePath);
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream', 'Cache-Control': cacheHeader(ext) });
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
    s.stages = STAGES; // itinéraire toujours à jour côté serveur
    s.budget = s.budget || {};
    s.budget.estimate = BUDGET_ESTIMATE; // estimation figée côté serveur
    if (!s.tasksDone) s.tasksDone = {};
    if (!s.choices) s.choices = {};
    if (!Array.isArray(s.budget.expenses)) s.budget.expenses = [];
    const a = body.action;

    if (a === 'toggleTask') {
      // Coche/décoche une sous-tâche (clé "stageId-taskIdx")
      const key = `${Number(body.stage)}-${Number(body.task)}`;
      if (s.tasksDone[key]) delete s.tasksDone[key];
      else s.tasksDone[key] = true;
    } else if (a === 'choose') {
      const key = `${Number(body.stage)}-${Number(body.task)}`;
      s.choices[key] = String(body.option || '').slice(0, 120);
    } else if (a === 'setNote') {
      s.note = String(body.note || '').slice(0, 280);
      s.noteAt = new Date().toISOString();
    } else if (a === 'addExpense') {
      s.budget.expenses.unshift({
        id: Date.now(),
        label: String(body.label || '').slice(0, 60),
        cat: String(body.cat || 'Divers').slice(0, 30),
        amount: Math.max(0, Number(body.amount) || 0),
        at: new Date().toISOString(),
      });
      s.budget.expenses = s.budget.expenses.slice(0, 200);
    } else if (a === 'delExpense') {
      s.budget.expenses = s.budget.expenses.filter((e) => e.id !== Number(body.id));
    } else if (a === 'setPeople') {
      s.budget.people = Math.max(1, Math.min(12, Number(body.people) || 4));
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
