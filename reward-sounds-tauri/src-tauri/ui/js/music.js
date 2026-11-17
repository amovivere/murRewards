/* Вкладка «Музыка»: плеер, очередь, OBS-оверлей и настройки музыки. */

import {
  state,
  $,
  $$,
  invoke,
  tryInvoke,
  toast,
  confirmDialog,
  menu,
  icons,
  escapeHtml,
  fmtDuration,
  bindSlider,
  paintSlider,
  requestRefresh,
  navigate,
  createModal,
  exitMenuItem,
} from './bridge.js';

const OVERLAY_URL = 'http://127.0.0.1:8770/overlay';

let boundRoot = null;
let lastSignature = '';
let clock = null;
let clockStartedAt = 0;

export function renderMusic(root, view) {
  boundRoot = root;
  root.innerHTML = musicPageHtml(view);
  bind(root, view);
  lastSignature = musicSignature(view);
  startClock(view);
}

export function syncMusic(root, view) {
  if (state.tab !== 'music' || boundRoot !== root) return;
  const signature = musicSignature(view);
  if (signature !== lastSignature) {
    renderMusic(root, view);
  } else {
    updateProgress(view);
  }
}

/** Вызывается из requestAnimationFrame в app.js: двигает полосу прогресса. */
export function tickPlayer() {
  if (state.tab === 'music') updateProgress(state.view);
}

function musicSignature(view) {
  const music = view.music || {};
  return JSON.stringify({
    enabled: music.enabled,
    ready: music.ready,
    ytdlp: music.ytdlp_version,
    error: music.error,
    current: music.current && { id: music.current.id, state: music.current.state },
    player: music.player && { loaded: music.player.loaded, paused: music.player.paused, duration: music.player.duration_sec, error: music.player.error },
    items: (music.items || []).map((item) => [item.id, item.state, item.title, item.prefetched]),
    prefetched: music.prefetched,
    volume: music.volume,
    enabled_changed: music.enabled,
    reward: [music.reward_id, music.reward_title, music.reward_cost],
    overlay: [music.overlay_seconds, music.overlay_position, music.overlay_font],
    max: [music.max_queue, music.max_duration_sec],
  });
}

/* ============================ разметка ============================ */

