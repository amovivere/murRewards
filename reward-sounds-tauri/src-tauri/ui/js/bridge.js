/* Общие помощники нового UI: мост к Tauri, состояние, тосты, модалки, меню. */

export const state = {
  view: null,
  tab: 'rewards',
  ready: false,
  // Состояние UI-фильтров переживает перерисовки
  log: { level: 'all', search: '', debug: false },
  rewards: { expandedDisabled: false, localOpen: false },
};

export const $ = (selector, root = document) => root.querySelector(selector);
export const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));

let refreshHandler = () => {};
/** Запрашивает внеочередной опрос состояния у app.js. */
export function setRefreshHandler(handler) {
  refreshHandler = handler;
}
/** Попросить app.js немедленно обновить состояние с бэкенда. */
export function requestRefresh() {
  refreshHandler();
}

let navigateHandler = () => {};
/** Регистрирует переключатель вкладок (реализован в app.js). */
export function setNavigateHandler(handler) {
  navigateHandler = handler;
}
/** Переключить вкладку из любого экрана. */
export function navigate(tab) {
  navigateHandler(tab);
}

/* ---------- слайдеры ---------- */

export function paintSlider(slider, fraction) {
  const value = Math.max(0, Math.min(1, Number(fraction) || 0));
  const fill = slider.querySelector('.fill');
  const knob = slider.querySelector('.knob');
  if (fill) fill.style.width = `${(value * 100).toFixed(2)}%`;
  if (knob) knob.style.left = `${(value * 100).toFixed(2)}%`;
  return value;
}

export function sliderFraction(slider) {
  const knob = slider.querySelector('.knob');
  const fill = slider.querySelector('.fill');
  let fraction = 0.3;
  if (knob && knob.style.left) fraction = parseFloat(knob.style.left) / 100;
  else if (fill && fill.style.width) fraction = parseFloat(fill.style.width) / 100;
  if (!Number.isFinite(fraction)) fraction = 0.3;
  return Math.max(0, Math.min(1, fraction));
}

/** Подключает pointer/клавиатуру к разметке .slider. */
export function bindSlider(slider, { onChange = () => {}, onCommit = () => {}, step = 0.02 } = {}) {
  if (!slider || slider.dataset.bound) return;
  slider.dataset.bound = '1';
  if (!slider.hasAttribute('tabindex')) slider.tabIndex = 0;
  if (!slider.hasAttribute('role')) slider.setAttribute('role', 'slider');
  if (!slider.hasAttribute('aria-label')) slider.setAttribute('aria-label', 'Значение');
  let fraction = sliderFraction(slider);
  paintSlider(slider, fraction);
  slider.setAttribute('aria-valuenow', String(Math.round(fraction * 100)));

  const update = (event) => {
    const rect = slider.getBoundingClientRect();
    fraction = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width));
    paintSlider(slider, fraction);
    slider.setAttribute('aria-valuenow', String(Math.round(fraction * 100)));
    onChange(fraction);
  };

  slider.addEventListener('pointerdown', (event) => {
    event.preventDefault();
    slider.setPointerCapture?.(event.pointerId);
    slider.classList.add('dragging');
    update(event);
    const move = (ev) => update(ev);
    const up = (ev) => {
      slider.classList.remove('dragging');
      slider.removeEventListener('pointermove', move);
      slider.removeEventListener('pointerup', up);
      slider.removeEventListener('pointercancel', up);
      update(ev);
      onCommit(fraction);
    };
    slider.addEventListener('pointermove', move);
    slider.addEventListener('pointerup', up);
    slider.addEventListener('pointercancel', up);
  });

  slider.addEventListener('keydown', (event) => {
    const delta = event.shiftKey ? 0.1 : step;
    if (event.key === 'ArrowLeft' || event.key === 'ArrowDown') fraction -= delta;
    else if (event.key === 'ArrowRight' || event.key === 'ArrowUp') fraction += delta;
    else return;
    event.preventDefault();
    fraction = Math.max(0, Math.min(1, fraction));
    paintSlider(slider, fraction);
    slider.setAttribute('aria-valuenow', String(Math.round(fraction * 100)));
    onChange(fraction);
    onCommit(fraction);
  });
}

