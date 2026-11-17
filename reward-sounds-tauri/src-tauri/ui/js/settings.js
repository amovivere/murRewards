/* Вкладка «Настройки»: Twitch, звук, аудиовыход, приложение, музыка, данные. */

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
  bindSlider,
  requestRefresh,
  navigate,
  createModal,
  menu,
  exitMenuItem,
  diagnosticsText,
  applyAccent,
  normalizeAccent,
  accentInk,
  DEFAULT_ACCENT,
  ACCENT_PRESETS,
} from './bridge.js';
import { soundTestHtml, bindSoundTest } from './sound-test.js';
import { openMusicSettings } from './music.js';

let boundRoot = null;
let lastSignature = '';
let saveTimer = null;
let lastNormalizeMessage = '';

export function renderSettings(root, view) {
  boundRoot = root;
  root.innerHTML = settingsPageHtml(view);
  bind(root, view);
  lastSignature = settingsSignature(view);
}

export function syncSettings(root, view) {
  if (state.tab !== 'settings' || boundRoot !== root) return;
  const signature = settingsSignature(view);
  if (signature !== lastSignature) {
    // Не пересоздаём DOM, пока пользователь печатает Client ID.
    const typing = document.activeElement?.id === 'twitch-client-id';
    if (typing) {
      updateLiveBits(root, view);
      return;
    }
    renderSettings(root, view);
    return;
  }
  updateLiveBits(root, view);
}

function settingsSignature(view) {
  return JSON.stringify({
    connected: view.connected,
    login: view.login,
    displayName: view.display_name,
    auth: view.auth,
    eventsub: view.eventsub,
    eventsub_error: view.eventsub_error,
    audio_ready: view.audio_ready,
    audio_device: view.audio_device,
    health: view.health,
    accent: view.accent,
  });
}

/* ============================ разметка ============================ */

function settingsPageHtml(view) {
  const auth = view.auth || { state: 'idle' };
  return `
    <div class="page-head">
      <div>
        <h1 class="h1">Настройки</h1>
        <div class="sub">Twitch, звук и поведение приложения</div>
      </div>
      <div class="head-actions">
        <span class="save-indicator" id="settings-save-state">Изменения сохраняются автоматически</span>
        <button class="btn btn-icon btn-ghost" id="settings-menu" title="Действия">•••</button>
      </div>
    </div>
    <div class="settings-grid">
      ${healthCard(view)}
      ${twitchCard(view, auth)}
      ${soundCard(view)}
      ${audioCard(view)}
      ${appearanceCard(view)}
      ${appCard(view)}
      ${musicCard(view)}
      ${dataCard(view)}
    </div>`;
}

function healthCard(view) {
  const items = view.health || [];
  const problems = items.filter((item) => item.state === 'error' || item.state === 'warn').length;
  const rows = items
    .map(
      (item) => `
      <div class="health-row static">
        <span class="dot ${healthDot(item.state)}"></span>
        <span class="health-row-main">
          <span class="health-row-title">${escapeHtml(item.title)}</span>
          <span class="health-row-detail">${escapeHtml(item.detail)}</span>
        </span>
        ${item.action && item.action !== 'settings' ? `<button class="btn btn-sm btn-ghost state-action" data-health-go="${escapeHtml(item.action)}">Открыть</button>` : ''}
      </div>`
    )
    .join('');
  return `
    <div class="card settings-card health-card" id="settings-health">
      <div class="health-card-head">
        <div>
          <div class="settings-card-title">Здоровье системы</div>
          <div class="settings-card-sub">${
            problems ? `Требуют внимания: ${problems}` : 'Все подсистемы в порядке'
          }</div>
        </div>
        <span class="pill ${problems ? 'pill-warn' : 'pill-accent'}">${problems ? `${problems} ${problems === 1 ? 'замечание' : 'замечания'}` : 'ОК'}</span>
      </div>
      <div class="health-list">${rows || '<div class="settings-row-hint">Нет данных о подсистемах</div>'}</div>
      <div class="settings-actions">
        <button class="btn btn-sm btn-secondary" id="settings-copy-diag">Скопировать диагностику</button>
        <button class="btn btn-sm btn-ghost" id="settings-open-log">Открыть журнал</button>
      </div>
    </div>`;
}

function healthDot(state) {
  return { ok: 'dot-green', warn: 'dot-amber', error: 'dot-red', off: 'dot-muted' }[state] || 'dot-muted';
}

const ACCENT_PRESET_LIST = ACCENT_PRESETS;

