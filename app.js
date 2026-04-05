'use strict';

// ── Storage ──────────────────────────────────────────────────────────────────
const STORAGE_KEY = 'investment_portfolio_v1';

function loadData() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
  } catch {
    return [];
  }
}

function saveData(investments) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(investments));
}

// ── State ─────────────────────────────────────────────────────────────────────
let investments = loadData();
let activeFilter = 'all';
let pendingDeleteId = null;

// ── Helpers ───────────────────────────────────────────────────────────────────
function formatEur(value) {
  return new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }).format(value);
}

function formatPct(value) {
  const sign = value > 0 ? '+' : '';
  return sign + value.toFixed(2).replace('.', ',') + '%';
}

function calcInvested(inv) {
  return inv.qty * inv.buyPrice;
}

function calcCurrent(inv) {
  return inv.qty * inv.curPrice;
}

function calcGain(inv) {
  return calcCurrent(inv) - calcInvested(inv);
}

function calcReturn(inv) {
  const invested = calcInvested(inv);
  if (invested === 0) return 0;
  return (calcGain(inv) / invested) * 100;
}

function gainClass(value) {
  if (value > 0) return 'gain';
  if (value < 0) return 'loss';
  return 'flat';
}

function typeColor(type) {
  const map = {
    'ETF':       '#6c63ff',
    'PPR':       '#22c55e',
    'Ação':      '#f59e0b',
    'Obrigação': '#3b82f6',
    'Cripto':    '#ec4899',
    'Outro':     '#8b8fa8',
  };
  return map[type] || '#8b8fa8';
}

function newId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

// ── Render Summary ─────────────────────────────────────────────────────────────
function renderSummary() {
  const visible = filteredInvestments();

  const totalInvested = visible.reduce((s, inv) => s + calcInvested(inv), 0);
  const totalCurrent  = visible.reduce((s, inv) => s + calcCurrent(inv), 0);
  const totalGain     = totalCurrent - totalInvested;
  const totalReturn   = totalInvested === 0 ? 0 : (totalGain / totalInvested) * 100;

  document.getElementById('total-invested').textContent = formatEur(totalInvested);
  document.getElementById('total-current').textContent  = formatEur(totalCurrent);

  const gainEl   = document.getElementById('total-gain');
  const returnEl = document.getElementById('total-return');

  gainEl.textContent   = formatEur(totalGain);
  returnEl.textContent = formatPct(totalReturn);

  gainEl.className   = 'value ' + gainClass(totalGain);
  returnEl.className = 'value ' + gainClass(totalReturn);
}

// ── Render Allocation Bar ──────────────────────────────────────────────────────
function renderAllocation() {
  const bar    = document.getElementById('allocation-bar');
  const legend = document.getElementById('allocation-legend');

  const all = investments; // allocation always uses all investments
  const total = all.reduce((s, inv) => s + calcCurrent(inv), 0);

  // Group by type
  const groups = {};
  for (const inv of all) {
    const cur = calcCurrent(inv);
    groups[inv.type] = (groups[inv.type] || 0) + cur;
  }

  bar.innerHTML    = '';
  legend.innerHTML = '';

  if (total === 0) {
    bar.style.background = 'var(--surface2)';
    return;
  }

  bar.style.background = '';

  const types = Object.entries(groups).sort((a, b) => b[1] - a[1]);
  for (const [type, value] of types) {
    const pct   = (value / total) * 100;
    const color = typeColor(type);

    const seg = document.createElement('div');
    seg.className = 'seg';
    seg.style.cssText = `width:${pct}%;background:${color};`;
    seg.title = `${type}: ${formatEur(value)} (${pct.toFixed(1)}%)`;
    bar.appendChild(seg);

    const item = document.createElement('div');
    item.className = 'legend-item';
    item.innerHTML = `<span class="legend-dot" style="background:${color}"></span><span>${type} — ${pct.toFixed(1)}%</span>`;
    legend.appendChild(item);
  }
}

// ── Filtered List ─────────────────────────────────────────────────────────────
function filteredInvestments() {
  if (activeFilter === 'all') return investments;
  return investments.filter(inv => inv.type === activeFilter);
}