export function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

export function pluralRu(n, one, few, many) {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return one;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return few;
  return many;
}

export function fmtDuration(seconds) {
  const value = Math.max(0, Math.floor(Number(seconds) || 0));
  return `${Math.floor(value / 60)}:${String(value % 60).padStart(2, '0')}`;
}

export function fmtPercent(value) {
  return `${Math.round((Number(value) || 0) * 100)}%`;
}

/* ---------- стек тостов (ошибки не исчезают сами) ---------- */

let toastHost = null;

function ensureToastHost() {
  if (toastHost && toastHost.isConnected) return toastHost;
  toastHost = document.createElement('div');
  toastHost.id = 'toast-stack';
  toastHost.className = 'toast-stack';
  toastHost.setAttribute('aria-live', 'polite');
  document.body.appendChild(toastHost);
  return toastHost;
}

function toastTitle(kind) {
  return (
    { error: 'Ошибка', warn: 'Внимание', success: 'Готово', info: 'Сообщение' }[kind] || 'Сообщение'
  );
}

function toastIcon(kind) {
  if (kind === 'error') return icons.warning;
  if (kind === 'warn') return icons.warning;
  if (kind === 'success') return icons.check;
  return icons.external;
}

/**
 * Тост справа снизу. Ошибки — липкие, с действием «Журнал» и текстом
 * на русском; успех и подсказки исчезают сами.
 */
export function toast(text, kind = 'info', timeoutOrOptions) {
  const options = typeof timeoutOrOptions === 'object' && timeoutOrOptions !== null
    ? timeoutOrOptions
    : { timeout: timeoutOrOptions };
  const host = ensureToastHost();
  const message = String(text ?? '').trim();
  if (!message) return null;
  const display = kind === 'error' ? friendlyError(message) : message;

  // Дубликаты не плодим: обновляем существующий тост и продлеваем ему жизнь.
  const duplicate = Array.from(host.children).find(
    (node) => node.dataset.message === display && node.dataset.kind === kind
  );
  if (duplicate) {
    const count = Number(duplicate.dataset.count || '1') + 1;
    duplicate.dataset.count = String(count);
    const countNode = duplicate.querySelector('.toast-count');
    if (countNode) countNode.textContent = `×${count}`;
    else duplicate.querySelector('.toast-title')?.insertAdjacentHTML('beforeend', ` <span class="toast-count">×${count}</span>`);
    if (duplicate._timer) clearTimeout(duplicate._timer);
    scheduleHide(duplicate, kind, options);
    return duplicate;
  }

  while (host.children.length >= 3) host.firstElementChild.remove();

  const node = document.createElement('div');
  node.className = `toast toast-${kind}`;
  node.setAttribute('role', kind === 'error' ? 'alert' : 'status');
  node.dataset.message = display;
  node.dataset.kind = kind;
  const actions = Array.isArray(options.actions)
    ? options.actions
    : kind === 'error'
      ? [{ label: 'Журнал', onClick: () => navigate('log') }]
      : [];
  node.innerHTML = `
    <span class="toast-icon">${toastIcon(kind)}</span>
    <div class="toast-body">
      <div class="toast-title">${escapeHtml(options.title || toastTitle(kind))}</div>
      <div class="toast-text">${escapeHtml(display)}</div>
      ${actions.length ? `<div class="toast-actions">${actions
        .map((action, index) => `<button class="toast-action" data-action="${index}">${escapeHtml(action.label)}</button>`)
        .join('')}</div>` : ''}
    </div>
    <button class="toast-close" title="Закрыть" aria-label="Закрыть">${icons.close}</button>`;
  host.appendChild(node);

  node.querySelector('.toast-close').addEventListener('click', () => node.remove());
  node.querySelectorAll('.toast-action').forEach((button) =>
    button.addEventListener('click', () => {
      actions[Number(button.dataset.action)]?.onClick?.();
      node.remove();
    })
  );
  scheduleHide(node, kind, options);
  return node;
}

