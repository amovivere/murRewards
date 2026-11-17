/* Вкладка «Чат»: подключение, команды, оверлей и живая лента сообщений. */

import {
  state,
  $,
  $$,
  invoke,
  tryInvoke,
  toast,
  confirmDialog,
  icons,
  escapeHtml,
  requestRefresh,
  navigate,
  menu,
  exitMenuItem,
  popover,
} from './bridge.js';

const TWITCH_CHAT_URL = 'https://www.twitch.tv/popout';

let boundRoot = null;
let lastFeedSignature = '';
let lastStatusKey = '';

export function renderChat(root, view) {
  boundRoot = root;
  root.innerHTML = chatPageHtml(view);
  lastFeedSignature = '';
  lastStatusKey = statusKey(view);
  bind(root, view);
  syncChat(root, view, true);
}

function statusKey(view) {
  const chat = view.chat || {};
  return JSON.stringify({
    connected: view.connected,
    login: view.login,
    chat: {
      enabled: chat.enabled,
      connected: chat.connected,
      read_only: chat.read_only,
      error: chat.error || '',
      settings: chat.settings || {},
    },
  });
}

export function syncChat(root, view, initial = false) {
  if (state.tab !== 'chat' || boundRoot !== root) return;
  const chat = view.chat || {};
  if (!initial && statusKey(view) !== lastStatusKey) {
    renderChat(root, view);
    return;
  }
  updateStatus(root, view, chat);
  updateFeed(root, chat);
  const input = $('#chat-input', root);
  if (input) input.disabled = !chat.connected || !!chat.read_only;
  const send = $('#chat-send', root);
  if (send) send.disabled = !chat.connected || !!chat.read_only;
}

function chatSettings(chat) {
  return chat.settings || {};
}

function commandEnabled(chat, key) {
  return chatSettings(chat).commands?.[key] !== false;
}

/* ============================ разметка ============================ */

function chatPageHtml(view) {
  const chat = view.chat || {};
  const settings = chatSettings(chat);
  return `
    <div class="page-head">
      <div>
        <h1 class="h1">Чат</h1>
        <div class="sub">Подключение, команды и оверлей — без отдельного бота</div>
      </div>
      <div class="head-actions">
        <button class="btn btn-icon btn-ghost" id="chat-menu" title="Действия">•••</button>
        <button class="btn btn-secondary" id="chat-open-twitch">Открыть чат на Twitch</button>
      </div>
    </div>

    <div class="pills chat-pills" id="chat-pills">${statusPills(view, chat)}</div>
    ${chat.read_only ? readOnlyBanner(view) : ''}
    ${chat.error ? `<div class="banner banner-error"><span class="banner-icon">${icons.warning}</span><span class="banner-text">${escapeHtml(chat.error)}</span><button class="btn btn-sm btn-secondary" id="chat-reconnect">Переподключить</button></div>` : ''}

    <div class="chat-grid">
      <div class="card chat-card" id="chat-connection">
        <div class="settings-card-title">Подключение чата</div>
        <div class="settings-card-sub">Тот же вход Twitch, что и для наград — отдельный Client ID не нужен</div>
        <div class="chat-conn-status" id="chat-conn-status">${connectionStatusHtml(view, chat)}</div>
        <div class="settings-row-hint">Права: <code>chat:read</code>, <code>chat:edit</code>. Если их нет — чат работает в режиме чтения, а отправка сообщений попросит переподключить Twitch.</div>
        <div class="settings-actions">
          <button class="btn btn-secondary" id="chat-reconnect">Переподключить</button>
          <button class="btn btn-ghost btn-danger-ghost" id="chat-disconnect"${chat.connected ? '' : ' disabled'}>Отключить</button>
        </div>
      </div>

      <div class="card chat-card" id="chat-commands">
        <div class="settings-card-title">Команды</div>
        <div class="settings-card-sub">Кто может вызывать и что происходит</div>
        <div class="chat-command-list">
          ${commandRow('queue', '!queue', 'Показать очередь', 'Все', chat)}
          ${commandRow('song', '!song', 'Что играет сейчас', 'Все', chat)}
          ${commandRow('skip', '!skip', 'Пропустить текущий трек', 'Модератор', chat)}
          ${commandRow('sound', '!звук <название>', 'Проиграть звук награды', 'Все', chat)}
        </div>
        <div class="settings-row-hint">Кулдаун 10 секунд на пользователя. Ответы уходят в чат от имени канала.</div>
      </div>

      <div class="card chat-card" id="chat-overlay">
        <div class="settings-card-title">Оверлей чата</div>
        <div class="settings-card-sub">Ссылка для источника «Браузер» в OBS</div>
        <div class="chat-overlay-url">
          <code id="chat-overlay-url" title="${escapeHtml(chat.overlay_url || 'http://127.0.0.1:8770/chat')}">${escapeHtml(chat.overlay_url || 'http://127.0.0.1:8770/chat')}</code>
          <button class="copy-btn" id="chat-overlay-copy" title="Скопировать ссылку">${icons.copy}</button>
        </div>
        <div class="chat-overlay-controls">
          <div class="setting-row"><span>Тема</span>
            <div class="seg" id="chat-overlay-theme">
              <button class="seg-item${(settings.overlay_theme || 'dark') === 'dark' ? ' active' : ''}" data-theme="dark">Тёмная</button>
              <button class="seg-item${settings.overlay_theme === 'light' ? ' active' : ''}" data-theme="light">Светлая</button>
            </div>
          </div>
          <div class="setting-row"><span>Прозрачность</span>
            <div class="chat-overlay-slider-row">
              <div class="slider sm" id="chat-overlay-opacity"><div class="track"></div><div class="fill" style="width:${Number(settings.overlay_opacity) || 60}%"></div><div class="knob" style="left:${Number(settings.overlay_opacity) || 60}%"></div></div>
              <span class="local-value" id="chat-overlay-opacity-value">${Number(settings.overlay_opacity) || 60}%</span>
            </div>
          </div>
        </div>
        <div class="settings-actions">
          <button class="btn btn-sm btn-secondary" id="chat-overlay-open">Открыть в браузере</button>
          <button class="btn btn-sm btn-ghost" id="chat-overlay-copy-2">Скопировать ссылку</button>
        </div>
      </div>

      <div class="card chat-card chat-live" id="chat-live">
        <div class="chat-live-head">
          <div class="settings-card-title">Чат</div>
          <span class="chat-live-count" id="chat-live-count">0 сообщений</span>
          <div class="spacer"></div>
          <button class="btn btn-sm btn-ghost" id="chat-clear">Очистить</button>
        </div>
        <div class="chat-feed" id="chat-feed">${feedHtml(chat)}</div>
        <form class="chat-send-row" id="chat-send-form">
          <input class="input chat-input" id="chat-input" type="text" maxlength="500" placeholder="${chat.read_only ? 'Только чтение — нужны права chat:edit' : 'Написать в чат…'}" autocomplete="off"${!chat.connected || chat.read_only ? ' disabled' : ''}>
          <button class="btn btn-primary btn-sm" id="chat-send" type="submit"${!chat.connected || chat.read_only ? ' disabled' : ''}>Отправить</button>
        </form>
      </div>
    </div>`;
}

