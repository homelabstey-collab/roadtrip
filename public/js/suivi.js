// ─────────────────────────────────────────────────────────────
//  Suivi du voyage — carte + polling + édition protégée
// ─────────────────────────────────────────────────────────────
let PWD = sessionStorage.getItem('roadtrip_pwd') || null;
let map, marker, trail;
const DAY_STATUS = { todo: 'À venir', current: 'En cours', done: 'Fait' };

// ── Carte Leaflet ───────────────────────────────────────────
function initMap() {
  map = L.map('map', { scrollWheelZoom: false }).setView([42.78, 0.05], 9);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 18, attribution: '© OpenStreetMap',
  }).addTo(map);
}

function renderMap(state) {
  if (!map) return;
  const c = state.current;
  if (typeof c.lat === 'number' && typeof c.lng === 'number') {
    if (!marker) marker = L.marker([c.lat, c.lng]).addTo(map);
    else marker.setLatLng([c.lat, c.lng]);
    marker.bindPopup(`<b>${c.label || 'Ici'}</b>${c.note ? '<br>' + c.note : ''}`);
    map.setView([c.lat, c.lng], 11, { animate: true });
  }
  // Tracé de la route (historique des arrêts, du plus ancien au plus récent)
  const pts = [...state.stops].reverse().filter(s => typeof s.lat === 'number').map(s => [s.lat, s.lng]);
  if (trail) trail.remove();
  if (pts.length > 1) trail = L.polyline(pts, { color: '#BE3A2A', weight: 3, opacity: .7, dashArray: '6 6' }).addTo(map);
}

// ── Rendu ───────────────────────────────────────────────────
function fmtDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

function render(state) {
  // Bandeau live
  const c = state.current;
  document.getElementById('liveWhere').textContent = c.label || 'Pas encore parti';
  document.getElementById('liveNote').textContent = c.note || '';
  document.getElementById('liveTs').textContent = c.at ? 'Mis à jour ' + fmtDate(c.at) : 'En attente du départ';

  // Avancée jour par jour
  const track = document.getElementById('track');
  track.innerHTML = state.days.map(d => `
    <div class="track-day ${d.status}">
      <span class="badge">${d.status === 'done' ? '✓' : d.id}</span>
      <div class="tinfo">
        <div class="tdate">${d.date}</div>
        <div class="ttitle">${d.title}</div>
      </div>
      <span class="tstat">${DAY_STATUS[d.status]}</span>
    </div>`).join('');

  // Éditeurs de jour (si déverrouillé)
  if (PWD) {
    document.getElementById('dayEditors').innerHTML = state.days.map(d => `
      <div class="row" style="align-items:center;margin:6px 0;">
        <div style="flex:2;min-width:160px;"><strong>J${d.id}</strong> · ${d.title}</div>
        <select data-day="${d.id}" style="flex:1;padding:7px;border:1px solid var(--line);border-radius:3px;">
          <option value="todo" ${d.status === 'todo' ? 'selected' : ''}>À venir</option>
          <option value="current" ${d.status === 'current' ? 'selected' : ''}>En cours</option>
          <option value="done" ${d.status === 'done' ? 'selected' : ''}>Fait</option>
        </select>
      </div>`).join('');
    document.querySelectorAll('#dayEditors select').forEach(sel => {
      sel.addEventListener('change', () => {
        post('setDayStatus', { id: Number(sel.dataset.day), status: sel.value });
      });
    });
  }

  renderMap(state);
}

// ── API ─────────────────────────────────────────────────────
async function load() {
  try {
    const r = await fetch('/api/state', { cache: 'no-store' });
    render(await r.json());
  } catch (e) { /* silencieux */ }
}

async function post(action, extra) {
  if (!PWD) return;
  const r = await fetch('/api/update', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password: PWD, action, ...extra }),
  });
  const j = await r.json();
  if (j.ok && j.state) render(j.state);
  else if (!j.ok) alert(j.error || 'Erreur');
  return j;
}

// ── Auth / édition ──────────────────────────────────────────
function showEdit(on) {
  document.getElementById('lockView').classList.toggle('hide', on);
  document.getElementById('editView').classList.toggle('hide', !on);
}

document.getElementById('unlockBtn').addEventListener('click', async () => {
  const pwd = document.getElementById('pwd').value;
  const msg = document.getElementById('authMsg');
  const r = await fetch('/api/auth', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password: pwd }),
  });
  const j = await r.json();
  if (j.ok) {
    PWD = pwd;
    sessionStorage.setItem('roadtrip_pwd', pwd);
    msg.textContent = '';
    showEdit(true);
    load();
  } else {
    msg.textContent = ' Mot de passe incorrect';
  }
});

document.getElementById('lockBtn').addEventListener('click', () => {
  PWD = null; sessionStorage.removeItem('roadtrip_pwd');
  document.getElementById('pwd').value = '';
  showEdit(false); load();
});

document.getElementById('useGps').addEventListener('click', () => {
  const msg = document.getElementById('stopMsg');
  if (!navigator.geolocation) { msg.textContent = ' GPS non dispo'; return; }
  msg.textContent = ' Localisation…';
  navigator.geolocation.getCurrentPosition(
    (pos) => {
      document.getElementById('stopLat').value = pos.coords.latitude.toFixed(5);
      document.getElementById('stopLng').value = pos.coords.longitude.toFixed(5);
      msg.textContent = ' Position récupérée ✓';
    },
    () => { msg.textContent = ' Échec GPS (autorise la localisation)'; },
    { enableHighAccuracy: true, timeout: 10000 }
  );
});

document.getElementById('postStop').addEventListener('click', async () => {
  const label = document.getElementById('stopLabel').value.trim();
  const lat = parseFloat(document.getElementById('stopLat').value);
  const lng = parseFloat(document.getElementById('stopLng').value);
  const note = document.getElementById('stopNote').value.trim();
  const msg = document.getElementById('stopMsg');
  if (!label || isNaN(lat) || isNaN(lng)) { msg.textContent = ' Remplis lieu + coordonnées'; return; }
  const j = await post('setCurrent', { label, lat, lng, note });
  if (j && j.ok) {
    msg.textContent = ' Point posé ✓';
    document.getElementById('stopLabel').value = '';
    document.getElementById('stopNote').value = '';
  }
});

// ── Init ────────────────────────────────────────────────────
initMap();
load();
if (PWD) showEdit(true);
setInterval(load, 15000); // rafraîchit toutes les 15 s
document.addEventListener('visibilitychange', () => { if (!document.hidden) load(); });