function scheduleHide(node, kind, options) {
  const delay = options.timeout ?? (kind === 'error' ? 0 : kind === 'warn' ? 7000 : 4200);
  if (delay > 0) {
    node._timer = setTimeout(() => node.remove(), delay);
  }
}

export function clearToast() {
  ensureToastHost().replaceChildren();
}

/** Переводит частые английские ошибки ядра в человеческий русский. */
export function friendlyError(message) {
  const text = String(message ?? '').trim();
  if (!text) return 'Не удалось выполнить действие. Подробности — в журнале.';
  const rules = [
    [/command .*not found|unknown command/i, 'Внутренняя команда недоступна. Откройте журнал или обновите приложение.'],
    [/error sending request|dns error|connection (refused|reset)|network|timed? ?out|timeout|os error 100/i, 'Нет связи с Twitch. Проверьте интернет и повторите попытку.'],
    [/401|unauthorized|invalid.*token|token.*(invalid|expired)/i, 'Twitch отклонил вход — переподключите аккаунт в настройках.'],
    [/403|forbidden|scope|permission/i, 'Не хватает прав Twitch — переподключите аккаунт, чтобы выдать нужные права.'],
    [/404|not found|no such file|os error 2/i, 'Не найдено. Возможно, объект уже удалён или файл перемещён.'],
    [/500|502|503|504|internal server error/i, 'Twitch временно недоступен. Повторите попытку позже.'],
    [/5[0-9][0-9] /, 'Сервис временно недоступен. Повторите попытку позже.'],
    [/unsupported|not supported|invalid format/i, 'Формат не поддерживается.'],
  ];
  for (const [pattern, replacement] of rules) {
    if (pattern.test(text)) return replacement;
  }
  // Уже русский текст показываем как есть.
  if (/[А-Яа-яЁё]/.test(text)) return text;
  return 'Не удалось выполнить действие. Подробности — в журнале.';
}


/* ---------- акцентный цвет интерфейса ---------- */

export const DEFAULT_ACCENT = '#8B00FF';
/// Пресеты акцента; проверены по контрасту и применяются без автокоррекции.
export const ACCENT_PRESETS = [
  '#8B00FF',
  '#5B5FE0',
  '#3B82F6',
  '#06B6D4',
  '#14B8A6',
  '#22C55E',
  '#EC4899',
  '#A3A3A3',
];

function isApprovedAccent(hex) {
  return ACCENT_PRESETS.some((color) => color.toLowerCase() === hex.toLowerCase());
}

function hexToRgb(hex) {
  const value = parseInt(hex.slice(1), 16);
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
}

function rgbToHsl([r, g, b]) {
  const [rr, gg, bb] = [r / 255, g / 255, b / 255];
  const max = Math.max(rr, gg, bb);
  const min = Math.min(rr, gg, bb);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h;
  if (max === rr) h = ((gg - bb) / d + (gg < bb ? 6 : 0)) / 6;
  else if (max === gg) h = ((bb - rr) / d + 2) / 6;
  else h = ((rr - gg) / d + 4) / 6;
  return [h, s, l];
}

function hslToHex([h, s, l]) {
  if (s === 0) {
    const gray = Math.round(l * 255);
    return `#${[gray, gray, gray].map((v) => v.toString(16).padStart(2, '0')).join('').toUpperCase()}`;
  }
  const hue = (p, q, t) => {
    let tt = t;
    if (tt < 0) tt += 1;
    if (tt > 1) tt -= 1;
    if (tt < 1 / 6) return p + (q - p) * 6 * tt;
    if (tt < 1 / 2) return q;
    if (tt < 2 / 3) return p + (q - p) * (2 / 3 - tt) * 6;
    return p;
  };
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const rgb = [hue(p, q, h + 1 / 3), hue(p, q, h), hue(p, q, h - 1 / 3)].map((v) =>
    Math.round(v * 255)
  );
  return `#${rgb.map((v) => v.toString(16).padStart(2, '0')).join('').toUpperCase()}`;
}

