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

// ── Étapes du parcours (façon "niveaux de jeu") ─────────────
// type : route | ravito | rando | manger | dodo | visite
// Chaque étape a un lieu (GPS) + des "options" (propositions au choix).
const STAGES = [
  { id: 1,  day: 'J1 · Lun. 10', type: 'route',  title: 'Josse → Gavarnie', sub: '~190 km · ~3 h', lat: 42.7355, lng: -0.0110,
    options: ['Plein eau / gasoil / courses AVANT de monter (rare et cher en altitude)'] },
  { id: 2,  day: 'J1 · Lun. 10', type: 'rando',  title: 'Cirque → Grande Cascade', sub: '~9–11 km · +400 m · facile', lat: 42.6935, lng: -0.0045,
    options: ['Sentier rive ouest (forêt) à l\'aller', 'Retour par l\'Hôtellerie du Cirque'] },
  { id: 3,  day: 'J1 · Lun. 10', type: 'manger', title: 'Dîner à Gavarnie', sub: 'choisir une adresse', lat: 42.7333, lng: -0.0091,
    options: ['La Kantine — burgers/raclette (la meilleure)', 'La Chaumière — planches, tartes myrtilles', 'Bar Claire Montagne — terrasse vue cirque'] },
  { id: 4,  day: 'J1 · Lun. 10', type: 'dodo',   title: 'Nuit 1', sub: 'parking van', lat: 42.7136, lng: -0.0509,
    options: ['Gavarnie / Gèdre village (sûr)', 'Col des Tentes 2208 m — départ Brèche, zéro route demain (⚠️ panneaux nuit à vérifier)'] },

  { id: 5,  day: 'J2 · Mar. 11', type: 'rando',  title: 'Brèche de Roland (2807 m)', sub: '~12–14 km · +900 m · 6–7 h · sportif+', lat: 42.6912, lng: -0.0343,
    options: ['Départ AVANT 8 h (parking + orages)', 'Bâtons — névé fréquent sous la brèche', 'Repli si météo : Refuge des Espuguettes (+700 m, plus sûr)'] },
  { id: 6,  day: 'J2 · Mar. 11', type: 'manger', title: 'Dîner J2', sub: 'Gavarnie ou Luz', lat: 42.8730, lng: -0.0031,
    options: ['Reste à Gavarnie (La Kantine ouverte mardi)', 'Le Mouton Noir, Luz — après-rando', 'Orika, Luz — gastro (OK mardi)'] },
  { id: 7,  day: 'J2 · Mar. 11', type: 'dodo',   title: 'Nuit 2', sub: 'rester ou avancer', lat: 42.9083, lng: 0.1453,
    options: ['Rester Col des Tentes / Gavarnie (peinard)', 'Avancer Col du Tourmalet 2115 m (spot mythique + Pic du Midi demain)', 'Aragnouet / Fabian — vallée d\'Aure tranquille'] },

  { id: 8,  day: 'J3 · Mer. 12', type: 'rando',  title: 'Lacs de Néouvielle', sub: '~10–12 km · +600 m · sportif', lat: 42.8436, lng: 0.1477,
    options: ['Boucle Aumar / Aubert / Laquettes + Col d\'Aubert', 'Version courte balade lacs (~5 km)', '⚠️ Monter avant 9h30 (route régulée), sinon navette Orédon ~8,50 €'] },
  { id: 9,  day: 'J3 · Mer. 12', type: 'visite', title: 'Option Pic du Midi de Bigorre', sub: 'facultatif · si dodo Tourmalet', lat: 42.9095, lng: 0.1790,
    options: ['Téléphérique La Mongie → 2877 m (~53 €/pers.)', 'À zapper si on a fait le Néouvielle'] },
  { id: 10, day: 'J3 · Mer. 12', type: 'visite', title: 'Récup thermes', sub: 'Saint-Lary', lat: 42.8196, lng: 0.3211,
    options: ['Sensoria Rio — ouvert mercredi 14h30–20h (jambes lourdes)'] },
  { id: 11, day: 'J3 · Mer. 12', type: 'manger', title: 'Dîner Saint-Lary', sub: 'choisir une table', lat: 42.8211, lng: 0.3271,
    options: ['Restaurant böbby — la meilleure (19 h)', 'Brasserie ICC — valeur sûre, terrasse', 'Le Balthazar — viandes/poissons', '⚠️ La Grange fermée le mercredi'] },
  { id: 12, day: 'J3 · Mer. 12', type: 'dodo',   title: 'Nuit 3', sub: 'le plus à l\'ouest possible', lat: 42.7906, lng: 0.2605,
    options: ['Aragnouet / Fabian — calme', 'Aire Saint-Lary ~10 € (eau + vidange + douche avant retour)'] },

  { id: 13, day: 'J4 · Jeu. 13', type: 'rando',  title: 'Petite rando matin', sub: 'optionnel', lat: 42.8253, lng: 0.1618,
    options: ['Tour de lac près d\'Orédon avant de plier', 'Ou on file direct si fatigue'] },
  { id: 14, day: 'J4 · Jeu. 13', type: 'route',  title: 'Retour Josse', sub: '~200 km · ~2 h 30', lat: 43.6409, lng: -1.2243,
    options: ['Nettoyage + plein gasoil EXIGÉS à la restitution', 'Prévoir ~1 h de battement'] },
];

const DEFAULT_STATE = {
  updatedAt: null,
  currentStage: 0,        // index de l'étape en cours (0 = première)
  done: [],               // ids des étapes validées
  choices: {},            // { stageId: "option choisie" }
  note: '',               // petit mot d'équipage en cours
  stages: STAGES,         // embarqué pour que le front ait tout
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
    s.stages = STAGES; // garde l'itinéraire toujours à jour côté serveur
    if (!Array.isArray(s.done)) s.done = [];
    if (!s.choices) s.choices = {};
    const a = body.action;
    const nb = STAGES.length;

    if (a === 'validate') {
      // Valide l'étape en cours → avance le van à la suivante
      const cur = STAGES[s.currentStage];
      if (cur && !s.done.includes(cur.id)) s.done.push(cur.id);
      s.currentStage = Math.min(s.currentStage + 1, nb - 1);
    } else if (a === 'goto') {
      // Sélecteur de niveau : aller à une étape précise (revenir / sauter)
      const idx = Number(body.index);
      if (idx >= 0 && idx < nb) s.currentStage = idx;
    } else if (a === 'toggleDone') {
      // (Dé)valider une étape précise depuis le sélecteur
      const id = Number(body.id);
      s.done = s.done.includes(id) ? s.done.filter((x) => x !== id) : [...s.done, id];
    } else if (a === 'choose') {
      // Choisir une proposition pour une étape (ex: quel resto)
      s.choices[String(body.id)] = String(body.option || '').slice(0, 120);
    } else if (a === 'setNote') {
      s.note = String(body.note || '').slice(0, 280);
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