function musicPageHtml(view) {
  const music = view.music || {};
  const status = statusInfo(view);
  const missing = missingReasons(view);
  const current = music.current;
  const items = music.items || [];

  return `
    <div class="page-head">
      <div>
        <h1 class="h1">Музыка</h1>
        <div class="sub">Треки по заявке: зритель присылает ссылку на YouTube в чат</div>
      </div>
      <div class="head-actions">
        <button class="btn btn-icon btn-ghost" id="music-menu" title="Действия">•••</button>
        <button class="btn btn-secondary" id="obs-open">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="4.5"/></svg>
          Оверлей OBS
        </button>
        <button class="btn btn-music-state" id="music-enabled">${dot(music.enabled && music.ready)}${escapeHtml(status.label)}</button>
      </div>
    </div>

    ${missing.length ? readinessBanner(missing) : ''}
    ${music.error ? errorBanner(music.error) : ''}

    <div class="toolbar" id="music-toolbar">
      <button class="pill active" id="music-reward-pill" title="Награда и цена">
        Награда: ${escapeHtml(music.reward_title || 'не выбрана')} · ${Number(music.reward_cost) || 0} баллов
      </button>
      <button class="btn btn-sm btn-ghost" id="music-price">Изменить</button>
      <div class="spacer"></div>
      <button class="pill ${music.ytdlp_version ? 'pill-accent' : 'pill-danger'}" id="ytdlp-pill" title="Проверить yt-dlp заново">
        ${music.ytdlp_version ? icons.check : icons.warning}${music.ytdlp_version ? `yt-dlp ${escapeHtml(music.ytdlp_version)}` : 'yt-dlp не найден'}
      </button>
    </div>

    <div class="card music-player" id="music-player">
      <div class="player-art">${musicIcon()}</div>
      <div class="player-info">
        <div class="player-state" id="player-state">${playerStateLabel(view)}</div>
        <div class="player-title" id="player-title">${escapeHtml(current?.title || 'Ничего не играет')}</div>
        <div class="player-meta" id="player-meta">${escapeHtml(playerMeta(current))}</div>
        ${
          current
            ? `<div class="player-progress-row">
          <span class="player-time" id="player-position">${fmtDuration(music.player?.position_sec)}</span>
          <div id="track-progress" role="slider" tabindex="0" aria-label="Перемотка" aria-valuemin="0" aria-valuemax="${Number(music.player?.duration_sec) || 0}" aria-valuenow="${Number(music.player?.position_sec) || 0}">
            <div class="track"></div>
            <div class="fill" id="progress-fill"></div>
            <div class="knob" id="progress-knob"></div>
          </div>
          <span class="player-time" id="player-duration">${fmtDuration(music.player?.duration_sec || current?.duration_sec)}</span>
        </div>
        <div class="player-controls">
          <button class="player-round" id="player-restart" title="Сначала">${restartIcon()}</button>
          <button class="player-play" id="play-toggle" title="${music.player?.paused ? 'Продолжить' : 'Пауза'}">${music.player?.paused ? icons.play : icons.pause}</button>
          <button class="player-round" id="player-skip" title="Пропустить трек">${skipIcon()}</button>
          <button class="player-text" id="skip-track">Пропустить трек</button>
        </div>`
            : `<div class="player-cta">
                 <button class="btn btn-sm btn-secondary" id="player-empty-add">Поставить трек вручную</button>
                 <button class="btn btn-sm btn-ghost" id="player-empty-reward">Настроить награду</button>
               </div>
               <div class="player-empty-hint">Плеер появится, когда придёт первый трек — из награды или ручной очереди.</div>`
        }
      </div>
      <div class="player-side">
        <div class="player-side-title">Громкость музыки</div>
        <div class="player-volume-row">
          <div class="slider" id="music-volume"><div class="track"></div><div class="fill" style="width:${(Number(music.volume) || 0) * 100}%"></div><div class="knob" style="left:${(Number(music.volume) || 0) * 100}%"></div></div>
          <span class="player-volume-value" id="music-volume-value">${Math.round((Number(music.volume) || 0) * 100)}%</span>
        </div>
        <div class="player-side-hint">Не меняет громкость Windows — только очередь.</div>
        <div class="player-next">Следующий: <span>${escapeHtml(nextTitle(view))}</span></div>
      </div>
    </div>

    <div class="card music-queue" id="music-queue">
      <div class="queue-head">
        <div class="queue-title">Очередь · ${queueCount(items)} из ${Number(music.max_queue) || 0}</div>
        ${queueCountPills(items)}
        <div class="spacer"></div>
        <button class="ghost-red" id="queue-clear"${queueCount(items) ? '' : ' disabled'}>Очистить</button>
      </div>
      <div class="queue-list" id="queue-list">${items.map(queueRowHtml).join('')}</div>
      ${items.length ? '' : '<div class="queue-empty" id="queue-empty">Очередь пуста. Ссылка из активации награды появится здесь.</div>'}
      <div class="queue-add-row">
        <label class="search" for="manual-url">${plusIcon()}<input id="manual-url" type="text" placeholder="Вставьте ссылку YouTube и нажмите Enter — трек встанет в очередь" autocomplete="off"></label>
        <button class="btn btn-secondary btn-sm" id="manual-add">В очередь</button>
      </div>
      <div class="queue-hint">Ручная очередь не тратит баллы зрителей — удобно для проверки.</div>
    </div>

    <div class="music-bottom">
      <div class="card obs-card" id="obs-card">
        <div class="obs-head">
          <div class="section-title">OBS — строка «Сейчас играет»</div>
          <div class="spacer"></div>
          <button class="btn btn-sm btn-ghost" id="obs-settings">Настроить</button>
        </div>
        <div class="obs-row">
          <code>http://127.0.0.1:8770/overlay</code>
          <button class="copy-btn" id="obs-copy-url" title="Скопировать ссылку">${icons.copy}</button>
          <button class="btn btn-sm btn-secondary" id="obs-show-now"${current ? '' : ' disabled title="Нет играющего трека"'}>Показать сейчас</button>
        </div>
        <div class="obs-preview ${current ? '' : ' empty'}" id="obs-preview">
          ${current ? `<span class="eq">${bars()}</span><span class="obs-track">${escapeHtml(current.title)}</span><span class="obs-user">· заказал @${escapeHtml(current.user_login)}</span>` : '<span class="obs-empty">Ничего не играет</span>'}
        </div>
      </div>
      <div class="card state-card" id="state-card">
        <div class="section-title">Состояние</div>
        <div class="state-list">
          ${stateRow(music.ytdlp_version ? 'ok' : 'warn', music.ytdlp_version ? `yt-dlp ${escapeHtml(music.ytdlp_version)} — готов` : 'yt-dlp не найден', music.ytdlp_version ? '' : 'recheck')}
          ${stateRow(view.chat_ready ? 'ok' : 'warn', view.chat_ready ? 'Чат: команда !трек включена' : 'Чат: нужен Twitch', view.chat_ready ? '' : 'chat')}
          ${stateRow(view.audio_ready ? 'ok' : 'error', view.audio_ready ? `Звук: ${escapeHtml(view.audio_device || 'устройство по умолчанию')}` : 'Звук: нет аудиовыхода', view.audio_ready ? '' : 'audio')}
        </div>
      </div>
    </div>
  `;
}