function relativeLuminance(hex) {
  return hexToRgb(hex)
    .map((channel) => {
      const c = channel / 255;
      return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
    })
    .reduce((acc, value, index) => acc + value * [0.2126, 0.7152, 0.0722][index], 0);
}

function contrastRatio(a, b) {
  const [l1, l2] = [relativeLuminance(a), relativeLuminance(b)].sort((x, y) => y - x);
  return (l1 + 0.05) / (l2 + 0.05);
}

/**
 * Приводит произвольный цвет к безопасному для тёмного интерфейса:
 * ограничивает светлоту, насыщенность и проверяет контраст мягкого текста.
 * Возвращает { hex, adjusted }.
 */
export function normalizeAccent(input) {
  const raw = String(input || '').trim();
  if (!/^#[0-9a-f]{6}$/i.test(raw)) return null;
  if (isApprovedAccent(raw)) return { hex: raw.toUpperCase(), adjusted: false };
  const [hue, saturation, lightness] = rgbToHsl(hexToRgb(raw));
  const neutral = saturation < 0.12;
  let s = neutral ? saturation : Math.max(0.35, Math.min(0.9, saturation));
  let l = Math.max(0.42, Math.min(0.68, lightness));
  let hex = hslToHex([hue, s, l]);

  // Мягкий текст (45 % белого) должен читаться на фоне #0A0A0A.
  let soft = hslToHex([hue, s, Math.min(0.9, Math.max(l, 0.55))]);
  for (let attempt = 0; attempt < 12 && contrastRatio(soft, '#0A0A0A') < 4.5; attempt += 1) {
    l = Math.min(0.85, l + 0.03);
    hex = hslToHex([hue, s, l]);
    soft = hslToHex([hue, s, Math.min(0.9, l + 0.1)]);
  }
  const adjusted =
    Math.abs(l - lightness) > 0.015 ||
    (!neutral && Math.abs(s - saturation) > 0.015) ||
    hex.toLowerCase() !== raw.toLowerCase();
  return { hex, adjusted };
}

/** Текст поверх акцентной заливки: тёмный на светлом, белый на тёмном. */
export function accentInk(color) {
  const normalized = normalizeAccent(color) || normalizeAccent(DEFAULT_ACCENT);
  return contrastRatio(normalized.hex, '#0A0A0A') >= contrastRatio(normalized.hex, '#FFFFFF') ? '#0A0A0A' : '#FFFFFF';
}

/** Немедленно применяет акцент ко всему интерфейсу и кэширует его. */
export function applyAccent(color) {
  const normalized = normalizeAccent(color) || normalizeAccent(DEFAULT_ACCENT);
  const root = document.documentElement;
  root.style.setProperty('--accent', normalized.hex);
  root.style.setProperty('--accent-rgb', hexToRgb(normalized.hex).join(', '));
  try {
    localStorage.setItem('rs.accent', normalized.hex);
  } catch {}
  return normalized;
}

/** Кэш акцента до первого опроса состояния: без вспышки чужого цвета. */
export function applyCachedAccent() {
  try {
    applyAccent(localStorage.getItem('rs.accent') || DEFAULT_ACCENT);
  } catch {
    applyAccent(DEFAULT_ACCENT);
  }
}

/* ---------- мост к Tauri ---------- */

export function tauriCore() {
  return window.__TAURI__ && window.__TAURI__.core ? window.__TAURI__.core : null;
}

export function tauriWindow() {
  const api = window.__TAURI__ && window.__TAURI__.window;
  return api && typeof api.getCurrentWindow === 'function' ? api.getCurrentWindow() : null;
}

/**
 * Вызов команды Tauri. Ошибка показывается тостом и пробрасывается:
 * вызывающий код должен проверить результат, прежде чем писать «успех».
 */
export async function invoke(command, args) {
  const core = tauriCore();
  if (!core) {
    throw new Error('Нет соединения с приложением (демо-режим браузера).');
  }
  try {
    return await core.invoke(command, args);
  } catch (error) {
    const message = normalizeError(error);
    console.error(`invoke ${command} failed`, error);
    toast(message, 'error');
    const wrapped = new Error(message);
    wrapped.toasted = true;
    throw wrapped;
  }
}

/** Вызов команды без проброса ошибки: ошибка уже показана тостом. */
export async function tryInvoke(command, args) {
  try {
    return await invoke(command, args);
  } catch {
    return null;
  }
}

function normalizeError(error) {
  if (typeof error === 'string') return error;
  if (error && typeof error.message === 'string') return error.message;
  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
}

/* ---------- модальные окна ---------- */

const openModals = [];

export function createModal({ className = 'modal', html = '', scrimClass = 'modal-scrim', onClose } = {}) {
  const scrim = document.createElement('div');
  scrim.className = scrimClass;
  scrim.innerHTML = `<div class="${className}" role="dialog" aria-modal="true">${html}</div>`;
  document.body.appendChild(scrim);
  const dialog = scrim.firstElementChild;
  const titleNode = scrim.querySelector('.modal-title');
  if (titleNode) {
    titleNode.id = titleNode.id || `modal-title-${Math.random().toString(36).slice(2, 8)}`;
    dialog.setAttribute('aria-labelledby', titleNode.id);
  } else {
    dialog.setAttribute('aria-label', 'Диалог');
  }

  const entry = { scrim, onClose, previousFocus: document.activeElement };
  openModals.push(entry);
  document.addEventListener('keydown', onKey);

  function close() {
    if (!scrim.isConnected) return;
    scrim.remove();
    const index = openModals.indexOf(entry);
    if (index >= 0) openModals.splice(index, 1);
    if (openModals.length === 0) document.removeEventListener('keydown', onKey);
    if (entry.previousFocus && typeof entry.previousFocus.focus === 'function') {
      try {
        entry.previousFocus.focus();
      } catch {}
    }
    onClose?.();
  }

  function onKey(event) {
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      close();
      return;
    }
    // Простой focus-trap: Tab не уходит за пределы модального окна.
    if (event.key !== 'Tab') return;
    const focusable = Array.from(
      scrim.querySelectorAll('button, input, select, textarea, [tabindex]:not([tabindex="-1"])')
    ).filter((element) => !element.disabled && element.offsetParent !== null);
    if (focusable.length === 0) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  scrim.addEventListener('mousedown', (event) => {
    if (event.target === scrim) close();
  });

  const focusTarget =
    scrim.querySelector('[data-autofocus]') ||
    scrim.querySelector('input, select, textarea, button');
  if (focusTarget) setTimeout(() => focusTarget.focus(), 30);

  return { scrim, close, root: scrim.firstElementChild };
}

/** Модальное подтверждение. Возвращает Promise<boolean>. */
export function confirmDialog({ title, text, confirmLabel = 'Подтвердить', cancelLabel = 'Отмена', danger = false }) {
  return new Promise((resolve) => {
    let done = false;
    const finish = (value) => {
      if (done) return;
      done = true;
      modal.close();
      resolve(value);
    };
    const modal = createModal({
      html: `
        <div class="modal-head">
          <div class="modal-title">${escapeHtml(title)}</div>
          <button class="modal-close" data-act="cancel" aria-label="Закрыть">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>
          </button>
        </div>
        ${text ? `<div class="modal-sub">${escapeHtml(text)}</div>` : ''}
        <div class="modal-actions">
          <div class="right">
            <button class="btn btn-secondary" data-act="cancel" data-autofocus>${escapeHtml(cancelLabel)}</button>
            <button class="btn ${danger ? 'btn-danger' : 'btn-primary'}" data-act="confirm">${escapeHtml(confirmLabel)}</button>
          </div>
        </div>`,
      onClose: () => finish(false),
    });
    modal.root.querySelectorAll('[data-act="cancel"]').forEach((button) =>
      button.addEventListener('click', () => finish(false))
    );
    modal.root.querySelector('[data-act="confirm"]').addEventListener('click', () => finish(true));
  });
}

/* ---------- всплывающие меню ---------- */

export function menu(anchor, items) {
  closeMenus();
  const pop = document.createElement('div');
  pop.className = 'popmenu';
  pop.setAttribute('role', 'menu');
  pop.innerHTML = items
    .map(
      (item, index) => `
      <button class="popmenu-item${item.danger ? ' danger' : ''}" role="menuitem" data-index="${index}">
        ${item.icon ? `<span class="popmenu-icon">${item.icon}</span>` : ''}<span>${escapeHtml(item.label)}</span>
      </button>`
    )
    .join('');
  document.body.appendChild(pop);
  const rect = anchor.getBoundingClientRect();
  const width = pop.offsetWidth || 210;
  const height = pop.offsetHeight || items.length * 34;
  let left = rect.right - width;
  let top = rect.bottom + 6;
  if (left < 8) left = 8;
  if (top + height > window.innerHeight - 8) top = Math.max(8, rect.top - height - 6);
  pop.style.left = `${Math.round(left)}px`;
  pop.style.top = `${Math.round(top)}px`;

  pop.addEventListener('click', (event) => {
    const button = event.target.closest('.popmenu-item');
    if (!button) return;
    const item = items[Number(button.dataset.index)];
    closeMenus();
    item.onClick?.();
  });

  setTimeout(() => {
    document.addEventListener('mousedown', onOutside, true);
    document.addEventListener('keydown', onKey, true);
    pop.querySelector('.popmenu-item')?.focus();
  }, 0);

  function onOutside(event) {
    if (!pop.contains(event.target)) closeMenus();
  }

  function onKey(event) {
    if (event.key === 'Escape') {
      event.preventDefault();
      closeMenus();
      anchor.focus?.();
      return;
    }
    if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
    const buttons = Array.from(pop.querySelectorAll('.popmenu-item'));
    if (!buttons.length) return;
    event.preventDefault();
    const current = buttons.indexOf(document.activeElement);
    let next = current;
    if (event.key === 'ArrowDown') next = (current + 1) % buttons.length;
    else if (event.key === 'ArrowUp') next = (current - 1 + buttons.length) % buttons.length;
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = buttons.length - 1;
    buttons[next]?.focus();
  }

  function close() {
    document.removeEventListener('mousedown', onOutside, true);
    document.removeEventListener('keydown', onKey, true);
    pop.remove();
  }
  pop._close = close;
  return { close };
}

export function closeMenus() {
  document.querySelectorAll('.popmenu').forEach((pop) => pop._close?.());
}

/* ---------- поповеры произвольного вида ---------- */

let openPopover = null;

/** Открывает поповер с произвольным HTML, привязанный к элементу. */
export function popover(anchor, html, { className = '', onMount } = {}) {
  closePopover();
  const node = document.createElement('div');
  node.className = `popover ${className}`.trim();
  node.innerHTML = html;
  document.body.appendChild(node);
  const rect = anchor.getBoundingClientRect();
  const width = node.offsetWidth || 320;
  const height = node.offsetHeight || 240;
  let left = Math.min(rect.right - width, window.innerWidth - width - 10);
  left = Math.max(10, left);
  let top = rect.bottom + 8;
  if (top + height > window.innerHeight - 10) top = Math.max(10, rect.top - height - 8);
  node.style.left = `${Math.round(left)}px`;
  node.style.top = `${Math.round(top)}px`;

  const onOutside = (event) => {
    if (!node.contains(event.target) && !anchor.contains(event.target)) close();
  };
  const onKey = (event) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      close();
    }
  };
  function close() {
    document.removeEventListener('mousedown', onOutside, true);
    document.removeEventListener('keydown', onKey, true);
    node.remove();
    if (openPopover === entry) openPopover = null;
  }
  setTimeout(() => {
    document.addEventListener('mousedown', onOutside, true);
    document.addEventListener('keydown', onKey, true);
  }, 0);
  const entry = { node, close };
  openPopover = entry;
  onMount?.(node, close);
  return entry;
}

