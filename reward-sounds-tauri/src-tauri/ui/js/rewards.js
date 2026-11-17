/* Вкладка «Награды»: карточки/список, фильтры, редактор награды, локальные привязки. */

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
  pluralRu,
  fmtDuration,
  fmtPercent,
  bindSlider,
  paintSlider,
  sliderFraction,
  requestRefresh,
  navigate,
  createModal,
  exitMenuItem,
} from './bridge.js';

const DASHBOARD_URL = 'https://dashboard.twitch.tv/';

const filters = { search: '', filter: 'all', sort: 'default' };
let lastSignature = '';
let boundRoot = null;

export function renderRewards(root, view) {
  boundRoot = root;
  root.innerHTML = rewardsPageHtml(view);
  renderCards(root, view);
  bind(root, view);
  lastSignature = rewardsSignature(view);
}

/** Обновление по опросу состояния: перерисовываем только при изменении данных. */
export function syncRewards(root, view) {
  if (state.tab !== 'rewards' || boundRoot !== root) return;
  const signature = rewardsSignature(view);
  if (signature !== lastSignature) {
    // Сохраняем фокус в поиске, чтобы ввод не прерывался.
    const searchFocused = document.activeElement?.id === 'reward-search';
    const caret = searchFocused ? document.activeElement.selectionStart : null;
    renderRewards(root, view);
    if (searchFocused) {
      const input = $('#reward-search');
      if (input) {
        input.focus();
        if (caret != null) input.setSelectionRange(caret, caret);
      }
    }
  } else {
    updateDynamicBits(root, view);
  }
}

function rewardsSignature(view) {
  return JSON.stringify({
    rewards: view?.rewards,
    loading: view?.rewards_loading,
    error: view?.rewards_error,
    grid: view?.grid_view,
    bindings: view?.local_bindings,
    playing: view?.playing,
  });
}

/* ============================ разметка ============================ */

function rewardsPageHtml(view) {
  const rewards = allRewards(view);
  const available = rewards.filter((reward) => reward.available);
  const disabled = rewards.filter((reward) => !reward.available);
  const withSound = available.filter((reward) => reward.has_sound).length;
  const playingIds = new Set(view.playing || []);
  const playing = available.filter((reward) => playingIds.has(reward.id)).length;
  const list = filters.filter === 'disabled' ? disabled : available;
  const empty = list.length === 0;

  return `
    <div class="page-head">
      <div>
        <h1 class="h1">Награды</h1>
        <div class="sub">${escapeHtml(subtitle(view, available.length, withSound))}</div>
      </div>
      <div class="head-actions">
        <button class="btn btn-icon btn-ghost dots-button" id="rewards-menu" title="Действия">•••</button>
        <button class="btn btn-primary" id="reward-create">${icons.plus}Создать награду</button>
      </div>
    </div>

    <div class="toolbar" id="rewards-toolbar">
      <label class="search" for="reward-search">
        ${icons.search}
        <input id="reward-search" type="text" placeholder="Поиск награды" autocomplete="off" value="${escapeHtml(filters.search)}">
      </label>
      <div class="seg" id="view-mode">
        <button class="seg-item${view.grid_view ? ' active' : ''}" data-view="grid">${gridIcon()}${view.grid_view ? 'Плитка' : 'Плитка'}</button>
        <button class="seg-item${view.grid_view ? '' : ' active'}" data-view="list">${listIcon()}Список</button>
      </div>
      <select class="select" id="reward-sort">
        <option value="default"${filters.sort === 'default' ? ' selected' : ''}>Все награды</option>
        <option value="expensive"${filters.sort === 'expensive' ? ' selected' : ''}>Сначала дорогие</option>
        <option value="cheap"${filters.sort === 'cheap' ? ' selected' : ''}>Сначала дешёвые</option>
        <option value="title"${filters.sort === 'title' ? ' selected' : ''}>По названию</option>
      </select>
      <div class="spacer"></div>
      <div class="toolbar-actions">
        <button class="btn btn-sm btn-secondary filters-toggle" id="rewards-filters" title="Фильтры наград">Фильтры <span id="filters-count"></span></button>
        <button class="btn btn-icon btn-secondary" id="reward-refresh" title="Обновить список">${icons.refresh}</button>
        <button class="btn btn-ghost btn-danger-ghost" id="stop-all"${playing ? '' : ' disabled title="Нет играющих звуков"'}>
          ${icons.stop}Остановить всё
        </button>
      </div>
    </div>

    <div class="pills" id="reward-pills">
      ${pill('all', 'Все', available.length, '')}
      ${pill('sound', 'Со звуком', withSound, '')}
      ${pill('nosound', 'Без звука', available.length - withSound, 'pill-dot-amber')}
      ${pill('playing', 'Играет', playing, 'pill-dot-accent')}
      ${pill('disabled', 'Выключенные', disabled.length, 'pill-dot-muted')}
    </div>

    ${view.rewards_error ? errorBanner(view.rewards_error) : ''}
    ${view.rewards_loading && rewards.length === 0 ? loadingState() : ''}

    <div id="rewards-body">
      <div id="rewards-list" class="${view.grid_view ? 'grid' : 'reward-list'}"></div>
    </div>

    ${blockedBlock(disabled, view)}
    ${orphanBlock(view)}
    ${localBindingsBlock(view)}
  `;
}