function statusInfo(view) {
  const music = view.music || {};
  if (!music.enabled) return { label: 'Приём выключен', tone: 'muted' };
  if (!view.connected) return { label: 'Нужен Twitch', tone: 'warn' };
  if (view.eventsub !== 'listening') return { label: 'Награды не слушаются', tone: 'warn' };
  if (!music.reward_id) return { label: 'Не выбрана награда', tone: 'warn' };
  if (!music.ytdlp_version) return { label: 'Нет yt-dlp', tone: 'danger' };
  if (!music.ready) return { label: 'Готовимся…', tone: 'warn' };
  return { label: 'Принимаем заявки', tone: 'ok' };
}

function missingReasons(view) {
  const music = view.music || {};
  const reasons = [];
  if (!music.enabled) reasons.push({ text: 'приём заявок выключен', action: 'enable' });
  if (!view.connected) reasons.push({ text: 'Twitch не подключён', action: 'twitch' });
  else if (view.eventsub !== 'listening') reasons.push({ text: 'активации наград не слушаются', action: 'eventsub' });
  if (!music.reward_id) reasons.push({ text: 'не выбрана награда', action: 'reward' });
  if (!music.ytdlp_version) reasons.push({ text: 'не найден yt-dlp', action: 'recheck' });
  return reasons;
}

function readinessBanner(reasons) {
  return `
    <div class="banner banner-warn" id="music-readiness">
      <span class="banner-icon">${icons.warning}</span>
      <div class="banner-text">Заявки пока не принимаются: ${reasons.map((reason) => escapeHtml(reason.text)).join('; ')}.</div>
      <button class="btn btn-sm btn-secondary" id="readiness-fix">Настроить</button>
    </div>`;
}

function errorBanner(message) {
  return `<div class="banner banner-error"><span class="banner-icon">${icons.warning}</span><div class="banner-text">${escapeHtml(message)}</div></div>`;
}

function queueCount(items) {
  return items.filter((item) => item.state !== 'done').length;
}

function queueCountPills(items) {
  const playing = items.filter((item) => item.state === 'playing').length;
  const loading = items.filter((item) => item.state === 'loading').length;
  const parts = [];
  if (playing) parts.push(`<span class="pill pill-sm pill-accent">${playing} играет</span>`);
  if (loading) parts.push(`<span class="pill pill-sm pill-warn">${loading} загружается</span>`);
  return parts.join('');
}

function queueRowHtml(item, index) {
  const stateColor = item.state === 'playing' ? 'pill-accent' : item.state === 'loading' ? 'pill-warn' : 'pill-muted';
  const stateLabel = {
    queued: 'в очереди',
    loading: 'загрузка',
    playing: 'играет',
    failed: 'ошибка',
    refunded: 'баллы возвращены',
  }[item.state] || item.state;
  return `
    <div class="queue-row ${item.state === 'playing' ? 'playing' : ''}" data-id="${escapeHtml(item.id)}">
      <span class="queue-index">${index + 1}</span>
      <div class="queue-main">
        <div class="queue-name">${escapeHtml(item.title)}</div>
        <div class="queue-meta">@${escapeHtml(item.user_login)}${item.duration_sec ? ` · ${fmtDuration(item.duration_sec)}` : ''}${item.channel ? ` · ${escapeHtml(item.channel)}` : ''}</div>
        ${item.state === 'loading' ? '<div class="queue-loading"><span></span></div>' : ''}
      </div>
      ${item.prefetched ? '<span class="queue-prefetch">загружен</span>' : ''}
      <span class="pill pill-sm ${stateColor}">${escapeHtml(stateLabel)}</span>
      ${item.state === 'queued' && index > 0 ? `<button class="queue-btn" data-queue="up" title="Поднять выше">${chevronUpIcon()}</button>` : ''}
      <button class="queue-btn" data-queue="remove" title="Убрать из очереди">${icons.close}</button>
    </div>`;
}