// ── Render Table ──────────────────────────────────────────────────────────────
function renderTable() {
  const tbody  = document.getElementById('investments-body');
  const list   = filteredInvestments();

  tbody.innerHTML = '';

  if (list.length === 0) {
    tbody.innerHTML = `<tr id="empty-row"><td colspan="11" class="empty-msg">
      ${activeFilter === 'all' ? 'Sem investimentos. Clique em "+ Adicionar" para começar.' : 'Sem investimentos nesta categoria.'}
    </td></tr>`;
    return;
  }

  for (const inv of list) {
    const invested = calcInvested(inv);
    const current  = calcCurrent(inv);
    const gain     = calcGain(inv);
    const ret      = calcReturn(inv);
    const gc       = gainClass(gain);

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><strong>${escHtml(inv.name)}</strong>${inv.notes ? `<br><small style="color:var(--text-muted)">${escHtml(inv.notes)}</small>` : ''}</td>
      <td style="color:var(--text-muted)">${escHtml(inv.ticker || '—')}</td>
      <td><span class="badge badge-${escHtml(inv.type)}">${escHtml(inv.type)}</span></td>
      <td>${Number(inv.qty).toLocaleString('pt-PT', {maximumFractionDigits: 6})}</td>
      <td>${formatEur(inv.buyPrice)}</td>
      <td>${formatEur(inv.curPrice)}</td>
      <td>${formatEur(invested)}</td>
      <td>${formatEur(current)}</td>
      <td class="${gc}">${formatEur(gain)}</td>
      <td class="${gc}">${formatPct(ret)}</td>
      <td>
        <div class="row-actions">
          <button class="btn-icon-sm" onclick="openEdit('${inv.id}')" title="Editar">&#9998;</button>
          <button class="btn-icon-sm del" onclick="openDelete('${inv.id}')" title="Eliminar">&#128465;</button>
        </div>
      </td>`;
    tbody.appendChild(tr);
  }
}

function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ── Full Render ────────────────────────────────────────────────────────────────
function render() {
  renderSummary();
  renderAllocation();
  renderTable();
}

// ── Modal: Add / Edit ─────────────────────────────────────────────────────────
function openAdd() {
  document.getElementById('modal-title').textContent = 'Adicionar Investimento';
  document.getElementById('investment-form').reset();
  document.getElementById('form-id').value = '';
  showModal('modal-overlay');
}

function openEdit(id) {
  const inv = investments.find(i => i.id === id);
  if (!inv) return;

  document.getElementById('modal-title').textContent = 'Editar Investimento';
  document.getElementById('form-id').value        = inv.id;
  document.getElementById('form-name').value      = inv.name;
  document.getElementById('form-ticker').value    = inv.ticker || '';
  document.getElementById('form-type').value      = inv.type;
  document.getElementById('form-qty').value       = inv.qty;
  document.getElementById('form-buy-price').value = inv.buyPrice;
  document.getElementById('form-cur-price').value = inv.curPrice;
  document.getElementById('form-notes').value     = inv.notes || '';
  showModal('modal-overlay');
}

function closeModal() {
  document.getElementById('modal-overlay').classList.add('hidden');
}

function showModal(id) {
  document.getElementById(id).classList.remove('hidden');
}

// ── Modal: Delete ─────────────────────────────────────────────────────────────
function openDelete(id) {
  const inv = investments.find(i => i.id === id);
  if (!inv) return;
  pendingDeleteId = id;
  document.getElementById('delete-msg').textContent =
    `Tem a certeza que quer eliminar "${inv.name}"?`;
  showModal('delete-overlay');
}

function closeDelete() {
  pendingDeleteId = null;
  document.getElementById('delete-overlay').classList.add('hidden');
}

function confirmDelete() {
  if (!pendingDeleteId) return;
  investments = investments.filter(i => i.id !== pendingDeleteId);
  saveData(investments);
  render();
  closeDelete();
}

// ── Form Submit ───────────────────────────────────────────────────────────────
document.getElementById('investment-form').addEventListener('submit', (e) => {
  e.preventDefault();

  const id        = document.getElementById('form-id').value;
  const name      = document.getElementById('form-name').value.trim();
  const ticker    = document.getElementById('form-ticker').value.trim().toUpperCase();
  const type      = document.getElementById('form-type').value;
  const qty       = parseFloat(document.getElementById('form-qty').value);
  const buyPrice  = parseFloat(document.getElementById('form-buy-price').value);
  const curPrice  = parseFloat(document.getElementById('form-cur-price').value);
  const notes     = document.getElementById('form-notes').value.trim();

  if (!name || !type || isNaN(qty) || isNaN(buyPrice) || isNaN(curPrice)) return;

  if (id) {
    // Edit
    const inv = investments.find(i => i.id === id);
    if (inv) Object.assign(inv, { name, ticker, type, qty, buyPrice, curPrice, notes });
  } else {
    // Add
    investments.push({ id: newId(), name, ticker, type, qty, buyPrice, curPrice, notes });
  }

  saveData(investments);
  render();
  closeModal();
});

// ── Filter Buttons ─────────────────────────────────────────────────────────────
document.querySelectorAll('.filter-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    activeFilter = btn.dataset.type;
    render();
  });
});

// ── Wire UI ───────────────────────────────────────────────────────────────────
document.getElementById('btn-add').addEventListener('click', openAdd);
document.getElementById('modal-close').addEventListener('click', closeModal);
document.getElementById('btn-cancel').addEventListener('click', closeModal);
document.getElementById('delete-cancel').addEventListener('click', closeDelete);
document.getElementById('delete-confirm').addEventListener('click', confirmDelete);

// Close modals on overlay click
document.getElementById('modal-overlay').addEventListener('click', (e) => {
  if (e.target === e.currentTarget) closeModal();
});
document.getElementById('delete-overlay').addEventListener('click', (e) => {
  if (e.target === e.currentTarget) closeDelete();
});

// ── Seed demo data if empty ────────────────────────────────────────────────────
if (investments.length === 0) {
  investments = [
    { id: newId(), name: 'Vanguard FTSE All-World', ticker: 'VWCE', type: 'ETF',       qty: 25,  buyPrice: 98.50,  curPrice: 112.30, notes: 'Acumulação' },
    { id: newId(), name: 'iShares Core MSCI World', ticker: 'IWDA', type: 'ETF',       qty: 40,  buyPrice: 75.20,  curPrice: 82.10,  notes: '' },
    { id: newId(), name: 'PPR Allianz',             ticker: '',     type: 'PPR',       qty: 1,   buyPrice: 8500,   curPrice: 9200,   notes: 'Perfil moderado' },
    { id: newId(), name: 'EDP Renováveis',          ticker: 'EDPR', type: 'Ação',      qty: 100, buyPrice: 14.80,  curPrice: 16.20,  notes: '' },
    { id: newId(), name: 'Obrig. Tesouro 2030',     ticker: '',     type: 'Obrigação', qty: 5,   buyPrice: 1000,   curPrice: 1045,   notes: 'OT 3.35%' },
  ];
  saveData(investments);
}

// ── Init ──────────────────────────────────────────────────────────────────────
render();