function subtitle(view, total, withSound) {
  if (!view.connected) return 'Подключите Twitch, чтобы увидеть награды';
  if (view.rewards_loading && total === 0) return 'Загружаем список наград…';
  const login = view.login || view.display_name || '';
  return `@${login} · ${total} ${pluralRu(total, 'награда', 'награды', 'наград')} · ${withSound} со звуком`;
}

function pill(filter, label, count, dotClass) {
  const active = filters.filter === filter ? ' active' : '';
  return `<button class="pill${active}" data-filter="${filter}">
    ${dotClass ? `<span class="dot ${dotClass}"></span>` : ''}${escapeHtml(label)} <b>${count}</b>
  </button>`;
}

function errorBanner(message) {
  return `
    <div class="banner banner-error" id="rewards-error">
      <span class="banner-icon">${icons.warning}</span>
      <div class="banner-text">${escapeHtml(message)}</div>
      <button class="btn btn-sm btn-secondary" id="rewards-retry">Повторить</button>
    </div>`;
}

function loadingState() {
  return `<div class="card loading-card">Загружаем награды…</div>`;
}

function emptyState(view) {
  if (!view.connected) {
    return `<div class="card empty-card"><b>Twitch не подключён</b><br>Подключите аккаунт в настройках, чтобы увидеть награды канала.</div>`;
  }
  if (view.rewards_error) return '';
  if (allRewards(view).length === 0) {
    return `<div class="card empty-card">
      <b>Наград пока нет</b><br>Создайте награду на Twitch или прямо здесь.
      <div class="settings-actions"><button class="btn btn-primary" data-empty-action="create">Создать награду</button>
      <button class="btn btn-secondary" data-empty-action="twitch">Открыть панель Twitch</button></div>
    </div>`;
  }
  return `<div class="card empty-card"><b>Ничего не найдено</b><br>Измените поиск или фильтр.
    <div class="settings-actions"><button class="btn btn-secondary" data-empty-action="reset">Сбросить фильтры</button></div></div>`;
}

function blockedBlock(disabled, view) {
  if (disabled.length === 0) return '';
  const open = state.rewards.expandedDisabled;
  return `
    <div class="collapsed-block${open ? ' open' : ''}" id="disabled-block">
      <button class="collapsed" id="disabled-toggle">
        ${icons.chevron}<span>Выключенные и недоступные награды · ${disabled.length}</span>
        <span class="chev">${open ? 'Скрыть' : 'Показать'}</span>
      </button>
      ${open ? `<div class="grid disabled-grid" id="disabled-grid">${disabled.map((reward) => cardHtml(reward, view)).join('')}</div>` : ''}
    </div>`;
}

function orphanBlock(view) {
  const rewards = allRewards(view);
  const known = new Set(rewards.map((reward) => reward.id));
  const orphans = (view.local_bindings || []).filter((binding) => !known.has(binding.reward_id) && binding.file);
  if (orphans.length === 0) return '';
  return `
    <div class="card orphan-card">
      <div class="section-title">Привязки без награды на Twitch · ${orphans.length}</div>
      <div class="orphan-list">
        ${orphans
          .map(
            (binding) => `
          <div class="orphan-row">
            <span class="orphan-name">${escapeHtml(binding.title || binding.reward_id)}</span>
            <span class="orphan-meta">${escapeHtml(binding.file?.meta || '')}</span>
            <button class="btn btn-sm btn-secondary" data-orphan-play="${escapeHtml(binding.reward_id)}">Прослушать</button>
            <button class="ghost-red" data-orphan-remove="${escapeHtml(binding.reward_id)}">Убрать звук</button>
          </div>`
          )
          .join('')}
      </div>
    </div>`;
}

function localBindingsBlock(view) {
  const bindings = view.local_bindings || [];
  if (bindings.length === 0) return '';
  const open = state.rewards.localOpen;
  return `
    <div class="card local-card">
      <div class="local-head">
        <div class="section-title">Локальные привязки · ${bindings.length}</div>
        <span class="pill pill-sm">работают без Twitch</span>
        <div class="spacer"></div>
        <button class="btn btn-sm btn-ghost" id="local-toggle">${open ? 'Свернуть' : 'Показать все'}</button>
      </div>
      ${open ? `<div class="local-grid">${bindings.map(localBindingCard).join('')}</div>` : ''}
    </div>`;
}

function localBindingCard(binding) {
  const file = binding.file;
  const exists = !!file?.exists;
  const volume = Math.max(0, Math.min(2, Number(file?.volume) || 0));
  const volumePct = (volume / 2) * 100;
  return `
    <div class="local-binding" data-id="${escapeHtml(binding.reward_id)}">
      <div class="local-title">${escapeHtml(binding.title || binding.reward_id)}${binding.music ? '<span class="music-badge">МУЗЫКА</span>' : ''}</div>
      <div class="local-meta">${exists ? escapeHtml(file?.meta || '') : 'файл не найден'}</div>
      <div class="local-row">
        <button class="soundchip-play" data-local-play="${escapeHtml(binding.reward_id)}" title="Прослушать"${exists ? '' : ' disabled'}>${icons.play}</button>
        <div class="slider sm${exists ? '' : ' disabled'}" data-local-volume="${escapeHtml(binding.reward_id)}">
          <div class="track"></div><div class="fill" style="width:${volumePct}%"></div>
          <div class="knob" style="left:${volumePct}%"></div>
        </div>
        <span class="local-value">${Math.round(volume * 100)}%</span>
        <button class="ghost-red" data-local-remove="${escapeHtml(binding.reward_id)}">Убрать</button>
      </div>
    </div>`;
}

