// ─────────────────────────────────────────────────────────────
//  Suivi "progression de jeu" — le van avance d'étape en étape
// ─────────────────────────────────────────────────────────────
let PWD = sessionStorage.getItem('roadtrip_pwd') || null;

const TYPE_META = {
  route:  { ic: '🚐', label: 'Route' },
  ravito: { ic: '🛒', label: 'Ravito' },
  rando:  { ic: '🥾', label: 'Rando' },
  manger: { ic: '🍽️', label: 'Manger' },
  dodo:   { ic: '🌙', label: 'Dodo' },
  visite: { ic: '✨', label: 'Visite' },
};

let STATE = null;

// ── Rendu ───────────────────────────────────────────────────
function render(s) {
  STATE = s;
  const stages = s.stages || [];
  const nb = stages.length;
  const doneSet = new Set(s.done || []);
  const cur = stages[s.currentStage] || stages[0];

  // Barre de progression (compte les étapes validées)
  const doneCount = doneSet.size;
  const pct = nb ? Math.round((doneCount / nb) * 100) : 0;
  document.getElementById('progFill').style.width = pct + '%';
  document.getElementById('progVan').style.left = pct + '%';
  document.getElementById('progCount').textContent = `${doneCount} / ${nb}`;
  document.getElementById('progPct').textContent = pct + ' %';

  // Étape en cours, en grand
  const m = TYPE_META[cur.type] || { ic: '📍', label: cur.type };
  const choice = (s.choices || {})[String(cur.id)];
  document.getElementById('stageNow').innerHTML = `
    <div class="sn-head">
      <span class="sn-ic">${m.ic}</span>
      <div>
        <div class="sn-day">${cur.day} · <span class="sn-type">${m.label}</span></div>
        <div class="sn-title">${cur.title}</div>
        <div class="sn-sub">${cur.sub || ''}</div>
      </div>
      <a class="maplink sn-map" href="https://maps.google.com/?q=${cur.lat},${cur.lng}" target="_blank" rel="noopener">Maps</a>
    </div>
    <div class="sn-options">
      ${(cur.options || []).map((opt) => {
        const chosen = choice === opt;
        return `<button class="opt ${chosen ? 'chosen' : ''}" data-id="${cur.id}" data-opt="${encodeURIComponent(opt)}" ${PWD ? '' : 'disabled'}>
          <span class="opt-mark">${chosen ? '✓' : '○'}</span>${opt}</button>`;
      }).join('')}
    </div>
    ${PWD ? `<div class="sn-actions">
        <button class="btn alt" id="prevStage" ${s.currentStage === 0 ? 'disabled' : ''}>← Étape précédente</button>
        <button class="btn sol" id="validateStage">✓ Valider cette étape — le van avance</button>
      </div>` :
      `<div class="sn-live"><span class="live-dot"></span> Suivi en direct — l'équipage valide les étapes</div>`}
  `;

  // Choix d'option
  if (PWD) {
    document.querySelectorAll('#stageNow .opt').forEach((b) => {
      b.addEventListener('click', () => post('choose', { id: Number(b.dataset.id), option: decodeURIComponent(b.dataset.opt) }));
    });
    const v = document.getElementById('validateStage');
    if (v) v.addEventListener('click', () => post('validate', {}));
    const p = document.getElementById('prevStage');
    if (p) p.addEventListener('click', () => post('goto', { index: Math.max(0, s.currentStage - 1) }));
  }

  // Note d'équipage
  const cn = document.getElementById('crewNote');
  cn.innerHTML = s.note ? `<span class="mono">mot d'équipage</span><p>« ${s.note} »</p>` : '';
  cn.style.display = s.note ? 'block' : 'none';

  // Sélecteur de niveau
  document.getElementById('levels').innerHTML = stages.map((st, i) => {
    const done = doneSet.has(st.id);
    const isCur = i === s.currentStage;
    const mm = TYPE_META[st.type] || { ic: '📍' };
    const cls = done ? 'done' : isCur ? 'current' : 'todo';
    return `<button class="level ${cls}" data-index="${i}" ${PWD ? '' : 'disabled'}>
      <span class="lv-ic">${done ? '✓' : mm.ic}</span>
      <span class="lv-txt"><span class="lv-day">${st.day}</span><span class="lv-title">${st.title}</span></span>
    </button>`;
  }).join('');
  if (PWD) {
    document.querySelectorAll('#levels .level').forEach((b) => {
      b.addEventListener('click', () => post('goto', { index: Number(b.dataset.index) }));
    });
  }
}

// ── API ─────────────────────────────────────────────────────
async function load() {
  try { const r = await fetch('/api/state', { cache: 'no-store' }); render(await r.json()); } catch (e) {}
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

// ── Auth ────────────────────────────────────────────────────
function showEdit(on) {
  document.getElementById('lockView').classList.toggle('hide', on);
  document.getElementById('editView').classList.toggle('hide', !on);
}
document.getElementById('unlockBtn').addEventListener('click', async () => {
  const pwd = document.getElementById('pwd').value;
  const r = await fetch('/api/auth', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password: pwd }) });
  const j = await r.json();
  if (j.ok) { PWD = pwd; sessionStorage.setItem('roadtrip_pwd', pwd); document.getElementById('authMsg').textContent = ''; showEdit(true); if (STATE) render(STATE); }
  else document.getElementById('authMsg').textContent = ' Mot de passe incorrect';
});
document.getElementById('lockBtn').addEventListener('click', () => {
  PWD = null; sessionStorage.removeItem('roadtrip_pwd'); document.getElementById('pwd').value = ''; showEdit(false); if (STATE) render(STATE);
});
document.getElementById('saveNote').addEventListener('click', () => {
  post('setNote', { note: document.getElementById('noteInput').value });
});
document.getElementById('resetBtn').addEventListener('click', () => {
  if (confirm('Tout réinitialiser ? Le van repart de l\'étape 1.')) post('reset', {});
});

// ── Init ────────────────────────────────────────────────────
if (PWD) showEdit(true);
load();
setInterval(load, 15000);
document.addEventListener('visibilitychange', () => { if (!document.hidden) load(); });