function stateRow(tone, text, action) {
  const icon = tone === 'ok' ? icons.check : icons.warning;
  return `<div class="state-row state-${tone}">
    <span class="state-icon">${icon}</span><span class="state-text">${escapeHtml(text)}</span>
    ${action ? `<button class="btn btn-sm btn-ghost state-action" data-state-action="${action}">Исправить</button>` : ''}
  </div>`;
}

function dot(ok) {
  return `<span class="dot ${ok ? 'dot-green' : 'dot-muted'}"></span>`;
}

function playerStateLabel(view) {
  const music = view.music || {};
  if (!music.current) return '';
  if (music.current.state === 'loading') return 'ЗАГРУЖАЕМ ТРЕК';
  return music.player?.paused ? 'ПАУЗА' : 'СЕЙЧАС ИГРАЕТ';
}

function playerMeta(current) {
  if (!current) return 'Активируйте награду на канале — трек встанет в очередь';
  const who = current.user_login === 'manual' ? 'ручная заявка' : `заказал @${current.user_login}`;
  return `${who}${current.channel ? ` · ${current.channel}` : ''}${current.duration_sec ? ` · ${fmtDuration(current.duration_sec)}` : ''}`;
}

function nextTitle(view) {
  const music = view.music || {};
  if (music.prefetched_title) return music.prefetched_title;
  const next = (music.items || []).find((item) => item.state === 'queued');
  return next ? next.title : '—';
}

function musicIcon() {
  return '<svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#6E6E6E" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18V5l11-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="17" cy="16" r="3"/></svg>';
}

function restartIcon() {
  return '<svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" stroke="none"><path d="M19 6v12L9 12l10-6z"/><rect x="5" y="6" width="2.4" height="12" rx="1"/></svg>';
}

function skipIcon() {
  return '<svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" stroke="none"><path d="M5 6v12l10-6L5 6z"/><rect x="16.6" y="6" width="2.4" height="12" rx="1"/></svg>';
}

function chevronUpIcon() {
  return '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 19V5M5 12l7-7 7 7"/></svg>';
}

function plusIcon() {
  return '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>';
}

function bars() {
  return '<span style="width:3px;height:7px"></span><span style="width:3px;height:12px"></span><span style="width:3px;height:16px"></span><span style="width:3px;height:9px"></span>';
}

/* ============================ события ============================ */