/* ============================ карточки ============================ */

function allRewards(view) {
  return (view?.rewards || []).slice();
}

function sortedFiltered(rewards, view) {
  const playing = new Set(view.playing || []);
  const query = filters.search.trim().toLowerCase();
  let list = rewards.filter((reward) => {
    const title = (reward.title || '').toLowerCase();
    if (!title.includes(query)) return false;
    if (filters.filter === 'sound') return reward.has_sound;
    if (filters.filter === 'nosound') return !reward.has_sound;
    if (filters.filter === 'playing') return playing.has(reward.id);
    if (filters.filter === 'disabled') return !reward.available;
    return reward.available;
  });
  if (filters.sort === 'expensive') list.sort((a, b) => b.cost - a.cost);
  else if (filters.sort === 'cheap') list.sort((a, b) => a.cost - b.cost);
  else if (filters.sort === 'title') list.sort((a, b) => (a.title || '').localeCompare(b.title || '', 'ru'));
  else list.sort((a, b) => Number(b.available) - Number(a.available));
  return list;
}

function renderCards(root, view) {
  const container = $('#rewards-list', root);
  if (!container) return;
  let rewards = allRewards(view);
  if (filters.filter === 'disabled') rewards = rewards.filter((reward) => !reward.available);
  else if (filters.filter === 'all') rewards = rewards;
  else rewards = rewards.filter((reward) => reward.available);
  rewards = sortedFiltered(rewards, view);

  const forceList = window.innerWidth < 1120;
  const useGrid = !!view.grid_view && !forceList;
  container.className = useGrid ? 'grid' : 'reward-list';
  if (rewards.length === 0) {
    container.classList.remove('grid', 'reward-list');
    container.innerHTML = emptyState(view);
    syncModeButtons(root, useGrid);
    syncFilterButton(root);
    return;
  }
  container.innerHTML = useGrid
    ? rewards.map((reward) => cardHtml(reward, view)).join('')
    : rewards.map((reward) => rowHtml(reward, view)).join('');
  bindCardActions(container, view);
  bindVolumeSliders(container, view);
  syncModeButtons(root, useGrid);
  syncFilterButton(root);
}

const FILTER_LABELS = {
  all: 'Все',
  sound: 'Со звуком',
  nosound: 'Без звука',
  playing: 'Играет',
  disabled: 'Выключенные',
};

function syncModeButtons(root, useGrid) {
  root.querySelectorAll('#view-mode [data-view]').forEach((button) => {
    button.classList.toggle('active', button.dataset.view === (useGrid ? 'grid' : 'list'));
  });
}

function syncFilterButton(root) {
  const count = root.querySelector('#filters-count');
  if (count) count.textContent = filters.filter === 'all' ? '' : FILTER_LABELS[filters.filter] || '';
  const button = root.querySelector('#rewards-filters');
  if (button) button.classList.toggle('active', filters.filter !== 'all');
}

function rewardPlayingCount(reward, view) {
  return (view.playing || []).filter((id) => id === reward.id).length;
}

function fileChip(reward) {
  const file = reward.file;
  if (!file) {
    return `<div class="soundchip empty"><span class="fname">Звук не выбран</span><span class="fmt">нажмите «Выбрать»</span></div>`;
  }
  return `
    <div class="soundchip${file.exists ? '' : ' empty'}">
      <button class="play sound-play" title="${file.exists ? 'Прослушать' : 'Файл не найден'}"${file.exists ? '' : ' disabled'}>${icons.play}</button>
      <span class="fname" title="${escapeHtml(file.path)}">${escapeHtml(file.name)}</span>
      <span class="fmt">${file.exists ? escapeHtml(file.meta) : 'файл не найден'}</span>
    </div>`;
}

function volumeRow(reward) {
  const file = reward.file;
  if (!file) {
    return `<div class="volrow"><span class="cap">ГРОМКОСТЬ</span>
      <div class="slider sm disabled"><div class="track"></div><div class="fill" style="width:0%"></div></div>
      <span class="val">—</span></div>`;
  }
  const volume = Math.max(0, Math.min(2, Number(file.volume) || 0));
  const volumePct = (volume / 2) * 100;
  return `<div class="volrow"><span class="cap">ГРОМКОСТЬ</span>
    <div class="slider sm" data-reward-volume="${escapeHtml(reward.id)}">
      <div class="track"></div><div class="fill" style="width:${volumePct}%"></div>
      <div class="knob" style="left:${volumePct}%"></div>
    </div>
    <span class="val">${Math.round(volume * 100)}%</span></div>`;
}

function isMusicReward(reward, view) {
  return !!reward && !!view?.music && view.music.reward_id === reward.id;
}

function actionsHtml(reward, view) {
  const parts = [];
  if (!reward.file) {
    parts.push(`<button class="btn btn-sm btn-primary" data-act="choose">Выбрать звук</button>`);
  }
  return `<div class="card-actions">${parts.join('')}</div>`;
}

