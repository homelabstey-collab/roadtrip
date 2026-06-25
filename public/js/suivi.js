// ─────────────────────────────────────────────────────────────
//  Suivi — timeline verticale, le van descend la route
// ─────────────────────────────────────────────────────────────
let PWD = sessionStorage.getItem('roadtrip_pwd') || null;
let STATE = null;

const TASK_META = {
  destination: { ic: '📍', label: 'Destination' },
  rando:       { ic: '🥾', label: 'Rando' },
  manger:      { ic: '🍽️', label: 'Manger' },
  dodo:        { ic: '🌙', label: 'Dodo' },
  visite:      { ic: '✨', label: 'Visite' },
};
// Couleur du bloc numéro selon l'avancement de l'étape
const NUM_COLOR = { done: 'var(--pine)', current: 'var(--solC)', locked: '#5b5f52' };

function stageStatus(stage, idx, allStages, tasksDone) {
  const keys = stage.tasks.map((_, t) => `${stage.id}-${t}`);
  const doneCount = keys.filter((k) => tasksDone[k]).length;
  if (doneCount === keys.length) return 'done';
  if (doneCount > 0) return 'current';
  // 1ʳᵉ étape non commencée = "current" si la précédente est finie
  const prevDone = idx === 0 || allStages.slice(0, idx).every((st) =>
    st.tasks.every((_, t) => tasksDone[`${st.id}-${t}`]));
  return prevDone ? 'current' : 'locked';
}

function fmtDate(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

function render(s) {
  STATE = s;
  const stages = s.stages || [];
  const tasksDone = s.tasksDone || {};
  const choices = s.choices || {};

  // Progression globale (toutes sous-tâches confondues)
  let total = 0, done = 0;
  stages.forEach((st) => st.tasks.forEach((_, t) => { total++; if (tasksDone[`${st.id}-${t}`]) done++; }));
  const pct = total ? Math.round((done / total) * 100) : 0;
  document.getElementById('progFill').style.width = pct + '%';
  document.getElementById('progPct').textContent = pct + ' %';
  // compte les étapes complètes
  const stagesDone = stages.filter((st) => st.tasks.every((_, t) => tasksDone[`${st.id}-${t}`])).length;
  document.getElementById('progCount').textContent = `${stagesDone} / ${stages.length} étapes`;

  // Timeline
  document.getElementById('timeline').innerHTML = stages.map((st, idx) => {
    const status = stageStatus(st, idx, stages, tasksDone);
    const locked = status === 'locked';

    // sous-tâches (ronds cochables)
    const tasksHtml = st.tasks.map((tk, t) => {
      const key = `${st.id}-${t}`;
      const checked = !!tasksDone[key];
      const m = TASK_META[tk.type] || { ic: '•', label: tk.type };
      const choice = choices[key];
      return `
        <div class="task ${checked ? 'checked' : ''} ${locked ? 'locked' : ''}">
          <button class="task-check" data-stage="${st.id}" data-task="${t}" ${PWD && !locked ? '' : 'disabled'} title="${m.label}">
            ${locked ? '🔒' : checked ? '✓' : '○'}
          </button>
          <div class="task-body">
            <div class="task-top"><span class="task-ic">${m.ic}</span><span class="task-type mono">${m.label}</span></div>
            <div class="task-label">${tk.label}</div>
            ${tk.sub ? `<div class="task-sub">${tk.sub}</div>` : ''}
            ${tk.options && tk.options.length > 1 ? `
              <div class="task-opts">
                ${tk.options.map((opt) => `<button class="topt ${choice === opt ? 'sel' : ''}" data-stage="${st.id}" data-task="${t}" data-opt="${encodeURIComponent(opt)}" ${PWD && !locked ? '' : 'disabled'}>${choice === opt ? '✓ ' : ''}${opt}</button>`).join('')}
              </div>` : (tk.options && tk.options[0] ? `<div class="task-single">${tk.options[0]}</div>` : '')}
            ${tk.links && tk.links.length ? `
              <div class="task-links">
                ${tk.links.map((lk) => `<a class="tlink" href="${lk.url}" target="_blank" rel="noopener">${lk.label} ↗</a>`).join('')}
              </div>` : ''}
          </div>
        </div>`;
    }).join('');

    return `
      <div class="tl-row ${status}">
        <div class="tl-rail">
          <div class="tl-node">${status === 'done' ? '✓' : status === 'current' ? '<img src="/images/van.png" alt="van">' : '🔒'}</div>
        </div>
        <article class="tl-card ${status}">
          <div class="tl-media" style="background-image:url('${st.img}')">
            <span class="tl-num" style="background:${NUM_COLOR[status]}">${st.id}</span>
          </div>
          <div class="tl-content">
            <div class="tl-head">
              <div>
                <div class="tl-day mono">${st.day}</div>
                <h3 class="tl-place">${st.place}</h3>
              </div>
              <span class="tl-status ${status}">${status === 'done' ? 'Terminé' : status === 'current' ? 'En cours' : 'À venir'}</span>
            </div>
            <div class="tl-tasks">${tasksHtml}</div>
            <a class="maplink tl-map" href="https://maps.google.com/?q=${st.lat},${st.lng}" target="_blank" rel="noopener">Ouvrir dans Maps</a>
          </div>
        </article>
      </div>`;
  }).join('');

  // Listeners (si déverrouillé)
  if (PWD) {
    document.querySelectorAll('.task-check:not([disabled])').forEach((b) => {
      b.addEventListener('click', () => post('toggleTask', { stage: Number(b.dataset.stage), task: Number(b.dataset.task) }));
    });
    document.querySelectorAll('.topt:not([disabled])').forEach((b) => {
      b.addEventListener('click', () => post('choose', { stage: Number(b.dataset.stage), task: Number(b.dataset.task), option: decodeURIComponent(b.dataset.opt) }));
    });
  }

  // Note d'équipage
  const cn = document.getElementById('crewNote');
  cn.innerHTML = s.note ? `<div class="cn-head"><span class="cn-ic">💬</span><span class="mono">Notes de l'équipe</span></div><p>${s.note}</p>${s.noteAt ? `<div class="cn-ts mono">Dernière mise à jour : ${fmtDate(s.noteAt)}</div>` : ''}` : '';
  cn.style.display = s.note ? 'block' : 'none';
}

// ── API ─────────────────────────────────────────────────────
async function load() { try { const r = await fetch('/api/state', { cache: 'no-store' }); render(await r.json()); } catch (e) {} }
async function post(action, extra) {
  if (!PWD) return;
  const r = await fetch('/api/update', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password: PWD, action, ...extra }) });
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
document.getElementById('lockBtn').addEventListener('click', () => { PWD = null; sessionStorage.removeItem('roadtrip_pwd'); document.getElementById('pwd').value = ''; showEdit(false); if (STATE) render(STATE); });
document.getElementById('saveNote').addEventListener('click', () => post('setNote', { note: document.getElementById('noteInput').value }));
document.getElementById('resetBtn').addEventListener('click', () => { if (confirm('Tout réinitialiser ?')) post('reset', {}); });

// ── Init ────────────────────────────────────────────────────
if (PWD) showEdit(true);
load();
setInterval(load, 15000);
document.addEventListener('visibilitychange', () => { if (!document.hidden) load(); });
