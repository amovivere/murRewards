/* Вкладка «Журнал»: поиск, уровни, «показывать отладку», автообновление. */

import { state, $, $$, invoke, tryInvoke, toast, icons, escapeHtml, requestRefresh, navigate, menu, exitMenuItem, confirmDialog } from './bridge.js';

const filters = { search: '', level: 'all', debug: false };
let boundRoot = null;
let lastRows = [];
let loading = false;

export function renderLog(root) {
  boundRoot = root;
  root.innerHTML = logPageHtml();
  bind(root);
}

export async function refreshLog({ silent = true } = {}) {
  if (loading || state.tab !== 'log') return;
  loading = true;
  try {
    const logs = await invoke('get_logs', { limit: 400 });
    if (Array.isArray(logs)) {
      lastRows = logs;
      renderRows();
      if (!silent) toast('Журнал обновлён');
    }
  } catch {
    // ошибка уже показана тостом
  } finally {
    loading = false;
  }
}

export function syncLog(root) {
  if (state.tab === 'log' && boundRoot !== root) boundRoot = root;
}

function logPageHtml() {
  return `
    <div class="page-head">
      <div>
        <h1 class="h1">Журнал</h1>
        <div class="sub">События наград, музыки, Twitch и ошибки приложения</div>
      </div>
      <div class="head-actions">
        <button class="btn btn-secondary" id="log-open-folder">${icons.folder} Папка журнала</button>
        <button class="btn btn-ghost btn-danger-ghost" id="log-clear">${icons.trash} Очистить</button>
        <button class="btn btn-secondary" id="log-refresh">Обновить</button>
        <button class="btn btn-icon btn-ghost" id="log-menu" title="Действия">•••</button>
      </div>
    </div>
    <div class="toolbar" id="log-toolbar">
      <label class="search log-search" for="log-search">${icons.search}
        <input id="log-search" placeholder="Поиск по журналу" value="${escapeHtml(filters.search)}">
      </label>
      <div class="pills" id="log-levels">
        ${logPill('all', 'Все')}
        ${logPill('info', 'Инфо')}
        ${logPill('warn', 'Предупреждения')}
        ${logPill('error', 'Ошибки')}
      </div>
      <div class="spacer"></div>
      <label class="switch-row" title="Показывать отладочные записи">
        <input type="checkbox" id="log-debug" ${filters.debug ? 'checked' : ''}>
        <span>Отладка</span>
      </label>
      <span class="log-count" id="log-count"></span>
    </div>
    <div class="card log-card" id="log-card">
      <div class="log-list" id="log-list"></div>
    </div>`;
}

function logPill(level, label) {
  return `<button class="pill${filters.level === level ? ' active' : ''}" data-level="${level}">${escapeHtml(label)}</button>`;
}

function bind(root) {
  $('#log-refresh', root)?.addEventListener('click', () => refreshLog({ silent: false }));
  $('#log-open-folder', root)?.addEventListener('click', () =>
    invoke('open_folder', { kind: 'logs' }).catch(() => {})
  );
  $('#log-clear', root)?.addEventListener('click', () => clearLog());
  $('#log-menu', root)?.addEventListener('click', (event) => {
    menu(event.currentTarget, [
      { label: 'Очистить журнал', icon: icons.trash, onClick: () => clearLog() },
      { label: 'Открыть настройки', icon: icons.edit, onClick: () => navigate('settings') },
      exitMenuItem(),
    ]);
  });

  const search = $('#log-search', root);
  search?.addEventListener('input', () => {
    filters.search = search.value;
    applyFilters();
  });

  $$('#log-levels .pill', root).forEach((button) =>
    button.addEventListener('click', () => {
      filters.level = button.dataset.level;
      $$('#log-levels .pill', root).forEach((item) => item.classList.toggle('active', item === button));
      applyFilters();
    })
  );

  $('#log-debug', root)?.addEventListener('change', (event) => {
    filters.debug = event.target.checked;
    applyFilters();
  });
}

function renderRows() {
  const list = $('#log-list');
  if (!list) return;
  const card = $('#log-card');
  const wasTop = !card || card.scrollTop < 40;
  const previous = card?.scrollTop || 0;
  list.innerHTML = lastRows.length
    ? lastRows.map(rowHtml).join('')
    : '<div class="log-empty">Пока записей нет</div>';
  applyFilters();
  if (card) card.scrollTop = wasTop ? 0 : previous;
}

async function clearLog() {
  const ok = await confirmDialog({
    title: 'Очистить журнал?',
    text: 'Текущий файл перенесётся в архив рядом с журналом (logs/archive-*.log), после чего журнал начнётся заново.',
    confirmLabel: 'Очистить',
    danger: true,
  });
  if (!ok) return;
  try {
    const archive = await invoke('clear_log');
    lastRows = [];
    renderRows();
    await refreshLog({ silent: true });
    toast(archive ? `Журнал очищен, архив: ${archive}` : 'Журнал очищен');
  } catch {}
}

function rowHtml(entry) {
  const level = String(entry.level || '').toUpperCase();
  const levelLower = level.toLowerCase();
  return `<div class="log-row" data-level="${escapeHtml(levelLower)}" data-search="${escapeHtml(
    `${entry.time} ${entry.message} ${level}`.toLowerCase()
  )}">
    <span class="log-time">${escapeHtml(entry.time)}</span>
    <span class="log-level log-level-${escapeHtml(levelLower)}">${escapeHtml(levelLabel(level))}</span>
    <span class="log-message">${escapeHtml(entry.message)}</span>
  </div>`;
}

function levelLabel(level) {
  return (
    {
      ERROR: 'ошибка',
      WARN: 'предупреждение',
      INFO: 'инфо',
      DEBUG: 'отладка',
      TRACE: 'трассировка',
    }[level] || level.toLowerCase()
  );
}

function applyFilters() {
  const list = $('#log-list');
  if (!list) return;
  const query = filters.search.trim().toLowerCase();
  let visible = 0;
  $$('.log-row', list).forEach((row) => {
    const level = row.dataset.level;
    let show = true;
    if (!filters.debug && (level === 'debug' || level === 'trace')) show = false;
    if (show && filters.level === 'info') show = level === 'info';
    else if (show && filters.level === 'warn') show = level === 'warn' || level === 'error';
    else if (show && filters.level === 'error') show = level === 'error';
    if (show && query) show = row.dataset.search.includes(query);
    row.hidden = !show;
    if (show) visible += 1;
  });
  const count = $('#log-count');
  if (count) count.textContent = `Записей: ${visible}`;
  const empty = list.querySelector('.log-empty');
  if (empty) empty.hidden = visible > 0;
  if (!list.querySelector('.log-row')) {
    if (!list.querySelector('.log-empty')) {
      list.innerHTML = '<div class="log-empty">Под этот фильтр записей нет</div>';
    } else {
      const node = list.querySelector('.log-empty');
      node.textContent = 'Под этот фильтр записей нет';
      node.hidden = false;
    }
  }
}

export function resetLogScroll() {
  const card = $('#log-card');
  if (card) card.scrollTop = card.scrollHeight;
}