function appearanceCard(view) {
  const accent = /^#[0-9a-f]{6}$/i.test(view.accent || '') ? view.accent.toUpperCase() : DEFAULT_ACCENT;
  return `
    <div class="card settings-card appearance-card" id="settings-appearance">
      <div class="settings-card-title">Внешний вид</div>
      <div class="settings-card-sub">Акцентный цвет кнопок, фокуса и активных элементов</div>
      <div class="appearance-preview">
        <button class="btn btn-sm btn-primary" type="button" id="appearance-example" style="background:${accent};border-color:${accent};color:${accentInk(accent)}">Пример кнопки</button>
        <span class="pill pill-accent">Акцент</span>
        <div class="slider sm appearance-slider" aria-hidden="true">
          <div class="track"></div><div class="fill" style="width:60%;background:${accent}"></div><div class="knob" style="left:60%;background:${accent}"></div>
        </div>
      </div>
      <div class="color-controls appearance-controls">
        <label class="color-swatch" id="accent-swatch" title="Выбрать акцентный цвет" style="background:${accent}">
          <input type="color" id="accent-native" value="${accent}" aria-label="Выбрать акцентный цвет">
        </label>
        <input class="input reward-input color-hex" id="accent-hex" maxlength="7" value="${accent}" aria-label="Акцентный цвет в формате HEX">
        <button class="btn btn-sm btn-ghost" id="accent-reset" title="Вернуть фирменный фиолетовый">Сбросить</button>
      </div>
      <div class="color-palette" id="accent-palette">
        ${ACCENT_PRESET_LIST.map(
          (color) =>
            `<button type="button" class="color-preset${color.toLowerCase() === accent.toLowerCase() ? ' active' : ''}" data-accent="${color}" style="background:${color}" title="${color}" aria-label="Акцент ${color}"></button>`
        ).join('')}
      </div>
      <div class="settings-row-hint">Меняются только акцентные элементы. Статусы, опасные действия, цвета наград и чат-пользователей остаются прежними; слишком тёмный или яркий цвет мягко корректируется для читаемости.</div>
      <div class="accent-note" id="accent-note" hidden></div>
    </div>`;
}

function bindAppearance(root, view) {
  const native = $('#accent-native', root);
  const hex = $('#accent-hex', root);
  const swatch = $('#accent-swatch', root);
  const palette = $('#accent-palette', root);
  const note = $('#accent-note', root);
  const example = $('#appearance-example', root);
  if (!native || !hex || !swatch) return;

  let timer = null;
  let lastSaved = (view.accent || DEFAULT_ACCENT).toUpperCase();
  const markActive = (value) =>
    palette?.querySelectorAll('[data-accent]').forEach((button) =>
      button.classList.toggle('active', button.dataset.accent.toLowerCase() === value.toLowerCase())
    );
  const showNote = (normalized, original) => {
    if (!note) return;
    if (normalized.adjusted) {
      note.hidden = false;
      note.textContent = `Цвет мягко скорректирован для контраста: ${normalized.hex}${original && original.toUpperCase() !== normalized.hex ? ` (было ${original.toUpperCase()})` : ''}`;
    } else {
      note.hidden = true;
      note.textContent = '';
    }
  };
  const persist = (value) => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(async () => {
      try {
        const result = await invoke('set_app_setting', { key: 'accent', value });
        if (result) {
          state.view = result;
          applyAccent(result.accent);
          lastSaved = result.accent.toUpperCase();
        }
      } catch {}
    }, 300);
  };
  const paint = (input, { save = false, silent = false } = {}) => {
    const normalized = normalizeAccent(input);
    if (!normalized) {
      if (!silent) toast('Цвет должен быть в формате #RRGGBB', 'warn');
      return;
    }
    hex.value = normalized.hex;
    native.value = normalized.hex;
    swatch.style.background = normalized.hex;
    if (example) {
      example.style.background = normalized.hex;
      example.style.borderColor = normalized.hex;
      example.style.color = accentInk(normalized.hex);
    }
    markActive(normalized.hex);
    applyAccent(normalized.hex);
    showNote(normalized, input);
    if (save && normalized.hex.toUpperCase() !== lastSaved) persist(normalized.hex);
  };

  native.addEventListener('input', () => paint(native.value, { save: true }));
  hex.addEventListener('input', () => paint(hex.value, { silent: true }));
  hex.addEventListener('change', () => paint(hex.value, { save: true }));
  palette?.querySelectorAll('[data-accent]').forEach((button) =>
    button.addEventListener('click', () => paint(button.dataset.accent, { save: true }))
  );
  $('#accent-reset', root)?.addEventListener('click', () => {
    paint(DEFAULT_ACCENT, { save: true });
    toast('Акцентный цвет сброшен');
  });
}

