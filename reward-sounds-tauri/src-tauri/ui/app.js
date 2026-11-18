/* Точка входа Tauri-интерфейса: каркас, навигация, опрос состояния. */

import {
  state,
  $,
  $$,
  invoke,
  tryInvoke,
  toast,
  icons,
  escapeHtml,
  fmtDuration,
  bindSlider,
  paintSlider,
  popover,
  closePopover,
  diagnosticsText,
  applyAccent,
  applyCachedAccent,
  DEFAULT_ACCENT,
  setRefreshHandler,
  setNavigateHandler,
  tauriWindow,
} from './js/bridge.js';
import { renderRewards, syncRewards } from './js/rewards.js';
import { renderMusic, syncMusic, tickPlayer } from './js/music.js';
import { renderSettings, syncSettings } from './js/settings.js';
import { renderLog, refreshLog, syncLog } from './js/log.js';
import { renderOnboarding, syncOnboarding } from './js/onboarding.js';
import { renderChat, syncChat } from './js/chat.js';

const content = () => $('#content');
let pollTimer = null;
let pollInFlight = false;
let logTimer = null;
let chromeReady = false;
let lastConnected = null;

/* ============================ запуск ============================ */

function init() {
  bindWindowControls();
  bindNavigation();
  bindTopbar();
  setRefreshHandler(pollNow);
  setNavigateHandler(switchTab);
  installErrorHandlers();
  applyCachedAccent();
  window.RS = {
    state,
    render: switchTab,
    pollNow,
    view: () => state.view,
    api: { invoke, tryInvoke },
    // Хук для UI-тестов/скриншотов с мок-состоянием: ставит опрос на паузу.
    pausePolling: (paused) => {
      window.__RS_PAUSE_POLL__ = !!paused;
    },
  };

  pollNow();
  pollTimer = setInterval(pollNow, 1500);
  requestAnimationFrame(frameLoop);
  startLogTimer();
}

async function pollNow() {
  if (window.__RS_PAUSE_POLL__) return;
  if (pollInFlight) return;
  pollInFlight = true;
  try {
    const view = await tryInvoke('get_state');
    if (view) {
      applyView(view);
    } else if (!state.ready) {
      renderDisconnected();
    }
  } finally {
    pollInFlight = false;
  }
}

function applyView(view) {
  const first = !state.ready;
  state.view = view;
  state.ready = true;
  updateChrome(view);
  const connected = !!view.connected;
  const connectionChanged = lastConnected !== null && lastConnected !== connected;
  lastConnected = connected;

  const tab = state.tab;
  if (first) {
    renderTab(initialTab());
    return;
  }
  if (connectionChanged && tab === 'rewards') {
    renderTab('rewards');
    return;
  }
  const root = content();
  if (!root) return;
  if (tab === 'rewards') {
    if (!connected) syncOnboarding(root, view);
    else syncRewards(root, view);
  } else if (tab === 'onboarding') {
    syncOnboarding(root, view);
  } else if (tab === 'music') {
    syncMusic(root, view);
  } else if (tab === 'chat') {
    syncChat(root, view);
  } else if (tab === 'overlay') {
    // Страница настроек оверлея живёт на локальном сервере и открывается как iframe.
  } else if (tab === 'settings') {
    syncSettings(root, view);
  } else if (tab === 'log') {
    syncLog(root);
  }
}

function initialTab() {
  const params = new URLSearchParams(location.search);
  const screen = params.get('screen');
  if (screen && ['rewards', 'music', 'chat', 'overlay', 'settings', 'log', 'onboarding'].includes(screen)) return screen;
  return 'rewards';
}

/* ============================ навигация ============================ */

function bindNavigation() {
  $$('.nav-item').forEach((item) =>
    item.addEventListener('click', () => switchTab(item.dataset.tab))
  );
}

function switchTab(tab) {
  if (tab === 'onboarding') {
    state.tab = 'onboarding';
    updateNav('onboarding');
    const root = content();
    renderOnboarding(root, state.view || emptyView());
    return;
  }
  if (state.tab === tab && content()?.dataset.rendered === tab) return;
  state.tab = tab;
  renderTab(tab);
}

