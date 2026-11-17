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

/* ---------- тосты в футере (старый «footer-text» остаётся каналом) ---------- */

let toastTimer = null;
let toastKind = '';
export function toast(text, kind = 'info', timeout) {
  const el = $('#footer-text');
  if (!el) return;
  el.textContent = text;
  toastKind = kind;
  document.body.dataset.toastKind = kind;
  if (toastTimer) clearTimeout(toastTimer);
  const delay = timeout ?? (kind === 'error' ? 9000 : kind === 'warn' ? 7000 : 4500);
  if (delay > 0) {
    toastTimer = setTimeout(() => {
      el.textContent = 'Готово';
      document.body.dataset.toastKind = '';
      toastTimer = null;
    }, delay);
  }
}

export function clearToast() {
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = null;
  const el = $('#footer-text');
  if (el) el.textContent = 'Готово';
  document.body.dataset.toastKind = '';
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
  pop.innerHTML = items
    .map(
      (item, index) => `
      <button class="popmenu-item${item.danger ? ' danger' : ''}" data-index="${index}">
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
  }, 0);

  function onOutside(event) {
    if (!pop.contains(event.target)) closeMenus();
  }

  function onKey(event) {
    if (event.key === 'Escape') {
      event.preventDefault();
      closeMenus();
    }
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