function statusPills(view, chat) {
  const pills = [];
  if (!view.connected) pills.push('<span class="pill pill-danger">Twitch не подключён</span>');
  else if (chat.connected && !chat.read_only) pills.push(`<span class="pill pill-accent"><span class="dot dot-green"></span>Подключено · ${escapeHtml(view.login || '')}</span>`);
  else if (chat.connected && chat.read_only) pills.push('<span class="pill pill-warn"><span class="dot dot-amber"></span>Только чтение</span>');
  else pills.push('<span class="pill pill-warn"><span class="dot dot-amber"></span>Переподключение…</span>');
  pills.push(`<span class="pill">Команд: ${['queue', 'song', 'skip', 'sound'].filter((key) => commandEnabled(chat, key)).length}</span>`);
  pills.push(`<span class="pill">Сообщений: ${(chat.messages || []).length}</span>`);
  return pills.join('');
}

function readOnlyBanner(view) {
  return `
    <div class="banner banner-warn" id="chat-readonly">
      <span class="banner-icon">${icons.warning}</span>
      <span class="banner-text">Чат читается, но отправлять сообщения нельзя: у старого входа нет прав <code>chat:edit</code>. Переподключите Twitch — новые права добавятся автоматически.</span>
      <button class="btn btn-sm btn-secondary" id="chat-reconnect-twitch">Переподключить Twitch</button>
    </div>`;
}

function connectionStatusHtml(view, chat) {
  if (!view.connected) {
    return `<div class="settings-status"><span class="dot dot-muted"></span>Twitch не подключён</div>
      <div class="settings-row-hint">Подключите аккаунт в настройках — чат использует тот же вход.</div>`;
  }
  if (chat.connected && !chat.read_only) {
    return `<div class="settings-status"><span class="dot dot-green"></span>Подключено · ${escapeHtml(view.login || '')}</div>
      <div class="settings-row-hint">Можно читать и писать в чат канала.</div>`;
  }
  if (chat.connected && chat.read_only) {
    return `<div class="settings-status"><span class="dot dot-amber"></span>Чтение без отправки</div>
      <div class="settings-row-hint">Входу не хватает прав <code>chat:edit</code>.</div>`;
  }
  return `<div class="settings-status"><span class="dot dot-amber"></span>Подключаемся…</div>`;
}