function card(title, subtitle, body) {
  return `
    <div class="card settings-card">
      <div class="settings-card-title">${escapeHtml(title)}</div>
      ${subtitle ? `<div class="settings-card-sub">${escapeHtml(subtitle)}</div>` : ''}
      ${body}
    </div>`;
}

function twitchCard(view, auth) {
  let body;
  if (auth.state === 'waiting') {
    body = `
      <div class="settings-status"><span class="dot dot-green"></span>Ждём подтверждения на Twitch</div>
      <div class="auth-code" id="auth-code">${escapeHtml(auth.user_code || '…')}</div>
      <div class="settings-row-hint">Введите этот код на twitch.tv/activate. Код действует несколько минут.</div>
      <div class="settings-actions">
        <button class="btn btn-primary" id="twitch-open-activate">Открыть twitch.tv/activate</button>
        <button class="btn btn-secondary" id="twitch-copy-code">Скопировать код</button>
        <button class="btn btn-secondary" id="twitch-cancel">Отмена</button>
      </div>
      ${auth.progress ? `<div class="settings-row-hint">${escapeHtml(auth.progress)}</div>` : ''}
      ${auth.error ? `<div class="settings-error">${escapeHtml(auth.error)}</div>` : ''}`;
  } else if (view.connected) {
    const eventsubText =
      view.eventsub === 'listening'
        ? 'Активации наград слушаются'
        : view.eventsub === 'connecting'
          ? 'Переподключение к чату событий…'
          : 'Активации наград не слушаются';
    body = `
      <div class="settings-status"><span class="dot dot-green"></span>Подключено · @${escapeHtml(view.login || view.display_name || '')}</div>
      <div class="settings-status"><span class="dot ${view.eventsub === 'listening' ? 'dot-green' : 'dot-amber'}"></span>${escapeHtml(eventsubText)}</div>
      ${view.eventsub_error ? `<div class="settings-error">${escapeHtml(view.eventsub_error)}</div>` : ''}
      <div class="settings-actions">
        <button class="btn btn-primary" id="twitch-refresh-data">Обновить данные</button>
        <button class="btn btn-secondary" id="twitch-restart-eventsub">Переподключить события</button>
      </div>
      <div class="settings-row account-row">
        <div>
          <div class="settings-row-title">Аккаунт</div>
          <div class="settings-row-hint">Сменить канал можно только после отключения текущего</div>
        </div>
        <button class="btn btn-sm btn-secondary" id="twitch-reconnect">Сменить…</button>
      </div>
      <div class="danger-zone">
        <div class="danger-zone-title">Опасная зона</div>
        <div class="danger-zone-text">Отключить Twitch — награды и чат перестанут работать до повторного входа. Потребуется подтверждение.</div>
        <button class="btn btn-sm btn-danger" id="twitch-disconnect">Отключить Twitch</button>
      </div>
      <div class="settings-row-hint">Client ID: <code>${escapeHtml(view.client_id || '—')}</code></div>
      ${auth.error ? `<div class="settings-error">${escapeHtml(auth.error)}</div>` : ''}`;
  } else {
    const clientId = view.client_id || '';
    body = `
      <div class="settings-status"><span class="dot dot-muted"></span>Не подключено</div>
      ${auth.error ? `<div class="settings-error">${escapeHtml(auth.error)}</div>` : ''}
      <label class="settings-label" for="twitch-client-id">CLIENT ID</label>
      <input class="input settings-input" id="twitch-client-id" value="${escapeHtml(clientId)}" spellcheck="false" autocomplete="off" placeholder="Client ID приложения Twitch">
      <div class="settings-row-hint">Публичный идентификатор приложения из dev.twitch.tv — не пароль.</div>
      <div class="settings-actions">
        <button class="btn btn-primary" id="twitch-connect">Подключить Twitch</button>
        <button class="btn btn-secondary" id="twitch-get-client-id">Где взять Client ID?</button>
      </div>`;
  }
  return card('Twitch', 'Аккаунт канала, с которого читаются награды', body);
}