function renderTab(tab) {  const root = content();
  if (!root) return;
  root.dataset.rendered = tab;
  updateNav(tab);
  const view = state.view || emptyView();
  if (tab === 'rewards') {
    if (!view.connected) renderOnboarding(root, view);
    else renderRewards(root, view);
  } else if (tab === 'music') {
    renderMusic(root, view);
  } else if (tab === 'chat') {
    renderChat(root, view);
  } else if (tab === 'overlay') {
    renderOverlay(root);
  } else if (tab === 'settings') {
    renderSettings(root, view);
  } else if (tab === 'log') {
    renderLog(root);
    refreshLog({ silent: true });
  } else if (tab === 'onboarding') {
    renderOnboarding(root, view);
  }
  updateChrome(view);
}

function updateNav(tab) {
  const navTab = tab === 'onboarding' ? 'rewards' : tab;
  $$('.nav-item').forEach((item) => item.classList.toggle('active', item.dataset.tab === navTab));
}

function emptyView() {
  return {
    connected: false,
    login: '',
    display_name: '',
    version: '—',
    volume: 0.8,
    muted: false,
    audio_ready: false,
    audio_device: null,
    audio_error: null,
    rewards: [],
    rewards_loading: false,
    rewards_error: null,
    bindings: 0,
    local_bindings: [],
    playing: [],
    chat_ready: false,
    eventsub: 'stopped',
    eventsub_error: null,
    grid_view: true,
    normalizing: false,
    normalize_message: null,
    music: { enabled: false, ready: false, items: [], current: null, player: {}, volume: 0, reward_title: '', reward_cost: 0, reward_id: '', max_queue: 0, max_duration_sec: 0, overlay_seconds: 0, overlay_font: 17, overlay_position: 'top' },
    auth: { state: 'idle' },
    client_id: '',
    autostart: false,
    close_to_tray: true,
    start_minimized: false,
    playback_enabled: true,
    data_dir: '',
    log_file: '',
    health: [],
    chat: {
      enabled: false,
      connected: false,
      read_only: false,
      error: null,
      login: '',
      messages: [],
      overlay_url: 'http://127.0.0.1:8770/chat',
      overlay_theme: 'dark',
      overlay_opacity: 60,
      overlay_font: 16,
      overlay_seconds: 0,
      commands: { queue: true, song: true, skip: true, sound: true },
    },
  };
}

function renderOverlay(root) {
  root.innerHTML = `
    <div class="overlay-settings-wrap">
      <iframe class="overlay-settings-frame" src="http://127.0.0.1:8770/chat-overlay/config" title="Настройки оверлея чата"></iframe>
    </div>`;
}

function renderDisconnected() {  const root = content();
  if (!root) return;
  root.dataset.rendered = 'error';
  root.innerHTML = `
    <div class="card error-card">
      <div class="section-title">Нет связи с приложением</div>
      <div class="settings-row-hint">Интерфейс не смог получить состояние у Tauri-бэкенда. Попробуйте обновить окно.</div>
      <div class="settings-actions"><button class="btn btn-primary" id="retry-connection">Повторить</button></div>
    </div>`;
  $('#retry-connection', root)?.addEventListener('click', () => pollNow());
}

/* ============================ шапка, сайдбар, футер ============================ */

function healthSummary(view) {
  const items = view?.health || [];
  const errors = items.filter((item) => item.state === 'error').length;
  const warns = items.filter((item) => item.state === 'warn').length;
  const problems = errors + warns;
  const overall = errors > 0 ? 'error' : warns > 0 ? 'warn' : 'ok';
  return { items, errors, warns, problems, overall };
}

function healthChipText(summary) {
  if (summary.errors > 0) {
    return summary.errors === 1 ? 'Есть проблема' : `Проблем: ${summary.errors}`;
  }
  if (summary.warns > 0) {
    return summary.warns === 1 ? 'Есть замечание' : `Замечаний: ${summary.warns}`;
  }
  return 'Все системы работают';
}

function healthDotClass(state) {
  if (state === 'ok') return 'dot-green';
  if (state === 'warn') return 'dot-amber';
  if (state === 'error') return 'dot-red';
  return 'dot-muted';
}