function bind(root, view) {
  const music = view.music || {};

  $('#music-menu', root)?.addEventListener('click', (event) => {
    menu(event.currentTarget, [
      { label: 'Награда и цена', icon: icons.edit, onClick: openPriceModal },
      { label: 'Настройки музыки', icon: icons.folder, onClick: openMusicSettings },
      { label: 'Проверить yt-dlp', icon: icons.refresh, onClick: () => recheckYtdlp() },
      { label: 'Открыть журнал', icon: icons.external, onClick: () => navigate('log') },
      exitMenuItem(),
    ]);
  });

  $('#music-price', root)?.addEventListener('click', openPriceModal);
  $('#player-empty-add', root)?.addEventListener('click', () => {
    const input = $('#manual-url');
    input?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    input?.focus();
  });
  $('#player-empty-reward', root)?.addEventListener('click', openPriceModal);
  $('#music-reward-pill', root)?.addEventListener('click', openPriceModal);
  $('#obs-open', root)?.addEventListener('click', openObsModal);
  $('#obs-settings', root)?.addEventListener('click', openObsModal);

  $('#music-enabled', root)?.addEventListener('click', async () => {
    const enabled = !(state.view?.music?.enabled ?? false);
    const result = await tryInvoke('music_set_enabled', { enabled });
    if (result) {
      state.view = result;
      requestRefresh();
      toast(enabled ? 'Приём заявок включён' : 'Приём заявок выключен');
    }
  });

  $('#ytdlp-pill', root)?.addEventListener('click', () => recheckYtdlp());

  const player = $('#music-player', root);
  $('#play-toggle', root)?.addEventListener('click', () => musicCommand('music_toggle_pause'));
  $('#player-restart', root)?.addEventListener('click', () => musicCommand('music_restart'));
  $('#player-skip', root)?.addEventListener('click', () => musicCommand('music_skip'));
  $('#skip-track', root)?.addEventListener('click', () => musicCommand('music_skip'));

  const progress = $('#track-progress', root);
  progress?.addEventListener('pointerdown', async (event) => {
    const total = Number(state.view?.music?.player?.duration_sec) || 0;
    if (!total) return;
    const rect = progress.getBoundingClientRect();
    const fraction = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width));
    await tryInvoke('music_seek', { sec: Math.round(total * fraction) });
    requestRefresh();
  });
  progress?.addEventListener('keydown', async (event) => {
    const total = Number(state.view?.music?.player?.duration_sec) || 0;
    if (!total) return;
    let position = Number(state.view?.music?.player?.position_sec) || 0;
    const step = event.shiftKey ? 30 : 5;
    if (event.key === 'ArrowRight' || event.key === 'ArrowUp') position += step;
    else if (event.key === 'ArrowLeft' || event.key === 'ArrowDown') position -= step;
    else if (event.key === 'Home') position = 0;
    else if (event.key === 'End') position = total;
    else return;
    event.preventDefault();
    position = Math.max(0, Math.min(total, position));
    await tryInvoke('music_seek', { sec: Math.round(position) });
    requestRefresh();
  });

  const volume = $('#music-volume', root);
  if (volume) {
    bindSlider(volume, {
      onChange: (fraction) => {
        const label = $('#music-volume-value', root);
        if (label) label.textContent = `${Math.round(fraction * 100)}%`;
      },
      onCommit: async (fraction) => {
        const result = await tryInvoke('music_set_volume', { volume: fraction });
        if (result) {
          state.view = result;
          requestRefresh();
        }
      },
    });
  }

  $('#queue-clear', root)?.addEventListener('click', async () => {
    const ok = await confirmDialog({
      title: 'Очистить очередь?',
      text: 'Зрители получат баллы обратно, заявки будут отменены на Twitch.',
      confirmLabel: 'Очистить',
      danger: true,
    });
    if (!ok) return;
    const result = await tryInvoke('music_clear_queue');
    if (result) {
      state.view = result;
      requestRefresh();
      toast('Очередь очищена');
    }
  });

  $('#queue-list', root)?.addEventListener('click', async (event) => {
    const button = event.target.closest('[data-queue]');
    if (!button) return;
    const row = button.closest('.queue-row');
    const id = row?.dataset.id;
    if (!id) return;
    if (button.dataset.queue === 'up') {
      const result = await tryInvoke('music_move_up', { id });
      if (result) {
        state.view = result;
        requestRefresh();
      }
    } else {
      const result = await tryInvoke('music_remove_item', { id });
      if (result) {
        state.view = result;
        requestRefresh();
        toast('Заявка убрана из очереди');
      }
    }
  });

  const manual = $('#manual-url', root);
  const add = async () => {
    const url = manual?.value.trim();
    if (!url) return;
    manual.value = '';
    const result = await tryInvoke('music_add_manual', { url });
    if (result) {
      state.view = result;
      requestRefresh();
      toast('Трек добавлен в очередь');
    }
  };
  manual?.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') add();
  });
  $('#manual-add', root)?.addEventListener('click', add);

  $('#obs-copy-url', root)?.addEventListener('click', copyOverlayUrl);
  $('#obs-show-now', root)?.addEventListener('click', showOverlayNow);
  $('#readiness-fix', root)?.addEventListener('click', () => {
    if (!view.connected) navigate('settings');
    else if (view.eventsub !== 'listening') tryInvoke('restart_eventsub').then(() => requestRefresh());
    else if (!music.reward_id) openPriceModal();
    else if (!music.ytdlp_version) recheckYtdlp();
    else if (!music.enabled) toast('Включите приём заявок кнопкой в шапке', 'warn');
  });

  root.querySelectorAll('[data-state-action]').forEach((button) =>
    button.addEventListener('click', () => {
      const action = button.dataset.stateAction;
      if (action === 'recheck') recheckYtdlp();
      else if (action === 'chat') navigate('settings');
      else if (action === 'audio') navigate('settings');
    })
  );

  // Слайдеры громкости в очереди не нужны; минимальный клик по пустому месту ничего не делает.
  void player;
}

