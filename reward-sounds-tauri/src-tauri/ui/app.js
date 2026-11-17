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
  setRefreshHandler,
  setNavigateHandler,
  tauriWindow,
} from './js/bridge.js';
import { renderRewards, syncRewards } from './js/rewards.js';
import { renderMusic, syncMusic, tickPlayer } from './js/music.js';
import { renderSettings, syncSettings } from './js/settings.js';
import { renderLog, refreshLog, syncLog } from './js/log.js';
import { renderOnboarding, syncOnboarding } from './js/onboarding.js';

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
  bindFooter();
  setRefreshHandler(pollNow);
  setNavigateHandler(switchTab);
  installErrorHandlers();
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
  } else if (tab === 'settings') {
    syncSettings(root, view);
  } else if (tab === 'log') {
    syncLog(root);
  }
}

function initialTab() {
  const params = new URLSearchParams(location.search);
  const screen = params.get('screen');
  if (screen && ['rewards', 'music', 'settings', 'log', 'onboarding'].includes(screen)) return screen;
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

function renderTab(tab) {
  const root = content();
  if (!root) return;
  root.dataset.rendered = tab;
  updateNav(tab);
  const view = state.view || emptyView();
  if (tab === 'rewards') {
    if (!view.connected) renderOnboarding(root, view);
    else renderRewards(root, view);
  } else if (tab === 'music') {
    renderMusic(root, view);
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
  };
}

function renderDisconnected() {
  const root = content();
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

function updateChrome(view) {
  document.body.classList.toggle('offline', !view.connected);
  document.body.classList.toggle('muted', !!view.muted);

  const status = $('#twitch-status');
  if (status) {
    status.textContent = view.connected ? `Подключено · ${view.login || view.display_name || ''}` : 'Twitch не подключён';
  }
  const statusLine = $('#statusline');
  if (statusLine) statusLine.title = view.connected ? `Аккаунт ${view.login || view.display_name || ''}` : 'Открыть настройки Twitch';
  const statusDot = $('#twitch-status-dot');
  if (statusDot) statusDot.className = `dot ${view.connected ? 'dot-green' : 'dot-muted'}`;

  const eventsubText = $('#eventsub-text');
  if (eventsubText) {
    eventsubText.textContent =
      !view.connected
        ? ''
        : view.eventsub === 'listening'
          ? 'Слушаем награды'
          : view.eventsub === 'connecting'
            ? 'Переподключение…'
            : 'Не слушаем';
  }
  const eventsub = $('#eventsub-status');
  if (eventsub) {
    eventsub.hidden = !view.connected;
    eventsub.title = view.eventsub_error || 'Статус прослушивания активаций наград';
  }
  const eventsubDot = $('#eventsub-dot');
  if (eventsubDot) {
    eventsubDot.className = `dot ${view.eventsub === 'listening' ? 'dot-green' : view.eventsub === 'connecting' ? 'dot-amber' : 'dot-muted'}`;
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

  const audioState = $('#audio-state');
  if (audioState) {
    if (!view.audio_ready) {
      audioState.textContent = 'Нет аудиовыхода';
      $('#audio-state-dot').className = 'dot dot-red';
    } else if (view.muted) {
      audioState.textContent = 'Без звука';
      $('#audio-state-dot').className = 'dot dot-amber';
    } else {
      const device = view.audio_device || 'устройство по умолчанию';
      audioState.textContent = device.length > 22 ? `Звук: ${device.slice(0, 20)}…` : `Звук: ${device}`;
      $('#audio-state-dot').className = 'dot dot-green';
    }
    audioState.title = view.audio_error || view.audio_device || '';
  }

  const version = $('#version');
  if (version) version.textContent = `версия ${view.version || '—'}`;
  chromeReady = true;
}

function bindTopbar() {
  $('#statusline')?.addEventListener('click', () => switchTab('settings'));
  $('#eventsub-status')?.addEventListener('click', () => switchTab('settings'));

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
  $('#footer-exit')?.addEventListener('click', () => {
    invoke('exit_app').catch(() => {});
  });
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
    const card = $('#log-card');
    const atBottom = card ? card.scrollHeight - card.scrollTop - card.clientHeight < 40 : true;
    refreshLog({ silent: true }).then(() => {
      const nextCard = $('#log-card');
      if (atBottom && nextCard) nextCard.scrollTop = nextCard.scrollHeight;
    });
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