function updateChrome(view) {
  document.body.classList.toggle('offline', !view.connected);
  document.body.classList.toggle('muted', !!view.muted);
  applyAccent(view.accent || DEFAULT_ACCENT);

  const summary = healthSummary(view);
  const chip = $('#health-chip');
  if (chip) {
    chip.dataset.state = summary.overall;
    chip.title = summary.problems ? 'Есть проблемы — открыть статус систем' : 'Все системы работают';
    const dot = $('#health-dot', chip);
    if (dot) dot.className = `dot ${healthDotClass(summary.overall)}`;
    const text = $('#health-text', chip);
    if (text) text.textContent = healthChipText(summary);
  }

  const volumeValue = $('#top-volume-value');
  if (volumeValue) volumeValue.textContent = `${Math.round((Number(view.volume) || 0) * 100)}%`;
  const volumeSlider = $('#top-volume');
  if (volumeSlider) paintSlider(volumeSlider, Number(view.volume) || 0);

  const mute = $('#mute-toggle');
  if (mute) {
    mute.classList.toggle('active', !!view.muted);
    mute.title = view.muted ? 'Включить звук' : 'Без звука';
    mute.innerHTML = view.muted ? muteIcon() : soundIcon();
  }

  const playing = (view.playing || []).length;
  const playingNode = $('#playing-indicator');
  if (playingNode) {
    playingNode.hidden = playing === 0;
    playingNode.textContent = `■ ${playing} звучит`;
    playingNode.title = 'Остановить все звуки';
  }

  const versionText = `версия ${view.version || '—'}`;
  const footerVersion = $('#footer-version');
  if (footerVersion) footerVersion.textContent = versionText;
  chromeReady = true;
}

function openHealthPopover(anchor) {
  const view = state.view || emptyView();
  const summary = healthSummary(view);
  const rows = summary.items
    .map(
      (item) => `
      <button class="health-row" data-health-key="${escapeHtml(item.key)}" data-health-action="${escapeHtml(item.action)}">
        <span class="dot ${healthDotClass(item.state)}"></span>
        <span class="health-row-main">
          <span class="health-row-title">${escapeHtml(item.title)}</span>
          <span class="health-row-detail">${escapeHtml(item.detail)}</span>
        </span>
        <span class="health-row-state">${escapeHtml(healthStateLabel(item.state))}</span>
      </button>`
    )
    .join('');

  popover(
    anchor,
    `
    <div class="health-popover-head">
      <div>
        <div class="section-title">Состояние систем</div>
        <div class="settings-row-hint">${
          summary.problems
            ? 'Есть проблемы — они подсвечены и ведут туда, где исправляются'
            : 'Всё готово к работе: награды, звук, музыка, чат и оверлей'
        }</div>
      </div>
      <span class="pill ${summary.errors ? 'pill-danger' : summary.warns ? 'pill-warn' : 'pill-accent'}">${
        summary.problems ? `Проблем: ${summary.problems}` : 'ОК'
      }</span>
    </div>
    <div class="health-list">${rows || '<div class="settings-row-hint">Нет данных о подсистемах</div>'}</div>
    <div class="health-popover-foot">
      <button class="btn btn-sm btn-secondary" id="health-open-settings">Открыть «Здоровье системы»</button>
      <button class="btn btn-sm btn-ghost" id="health-copy">Скопировать диагностику</button>
    </div>`,
    {
      className: 'health-popover',
      onMount: (node, close) => {
        node.querySelectorAll('[data-health-action]').forEach((button) =>
          button.addEventListener('click', () => {
            close();
            switchTab(button.dataset.healthAction || 'settings');
          })
        );
        $('#health-open-settings', node)?.addEventListener('click', () => {
          close();
          switchTab('settings');
          setTimeout(() => {
            document.getElementById('settings-health')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }, 160);
        });
        $('#health-copy', node)?.addEventListener('click', () => {
          copyDiagnostics();
          close();
        });
      },
    }
  );
}

function healthStateLabel(state) {
  return { ok: 'работает', warn: 'внимание', error: 'ошибка', off: 'выключено' }[state] || state;
}

async function copyDiagnostics() {
  const view = state.view || emptyView();
  try {
    await navigator.clipboard.writeText(diagnosticsText(view));
    toast('Диагностика скопирована');
  } catch {
    toast('Не удалось скопировать диагностику', 'error');
  }
}