function soundCard(view) {
  const volume = Math.round((Number(view.volume) || 0) * 100);
  return card(
    'Звук',
    'Громкость приложения и воспроизведение',
    `
    <div class="settings-volume-row">
      <span class="settings-label">ГРОМКОСТЬ</span>
      <div class="slider" id="settings-volume"><div class="track"></div><div class="fill" style="width:${volume}%"></div><div class="knob" style="left:${volume}%"></div></div>
      <span class="settings-volume-value" id="settings-volume-value">${volume}%</span>
    </div>
    ${toggleHtml('muted', !!view.muted, 'Без звука', 'Заглушить все звуки наград')}
    ${toggleHtml('playback_enabled', view.playback_enabled !== false, 'Воспроизводить звуки наград', 'Активации будут игнорироваться, пока выключено')}
    <div class="settings-row-hint">Громкость действует только на звуки Reward Sounds — системную громкость Windows приложение не меняет.</div>`
  );
}

function audioCard(view) {
  const ready = !!view.audio_ready;
  const device = view.audio_device || 'устройство не найдено';
  return card(
    'Аудиовыход',
    'Куда играют звуки наград',
    `
    <div class="settings-status">${ready ? '<span class="dot dot-green"></span>' : '<span class="dot dot-red"></span>'}
      <span class="${ready ? '' : 'danger-text'}">${ready ? escapeHtml(device) : 'недоступно — проверьте колонки или наушники'}</span>
    </div>
    ${view.audio_error ? `<div class="settings-error">${escapeHtml(view.audio_error)}</div>` : ''}
    ${view.normalizing ? `<div class="settings-status"><span class="dot dot-amber"></span>Измеряем громкость звуков…</div>` : ''}
    ${soundTestHtml()}
    <div class="settings-actions">
      <button class="btn btn-secondary" id="audio-restart">Перезапустить аудио</button>
      <button class="btn btn-secondary" id="audio-stop-all">Остановить все звуки</button>
      <button class="btn btn-secondary" id="audio-normalize"${view.bindings > 0 && !view.normalizing ? '' : ' disabled'}>Выровнять громкость</button>
    </div>
    <div class="settings-row-hint">Приложение автоматически подхватывает смену устройства вывода Windows. Выравнивание подгоняет громкость привязанных звуков под общий уровень.</div>`
  );
}

function appCard(view) {
  return card(
    'Приложение',
    'Запуск и поведение окна',
    `
    ${toggleHtml('autostart', !!view.autostart, 'Запускать с Windows', '')}
    ${toggleHtml('close_to_tray', !!view.close_to_tray, 'Закрывать в трей', 'Крестик прячет окно, приложение продолжает работать')}
    ${toggleHtml('start_minimized', !!view.start_minimized, 'Запускать свёрнутым', 'Следующий запуск начнётся со значка в трее')}
    <div class="settings-row"><div class="settings-row-title">Версия</div><div class="settings-version">${escapeHtml(view.version || '')}</div></div>
    <div class="settings-actions">
      <button class="btn btn-secondary" id="app-hide">Свернуть в трей</button>
      <button class="btn btn-secondary reward-delete-text" id="app-exit">Выйти из приложения</button>
    </div>
    <div class="settings-row-hint">Изменения «Закрывать в трей» и «Запускать свёрнутым» применяются сразу, но окно уже открыто — поведение при закрытии поменяется без перезапуска.</div>`
  );
}

function musicCard(view) {
  const music = view.music || {};
  const ready = view.connected && view.eventsub === 'listening' && music.reward_id && music.ytdlp_version && music.enabled;
  return card(
    'Музыка',
    'Треки по заявке из чата',
    `
    <div class="settings-status">${ready ? '<span class="dot dot-green"></span>Готова к заявкам' : '<span class="dot dot-amber"></span>Не готова'}</div>
    <div class="settings-row"><div><div class="settings-row-title">Награда</div><div class="settings-row-hint">${escapeHtml(music.reward_title || 'не выбрана')} · ${Number(music.reward_cost) || 0} баллов</div></div></div>
    <div class="settings-row"><div><div class="settings-row-title">Очередь</div><div class="settings-row-hint">лимит ${Number(music.max_queue) || 0} · максимум ${Math.round((Number(music.max_duration_sec) || 0) / 60)} мин</div></div></div>
    <div class="settings-actions">
      <button class="btn btn-secondary" id="open-music-settings">Настроить музыку</button>
      <button class="btn btn-secondary" id="open-music-tab">Открыть вкладку «Музыка»</button>
    </div>`
  );
}

