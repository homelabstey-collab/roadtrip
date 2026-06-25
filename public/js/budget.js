// ─────────────────────────────────────────────────────────────
//  Budget — estimation + suivi des dépenses réelles
// ─────────────────────────────────────────────────────────────
let PWD = sessionStorage.getItem('roadtrip_pwd') || null;
let STATE = null;

const eur = (n) => (Math.round(n * 100) / 100).toLocaleString('fr-FR', { minimumFractionDigits: 0, maximumFractionDigits: 2 }) + ' €';
function fmtDate(iso) { return iso ? new Date(iso).toLocaleString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : ''; }

function render(s) {
  STATE = s;
  const b = s.budget || {};
  const est = (b.estimate || []).reduce((a, x) => a + x.amount, 0);
  const spent = (b.expenses || []).reduce((a, x) => a + x.amount, 0);
  const people = b.people || 4;
  const left = est - spent;

  document.getElementById('kpiEst').textContent = eur(est);
  document.getElementById('kpiSpent').textContent = eur(spent);
  document.getElementById('kpiLeft').textContent = eur(left);
  document.getElementById('kpiPer').textContent = eur(est / people) + ' /pers.';

  // jauge dépensé / estimé
  const pct = est ? Math.min(100, Math.round((spent / est) * 100)) : 0;
  const fill = document.getElementById('gaugeFill');
  fill.style.width = pct + '%';
  fill.style.background = spent > est ? 'var(--solA)' : 'linear-gradient(90deg,var(--pine),var(--solC))';
  document.getElementById('gaugeTxt').textContent = `${eur(spent)} / ${eur(est)}`;
  document.getElementById('gaugePct').textContent = pct + ' %';

  // table estimation
  document.getElementById('estTable').innerHTML = `
    <thead><tr><th>Poste</th><th style="text-align:right;">Estimé</th><th style="text-align:right;">÷ ${people}</th></tr></thead>
    <tbody>
      ${(b.estimate || []).map((e) => `<tr><td>${e.cat}</td><td style="text-align:right;">${eur(e.amount)}</td><td style="text-align:right;color:var(--muted);">${eur(e.amount / people)}</td></tr>`).join('')}
      <tr class="total"><td>Total</td><td style="text-align:right;">${eur(est)}</td><td style="text-align:right;">${eur(est / people)}</td></tr>
    </tbody>`;

  // dépenses réelles
  const list = document.getElementById('expList');
  const empty = document.getElementById('expEmpty');
  if (!b.expenses || b.expenses.length === 0) { list.innerHTML = ''; empty.style.display = 'block'; }
  else {
    empty.style.display = 'none';
    list.innerHTML = b.expenses.map((e) => `
      <div class="exp-row">
        <span class="exp-cat">${e.cat}</span>
        <div class="exp-mid"><div class="exp-label">${e.label || '—'}</div><div class="exp-ts mono">${fmtDate(e.at)}</div></div>
        <span class="exp-amt">${eur(e.amount)}</span>
        ${PWD ? `<button class="exp-del" data-id="${e.id}" title="Supprimer">✕</button>` : ''}
      </div>`).join('');
    if (PWD) document.querySelectorAll('.exp-del').forEach((b2) => b2.addEventListener('click', () => post('delExpense', { id: Number(b2.dataset.id) })));
  }

  // valeur du champ people
  const pInput = document.getElementById('people');
  if (pInput && document.activeElement !== pInput) pInput.value = people;
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

document.getElementById('addExp').addEventListener('click', async () => {
  const label = document.getElementById('expLabel').value.trim();
  const cat = document.getElementById('expCat').value;
  const amount = parseFloat(document.getElementById('expAmount').value);
  const msg = document.getElementById('addMsg');
  if (!label || isNaN(amount) || amount < 0) { msg.textContent = ' Remplis le libellé + un montant'; return; }
  const j = await post('addExpense', { label, cat, amount });
  if (j && j.ok) { msg.textContent = ' Ajouté ✓'; document.getElementById('expLabel').value = ''; document.getElementById('expAmount').value = ''; }
});
document.getElementById('savePeople').addEventListener('click', () => post('setPeople', { people: Number(document.getElementById('people').value) }));

// ── Init ────────────────────────────────────────────────────
if (PWD) showEdit(true);
load();
setInterval(load, 15000);
document.addEventListener('visibilitychange', () => { if (!document.hidden) load(); });