async function musicCommand(command, args = {}) {
  const result = await tryInvoke(command, args);
  if (result) {
    state.view = result;
    requestRefresh();
  }
}

async function recheckYtdlp() {
  const result = await tryInvoke('music_recheck');
  if (result) {
    state.view = result;
    requestRefresh();
    toast(result.music?.ytdlp_version ? `yt-dlp ${result.music.ytdlp_version} найден` : 'yt-dlp не найден');
  }
}

async function copyOverlayUrl() {
  try {
    await navigator.clipboard.writeText(OVERLAY_URL);
    toast('Ссылка на оверлей скопирована');
  } catch {
    toast('Не удалось скопировать ссылку', 'error');
  }
}

async function showOverlayNow() {
  const result = await tryInvoke('music_show_overlay');
  if (result) {
    state.view = result;
    toast('Строка «Сейчас играет» показана в оверлее');
  }
}

/* ============================ таймер прогресса ============================ */

function startClock(view) {
  const music = view.music || {};
  const player = music.player || {};
  clock = {
    base: Number(player.position_sec) || 0,
    total: Number(player.duration_sec) || Number(music.current?.duration_sec) || 0,
    playing: !player.paused && !!music.current,
  };
  clockStartedAt = performance.now();
  updateProgress(view);
}

function updateProgress(view) {
  const music = view?.music || {};
  const current = music.current;
  const total = Number(music.player?.duration_sec) || Number(current?.duration_sec) || 0;
  const positionEl = $('#player-position');
  const durationEl = $('#player-duration');
  if (!clock || !current) {
    if (durationEl) durationEl.textContent = fmtDuration(0);
    return;
  }
  const elapsed = clock.playing ? (performance.now() - clockStartedAt) / 1000 : 0;
  const position = Math.min(clock.total, clock.base + elapsed);
  const fraction = clock.total ? position / clock.total : 0;
  const fill = $('#progress-fill');
  const knob = $('#progress-knob');
  if (fill) fill.style.width = `${(fraction * 100).toFixed(2)}%`;
  if (knob) knob.style.left = `${(fraction * 100).toFixed(2)}%`;
  if (positionEl) positionEl.textContent = fmtDuration(Math.floor(position));
  if (durationEl) durationEl.textContent = fmtDuration(total);
  const progressNode = $('#track-progress');
  if (progressNode) {
    progressNode.setAttribute('aria-valuemax', String(Math.round(total)));
    progressNode.setAttribute('aria-valuenow', String(Math.round(position)));
    progressNode.setAttribute('aria-valuetext', `${fmtDuration(Math.floor(position))} из ${fmtDuration(total)}`);
  }
}

/* ============================ модалка «Награда и цена» ============================ */