export function closePopover() {
  openPopover?.close();
  openPopover = null;
}

/** Пункт меню «Завершить работу…»: выход только с подтверждением. */
export function exitMenuItem() {
  return {
    label: 'Завершить работу…',
    icon: icons.external,
    danger: true,
    onClick: () => {
      confirmDialog({
        title: 'Выйти из Reward Sounds?',
        text: 'Звуки наград, музыка и чат перестанут работать до следующего запуска. Свернуть в трей можно кнопкой окна.',
        confirmLabel: 'Выйти',
        danger: true,
      }).then((confirmed) => {
        if (confirmed) invoke('exit_app').catch(() => {});
      });
    },
  };
}

/** Текст диагностики для «Скопировать диагностику» (статус-хаб и настройки). */
export function diagnosticsText(view) {
  const items = view?.health || [];
  const stateLabel = (state) =>
    ({ ok: 'работает', warn: 'внимание', error: 'ошибка', off: 'выключено' })[state] || state;
  return [
    `Reward Sounds ${view?.version || ''}`,
    `Twitch: ${view?.connected ? `подключено @${view.login}` : 'не подключено'}`,
    ...items.map((item) => `${item.title}: ${stateLabel(item.state)} — ${item.detail}`),
    `Звук: ${view?.audio_ready ? view.audio_device || 'устройство по умолчанию' : 'нет аудиовыхода'}`,
    `Данные: ${view?.data_dir || '—'}`,
    `Журнал: ${view?.log_file || '—'}`,
  ].join('\n');
}