function bindTopbar() {
  $('#health-chip')?.addEventListener('click', (event) => {
    event.stopPropagation();
    openHealthPopover(event.currentTarget);
  });
  document.addEventListener('click', (event) => {
    if (!event.target.closest('.health-popover') && !event.target.closest('#health-chip')) {
      closePopover();
    }
  });

  const slider = $('#top-volume');
  if (slider) {
    bindSlider(slider, {
      onChange: (fraction) => {
        const value = $('#top-volume-value');
        if (value) value.textContent = `${Math.round(fraction * 100)}%`;
      },
      onCommit: async (fraction) => {
        const result = await tryInvoke('set_app_setting', { key: 'volume', value: fraction.toFixed(3) });
        if (result) {
          state.view = result;
          updateChrome(result);
        }
      },
    });
  }

  $('#mute-toggle')?.addEventListener('click', async () => {
    const muted = !(state.view?.muted ?? false);
    const result = await tryInvoke('set_app_setting', { key: 'muted', value: muted ? '1' : '0' });
    if (result) {
      state.view = result;
      updateChrome(result);
      toast(muted ? 'Звук выключен' : 'Звук включён');
    }
  });

  $('#playing-indicator')?.addEventListener('click', async () => {
    const ok = await tryInvoke('stop_all_sounds');
    if (ok !== null) {
      toast('Все звуки остановлены');
      pollNow();
    }
  });

  $('#window-min')?.addEventListener('click', () => withWindow((win) => win.minimize()));
  $('#window-max')?.addEventListener('click', () => withWindow((win) => win.toggleMaximize()));
  $('#window-close')?.addEventListener('click', () => withWindow((win) => win.close()));
}

function bindFooter() {
  // Выход перенесён из футера в меню «···» — всегда с подтверждением.
}

/* ============================ окно ============================ */

function withWindow(action) {
  const win = tauriWindow();
  if (!win) return;
  try {
    action(win);
  } catch (error) {
    console.warn('window action failed', error);
  }
}

function bindWindowControls() {
  const titlebar = $('.titlebar');
  titlebar?.addEventListener('mousedown', (event) => {
    if (event.button !== 0) return;
    if (event.target.closest('button')) return;
    withWindow((win) => win.startDragging());
  });
  titlebar?.addEventListener('dblclick', (event) => {
    if (event.target.closest('button')) return;
    withWindow((win) => win.toggleMaximize());
  });
}

/* ============================ журнал и таймеры ============================ */

function startLogTimer() {
  clearInterval(logTimer);
  logTimer = setInterval(() => {
    if (state.tab !== 'log') return;
    if (document.activeElement?.id === 'log-search') return;
    // Порядок «новые сверху» сохраняет позицию прокрутки внутри refreshLog.
    refreshLog({ silent: true });
  }, 2500);
}

function frameLoop() {
  tickPlayer();
  requestAnimationFrame(frameLoop);
}

/* ============================ прочее ============================ */

function installErrorHandlers() {
  window.addEventListener('unhandledrejection', (event) => {
    if (event.reason && event.reason.toasted) {
      event.preventDefault();
      return;
    }
    console.error('unhandled rejection', event.reason);
  });
  document.addEventListener('keydown', (event) => {
    if (event.ctrlKey && event.shiftKey && event.key.toLowerCase() === 'o') {
      event.preventDefault();
      switchTab('onboarding');
      toast('Экран первого запуска');
    }
  });
  // Перетаскивание окна по пустому месту шапки уже обработано, но если
  // пользователь нажал на иконку — не начинаем drag.
  document.addEventListener('contextmenu', (event) => {
    if (event.target.closest('.titlebar')) event.preventDefault();
  });
}

function soundIcon() {
  return '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M11 5l-5 4H3v6h3l5 4z"/><path d="M16 9a4 4 0 0 1 0 6"/><path d="M19 6a8 8 0 0 1 0 12"/></svg>';
}

function muteIcon() {
  return '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M11 5l-5 4H3v6h3l5 4z"/><path d="M16 9l5 6M21 9l-5 6"/></svg>';
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