function commandRow(key, command, description, who, chat) {
  const enabled = commandEnabled(chat, key);
  return `
    <div class="chat-command">
      <code>${escapeHtml(command)}</code>
      <div class="chat-command-info">
        <div class="chat-command-title">${escapeHtml(description)}</div>
        <div class="chat-command-hint">Кто: ${escapeHtml(who)}</div>
      </div>
      <button class="toggle${enabled ? ' on' : ''}" data-command="${key}" title="${enabled ? 'Выключить команду' : 'Включить команду'}" aria-label="${escapeHtml(command)}" aria-pressed="${enabled}"><span></span></button>
    </div>`;
}

function feedHtml(chat) {
  const messages = chat.messages || [];
  if (!messages.length) {
    return `<div class="chat-feed-empty">Пока сообщений нет. Подключитесь к чату канала.</div>`;
  }
  return messages.map(messageHtml).join('');
}

function messageHtml(message) {
  const time = new Date(Number(message.at_ms) || Date.now()).toLocaleTimeString('ru-RU', {
    hour: '2-digit',
    minute: '2-digit',
  });
  const color = /^#[0-9a-f]{6}$/i.test(message.color || '') ? message.color : '#C9A7FF';
  const badges = `${message.is_broadcaster ? '<span class="chat-badge chat-badge-broadcaster">стример</span>' : ''}${message.is_moderator ? '<span class="chat-badge">мод</span>' : ''}`;
  return `
    <div class="chat-message" data-id="${escapeHtml(message.id)}">
      <span class="chat-time">${time}</span>
      <span class="chat-user" style="color:${color}">${escapeHtml(message.display_name || message.user)}</span>
      ${badges}
      <span class="chat-text">${escapeHtml(message.text)}</span>
    </div>`;
}

/* ============================ обновление ============================ */

function updateStatus(root, view, chat) {
  const pills = $('#chat-pills', root);
  if (pills) pills.innerHTML = statusPills(view, chat);
  const status = $('#chat-conn-status', root);
  if (status) status.innerHTML = connectionStatusHtml(view, chat);
  const readonly = $('#chat-readonly', root);
  if (readonly) readonly.hidden = !chat.read_only;
  const count = $('#chat-live-count', root);
  if (count) count.textContent = `${(chat.messages || []).length} сообщений`;
  const url = $('#chat-overlay-url', root);
  if (url) url.textContent = chat.overlay_url || url.textContent;
}

function updateFeed(root, chat) {
  const feed = $('#chat-feed', root);
  if (!feed) return;
  const messages = chat.messages || [];
  const signature = messages.map((message) => message.id).join('|');
  if (signature === lastFeedSignature) return;
  const wasAtBottom = feed.scrollHeight - feed.scrollTop - feed.clientHeight < 40;
  feed.innerHTML = feedHtml(chat);
  lastFeedSignature = signature;
  if (wasAtBottom || messages.length <= 8) feed.scrollTop = feed.scrollHeight;
}

/* ============================ события ============================ */