/* ---------- иконки ---------- */

export const icons = {
  play: '<svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor" stroke="none"><path d="M8 5v14l11-7z"/></svg>',
  pause:
    '<svg width="12" height="12" viewBox="0 0 12 12"><rect x="2" y="1.5" width="3" height="9" rx="1" fill="currentColor"/><rect x="7" y="1.5" width="3" height="9" rx="1" fill="currentColor"/></svg>',
  refresh:
    '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M20 11a8 8 0 1 0-2.3 6"/><path d="M20 4v7h-7"/></svg>',
  stop: '<svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" stroke="none"><rect x="6" y="6" width="12" height="12" rx="2.5"/></svg>',
  plus: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>',
  dots: '<span aria-hidden="true">•••</span>',
  copy:
    '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V6a2 2 0 0 1 2-2h9"/></svg>',
  close:
    '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>',
  chevron: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M9 6l6 6-6 6"/></svg>',
  search:
    '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.6-3.6"/></svg>',
  external:
    '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M14 4h6v6"/><path d="M20 4l-8 8"/><path d="M18 13v6a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h6"/></svg>',
  folder:
    '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg>',
  edit:
    '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20h4L20 8l-4-4L4 16z"/></svg>',
  trash:
    '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h16M9 7V5h6v2M6 7l1 13h10l1-13"/></svg>',
  check:
    '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12l5 5L20 6"/></svg>',
  warning:
    '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 4l9 16H3z"/><path d="M12 10v4M12 17h.01"/></svg>',
};

/* ---------- мелочи ---------- */

/** Безопасно вставляет HTML в контейнер. */
export function setHtml(selector, html, root = document) {
  const node = $(selector, root);
  if (node) node.innerHTML = html;
  return node;
}

/** Склеивает HTML-строку из массива с фильтрацией пустых. */
export function joinHtml(parts) {
  return parts.filter(Boolean).join('');
}

export function textOr(value, fallback = '—') {
  const text = String(value ?? '').trim();
  return text || fallback;
}