function dataCard(view) {
  return card(
    'Данные',
    'Настройки, журнал и очередь хранятся в %APPDATA%\\RewardSounds',
    `
    <div class="path-row"><span class="settings-label">ПАПКА</span><code title="${escapeHtml(view.data_dir || '')}">${escapeHtml(view.data_dir || '—')}</code></div>
    <div class="path-row"><span class="settings-label">ЖУРНАЛ</span><code title="${escapeHtml(view.log_file || '')}">${escapeHtml(view.log_file || '—')}</code></div>
    <div class="settings-actions">
      <button class="btn btn-secondary" id="open-config-folder">${icons.folder} Папка настроек</button>
      <button class="btn btn-secondary" id="open-log-folder">${icons.folder} Папка журнала</button>
    </div>
    <div class="settings-row-hint">Здесь же лежат config.toml, queue.json и logs/reward-sounds.log. Токены Twitch зашифрованы Windows.</div>`
  );
}

function toggleHtml(key, enabled, label, hint) {
  return `<div class="settings-row">
    <div><div class="settings-row-title">${escapeHtml(label)}</div>${hint ? `<div class="settings-row-hint">${escapeHtml(hint)}</div>` : ''}</div>
    <button class="toggle ${enabled ? 'on' : ''}" data-setting="${key}" aria-pressed="${enabled}" title="${enabled ? 'Выключить' : 'Включить'}"><span></span></button>
  </div>`;
}

/* ============================ события ============================ */