function bind(root, view) {
  const chat = view.chat || {};
  $('#chat-menu', root)?.addEventListener('click', (event) => {
    menu(event.currentTarget, [
      { label: 'Переподключить чат', icon: icons.refresh, onClick: () => reconnect() },
      { label: 'Очистить сообщения', icon: icons.trash, onClick: () => clearMessages() },
      { label: 'Настройки Twitch', icon: icons.edit, onClick: () => navigate('settings') },
      exitMenuItem(),
    ]);
  });
  $('#chat-open-twitch', root)?.addEventListener('click', () => {
    const login = view.login || state.view?.login;
    if (!login) {
      toast('Сначала подключите Twitch', 'warn');
      return;
    }
    invoke('open_url', { url: `${TWITCH_CHAT_URL}/${encodeURIComponent(login)}/chat?popout=` }).catch(() => {});
  });
  $('#chat-open-twitch', root)?.addEventListener('auxclick', () => {});

  root.querySelectorAll('#chat-reconnect').forEach((button) =>
    button.addEventListener('click', () => reconnect())
  );
  $('#chat-reconnect-twitch', root)?.addEventListener('click', () => navigate('settings'));
  $('#chat-disconnect', root)?.addEventListener('click', async () => {
    const ok = await confirmDialog({
      title: 'Отключить чат?',
      text: 'Чат перестанет читаться и команды не будут работать до повторного подключения. Twitch-аккаунт останется подключён.',
      confirmLabel: 'Отключить',
      danger: true,
    });
    if (!ok) return;
    try {
      const result = await invoke('chat_disconnect');
      if (result) {
        state.view = result;
        requestRefresh();
        toast('Чат отключён');
      }
    } catch {}
  });
  $('#chat-clear', root)?.addEventListener('click', () => clearMessages());

  root.querySelectorAll('[data-command]').forEach((button) => {
    button.addEventListener('click', async () => {
      const key = button.dataset.command;
      const enabled = !button.classList.contains('on');
      button.classList.toggle('on', enabled);
      button.setAttribute('aria-pressed', String(enabled));
      try {
        const result = await invoke('chat_set_settings', {
          patch: { commands: { [key]: enabled } },
        });
        if (result) applyChatResult(result);
      } catch {
        button.classList.toggle('on', !enabled);
      }
    });
  });

  root.querySelectorAll('#chat-overlay-theme [data-theme]').forEach((button) => {
    button.addEventListener('click', async () => {
      root.querySelectorAll('#chat-overlay-theme [data-theme]').forEach((el) => el.classList.toggle('active', el === button));
      await saveOverlay({ overlayTheme: button.dataset.theme });
    });
  });
  bindChatOverlayOpacity(root);

  $('#chat-overlay-copy', root)?.addEventListener('click', () => copyOverlayUrl(root));
  $('#chat-overlay-copy-2', root)?.addEventListener('click', () => copyOverlayUrl(root));
  $('#chat-overlay-open', root)?.addEventListener('click', () => {
    const url = $('#chat-overlay-url', root)?.textContent;
    if (url) invoke('open_url', { url }).catch(() => {});
  });

  $('#chat-send-form', root)?.addEventListener('submit', async (event) => {
    event.preventDefault();
    await sendMessage(root);
  });
}

function bindChatOverlayOpacity(root) {
  const slider = $('#chat-overlay-opacity', root);
  if (!slider) return;
  let value = Math.round(parseFloat(slider.querySelector('.fill').style.width)) || 60;
  const paint = (fraction) => {
    const pct = Math.round(fraction * 100);
    value = pct;
    slider.querySelector('.fill').style.width = `${pct}%`;
    slider.querySelector('.knob').style.left = `${pct}%`;
    const label = $('#chat-overlay-opacity-value', root);
    if (label) label.textContent = `${pct}%`;
  };
  const commit = () => saveOverlay({ overlayOpacity: value });
  slider.addEventListener('pointerdown', (event) => {
    const move = (moveEvent) => {
      const rect = slider.getBoundingClientRect();
      paint(Math.max(0, Math.min(1, (moveEvent.clientX - rect.left) / rect.width)));
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      commit();
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    move(event);
  });
  slider.addEventListener('keydown', (event) => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    if (event.key === 'Home') paint(0);
    else if (event.key === 'End') paint(1);
    else paint(Math.max(0, Math.min(1, (value + (event.key === 'ArrowRight' ? 5 : -5)) / 100)));
    commit();
  });
  slider.setAttribute('tabindex', '0');
  slider.setAttribute('role', 'slider');
  slider.setAttribute('aria-label', 'Прозрачность оверлея чата');
}

async function saveOverlay(patch) {
  try {
    const result = await invoke('chat_set_settings', { patch });
    if (result) applyChatResult(result);
  } catch {}
}

function applyChatResult(result) {
  state.view = result;
  const chat = result.chat || {};
  const url = $('#chat-overlay-url');
  if (url && chat.overlay_url) url.textContent = chat.overlay_url;
  requestRefresh();
}

async function sendMessage(root) {
  const input = $('#chat-input', root);
  if (!input) return;
  const text = input.value.trim();
  if (!text) return;
  const button = $('#chat-send', root);
  if (button) button.disabled = true;
  try {
    await invoke('chat_send_message', { text });
    input.value = '';
    requestRefresh();
  } catch {
    // ошибка уже показана тостом
  } finally {
    if (button) button.disabled = false;
    input.focus();
  }
}

async function reconnect() {
  try {
    const result = await invoke('chat_refresh');
    if (result) {
      state.view = result;
      requestRefresh();
      toast('Переподключаем чат…');
    }
  } catch {}
}

async function clearMessages() {
  try {
    const result = await invoke('chat_clear_messages');
    if (result) {
      state.view = result;
      lastFeedSignature = '';
      requestRefresh();
      toast('Сообщения очищены');
    }
  } catch {}
}

async function copyOverlayUrl(root) {
  const url = $('#chat-overlay-url', root)?.textContent;
  if (!url) return;
  try {
    await navigator.clipboard.writeText(url);
    toast('Ссылка на оверлей чата скопирована');
  } catch {
    toast('Не удалось скопировать ссылку', 'error');
  }
}