function cardFlags(reward, view) {
  const flags = [];
  if (isMusicReward(reward, view)) flags.push('<span class="tile-flag" title="Награда музыки">♪</span>');
  if (reward.requires_input) flags.push('<span class="tile-flag" title="Нужен ввод текста">Aa</span>');
  return flags.length ? `<span class="tile-flags">${flags.join('')}</span>` : '';
}

function playingMarkup(reward, view) {
  const playing = rewardPlayingCount(reward, view);
  if (!playing) return '';
  return `<span class="tile-playing" title="играет ×${playing}">${playing > 1 ? `×${playing}` : ''}♪</span>`;
}

function cardHtml(reward, view) {
  const color = /^#[0-9a-f]{6}$/i.test(reward.color || '') ? reward.color : '#FF5A5F';
  const bg = mixHex('#141414', color, 0.13);
  const border = mixHex('#242424', color, 0.22);
  const status = reward.available ? 'АКТИВНА' : 'ВЫКЛЮЧЕНА';
  return `
    <div class="card reward-card${reward.available ? '' : ' is-disabled'}"
      data-id="${escapeHtml(reward.id)}"
      data-title="${escapeHtml(reward.title)}"
      style="background:${bg};border-color:${border}">
      <div class="card-top">
        <div class="tile" style="background:${color};color:${contrastTextColor(color)}">${escapeHtml(firstLetter(reward.title))}${playingMarkup(reward, view)}${cardFlags(reward, view)}</div>
        <div class="card-top-text">
          <div class="card-title">${escapeHtml(reward.title)}</div>
          <div class="card-meta"><span class="meta-text">${Number(reward.cost) || 0} БАЛЛОВ · ${status}</span></div>
        </div>
        <button class="dots" data-dots title="Действия с наградой">•••</button>
      </div>
      ${fileChip(reward)}
      ${volumeRow(reward)}
      ${actionsHtml(reward, view)}
    </div>`;
}

function rowHtml(reward, view) {
  const color = /^#[0-9a-f]{6}$/i.test(reward.color || '') ? reward.color : '#FF5A5F';
  const status = reward.available ? 'АКТИВНА' : 'ВЫКЛЮЧЕНА';
  const file = reward.file;
  const volume = Math.max(0, Math.min(2, Number(file?.volume) || 0));
  return `
    <div class="reward-row${reward.available ? '' : ' is-disabled'}" data-id="${escapeHtml(reward.id)}" data-title="${escapeHtml(reward.title)}">
      <div class="tile tile-sm" style="background:${color};color:${contrastTextColor(color)}">${escapeHtml(firstLetter(reward.title))}${playingMarkup(reward, view)}</div>
      <div class="rr-main">
        <div class="rr-title">${escapeHtml(reward.title)}${isMusicReward(reward, view) ? '<span class="music-badge">МУЗЫКА</span>' : ''}</div>
        <div class="rr-meta">${Number(reward.cost) || 0} БАЛЛОВ · ${status}</div>
      </div>
      <div class="rr-sound">${file ? `<button class="play sound-play" title="${file.exists ? 'Прослушать' : 'Файл не найден'}"${file.exists ? '' : ' disabled'}>${icons.play}</button><span class="rr-fname" title="${escapeHtml(file.path)}">${escapeHtml(file.name)}</span><span class="rr-fmt">${file.exists ? escapeHtml(file.meta) : 'файл не найден'}</span>` : '<span class="rr-muted">Звук не выбран</span>'}</div>
      <div class="rr-volume">${file ? `<div class="slider sm" data-reward-volume="${escapeHtml(reward.id)}"><div class="track"></div><div class="fill" style="width:${(volume / 2) * 100}%"></div><div class="knob" style="left:${(volume / 2) * 100}%"></div></div><span class="local-value">${Math.round(volume * 100)}%</span>` : '<span class="rr-muted">—</span>'}</div>
      <div class="rr-actions">${actionsHtml(reward, view)}</div>
      <button class="dots" data-dots title="Действия с наградой">•••</button>
    </div>`;
}

function mixHex(base, color, amount) {
  const parse = (hex) => {
    const match = /^#?([0-9a-f]{6})$/i.exec(hex || '');
    if (!match) return [20, 20, 20];
    const value = parseInt(match[1], 16);
    return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
  };
  const a = parse(base);
  const b = parse(color);
  const mix = (index) => Math.round(a[index] * (1 - amount) + b[index] * amount);
  return `#${[0, 1, 2].map((index) => mix(index).toString(16).padStart(2, '0')).join('')}`;
}