function bind(root, view) {
  bindAppearance(root, view);
  $('#settings-menu', root)?.addEventListener('click', (event) => {
    menu(event.currentTarget, [
      { label: 'Открыть журнал', icon: icons.folder, onClick: () => navigate('log') },
      { label: 'Скопировать диагностику', icon: icons.copy, onClick: copySettingsDiagnostics },
      exitMenuItem(),
    ]);
  });
  root.querySelectorAll('[data-health-go]').forEach((button) =>
    button.addEventListener('click', () => navigate(button.dataset.healthGo))
  );
  $('#settings-copy-diag', root)?.addEventListener('click', copySettingsDiagnostics);
  $('#settings-open-log', root)?.addEventListener('click', () => navigate('log'));

  $$('[data-setting]', root).forEach((button) => {
    button.addEventListener('click', async () => {
      const key = button.dataset.setting;
      const on = button.classList.contains('on');
      const value = on ? '0' : '1';
      button.disabled = true;
      const result = await tryInvoke('set_app_setting', { key, value });
      button.disabled = false;
      if (result) {
        button.classList.toggle('on', !on);
        button.setAttribute('aria-pressed', String(!on));
        state.view = result;
        markSaved('Сохранено');
        requestRefresh();
      }
    });
  });

  const volume = $('#settings-volume', root);
  if (volume) {
    const label = $('#settings-volume-value', root);
    bindSlider(volume, {
      onChange: (fraction) => {
        if (label) label.textContent = `${Math.round(fraction * 100)}%`;
      },
      onCommit: async (fraction) => {
        const result = await tryInvoke('set_app_setting', { key: 'volume', value: fraction.toFixed(3) });
        if (result) {
          state.view = result;
          markSaved('Сохранено');
          requestRefresh();
        }
      },
    });
  }

  $('#twitch-connect', root)?.addEventListener('click', () => {
    const input = $('#twitch-client-id', root);
    const clientId = input ? input.value.trim() : '';
    if (clientId.length < 20) {
      toast('Client ID должен быть длиной не меньше 20 символов', 'warn');
      return;
    }
    startLogin(clientId);
  });
  $('#twitch-reconnect', root)?.addEventListener('click', () => {
    const clientId = view.client_id || '';
    if (!clientId) {
      toast('Не найден Client ID — укажите его заново', 'warn');
      return;
    }
    startLogin(clientId);
  });
  $('#twitch-get-client-id', root)?.addEventListener('click', () =>
    invoke('open_url', { url: 'https://dev.twitch.tv/console/apps' }).catch(() => {})
  );
  $('#twitch-open-activate', root)?.addEventListener('click', () =>
    invoke('open_url', { url: 'https://www.twitch.tv/activate' }).catch(() => {})
  );
  $('#twitch-copy-code', root)?.addEventListener('click', async () => {
    const code = $('#auth-code', root)?.textContent?.trim();
    if (!code) return;
    try {
      await navigator.clipboard.writeText(code);
      toast('Код скопирован');
    } catch {
      toast('Не удалось скопировать код', 'error');
    }
  });
  $('#twitch-cancel', root)?.addEventListener('click', async () => {
    const result = await tryInvoke('twitch_cancel_login');
    if (result) {
      state.view = result;
      requestRefresh();
    }
  });
  $('#twitch-refresh-data', root)?.addEventListener('click', async () => {
    const result = await tryInvoke('refresh_twitch_now');
    if (result) {
      state.view = result;
      requestRefresh();
      toast('Данные Twitch обновлены');
    }
  });
  $('#twitch-restart-eventsub', root)?.addEventListener('click', async () => {
    const result = await tryInvoke('restart_eventsub');
    if (result) {
      state.view = result;
      requestRefresh();
      toast('Прослушивание активаций перезапущено');
    }
  });
  $('#twitch-disconnect', root)?.addEventListener('click', async () => {
    const ok = await confirmDialog({
      title: 'Отключить Twitch?',
      text: 'Звуки и очередь останутся, но награды и чат перестанут работать, пока вы снова не войдёте.',
      confirmLabel: 'Отключить',
      danger: true,
    });
    if (!ok) return;
    const result = await tryInvoke('twitch_disconnect');
    if (result) {
      state.view = result;
      requestRefresh();
      toast('Twitch отключён');
    }
  });

  bindSoundTest(root);
  $('#audio-restart', root)?.addEventListener('click', async () => {
    const result = await tryInvoke('restart_audio');
    if (result) {
      state.view = result;
      requestRefresh();
      toast('Аудиовыход перезапущен');
    }
  });
  $('#audio-stop-all', root)?.addEventListener('click', async () => {
    const ok = await tryInvoke('stop_all_sounds');
    if (ok !== null) {
      toast('Все звуки остановлены');
      requestRefresh();
    }
  });
  $('#audio-normalize', root)?.addEventListener('click', async () => {
    const ok = await confirmDialog({
      title: 'Выровнять громкость звуков?',
      text: 'Индивидуальные громкости привязанных звуков будут пересчитаны по их реальной громкости. Текущие значения заменятся.',
      confirmLabel: 'Выровнять',
    });
    if (!ok) return;
    const result = await tryInvoke('normalize_volumes');
    if (result) {
      state.view = result;
      requestRefresh();
      toast('Измеряем громкость звуков…');
    }
  });

  $('#app-hide', root)?.addEventListener('click', () => {
    invoke('win_hide').then(() => toast('Окно свёрнуто в трей')).catch(() => {});
  });
  $('#app-exit', root)?.addEventListener('click', async () => {
    const ok = await confirmDialog({
      title: 'Выйти из Reward Sounds?',
      text: 'Звуки наград и музыка перестанут работать до следующего запуска.',
      confirmLabel: 'Выйти',
      danger: true,
    });
    if (ok) invoke('exit_app').catch(() => {});
  });

  $('#open-music-settings', root)?.addEventListener('click', openMusicSettings);
  $('#open-music-tab', root)?.addEventListener('click', () => navigate('music'));
  $('#open-config-folder', root)?.addEventListener('click', () => invoke('open_folder', { kind: 'config' }).catch(() => {}));
  $('#open-log-folder', root)?.addEventListener('click', () => invoke('open_folder', { kind: 'logs' }).catch(() => {}));
}

async function copySettingsDiagnostics() {
  try {
    await navigator.clipboard.writeText(diagnosticsText(state.view || {}));
    toast('Диагностика скопирована');
  } catch {
    toast('Не удалось скопировать диагностику', 'error');
  }
}

async function startLogin(clientId) {  const result = await tryInvoke('twitch_start_login', { clientId });
  if (result) {
    state.view = result;
    requestRefresh();
  }
}

function markSaved(text = '✓ Сохранено') {
  const node = $('#settings-save-state');
  if (!node) return;
  node.textContent = text;
  node.classList.add('saved');
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    node.textContent = 'Изменения сохраняются автоматически';
    node.classList.remove('saved');
  }, 4000);
}

/* ============================ обновление без перерисовки ============================ */

function updateLiveBits(root, view) {
  const normalizing = !!view.normalizing;
  const button = $('#audio-normalize', root);
  if (button) button.disabled = normalizing || !(view.bindings > 0);
  if (view.normalize_message && view.normalize_message !== lastNormalizeMessage) {
    lastNormalizeMessage = view.normalize_message;
    toast(view.normalize_message, view.normalize_message.startsWith('Громкость') ? 'info' : 'warn');
    requestRefresh();
  }
}