function openPriceModal() {
  const view = state.view;
  const music = view.music || {};
  const rewards = (view.rewards || []).filter((reward) => reward.available);
  const selected = music.reward_id || '';
  let chosen = selected;

  const modal = createModal({
    html: `
      <div class="modal-head">
        <div class="modal-title">Награда и цена</div>
        <button class="modal-close" data-act="close" aria-label="Закрыть">${icons.close}</button>
      </div>
      <div class="modal-sub">Из какой награды приходят заявки и сколько баллов платит зритель.</div>
      <div class="modal-label">НАГРАДА</div>
      <div class="reward-choice" id="reward-choice">
        ${rewards.length ? rewards.map((reward) => `
          <button class="reward-choice-row${reward.id === selected ? ' active' : ''}" data-reward-id="${escapeHtml(reward.id)}">
            <span class="reward-choice-title">${escapeHtml(reward.title)}</span>
            <span class="reward-choice-cost">${Number(reward.cost) || 0} баллов</span>
          </button>`).join('') : '<div class="modal-sub">Список наград пуст — обновите его на вкладке «Награды».</div>'}
      </div>
      <div class="modal-label">ЦЕНА, БАЛЛОВ</div>
      <input class="input reward-input" id="music-cost" type="number" min="1" max="1000000" value="${Number(music.reward_cost) || 500}" data-autofocus>
      <div class="modal-sub">«Применить» поменяет цену награды на Twitch и включит обязательный ввод ссылки.</div>
      <div class="modal-actions">
        <div class="right">
          <button class="btn btn-secondary" data-act="close">Отмена</button>
          <button class="btn btn-primary" id="apply-price">Применить</button>
        </div>
      </div>`,
  });

  modal.root.querySelectorAll('[data-act="close"]').forEach((button) =>
    button.addEventListener('click', () => modal.close())
  );
  modal.root.querySelectorAll('[data-reward-id]').forEach((button) =>
    button.addEventListener('click', () => {
      chosen = button.dataset.rewardId;
      modal.root.querySelectorAll('[data-reward-id]').forEach((item) => item.classList.toggle('active', item === button));
      const reward = rewards.find((item) => item.id === chosen);
      const costInput = $('#music-cost', modal.root);
      if (reward && costInput) costInput.value = reward.cost;
    })
  );
  $('#apply-price', modal.root)?.addEventListener('click', async () => {
    const cost = Number($('#music-cost', modal.root).value) || 0;
    if (!(cost >= 1 && cost <= 1_000_000)) {
      toast('Цена — от 1 до 1 000 000 баллов', 'warn');
      return;
    }
    if (!chosen) {
      toast('Сначала выберите награду', 'warn');
      return;
    }
    const button = $('#apply-price', modal.root);
    button.disabled = true;
    button.textContent = 'Применяем…';
    try {
      if (chosen !== selected) {
        await invoke('set_music_reward', { rewardId: chosen });
      }
      await invoke('apply_music_price', { cost });
      modal.close();
      toast('Награда и цена сохранены');
      requestRefresh();
    } catch (error) {
      toast(error.message || String(error), 'error');
      button.disabled = false;
      button.textContent = 'Применить';
    }
  });
}

/* ============================ модалка «Настройки музыки» ============================ */

export function openMusicSettings() {
  const music = state.view?.music || {};
  const minutes = Math.max(1, Math.round((Number(music.max_duration_sec) || 480) / 60));
  const modal = createModal({
    html: `
      <div class="modal-head">
        <div class="modal-title">Настройки музыки</div>
        <span class="save-indicator" id="ms-save-state">Изменения сохраняются сразу</span>
        <button class="modal-close" data-act="close" aria-label="Закрыть">${icons.close}</button>
      </div>
      <div class="setting-row"><span>Заявок в очереди</span><input class="input reward-input setting-number" id="ms-max-queue" type="number" min="1" max="50" value="${Number(music.max_queue) || 10}"></div>
      <div class="setting-row"><span>Максимум, минут</span><input class="input reward-input setting-number" id="ms-max-duration" type="number" min="1" max="120" value="${minutes}"></div>
      <label class="setting-toggle"><input type="checkbox" id="ms-pause-yandex" ${music.pause_yandex ? 'checked' : ''}> Ставить Яндекс Музыку на паузу и возвращать после</label>
      <label class="setting-toggle"><input type="checkbox" id="ms-restore-queue" ${music.restore_queue ? 'checked' : ''}> Восстанавливать очередь после перезапуска</label>
      <div class="modal-sub">Кнопки «Сохранить» нет: изменения применяются сразу, как в OBS-модалке. Очередь хранится в queue.json рядом с настройками.</div>
      <div class="modal-actions">
        <div class="right">
          <button class="btn btn-secondary" id="ms-obs">Настроить оверлей</button>
          <button class="btn btn-primary" data-act="close">Закрыть</button>
        </div>
      </div>`,
  });

  let timer = null;
  const setSaveState = (text, saved = false) => {
    const node = $('#ms-save-state', modal.root);
    if (!node) return;
    node.textContent = text;
    node.classList.toggle('saved', saved);
  };
  const collect = () => ({
    maxQueue: Number($('#ms-max-queue', modal.root).value) || 10,
    maxDurationSec: Math.max(1, Number($('#ms-max-duration', modal.root).value) || 8) * 60,
    pauseYandex: $('#ms-pause-yandex', modal.root).checked,
    restoreQueue: $('#ms-restore-queue', modal.root).checked,
  });
  const save = () => {
    if (timer) clearTimeout(timer);
    setSaveState('Сохраняем…');
    timer = setTimeout(async () => {
      try {
        const result = await invoke('set_music_settings', { patch: collect() });
        if (result) {
          state.view = result;
          setSaveState('✓ Сохранено', true);
          requestRefresh();
        }
      } catch {
        setSaveState('Не сохранено', false);
      }
    }, 400);
  };

  modal.root.querySelectorAll('[data-act="close"]').forEach((button) =>
    button.addEventListener('click', () => modal.close())
  );
  modal.root.querySelectorAll('input').forEach((input) => input.addEventListener('change', save));
  $('#ms-obs', modal.root)?.addEventListener('click', () => {
    modal.close();
    openObsModal();
  });
}