function relativeLuminance(hex) {
  const match = /^#?([0-9a-f]{6})$/i.exec(hex || '');
  const value = match ? parseInt(match[1], 16) : 0x141414;
  const [r, g, b] = [(value >> 16) & 255, (value >> 8) & 255, value & 255].map((channel) => {
    const c = channel / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrastTextColor(background) {
  const bg = relativeLuminance(background);
  const ratio = (a, b) => (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
  return ratio(bg, 0) >= ratio(bg, 1) ? '#0A0A0A' : '#FFFFFF';
}

function firstLetter(title) {
  const text = String(title || 'R').trim();
  return (text.charAt(0) || 'R').toUpperCase();
}

function gridIcon() {
  return '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><rect x="3" y="3" width="7" height="7" rx="2"/><rect x="14" y="3" width="7" height="7" rx="2"/><rect x="3" y="14" width="7" height="7" rx="2"/><rect x="14" y="14" width="7" height="7" rx="2"/></svg>';
}

function listIcon() {
  return '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M4 6h16M4 12h16M4 18h10"/></svg>';
}

/* ============================ события ============================ */

function bind(root, view) {
  bindCardActions(root, view);
  bindVolumeSliders(root, view);

  $('#rewards-menu', root)?.addEventListener('click', (event) => {
    menu(event.currentTarget, [
      {
        label: 'Открыть панель наград Twitch',
        icon: icons.external,
        onClick: () => invoke('open_url', { url: DASHBOARD_URL }).catch(() => {}),
      },
      { label: 'Открыть журнал', icon: icons.folder, onClick: () => navigate('log') },
      { label: 'Настройки', icon: icons.edit, onClick: () => navigate('settings') },
      exitMenuItem(),
    ]);
  });

  $('#reward-create', root)?.addEventListener('click', () => openRewardModal(null));
  $('#rewards-retry', root)?.addEventListener('click', () => {
    tryInvoke('refresh_twitch_now').then(() => requestRefresh());
  });

  // Кнопки пустых состояний создаются динамически — делегируем клики.
  root.addEventListener('click', async (event) => {
    const action = event.target.closest('[data-empty-action]')?.dataset.emptyAction;
    if (!action) return;
    if (action === 'create') openRewardModal(null);
    else if (action === 'twitch') invoke('open_url', { url: DASHBOARD_URL }).catch(() => {});
    else if (action === 'reset') {
      filters.search = '';
      filters.filter = 'all';
      renderRewards(root, state.view);
    }
  });

  const search = $('#reward-search', root);
  search?.addEventListener('input', () => {
    filters.search = search.value;
    refreshList(root);
  });

  $('#reward-sort', root)?.addEventListener('change', (event) => {
    filters.sort = event.target.value;
    refreshList(root);
  });

  $$('#reward-pills .pill', root).forEach((button) =>
    button.addEventListener('click', () => {
      filters.filter = button.dataset.filter;
      $$('#reward-pills .pill', root).forEach((item) => item.classList.toggle('active', item === button));
      renderCards(root, view);
    })
  );

  $$('#view-mode .seg-item', root).forEach((button) =>
    button.addEventListener('click', async () => {
      if (button.classList.contains('active')) return;
      const grid = button.dataset.view === 'grid';
      const result = await tryInvoke('set_app_setting', { key: 'grid_view', value: grid ? '1' : '0' });
      if (result) {
        state.view = result;
        requestRefresh();
      }
    })
  );

  $('#rewards-filters', root)?.addEventListener('click', (event) => {
    const order = ['all', 'sound', 'nosound', 'playing', 'disabled'];
    const sortOrder = ['default', 'expensive', 'cheap', 'title'];
    const sortLabels = {
      default: 'Все награды',
      expensive: 'Сначала дорогие',
      cheap: 'Сначала дешёвые',
      title: 'По названию',
    };
    menu(event.currentTarget, [
      ...order.map((key) => ({
        label: `${filters.filter === key ? '✓ ' : ''}${FILTER_LABELS[key]}`,
        onClick: () => {
          filters.filter = key;
          renderCards(root, state.view || {});
        },
      })),
      ...sortOrder.map((key) => ({
        label: `${filters.sort === key ? '✓ ' : ''}${sortLabels[key]}`,
        onClick: () => {
          filters.sort = key;
          renderCards(root, state.view || {});
        },
      })),
    ]);
  });

  $('#reward-refresh', root)?.addEventListener('click', async () => {
    try {
      const result = await invoke('refresh_rewards');
      if (result) {
        state.view = result;
        requestRefresh();
        toast(result.rewards_loading ? 'Обновляем награды…' : 'Список наград обновлён');
      }
    } catch {}
  });

  $('#stop-all', root)?.addEventListener('click', async () => {
    try {
      await invoke('stop_all_sounds');
      toast('Все звуки остановлены');
      requestRefresh();
    } catch {}
  });

  $('#disabled-toggle', root)?.addEventListener('click', () => {
    state.rewards.expandedDisabled = !state.rewards.expandedDisabled;
    renderRewards(root, state.view);
  });

  $('#local-toggle', root)?.addEventListener('click', () => {
    state.rewards.localOpen = !state.rewards.localOpen;
    renderRewards(root, state.view);
  });

  bindLocalBindings(root);

  const disabledGrid = $('#disabled-grid', root);
  if (disabledGrid) {
    bindCardActions(disabledGrid, view);
    bindVolumeSliders(disabledGrid, view);
  }
}

function refreshList(root) {
  renderCards(root, state.view);
}

function bindCardActions(container, view) {
  container.querySelectorAll('.sound-play').forEach((button) => {
    if (button.dataset.bound) return;
    button.dataset.bound = '1';
    button.addEventListener('click', (event) => {
      event.stopPropagation();
      const card = button.closest('.reward-card, .reward-row');
      if (!card) return;
      const reward = findReward(card.dataset.id);
      if (!reward?.file?.exists) {
        toast('Файл не найден — выберите звук заново', 'warn');
        return;
      }
      invoke('preview_sound', { rewardId: card.dataset.id })
        .then(() => toast(`Проигрываем «${reward.title}»`))
        .catch(() => {});
    });
  });

  container.querySelectorAll('button[data-act]').forEach((button) => {
    if (button.dataset.bound) return;
    button.dataset.bound = '1';
    button.addEventListener('click', async (event) => {
      event.stopPropagation();
      const card = button.closest('.reward-card, .reward-row');
      if (!card) return;
      const reward = findReward(card.dataset.id);
      if (!reward) return;
      const action = button.dataset.act;
      if (action === 'open-music') {
        navigate('music');
        return;
      }
      if (action === 'remove') {
        await removeSound(reward);
        return;
      }
      if (action === 'replace' || action === 'choose') {
        await chooseSound(reward);
        return;
      }
    });
  });

  container.querySelectorAll('[data-dots]').forEach((button) => {
    if (button.dataset.bound) return;
    button.dataset.bound = '1';
    button.addEventListener('click', (event) => {
      event.stopPropagation();
      const card = button.closest('.reward-card, .reward-row');
      if (!card) return;
      const reward = findReward(card.dataset.id);
      if (!reward) return;
      menu(button, [
        { label: 'Изменить награду', icon: icons.edit, onClick: () => openRewardModal(reward) },
        ...(reward.file
          ? [
              {
                label: 'Заменить звук',
                icon: icons.refresh,
                onClick: () => chooseSound(reward),
              },
              {
                label: 'Убрать звук',
                icon: icons.trash,
                onClick: () => removeSound(reward),
              },
            ]
          : [
              {
                label: 'Выбрать звук',
                icon: icons.plus,
                onClick: () => chooseSound(reward),
              },
            ]),
        ...(isMusicReward(reward, state.view)
          ? [{ label: 'Открыть в «Музыке»', icon: icons.external, onClick: () => navigate('music') }]
          : []),
        {
          label: 'Удалить награду',
          icon: icons.trash,
          danger: true,
          onClick: () => deleteReward(reward),
        },
      ]);
    });
  });
}

function onCardClick(event, view) {
  // Клик по свободному месту карточки ничего не делает: действия — только на кнопках.
  if (event.target.closest('button')) return;
}

function bindVolumeSliders(container, view) {
  container.querySelectorAll('[data-reward-volume]').forEach((slider) => {
    if (slider.dataset.bound) return;
    const rewardId = slider.dataset.rewardVolume;
    const card = slider.closest('.reward-card, .reward-row');
    const label = card?.querySelector('.volrow .val, .rr-volume .local-value');
    bindSlider(slider, {
      onChange: (fraction) => {
        if (label) label.textContent = `${Math.round(fraction * 2 * 100)}%`;
      },
      onCommit: async (fraction) => {
        try {
          const result = await invoke('set_sound_volume', { rewardId, volume: fraction * 2 });
          if (result) {
            state.view = result;
            requestRefresh();
          }
        } catch {}
      },
    });
  });
}

function bindLocalBindings(root) {
  root.querySelectorAll('[data-local-play]').forEach((button) => {
    if (button.dataset.bound) return;
    button.dataset.bound = '1';
    button.addEventListener('click', () => {
      const id = button.dataset.localPlay;
      invoke('preview_sound', { rewardId: id })
        .then(() => toast('Проигрываем звук'))
        .catch(() => {});
    });
  });

  root.querySelectorAll('[data-local-volume]').forEach((slider) => {
    if (slider.dataset.bound) return;
    const rewardId = slider.dataset.localVolume;
    const value = slider.closest('.local-binding')?.querySelector('.local-value');
    bindSlider(slider, {
      onChange: (fraction) => {
        if (value) value.textContent = `${Math.round(fraction * 2 * 100)}%`;
      },
      onCommit: async (fraction) => {
        const result = await tryInvoke('set_sound_volume', { rewardId, volume: fraction * 2 });
        if (result) {
          state.view = result;
          requestRefresh();
        }
      },
    });
  });

  root.querySelectorAll('[data-local-remove], [data-orphan-remove]').forEach((button) => {
    if (button.dataset.bound) return;
    button.dataset.bound = '1';
    button.addEventListener('click', async () => {
      const id = button.dataset.localRemove || button.dataset.orphanRemove;
      const binding = (state.view?.local_bindings || []).find((item) => item.reward_id === id);
      const ok = await confirmDialog({
        title: 'Убрать звук?',
        text: binding ? `Звук «${binding.title}» будет отвязан от награды.` : undefined,
        confirmLabel: 'Убрать',
        danger: true,
      });
      if (!ok) return;
      const result = await tryInvoke('clear_sound', { rewardId: id });
      if (result) {
        state.view = result;
        toast('Звук отвязан');
        requestRefresh();
      }
    });
  });

  root.querySelectorAll('[data-orphan-play]').forEach((button) => {
    if (button.dataset.bound) return;
    button.dataset.bound = '1';
    button.addEventListener('click', () => {
      invoke('preview_sound', { rewardId: button.dataset.orphanPlay })
        .then(() => toast('Проигрываем звук'))
        .catch(() => {});
    });
  });
}

function findReward(id) {
  return (state.view?.rewards || []).find((reward) => reward.id === id);
}

/* ============================ редактор награды ============================ */

let editorState = null;

function openRewardModal(reward) {
  const editing = !!reward;
  const sound = {
    path: reward?.file?.path || null,
    name: reward?.file?.name || null,
    meta: reward?.file?.meta || null,
    removed: false,
    picked: false,
  };
  editorState = { reward, editing, sound, saving: false };

  const initialColor = /^#[0-9a-f]{6}$/i.test(reward?.color || '') ? reward.color : '#8B00FF';
  const colorPresets = ['#8B00FF', '#FF5A5F', '#FF7A00', '#F5C97B', '#22C55E', '#00C8FF', '#3B82F6', '#EC4899', '#A3A3A3'];
  const modal = createModal({
    html: `
      <div class="modal-head">
        <div class="modal-title">${editing ? 'Изменить награду' : 'Новая награда'}</div>
        <button class="modal-close" data-act="close" aria-label="Закрыть">${icons.close}</button>
      </div>
      <div class="modal-sub">${editing ? 'Изменения уйдут на Twitch.' : 'Награда создастся в канале через Twitch API.'}</div>
      <div class="modal-label">НАЗВАНИЕ</div>
      <input class="input reward-input" id="reward-title" maxlength="45" value="${escapeHtml(reward?.title || '')}" placeholder="Например, «Сказать слово»" data-autofocus>
      <div class="reward-form-row">
        <div><div class="modal-label">ЦЕНА, БАЛЛОВ</div><input class="input reward-input" id="reward-cost" type="number" min="1" max="1000000" value="${reward?.cost ?? 100}"></div>
        <div>
          <div class="modal-label">ЦВЕТ</div>
          <div class="color-controls">
            <label class="color-swatch" id="reward-color-swatch" title="Выбрать цвет" style="background:${initialColor}">
              <input type="color" id="reward-color-native" value="${initialColor}" aria-label="Выбрать цвет награды">
            </label>
            <input class="input reward-input color-hex" id="reward-color" maxlength="7" value="${escapeHtml(initialColor)}" placeholder="#8B00FF" aria-label="Цвет награды в формате HEX">
          </div>
        </div>
      </div>
      <div class="color-palette" id="reward-color-palette">
        ${colorPresets.map((color) => `<button type="button" class="color-preset${color.toLowerCase() === initialColor.toLowerCase() ? ' active' : ''}" data-color="${color}" style="background:${color}" title="${color}" aria-label="Цвет ${color}"></button>`).join('')}
      </div>
      <label class="reward-check"><input type="checkbox" id="reward-input-required" ${reward?.requires_input ? 'checked' : ''}> Нужен ввод текста от зрителя</label>
      <div class="modal-label">ЗВУК НАГРАДЫ</div>
      <div class="editor-sound" id="editor-sound"></div>
      <div class="modal-error" id="editor-error" hidden></div>
      <div class="modal-actions">
        ${editing ? '<button class="btn btn-secondary reward-delete" id="reward-delete">Удалить</button>' : ''}
        <div class="right">
          <button class="btn btn-secondary" data-act="close">Отмена</button>
          <button class="btn btn-primary" id="reward-save">${editing ? 'Сохранить' : 'Создать'}</button>
        </div>
      </div>`,
    onClose: () => {
      editorState = null;
    },
  });

  bindColorPicker(modal.root, initialColor);
  renderEditorSound(modal.root, sound);
  modal.root.querySelectorAll('[data-act="close"]').forEach((button) =>
    button.addEventListener('click', () => modal.close())
  );
  $('#reward-save', modal.root).addEventListener('click', () => saveReward(modal));
  $('#reward-title', modal.root).addEventListener('keydown', (event) => {
    if (event.key === 'Enter') saveReward(modal);
  });
  $('#reward-delete', modal.root)?.addEventListener('click', () => {
    modal.close();
    deleteReward(reward);
  });
}

function bindColorPicker(root, initialColor) {
  const hex = $('#reward-color', root);
  const native = $('#reward-color-native', root);
  const swatch = $('#reward-color-swatch', root);
  const palette = $('#reward-color-palette', root);
  if (!hex || !native || !swatch) return;

  const markActive = (value) =>
    palette?.querySelectorAll('[data-color]').forEach((button) =>
      button.classList.toggle('active', button.dataset.color.toLowerCase() === value.toLowerCase())
    );
  const apply = (value) => {
    const color = value.startsWith('#') ? value : `#${value}`;
    hex.value = color.toUpperCase();
    native.value = color;
    swatch.style.background = color;
    markActive(color);
  };

  hex.addEventListener('input', () => {
    const value = hex.value.trim();
    if (!/^#[0-9a-f]{6}$/i.test(value)) return;
    native.value = value;
    swatch.style.background = value;
    markActive(value);
  });
  native.addEventListener('input', () => apply(native.value));
  palette?.querySelectorAll('[data-color]').forEach((button) =>
    button.addEventListener('click', () => apply(button.dataset.color))
  );
}

function renderEditorSound(root, sound) {
  const node = $('#editor-sound', root);
  if (!node) return;
  if (sound.removed || !sound.name) {
    node.innerHTML = `
      <div class="editor-sound-empty">
        <span>Файл не выбран — награда будет без звука</span>
        <button class="btn btn-sm btn-secondary" data-sound="choose">Выбрать звук</button>
      </div>`;
  } else {
    node.innerHTML = `
      <div class="editor-sound-row">
        <div class="editor-sound-file"><div class="fname">${escapeHtml(sound.name)}</div><div class="fmt">${escapeHtml(sound.meta || '')}</div></div>
        <button class="btn btn-sm btn-secondary" data-sound="preview" title="Прослушать">${icons.play} Прослушать</button>
        <button class="btn btn-sm btn-secondary" data-sound="choose">Заменить</button>
        <button class="ghost-red" data-sound="remove">Убрать</button>
      </div>`;
  }
  node.querySelectorAll('[data-sound]').forEach((button) =>
    button.addEventListener('click', async () => {
      const action = button.dataset.sound;
      if (action === 'choose') {
        const picked = await tryInvoke('pick_sound_file');
        if (picked) {
          sound.path = picked.path;
          sound.name = picked.name;
          sound.meta = picked.meta;
          sound.removed = false;
          sound.picked = true;
          renderEditorSound(root, sound);
        }
      } else if (action === 'remove') {
        sound.path = null;
        sound.name = null;
        sound.meta = null;
        sound.removed = true;
        sound.picked = false;
        renderEditorSound(root, sound);
      } else if (action === 'preview') {
        if (sound.picked && sound.path) {
          tryInvoke('preview_path', { path: sound.path });
        } else if (editorState?.reward?.id) {
          tryInvoke('preview_sound', { rewardId: editorState.reward.id });
        }
      }
    })
  );
}

function showEditorError(message) {
  const node = $('#editor-error');
  if (!node) return;
  node.textContent = message;
  node.hidden = false;
}

async function saveReward(modal) {
  if (!editorState || editorState.saving) return;
  const title = $('#reward-title', modal.root).value.trim();
  const cost = Number($('#reward-cost', modal.root).value) || 0;
  const color = $('#reward-color', modal.root).value.trim();
  const requiresInput = $('#reward-input-required', modal.root).checked;
  if (!title) {
    showEditorError('Введите название награды');
    return;
  }
  if (!/^#[0-9a-f]{6}$/i.test(color)) {
    showEditorError('Цвет должен быть в формате #RRGGBB');
    return;
  }
  const sound = editorState.sound;
  const soundPath = sound && !sound.removed && sound.picked ? sound.path : null;
  const clearSound = !!sound?.removed && !!editorState.reward?.file;
  const saveButton = $('#reward-save', modal.root);
  editorState.saving = true;
  saveButton.disabled = true;
  saveButton.textContent = 'Сохраняем…';
  try {
    const result = editorState.editing
      ? await invoke('update_reward', {
          rewardId: editorState.reward.id,
          title,
          cost,
          color,
          requiresInput,
          soundPath,
          clearSound,
        })
      : await invoke('create_reward', {
          title,
          cost,
          color,
          requiresInput,
          soundPath,
        });
    if (result) {
      state.view = result;
      modal.close();
      toast(editorState.editing ? 'Награда обновляется…' : 'Награда создаётся…');
      requestRefresh();
      setTimeout(() => requestRefresh(), 900);
    }
  } catch (error) {
    showEditorError(error.message || String(error));
  } finally {
    if (editorState) editorState.saving = false;
    if (saveButton.isConnected) {
      saveButton.disabled = false;
      saveButton.textContent = editorState?.editing ? 'Сохранить' : 'Создать';
    }
  }
}

async function chooseSound(reward) {
  if (!reward) return;
  try {
    const result = await invoke('choose_sound', { rewardId: reward.id, title: reward.title });
    if (result) {
      state.view = result;
      toast('Файл сохранён');
      requestRefresh();
    }
  } catch {}
}

async function removeSound(reward) {
  if (!reward) return;
  const ok = await confirmDialog({
    title: `Убрать звук у «${reward.title}»?`,
    text: 'Файл останется на диске — отвяжется только от награды.',
    confirmLabel: 'Убрать',
    danger: true,
  });
  if (!ok) return;
  try {
    const result = await invoke('clear_sound', { rewardId: reward.id });
    if (result) {
      state.view = result;
      toast('Звук отвязан');
      requestRefresh();
    }
  } catch {}
}

async function deleteReward(reward) {
  if (!reward) return;
  const ok = await confirmDialog({
    title: `Удалить награду «${reward.title}»?`,
    text: 'Действие необратимо: награда удалится на Twitch. Локальная привязка звука останется.',
    confirmLabel: 'Удалить',
    danger: true,
  });
  if (!ok) return;
  try {
    const result = await invoke('delete_reward', { rewardId: reward.id, title: reward.title });
    if (result) {
      state.view = result;
      toast('Награда удаляется…');
      requestRefresh();
      setTimeout(() => requestRefresh(), 900);
    }
  } catch {}
}

/* ============================ обновление мелочей ============================ */

function updateDynamicBits(root, view) {
  const available = allRewards(view).filter((reward) => reward.available);
  const playingIds = new Set(view.playing || []);
  $$('.reward-card, .reward-row', root).forEach((card) => {
    const id = card.dataset.id;
    const reward = findReward(id);
    if (!reward) return;
    const count = (view.playing || []).filter((itemId) => itemId === id).length;
    const badge = card.querySelector('.playing-badge');
    if (count > 0 && !badge) {
      card.querySelector('.card-actions')?.insertAdjacentHTML(
        'beforeend',
        `<span class="playing-badge">играет ×${count}</span>`
      );
    } else if (count === 0 && badge) {
      badge.remove();
    } else if (count > 0 && badge) {
      badge.textContent = `играет ×${count}`;
    }
  });
  const stop = $('#stop-all', root);
  if (stop) {
    const playing = available.filter((reward) => playingIds.has(reward.id)).length;
    stop.disabled = playing === 0;
  }
}

export { findReward };