/* ============================ модалка OBS ============================ */

export function openObsModal() {
  const music = state.view?.music || {};
  const seconds = Number(music.overlay_seconds) || 0;
  const font = Number(music.overlay_font) || 17;
  const position = music.overlay_position === 'bottom' ? 'bottom' : 'top';
  const hasTrack = !!music.current;
  let saveTimer = null;

  const modal = createModal({
    html: `
      <div class="modal-head">
        <div class="modal-title">OBS — строка «Сейчас играет»</div>
        <button class="modal-close" data-act="close" aria-label="Закрыть">${icons.close}</button>
      </div>
      <div class="modal-sub">Добавьте ссылку в OBS как источник «Браузер». Строка показывается, когда играет трек.</div>
      <div class="modal-label">ССЫЛКА ДЛЯ ИСТОЧНИКА</div>
      <div class="urlrow">
        <code>${OVERLAY_URL}</code>
        <button class="btn btn-icon btn-ghost" id="obs-copy" title="Скопировать">${icons.copy}</button>
      </div>
      <div class="modal-row">
        <span>Показывать, секунд</span>
        <input class="input reward-input setting-number" id="obs-seconds" type="number" min="0" max="600" value="${seconds}">
        <span class="modal-hint">0 — показывать всё время, пока играет трек</span>
      </div>
      <div class="modal-row">
        <span>Размер шрифта</span>
        <input class="input reward-input setting-number" id="obs-font" type="number" min="12" max="48" value="${font}">
        <span class="modal-hint">px</span>
      </div>
      <div class="modal-row">
        <span>Положение</span>
        <div class="pos" id="obs-pos">
          <button class="${position === 'top' ? 'active' : ''}" data-pos="top">Сверху</button>
          <button class="${position === 'bottom' ? 'active' : ''}" data-pos="bottom">Снизу</button>
        </div>
      </div>
      <div class="modal-sub">Источник: ширина 1920, высота 200–300. «Обновлять при активации» и «Выключать, когда не виден» — выключить. Команда !трек в чате показывает строку ещё раз.</div>
      <div class="modal-actions">
        <button class="btn btn-secondary" id="obs-browser">Открыть в браузере</button>
        <div class="right">
          <button class="btn btn-secondary" id="obs-show-now"${hasTrack ? '' : ' disabled title="Нет играющего трека"'}>Показать сейчас</button>
          <button class="btn btn-primary" id="obs-done">Закрыть</button>
        </div>
      </div>`,
    onClose: () => {
      if (saveTimer) clearTimeout(saveTimer);
    },
  });

  const save = (patch) => {
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(async () => {
      const result = await tryInvoke('set_music_settings', { patch });
      if (result) {
        state.view = result;
        requestRefresh();
      }
    }, 350);
  };

  modal.root.querySelectorAll('[data-act="close"]').forEach((button) =>
    button.addEventListener('click', () => modal.close())
  );
  $('#obs-done', modal.root)?.addEventListener('click', () => modal.close());
  $('#obs-copy', modal.root)?.addEventListener('click', copyOverlayUrl);
  $('#obs-show-now', modal.root)?.addEventListener('click', async () => {
    await showOverlayNow();
  });
  $('#obs-browser', modal.root)?.addEventListener('click', () =>
    invoke('open_url', { url: OVERLAY_URL }).catch(() => {})
  );
  $('#obs-seconds', modal.root)?.addEventListener('change', (event) => {
    const value = Math.max(0, Math.min(600, Number(event.target.value) || 0));
    save({ overlaySeconds: value });
  });
  $('#obs-font', modal.root)?.addEventListener('change', (event) => {
    const value = Math.max(12, Math.min(48, Number(event.target.value) || 17));
    save({ overlayFont: value });
  });
  modal.root.querySelectorAll('#obs-pos button').forEach((button) =>
    button.addEventListener('click', () => {
      modal.root.querySelectorAll('#obs-pos button').forEach((item) => item.classList.toggle('active', item === button));
      save({ overlayPosition: button.dataset.pos });
    })
  );
}
