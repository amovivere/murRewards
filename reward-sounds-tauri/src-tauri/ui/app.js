/* ===== Reward Sounds — Tauri UI prototype ===== */
(() => {
  'use strict';

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const content = $('#content');
  const footerText = $('#footer-text');

  const invoke = (cmd, args) => {
    const api = window.__TAURI__ && window.__TAURI__.core;
    if (!api || typeof api.invoke !== 'function') return Promise.resolve(null);
    return api.invoke(cmd, args).catch((err) => {
      console.warn('invoke failed', cmd, err);
      try {
        const f = document.getElementById('footer-text');
        if (f) f.textContent = `IPC error: ${cmd}: ${err}`;
      } catch {}
      return null;
    });
  };

  const state = {
    tab: 'rewards',
    connected: true,
    login: 'goshanmur',
    displayName: '',
    volume: 0.28,
    version: '1.7.0',
    musicTitle: 'МУЗЫКА ЮТУБ',
    musicCost: 50,
    playing: true,
    core: null,
    coreSig: '',
    logs: [],
    logUi: { search: '', level: 'all' },
    rewardUi: { search: '', filter: 'all', sort: 'Все награды' },
  };

  let toastTimer = null;
  function setFooter(text, timeout = 4500) {
    footerText.textContent = text;
    if (toastTimer) clearTimeout(toastTimer);
    if (timeout) {
      toastTimer = setTimeout(() => {
        footerText.textContent = 'Готово';
        toastTimer = null;
      }, timeout);
    }
  }

  /* ---------- общие помощники ---------- */
  function replaceText(root, from, to) {
    if (!from || !to || from === to) return;
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    for (const node of nodes) {
      if (node.nodeValue && node.nodeValue.includes(from)) {
        node.nodeValue = node.nodeValue.split(from).join(to);
      }
    }
  }

  function applyStatusToDom() {
    $('#twitch-status').textContent = state.connected
      ? `Подключено · ${state.login}`
      : 'Twitch не подключён';
    const eventsub = state.core?.eventsub || 'stopped';
    const eventsubText = $('#eventsub-text');
    if (eventsubText) {
      eventsubText.textContent =
        eventsub === 'listening'
          ? 'Слушаем награды'
          : eventsub === 'connecting'
            ? 'Переподключение…'
            : 'Не слушаем';
      const dot = $('#eventsub-status .dot');
      if (dot) {
        dot.style.background =
          eventsub === 'listening' ? '#8B00FF' : eventsub === 'connecting' ? '#F59E0B' : '#8B8B8B';
      }
    }
    $('#version').textContent = `версия ${state.version}`;
    document.body.classList.toggle('offline', !state.connected);
    setTopVolume(state.volume);
    if (state.connected && state.tab === 'music') {
      const pill = $('.toolbar .pill.active', content);
      if (pill) {
        const title = state.musicTitle || 'МУЗЫКА ЮТУБ';
        pill.textContent = `Награда: ${title} · ${state.musicCost} баллов`;
      }
    }
  }

  /* ---------- окно ---------- */
  function tauriWindow() {
    const api = window.__TAURI__ && window.__TAURI__.window;
    return api && typeof api.getCurrentWindow === 'function' ? api.getCurrentWindow() : null;
  }

  function bindWindowControls() {
    const win = tauriWindow();
    $$('[data-win]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const action = btn.dataset.win;
        try {
          if (action === 'min') await invoke('win_minimize');
          else if (action === 'max') await invoke('win_toggle_maximize');
          else if (action === 'close') await invoke('win_close');
        } catch (err) {
          console.warn('window action failed', action, err);
        }
      });
    });
    const titlebar = $('.titlebar');
    titlebar.addEventListener('mousedown', async (event) => {
      if (event.button !== 0) return;
      if (event.target.closest('button')) return;
      try {
        if (win) await win.startDragging();
        else invoke('win_start_drag');
      } catch (err) {
        console.warn('drag failed', err);
      }
    });
  }

  /* ---------- слайдеры ---------- */
  function paintSlider(slider, fraction) {
    const fill = $('.fill', slider);
    const knob = $('.knob', slider);
    const f = Math.max(0, Math.min(1, fraction));
    if (fill) fill.style.width = `${(f * 100).toFixed(2)}%`;
    if (knob) knob.style.left = `${(f * 100).toFixed(2)}%`;
    return f;
  }

  function sliderFraction(slider) {
    const knob = $('.knob', slider);
    const fill = $('.fill', slider);
    let f = 0.3;
    if (knob && knob.style.left) f = parseFloat(knob.style.left) / 100;
    else if (fill && fill.style.width) f = parseFloat(fill.style.width) / 100;
    if (!Number.isFinite(f)) f = 0.3;
    return Math.max(0, Math.min(1, f));
  }

  function bindSlider(slider, options = {}) {
    if (slider.dataset.bound) return;
    slider.dataset.bound = '1';
    const onChange = options.onChange || (() => {});
    const onCommit = options.onCommit || (() => {});
    let fraction = sliderFraction(slider);
    paintSlider(slider, fraction);

    const update = (event) => {
      const rect = slider.getBoundingClientRect();
      fraction = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width));
      paintSlider(slider, fraction);
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
      const step = event.shiftKey ? 0.1 : 0.02;
      if (event.key === 'ArrowLeft' || event.key === 'ArrowDown') {
        fraction = Math.max(0, fraction - step);
      } else if (event.key === 'ArrowRight' || event.key === 'ArrowUp') {
        fraction = Math.min(1, fraction + step);
      } else {
        return;
      }
      event.preventDefault();
      paintSlider(slider, fraction);
      onChange(fraction);
      onCommit(fraction);
    });
  }

  function setTopVolume(value) {
    const slider = $('#top-volume');
    if (!slider) return;
    paintSlider(slider, value);
    $('#top-volume-value').textContent = `${Math.round(value * 100)}%`;
  }

  function bindTopVolume() {
    const slider = $('#top-volume');
    bindSlider(slider, {
      onChange: (f) => {
        $('#top-volume-value').textContent = `${Math.round(f * 100)}%`;
      },
      onCommit: (f) => {
        invoke('set_volume', { volume: f });
        setFooter(`Громкость: ${Math.round(f * 100)}%`);
      },
    });
  }

  /* ---------- создание/редактирование награды ---------- */
  function openRewardModal(reward) {
    if ($('#reward-modal')) return;
    const editing = !!reward;
    const modal = document.createElement('div');
    modal.className = 'modal-scrim';
    modal.id = 'reward-modal';
    modal.innerHTML = `
      <div class="modal" role="dialog" aria-modal="true">
        <div class="modal-head">
          <div class="modal-title">${editing ? 'Изменить награду' : 'Новая награда'}</div>
          <button class="modal-close" id="reward-modal-close" aria-label="Закрыть">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>
          </button>
        </div>
        <div class="modal-sub">${editing ? 'Название, цена и цвет обновятся на Twitch.' : 'Награда создастся в канале через Twitch API.'}</div>
        <div class="modal-label">НАЗВАНИЕ</div>
        <input class="input reward-input" id="reward-title" maxlength="45" value="${escapeHtml(reward?.title || '')}" placeholder="Например, «Сказать слово»">
        <div class="reward-form-row">
          <div><div class="modal-label">ЦЕНА, БАЛЛОВ</div><input class="input reward-input" id="reward-cost" type="number" min="1" max="1000000" value="${reward?.cost ?? 100}"></div>
          <div><div class="modal-label">ЦВЕТ</div><input class="input reward-input" id="reward-color" value="${reward?.color || '#8B00FF'}" maxlength="7" placeholder="#8B00FF"></div>
        </div>
        <label class="reward-check"><input type="checkbox" id="reward-input-required" ${editing && state.core?.music?.reward_id === reward.id ? 'checked' : ''}> Нужен ввод текста от зрителя</label>
        <div class="modal-actions" style="margin-top:18px">
          ${editing ? '<button class="btn btn-secondary reward-delete" id="reward-delete">Удалить</button>' : ''}
          <div class="right">
            <button class="btn btn-secondary" id="reward-cancel">Отмена</button>
            <button class="btn btn-primary" id="reward-save">${editing ? 'Сохранить' : 'Создать'}</button>
          </div>
        </div>
      </div>`;
    document.body.appendChild(modal);
    const close = () => modal.remove();
    $('#reward-modal-close', modal).addEventListener('click', close);
    $('#reward-cancel', modal).addEventListener('click', close);
    modal.addEventListener('click', (event) => {
      if (event.target === modal) close();
    });
    const save = async () => {
      const title = $('#reward-title', modal).value.trim();
      const cost = Number($('#reward-cost', modal).value) || 0;
      const color = $('#reward-color', modal).value || '#8B00FF';
      const requiresInput = $('#reward-input-required', modal).checked;
      if (!title) {
        setFooter('Введите название награды');
        return;
      }
      try {
        const view = editing
          ? await invoke('update_reward', {
              rewardId: reward.id,
              title,
              cost,
              color,
              requiresInput,
            })
          : await invoke('create_reward', { title, cost, color, requiresInput });
        close();
        setFooter(editing ? 'Награда обновляется…' : 'Награда создаётся…');
        if (view) applyCoreView(view);
        setTimeout(async () => {
          try {
            const fresh = await invoke('get_state');
            if (fresh) {
              applyCoreView(fresh);
              if (state.tab === 'rewards') renderCoreRewards(fresh);
            }
          } catch {}
        }, 900);
      } catch (err) {
        setFooter(String(err), 6000);
      }
    };
    $('#reward-save', modal).addEventListener('click', save);
    $('#reward-title', modal).addEventListener('keydown', (event) => {
      if (event.key === 'Enter') save();
    });
    $('#reward-delete', modal)?.addEventListener('click', async () => {
      if (!window.confirm(`Удалить награду «${reward.title}» на Twitch?`)) return;
      try {
        const view = await invoke('delete_reward', { rewardId: reward.id, title: reward.title });
        close();
        setFooter('Награда удаляется…');
        if (view) applyCoreView(view);
        setTimeout(async () => {
          try {
            const fresh = await invoke('get_state');
            if (fresh) {
              applyCoreView(fresh);
              if (state.tab === 'rewards') renderCoreRewards(fresh);
            }
          } catch {}
        }, 900);
      } catch (err) {
        setFooter(String(err), 6000);
      }
    });
  }

  /* ---------- модальное окно OBS ---------- */
  function openObsModal() {
    if ($('#obs-modal')) return;
    const modal = document.createElement('div');
    modal.className = 'modal-scrim';
    modal.id = 'obs-modal';
    modal.innerHTML = `
      <div class="modal" role="dialog" aria-modal="true" aria-label="OBS — строка «Сейчас играет»">
        <div class="modal-head">
          <div class="modal-title">OBS — строка «Сейчас играет»</div>
          <button class="modal-close" id="obs-close" aria-label="Закрыть">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>
          </button>
        </div>
        <div class="modal-sub">Добавьте ссылку в OBS как источник «Браузер». Строка показывается, когда играет трек.</div>
        <div class="modal-label">ССЫЛКА ДЛЯ ИСТОЧНИКА</div>
        <div class="urlrow">
          <code>http://127.0.0.1:8770/overlay</code>
          <button class="btn btn-icon btn-ghost" id="obs-copy" title="Скопировать">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="8" y="8" width="11" height="12" rx="2"/><path d="M5 16V6a2 2 0 0 1 2-2h9"/></svg>
          </button>
        </div>
        <div class="modal-row">
          <span>Показывать, секунд</span>
          <input class="input" id="obs-seconds" type="number" value="10" min="0" max="600" style="width:66px;background:#161616;border:1px solid rgba(255,255,255,.08);border-radius:8px;padding:5px 8px">
          <span style="font-size:11.4px;color:rgba(139,139,139,.7)">0 — показывать всё время, пока играет трек</span>
        </div>
        <div class="modal-row">
          <span>Размер шрифта</span>
          <input class="input" id="obs-font" type="number" value="17" min="12" max="48" style="width:66px;background:#161616;border:1px solid rgba(255,255,255,.08);border-radius:8px;padding:5px 8px">
          <span style="font-size:11.4px;color:rgba(139,139,139,.7)">px</span>
        </div>
        <div class="modal-row">
          <span>Положение</span>
          <div class="pos" id="obs-pos">
            <button class="active" data-pos="top">Сверху</button>
            <button data-pos="bottom">Снизу</button>
          </div>
        </div>
        <div class="modal-sub" style="margin-top:14px">Источник: ширина 1920, высота 200–300. «Обновлять при активации» и «Выключать, когда не виден» — выключить. Команда !трек в чате показывает строку ещё раз.</div>
        <div class="modal-actions">
          <button class="btn btn-secondary" id="obs-browser">Открыть в браузере</button>
          <div class="right">
            <button class="btn btn-secondary" id="obs-show-now">Показать сейчас</button>
            <button class="btn btn-primary" id="obs-done">Закрыть</button>
          </div>
        </div>
      </div>`;
    document.body.appendChild(modal);
    const close = () => modal.remove();
    $('#obs-close', modal).addEventListener('click', close);
    $('#obs-done', modal).addEventListener('click', close);
    modal.addEventListener('click', (event) => {
      if (event.target === modal) close();
    });
    $('#obs-copy', modal).addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText('http://127.0.0.1:8770/overlay');
        setFooter('Ссылка на оверлей скопирована');
      } catch {
        setFooter('Не удалось скопировать ссылку');
      }
    });
    $('#obs-show-now', modal).addEventListener('click', () => {
      setFooter('Строка «Сейчас играет» показана в оверлее');
    });
    $('#obs-browser', modal).addEventListener('click', () => {
      setFooter('В прототипе браузер не открывается');
    });
    $$('#obs-pos button', modal).forEach((btn) => {
      btn.addEventListener('click', () => {
        $$('#obs-pos button', modal).forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        setFooter(`Положение оверлея: ${btn.textContent.toLowerCase()}`);
      });
    });
    const onKey = (event) => {
      if (event.key === 'Escape') {
        close();
        document.removeEventListener('keydown', onKey);
      }
    };
    document.addEventListener('keydown', onKey);
  }

  /* ---------- «Награды»: реальные данные из Rust-ядра ---------- */
  const ICON_PLAY =
    '<svg width="10" height="10" viewBox="0 0 24 24" fill="#EDEDED" stroke="none"><path d="M8 5v14l11-7z"/></svg>';

  function escapeHtml(value) {
    return String(value ?? '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#39;');
  }

  function mixHex(base, color, amount) {
    const parse = (hex) => {
      const m = /^#?([0-9a-f]{6})$/i.exec(hex || '');
      if (!m) return [20, 20, 20];
      const n = parseInt(m[1], 16);
      return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
    };
    const a = parse(base);
    const b = parse(color);
    const mix = (i) => Math.round(a[i] * (1 - amount) + b[i] * amount);
    return `#${[0, 1, 2]
      .map((i) => mix(i).toString(16).padStart(2, '0'))
      .join('')}`;
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

  // Цвет буквы на плитке награды: тёмный или белый — что контрастнее к цвету награды.
  function contrastTextColor(background) {
    const bg = relativeLuminance(background);
    const ratio = (a, b) => (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
    return ratio(bg, 0) >= ratio(bg, 1) ? '#0A0A0A' : '#FFFFFF';
  }

  function rewardCardHtml(reward, musicRewardId) {
    const color = /^#[0-9a-f]{6}$/i.test(reward.color || '')
      ? reward.color
      : '#FF5A5F';
    const bg = mixHex('#141414', color, 0.13);
    const border = mixHex('#242424', color, 0.22);
    const title = escapeHtml(reward.title);
    const letter = escapeHtml((reward.title || 'R').trim().charAt(0).toUpperCase() || 'R');
    const file = reward.file || null;
    const has = !!(file && file.exists);
    const volume = file ? Math.max(0, Math.min(2, Number(file.volume) || 0)) : 0;
    const volumePct = Math.max(0, Math.min(100, (volume / 2) * 100));
    const isMusic = !!musicRewardId && musicRewardId === reward.id;

    const chip = file
      ? `<div class="soundchip${has ? '' : ' empty'}">
           <span class="play sound-play">${ICON_PLAY}</span>
           <span class="fname">${escapeHtml(file.name)}</span>
           <span class="fmt">${has ? escapeHtml(file.meta) : 'файл не найден'}</span>
         </div>`
      : `<div class="soundchip empty"><span class="fname">Звук не выбран</span><span class="fmt">нажмите «Выбрать»</span></div>`;

    const volrow = file
      ? `<div class="volrow"><span class="cap">ГРОМКОСТЬ</span>
           <div class="slider sm"><div class="track"></div>
             <div class="fill" style="width:${volumePct}%"></div>
             <div class="knob" style="left:${volumePct}%"></div></div>
           <span class="val">${Math.round(volume * 100)}%</span></div>`
      : `<div class="volrow"><span class="cap">ГРОМКОСТЬ</span>
           <div class="slider sm disabled"><div class="track"></div><div class="fill" style="width:0%"></div></div>
           <span class="val">—</span></div>`;

    const actions = (file
      ? `<div class="btn btn-sm btn-secondary" data-act="replace">Заменить</div><div class="ghost-red" data-act="remove">Убрать</div>`
      : `<div class="btn btn-sm btn-primary" data-act="choose">Выбрать звук</div>`) +
      (isMusic
        ? `<div class="ghost-red ghost-neutral" data-act="open-music" title="Открыть вкладку «Музыка»">Открыть в «Музыке»</div>`
        : '');

    return `<div class="card reward-card" data-id="${escapeHtml(reward.id)}"
      data-title="${title}" data-cost="${Number(reward.cost) || 0}"
      data-has-sound="${has ? '1' : '0'}" data-playing="${reward.playing ? '1' : '0'}"
      data-available="${reward.available ? '1' : '0'}"
      style="background:${bg};border-color:${border}">
      <div class="card-top">
        <div class="tile" style="background:${color};color:${contrastTextColor(color)}">${letter}</div>
        <div style="flex:1 1 auto;min-width:0">
          <div class="card-title">${title}</div>
          <div class="card-meta">${Number(reward.cost) || 0} БАЛЛОВ · ${reward.available ? 'АКТИВНА' : 'ВЫКЛЮЧЕНА'}${isMusic ? '<span class="music-badge">МУЗЫКА</span>' : ''}</div>
        </div>
        <div class="dots">•••</div>
      </div>
      ${chip}
      ${volrow}
      <div class="card-actions">${actions}</div>
    </div>`;
  }

  function applyCoreView(view) {
    if (!view) return;
    state.core = view;
    state.connected = !!view.connected;
    state.login = view.login || view.display_name || state.login;
    state.displayName = view.display_name || '';
    state.volume = Number(view.volume) || 0;
    state.version = view.version || state.version;
    state.musicTitle = view.music_reward_title || state.musicTitle;
    state.musicCost = view.music_reward_cost ?? state.musicCost;
    applyStatusToDom();
  }

  function updateRewardCounts(view) {
    const rewards = (view.rewards || []).filter((r) => r.available);
    const withSound = rewards.filter((r) => r.has_sound).length;
    const disabled = (view.rewards || []).filter((r) => !r.available).length;
    const playing = rewards.filter((r) => r.playing).length;
    const counts = [
      ['Все', rewards.length],
      ['Со звуком', withSound],
      ['Без звука', rewards.length - withSound],
      ['Играет', playing],
      ['Выключенные', disabled],
    ];
    $$('#reward-pills .pill').forEach((pill, index) => {
      const [label, count] = counts[index] || ['', 0];
      const dot = pill.querySelector('.dot');
      pill.innerHTML = `${dot ? dot.outerHTML : ''}${label} ${count}`;
    });
    const sub = $('.page-head .sub');
    if (sub) {
      sub.textContent =
        `${rewards.length} ${pluralRu(rewards.length, 'награда', 'награды', 'наград')}` +
        ` · ${withSound} со звуком`;
    }
    const collapsed = $('.collapsed');
    if (collapsed) {
      const label = Array.from(collapsed.querySelectorAll('span')).find((el) =>
        el.textContent.includes('Выключенные')
      );
      if (label) label.textContent = `Выключенные и недоступные награды · ${disabled}`;
      collapsed.style.display = disabled > 0 ? '' : 'none';
    }
  }

  function pluralRu(n, one, few, many) {
    const mod10 = n % 10;
    const mod100 = n % 100;
    if (mod10 === 1 && mod100 !== 11) return one;
    if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return few;
    return many;
  }

  function renderCoreRewards(view) {
    const grid = $('#reward-grid');
    if (!grid) return;
    const rewards = (view.rewards || []).filter((reward) => reward.available);
    if (rewards.length === 0) {
      grid.innerHTML = `<div class="stub-card" style="grid-column:1/-1">
        <b>${view.rewards_loading ? 'Загружаем награды…' : 'Наград пока нет'}</b><br><br>
        ${escapeHtml(view.rewards_error || 'Создайте награду на Twitch или обновите список.')}
      </div>`;
    } else {
      grid.innerHTML = rewards
        .map((reward) => rewardCardHtml(reward, view.music?.reward_id))
        .join('');
    }
    updateRewardCounts(view);
    window.RS.applyRewardFilters?.();
    bindSlidersIn(grid);
    const refresh = $('.toolbar .btn-icon.btn-secondary', content);
    if (refresh) {
      refresh.style.opacity = view.rewards_loading ? '.45' : '';
      refresh.title = view.rewards_loading ? 'Обновляем награды…' : 'Обновить список';
    }
    if (view.rewards_error) setFooter(view.rewards_error, 6000);
  }

  function coreSignature(view) {
    return JSON.stringify({
      connected: view.connected,
      login: view.login,
      loading: view.rewards_loading,
      error: view.rewards_error,
      rewards: view.rewards,
      volume: view.volume,
      client_id: view.client_id,
      eventsub: view.eventsub,
      auth: view.auth,
      autostart: view.autostart,
      close_to_tray: view.close_to_tray,
      start_minimized: view.start_minimized,
      muted: view.muted,
      playback_enabled: view.playback_enabled,
    });
  }

  function bindRewards() {
    const grid = $('#reward-grid');
    if (!grid) return;
    state.rewardUi = state.rewardUi || { search: '', filter: 'all', sort: 'Все награды' };

    const applyFilter = () => {
      const { search, filter, sort } = state.rewardUi;
      const query = search.trim().toLowerCase();
      for (const card of $$('.reward-card', grid)) {
        const title = (card.dataset.title || '').toLowerCase();
        const hasSound = card.dataset.hasSound === '1';
        let show = title.includes(query);
        if (filter === 'sound') show = show && hasSound;
        else if (filter === 'nosound') show = show && !hasSound;
        else if (filter === 'playing') show = show && card.dataset.playing === '1';
        else if (filter === 'disabled') show = false;
        card.style.display = show ? '' : 'none';
      }
      const list = $$('.reward-card', grid).slice();
      const cost = (card) => Number(card.dataset.cost) || 0;
      const title = (card) => (card.dataset.title || '').toLowerCase();
      if (sort === 'Сначала дорогие') list.sort((a, b) => cost(b) - cost(a));
      else if (sort === 'Сначала дешёвые') list.sort((a, b) => cost(a) - cost(b));
      else if (sort === 'По названию') list.sort((a, b) => title(a).localeCompare(title(b), 'ru'));
      list.forEach((card) => grid.appendChild(card));
    };
    window.RS.applyRewardFilters = applyFilter;

    const searchInput = $('#reward-search');
    searchInput?.addEventListener('input', () => {
      state.rewardUi.search = searchInput.value;
      applyFilter();
    });

    $('#reward-pills')?.addEventListener('click', (event) => {
      const pill = event.target.closest('.pill');
      if (!pill) return;
      $$('#reward-pills .pill').forEach((p) => p.classList.remove('active'));
      pill.classList.add('active');
      const text = pill.textContent;
      state.rewardUi.filter = text.includes('Со звуком')
        ? 'sound'
        : text.includes('Без звука')
          ? 'nosound'
          : text.includes('Играет')
            ? 'playing'
            : text.includes('Выключенные')
              ? 'disabled'
              : 'all';
      applyFilter();
    });

    $('#reward-sort')?.addEventListener('change', (event) => {
      state.rewardUi.sort = event.target.value;
      applyFilter();
    });

    grid.addEventListener('click', async (event) => {
      const card = event.target.closest('.reward-card');
      if (!card) return;
      const rewardId = card.dataset.id;
      const title = card.dataset.title || 'награда';
      const play = event.target.closest('.sound-play');
      if (play) {
        try {
          await invoke('preview_sound', { rewardId });
          setFooter(`Проигрываем «${title}»`);
        } catch (err) {
          setFooter(String(err));
        }
        return;
      }
      if (event.target.closest('.dots')) {
        const fresh = state.core?.rewards?.find((item) => item.id === rewardId);
        openRewardModal(fresh || { id: rewardId, title });
        return;
      }
      const action = event.target.closest('[data-act]');
      if (!action) return;
      const act = action.dataset.act;
      if (act === 'open-music') {
        render('music');
        return;
      }
      try {
        let view = null;
        if (act === 'remove') {
          view = await invoke('clear_sound', { rewardId });
          setFooter(`Привязка «${title}» удалена`);
        } else if (act === 'replace' || act === 'choose') {
          view = await invoke('choose_sound', { rewardId, title });
          if (view) setFooter(`Файл для «${title}» сохранён`);
        }
        if (view) {
          applyCoreView(view);
          renderCoreRewards(view);
        }
      } catch (err) {
        setFooter(String(err), 6000);
      }
    });

    $('.collapsed')?.addEventListener('click', () => {
      setFooter('Показ выключенных наград появится на следующем этапе');
    });

    $('.head-actions .btn-primary')?.addEventListener('click', () => openRewardModal(null));

    const refresh = $('.toolbar .btn-icon.btn-secondary', content);
    refresh?.addEventListener('click', async () => {
      try {
        const view = await invoke('refresh_rewards');
        if (view) {
          applyCoreView(view);
          renderCoreRewards(view);
          setFooter(view.rewards_loading ? 'Обновляем награды…' : 'Список наград обновлён');
        }
      } catch (err) {
        setFooter(String(err));
      }
    });

    const stopAll = Array.from($$('.toolbar .ghost-red, .toolbar .btn-danger-ghost')).find((el) =>
      el.textContent.includes('Остановить')
    );
    stopAll?.addEventListener('click', async () => {
      try {
        await invoke('stop_all_sounds');
        setFooter('Все звуки остановлены');
      } catch (err) {
        setFooter(String(err));
      }
    });

    $$('.seg-item', content).forEach((item) => {
      item.addEventListener('click', () => {
        $$('.seg-item', content).forEach((i) => i.classList.remove('active'));
        item.classList.add('active');
        setFooter(`Вид «${item.textContent.trim()}» — на следующем этапе`);
      });
    });
  }

  /* ---------- «Музыка» ---------- */
  const ICONS = {
    pause: '<svg width="12" height="12" viewBox="0 0 12 12"><rect x="2" y="1.5" width="3" height="9" rx="1" fill="#0A0A0A"/><rect x="7" y="1.5" width="3" height="9" rx="1" fill="#0A0A0A"/></svg>',
    play: '<svg width="12" height="12" viewBox="0 0 12 12"><path d="M3 1.6v8.8L10 6z" fill="#0A0A0A"/></svg>',
  };

  function fmtDuration(seconds) {
    const value = Number(seconds) || 0;
    return `${Math.floor(value / 60)}:${String(value % 60).padStart(2, '0')}`;
  }

  function musicStateLabel(state) {
    return (
      {
        queued: 'в очереди',
        loading: 'загружается',
        playing: 'играет',
        done: 'сыграно',
        failed: 'ошибка',
        refunded: 'баллы возвращены',
        skipped: 'пропущено',
      }[state] || state
    );
  }

  let musicClock = null;

  function updateMusicProgress() {
    if (!musicClock || state.tab !== 'music') return;
    const player = $('#music-player');
    const progress = $('#track-progress', player || document);
    if (!progress) return;
    const total = musicClock.total;
    if (!total) return;
    const elapsed = musicClock.playing ? (performance.now() - musicClock.startedAt) / 1000 : 0;
    const position = Math.min(total, musicClock.base + elapsed);
    const fraction = position / total;
    const fill = $('#progress-fill', progress.parentElement);
    const knob = $('#progress-knob', progress.parentElement);
    if (fill) fill.style.width = `${(fraction * 100).toFixed(2)}%`;
    if (knob) knob.style.left = `${(fraction * 100).toFixed(2)}%`;
    const times = progress.parentElement?.querySelectorAll('span');
    if (times && times.length) {
      times[0].textContent = fmtDuration(Math.floor(position));
      times[times.length - 1].textContent = fmtDuration(total);
    }
  }

  function startMusicClock(player, total) {
    musicClock = {
      base: Number(player?.position_sec) || 0,
      total: Number(total) || Number(player?.duration_sec) || 0,
      playing: !!player && !player.paused && !!total,
      startedAt: performance.now(),
    };
  }

  function musicQueueRow(item, index, currentId, prefetched) {
    const playing = item.state === 'playing';
    const stateColor =
      item.state === 'playing'
        ? '#8B00FF'
        : item.state === 'loading'
          ? '#F59E0B'
          : '#B9B9B9';
    const stateBorder =
      item.state === 'playing'
        ? 'rgba(139,0,255,.3)'
        : item.state === 'loading'
          ? 'rgba(245,158,11,.3)'
          : 'rgba(255,255,255,.14)';
    const meta =
      item.state === 'loading'
        ? `<span style="color:#F59E0B">загружается</span>`
        : `@${escapeHtml(item.user_login)}${item.duration_sec ? ` · ${fmtDuration(item.duration_sec)}` : ''}`;
    const up =
      item.state === 'queued' && index > 0
        ? `<div class="queue-btn" data-act="up" title="Поднять выше" style="width:26px;height:26px;border-radius:8px;display:flex;align-items:center;justify-content:center;background:rgba(255,255,255,.05);cursor:pointer">
             <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#8B8B8B" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 19V5M5 12l7-7 7 7"/></svg>
           </div>`
        : '';
    const prefetch =
      prefetched && item.id === prefetched
        ? `<span style="font-size:10.4px;color:#8B00FF">загружен</span>`
        : '';
    return `<div class="queue-row" data-id="${escapeHtml(item.id)}"
      style="display:flex;align-items:center;gap:12px;height:36px;border-radius:10px;padding:0 10px;position:relative;${playing ? 'background:rgba(139,0,255,.07)' : ''}">
      ${playing ? '<span style="position:absolute;left:0;top:8px;bottom:8px;width:3px;border-radius:2px;background:#8B00FF"></span>' : ''}
      <span style="font-size:12.6px;color:#8B8B8B;width:14px">${index + 1}</span>
      <div style="flex:1 1 auto;min-width:0">
        <div style="font-size:13.8px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${escapeHtml(item.title)}</div>
        <div style="font-size:11.4px;color:#8B8B8B">${meta}</div>
      </div>
      ${prefetch}
      <div class="pill" style="height:24px;font-size:11.2px;padding:0 9px;color:${stateColor};border-color:${stateBorder}">${musicStateLabel(item.state)}</div>
      <div class="queue-btn" data-act="up" style="display:none"></div>
      <div class="queue-btn" data-act="remove" title="Убрать из очереди" style="width:26px;height:26px;border-radius:8px;display:flex;align-items:center;justify-content:center;background:rgba(255,255,255,.05);cursor:pointer">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#8B8B8B" stroke-width="2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>
      </div>
      ${up}
    </div>`;
  }

  function renderMusicCore(view) {
    const music = view && view.music;
    if (!music || state.tab !== 'music') return;

    // Шапка: статус приёма заявок.
    const statusBtn = $('.head-actions .btn-primary', content);
    if (statusBtn) {
      const label = !music.enabled
        ? 'Приём выключен'
        : music.ready
          ? 'Принимаем заявки'
          : 'Нет yt-dlp';
      statusBtn.innerHTML = `<span class="dot ${music.enabled && music.ready ? 'dot-green' : ''}" style="background:${music.enabled && music.ready ? '#8B00FF' : '#8B8B8B'}"></span>${label}`;
    }

    // Плашка награды и версия yt-dlp.
    const rewardPill = $('.toolbar .pill.active', content);
    if (rewardPill) {
      rewardPill.textContent = `Награда: ${music.reward_title || 'МУЗЫКА ЮТУБ'} · ${music.reward_cost} баллов`;
    }
    const ytdlpPill = $('.toolbar .pill:not(.active)', content);
    if (ytdlpPill) {
      if (music.ytdlp_version) {
        ytdlpPill.innerHTML = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#8B00FF" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"/></svg>yt-dlp ${escapeHtml(music.ytdlp_version)}`;
        ytdlpPill.style.color = '#8B00FF';
      } else {
        ytdlpPill.textContent = 'yt-dlp не найден';
        ytdlpPill.style.color = '#EF4444';
      }
    }

    const player = $('#music-player');
    if (!player) return;
    const current = music.current;
    const playerState = music.player || {};
    const total = Number(playerState.duration_sec) || Number(current?.duration_sec) || 0;
    const position = Number(playerState.position_sec) || 0;

    const label = Array.from(player.querySelectorAll('div')).find(
      (el) =>
        !el.children.length &&
        ['СЕЙЧАС ИГРАЕТ', 'ПАУЗА', 'ЗАГРУЖАЕМ ТРЕК'].includes(el.textContent.trim())
    );
    if (label) {
      label.textContent = !current
        ? ''
        : current.state === 'loading'
          ? 'ЗАГРУЖАЕМ ТРЕК'
          : playerState.paused
            ? 'ПАУЗА'
            : 'СЕЙЧАС ИГРАЕТ';
      label.style.color = current && current.state === 'loading' ? '#F59E0B' : '#8B00FF';
    }
    const title = player.querySelector('div[style*="font-size:19px"]');
    if (title) title.textContent = current ? current.title : 'Ничего не играет';
    const meta = player.querySelector('div[style*="font-size:12.8px"]');
    if (meta) {
      const who = current
        ? current.user_login === 'manual'
          ? 'ручная заявка'
          : `заказал @${current.user_login}`
        : '';
      meta.textContent = current
        ? `${who}${current.channel ? ` · ${current.channel}` : ''}${current.duration_sec ? ` · ${fmtDuration(current.duration_sec)}` : ''}`
        : 'Активируйте награду на канале — трек встанет в очередь';
    }

    const progress = $('#track-progress', player);
    if (progress) {
      const fraction = total ? Math.min(1, position / total) : 0;
      const fill = $('#progress-fill', player);
      const knob = $('#progress-knob', player);
      if (fill) fill.style.width = `${(fraction * 100).toFixed(2)}%`;
      if (knob) knob.style.left = `${(fraction * 100).toFixed(2)}%`;
      const times = progress.parentElement?.querySelectorAll('span');
      if (times && times.length) {
        times[0].textContent = fmtDuration(position);
        times[times.length - 1].textContent = fmtDuration(total);
      }
    }
    startMusicClock(playerState, total);

    const playToggle = $('#play-toggle', player);
    if (playToggle) {
      playToggle.innerHTML = playerState.paused ? ICONS.play : ICONS.pause;
      playToggle.dataset.playing = playerState.paused ? '0' : '1';
      playToggle.style.opacity = current ? '' : '.5';
    }

    const next = music.items.find((item) => item.state === 'queued');
    const nextDiv = Array.from(player.querySelectorAll('div')).find((el) =>
      el.textContent.trim().startsWith('Следующий:')
    );
    if (nextDiv) {
      nextDiv.innerHTML = `Следующий: <span style="color:#CFCFCF">${escapeHtml(next ? next.title : '—')}</span>`;
    }

    const volumeSlider = player.querySelector('.slider');
    if (volumeSlider) {
      const fraction = Math.max(0, Math.min(1, Number(music.volume) || 0));
      const fill = volumeSlider.querySelector('.fill');
      const knob = volumeSlider.querySelector('.knob');
      if (fill) fill.style.width = `${fraction * 100}%`;
      if (knob) knob.style.left = `${fraction * 100}%`;
      const labelSpan = volumeSlider.parentElement?.querySelector('span');
      if (labelSpan) labelSpan.textContent = `${Math.round(fraction * 100)}%`;
      volumeSlider.dataset.rewardVolume = '1';
      volumeSlider.dataset.bound = '';
    }

    // Очередь.
    const queue = $('#music-queue');
    if (queue) {
      const header = queue.firstElementChild;
      if (header) {
        const title = header.querySelector('div');
        if (title) title.textContent = `Очередь · ${music.items.length} из ${music.max_queue}`;
        const playing = music.items.filter((item) => item.state === 'playing').length;
        const loading = music.items.filter((item) => item.state === 'loading').length;
        const pills = header.querySelectorAll('.pill');
        if (pills[0]) {
          pills[0].style.display = playing ? '' : 'none';
          pills[0].textContent = `${playing} играет`;
        }
        if (pills[1]) {
          pills[1].style.display = loading ? '' : 'none';
          pills[1].textContent = `${loading} загружается`;
        }
      }
      queue.querySelectorAll('.queue-row, .queue-empty').forEach((row) => row.remove());
      const rows = music.items
        .map((item, index) => musicQueueRow(item, index, current?.id, music.prefetched))
        .join('');
      header?.insertAdjacentHTML('afterend', rows);
      if (!music.items.length) {
        header?.insertAdjacentHTML(
          'afterend',
          `<div class="queue-empty" style="padding:8px 10px;font-size:12px;color:#8B8B8B">Очередь пуста. Ссылка из активации награды появится здесь.</div>`
        );
      }
    }

    // Нижний ряд: ссылка OBS и превью.
    const obsCard = $('#obs-card');
    if (obsCard) {
      const url = obsCard.querySelector('div[style*="font-family:monospace"]');
      if (url) url.textContent = 'http://127.0.0.1:8770/overlay';
      const previewTitle = obsCard.querySelector('span[style*="font-weight:600"]');
      if (previewTitle) previewTitle.textContent = current ? current.title : '—';
      const requester = Array.from(obsCard.querySelectorAll('span')).find((el) =>
        el.textContent.includes('заказал')
      );
      if (requester) {
        requester.textContent = current
          ? current.user_login === 'manual'
            ? '· ручная заявка'
            : `· заказал @${current.user_login}`
          : '';
      }
    }
    // Карточка «Состояние».
    const stateCard = $('#state-card');
    if (stateCard) {
      const box = Array.from(stateCard.querySelectorAll('div')).find((el) =>
        (el.getAttribute('style') || '').includes('flex-direction:column')
      );
      if (box) {
        const ok = (text) =>
          `<div style="display:flex;align-items:center;gap:8px"><span style="color:#8B00FF">✓</span><span>${escapeHtml(text)}</span></div>`;
        const dot = (text) =>
          `<div style="display:flex;align-items:center;gap:8px"><span class="dot dot-green"></span><span>${escapeHtml(text)}</span></div>`;
        box.innerHTML = [
          music.ytdlp_version
            ? ok(`yt-dlp ${music.ytdlp_version} — готов`)
            : ok('yt-dlp не найден'),
          view.connected ? dot('Чат: команда !трек работает') : dot('Чат: нужен Twitch'),
          dot('Порт оверлея 8770 — свободен'),
        ].join('');
      }
    }
  }

  function bindOverlayCopy() {
    const button = $('#obs-copy-url', content);
    if (!button || button.dataset.bound) return;
    button.dataset.bound = '1';
    button.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText('http://127.0.0.1:8770/overlay');
        setFooter('Ссылка на оверлей скопирована');
      } catch {
        setFooter('Не удалось скопировать ссылку');
      }
    });
  }

  function bindMusic() {
    const player = $('#music-player');
    const queue = $('#music-queue');
    if (!player) return;
    bindOverlayCopy();
    if (state.core) {
      renderMusicCore(state.core);
      bindMusicBackend();
      return;
    }

    // Демо-режим без Tauri: только визуальные взаимодействия.
    const volumeSlider = $('.slider', player);
    if (volumeSlider) {
      const label = volumeSlider.parentElement?.querySelector('span');
      bindSlider(volumeSlider, {
        onChange: (f) => {
          if (label) label.textContent = `${Math.round(f * 100)}%`;
        },
      });
    }
    const playToggle = $('#play-toggle', player);
    playToggle?.addEventListener('click', () => {
      state.playing = !state.playing;
      playToggle.innerHTML = state.playing ? ICONS.pause : ICONS.play;
      playToggle.dataset.playing = state.playing ? '1' : '0';
      const label = Array.from(player.querySelectorAll('div')).find(
        (el) => el.textContent.trim() === 'СЕЙЧАС ИГРАЕТ' || el.textContent.trim() === 'ПАУЗА'
      );
      if (label) label.textContent = state.playing ? 'СЕЙЧАС ИГРАЕТ' : 'ПАУЗА';
    });
    $('#track-progress', player)?.addEventListener('pointerdown', () => {});
    $('#skip-track', player)?.addEventListener('click', () => setFooter('Пропуск трека (демо)'));
    $('#obs-header', content)?.addEventListener('click', openObsModal);
    $('#obs-open', content)?.addEventListener('click', openObsModal);
    $('#obs-show', content)?.addEventListener('click', () => setFooter('Показ строки (демо)'));
    const manual = $('#manual-url');
    const addButton = manual?.closest('.search')?.nextElementSibling;
    manual?.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') setFooter('Добавление ссылки (демо)');
    });
    addButton?.addEventListener('click', () => setFooter('Добавление ссылки (демо)'));
  }

  async function musicCommand(command, args = {}) {
    try {
      const view = await invoke(command, args);
      if (view) {
        applyCoreView(view);
        renderMusicCore(view);
      }
      return view;
    } catch (err) {
      setFooter(String(err), 5000);
      return null;
    }
  }

  function bindMusicBackend() {
    const player = $('#music-player');
    const queue = $('#music-queue');
    if (!player) return;

    $('#play-toggle', player)?.addEventListener('click', () => musicCommand('music_toggle_pause'));
    $('#skip-track', player)?.addEventListener('click', () => musicCommand('music_skip'));

    // Перемотка: клик/перетаскивание по полосе.
    const progress = $('#track-progress', player);
    progress?.addEventListener('pointerdown', async (event) => {
      const rect = progress.getBoundingClientRect();
      const fraction = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width));
      const total = musicClock?.total || 0;
      if (!total) return;
      await musicCommand('music_seek', { sec: Math.round(total * fraction) });
    });

    // Кнопки «назад»/«вперёд» — по стилям кружков.
    const roundButtons = Array.from(player.querySelectorAll('div')).filter((el) =>
      /width:32px;height:32px;border-radius:50%/.test(el.getAttribute('style') || '')
    );
    roundButtons[0]?.addEventListener('click', () => musicCommand('music_restart'));
    roundButtons[1]?.addEventListener('click', () => musicCommand('music_skip'));

    // Громкость музыки.
    const volumeSlider = $('.slider', player);
    if (volumeSlider) {
      bindSlider(volumeSlider, {
        onChange: (f) => {
          const label = volumeSlider.parentElement?.querySelector('span');
          if (label) label.textContent = `${Math.round(f * 100)}%`;
        },
        onCommit: (f) => musicCommand('music_set_volume', { volume: f }),
      });
    }

    // Ручная ссылка.
    const manual = $('#manual-url');
    const addButton = manual?.closest('.search')?.nextElementSibling;
    const add = () => {
      const url = manual?.value.trim();
      if (!url) return;
      manual.value = '';
      musicCommand('music_add_manual', { url });
    };
    manual?.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') add();
    });
    addButton?.addEventListener('click', add);

    // Очередь: крестики/стрелки, очистка.
    queue?.addEventListener('click', (event) => {
      const btn = event.target.closest('.queue-btn');
      if (btn) {
        const row = btn.closest('.queue-row');
        const id = row?.dataset.id;
        if (!id) return;
        if (btn.dataset.act === 'up') musicCommand('music_move_up', { id });
        else musicCommand('music_remove_item', { id });
        return;
      }
      const clear = event.target.closest('.ghost-red');
      if (clear && clear.textContent.includes('Очистить')) {
        musicCommand('music_clear_queue');
      }
    });

    // OBS.
    $('#obs-header', content)?.addEventListener('click', openObsModal);
    $('#obs-open', content)?.addEventListener('click', openObsModal);
    $('#obs-show', content)?.addEventListener('click', () => musicCommand('music_show_overlay'));

    // Статус приёма заявок.
    $('.head-actions .btn-primary', content)?.addEventListener('click', async () => {
      const enabled = !(state.core?.music?.enabled ?? false);
      await musicCommand('music_set_enabled', { enabled });
    });
  }

  function updateQueueCount() {
    const queue = $('#music-queue');
    if (!queue) return;
    const count = queue.querySelectorAll('.queue-row').length;
    const header = queue.firstElementChild;
    const title = header?.querySelector('div');
    if (title) title.textContent = `Очередь · ${count} из 10`;
  }

  function renumberQueue() {
    const queue = $('#music-queue');
    if (!queue) return;
    $$('.queue-row', queue).forEach((row, index) => {
      const number = row.querySelector('span');
      if (number) number.textContent = String(index + 1);
    });
  }

  function addQueueRow(label) {
    const queue = $('#music-queue');
    const rows = $$('.queue-row', queue);
    const template = rows[rows.length - 1];
    if (!template) return;
    const row = template.cloneNode(true);
    row.classList.remove('active');
    const number = row.querySelector('span');
    if (number) number.textContent = String(rows.length + 1);
    const title = row.querySelector('div[style*="font-size:13.8px"]');
    if (title) title.textContent = label.length > 70 ? `${label.slice(0, 67)}…` : label;
    const meta = title?.nextElementSibling;
    if (meta) meta.textContent = '@manual · —';
    template.after(row);
    updateQueueCount();
  }

  /* ---------- «Настройки» ---------- */
  function toggleHtml(key, enabled, label, hint) {
    return `<div class="settings-row">
      <div><div class="settings-row-title">${escapeHtml(label)}</div>${hint ? `<div class="settings-row-hint">${escapeHtml(hint)}</div>` : ''}</div>
      <button class="toggle ${enabled ? 'on' : ''}" data-setting="${key}" aria-pressed="${enabled}"><span></span></button>
    </div>`;
  }

  function settingsPage(view) {
    const core = view || state.core || {};
    const auth = core.auth || { state: 'idle' };
    const connected = !!core.connected;
    const login = core.login || core.display_name || '';
    const clientId = core.client_id || '';
    const volume = Math.round((Number(core.volume) || 0) * 100);

    let twitch;
    if (auth.state === 'waiting') {
      twitch = `
        <div class="settings-status"><span class="dot dot-green"></span>Ждём подтверждения на Twitch</div>
        <div class="auth-code">${escapeHtml(auth.user_code || '…')}</div>
        <div class="settings-row-hint">Введите этот код на twitch.tv/activate. Код действует несколько минут.</div>
        <div class="settings-actions">
          <button class="btn btn-primary" id="twitch-open-activate">Открыть twitch.tv/activate</button>
          <button class="btn btn-secondary" id="twitch-cancel">Отмена</button>
        </div>
        ${auth.progress ? `<div class="settings-row-hint">${escapeHtml(auth.progress)}</div>` : ''}`;
    } else {
      twitch = `
        <div class="settings-status">${connected ? '<span class="dot dot-green"></span>Подключено' : '<span class="dot" style="background:#5A5A5A"></span>Не подключено'}</div>
        ${auth.error ? `<div class="settings-error">${escapeHtml(auth.error)}</div>` : ''}
        <label class="settings-label">CLIENT ID</label>
        <input class="input settings-input" id="twitch-client-id" value="${escapeHtml(clientId)}" spellcheck="false" autocomplete="off" placeholder="Client ID приложения Twitch">
        <div class="settings-row-hint">Публичный идентификатор приложения из dev.twitch.tv — не пароль.</div>
        <div class="settings-actions">
          <button class="btn btn-primary" id="twitch-connect">${connected ? 'Переподключить' : 'Подключить Twitch'}</button>
          ${connected ? '<button class="btn btn-secondary" id="twitch-disconnect">Отключить</button>' : ''}
        </div>`;
    }

    return `
      <div class="page-head"><div><div class="h1">Настройки</div>
        <div class="sub">Twitch, звук и поведение приложения</div></div></div>
      <div class="settings-grid">
        <div class="card settings-card">
          <div class="settings-card-title">Twitch</div>
          <div class="settings-card-sub">Аккаунт канала, с которого читаются награды</div>
          ${twitch}
        </div>
        <div class="card settings-card">
          <div class="settings-card-title">Звук</div>
          <div class="settings-card-sub">Громкость приложения и воспроизведение</div>
          <div class="settings-volume-row">
            <span class="settings-label">ГРОМКОСТЬ</span>
            <div class="slider" id="settings-volume"><div class="track"></div><div class="fill" style="width:${volume}%"></div><div class="knob" style="left:${volume}%"></div></div>
            <span class="settings-volume-value" id="settings-volume-value">${volume}%</span>
          </div>
          ${toggleHtml('muted', !!core.muted, 'Без звука', 'Заглушить все звуки наград')}
          ${toggleHtml('playback_enabled', core.playback_enabled !== false, 'Воспроизводить звуки наград', '')}
        </div>
        <div class="card settings-card">
          <div class="settings-card-title">Приложение</div>
          <div class="settings-card-sub">Запуск и поведение окна</div>
          ${toggleHtml('autostart', !!core.autostart, 'Запускать с Windows', '')}
          ${toggleHtml('close_to_tray', !!core.close_to_tray, 'Закрывать в трей', 'Крестик прячет окно, приложение продолжает работать')}
          ${toggleHtml('start_minimized', !!core.start_minimized, 'Запускать свёрнутым', '')}
          <div class="settings-row"><div><div class="settings-row-title">Версия</div></div><div class="settings-version">${escapeHtml(core.version || state.version)}</div></div>
        </div>
        <div class="card settings-card">
          <div class="settings-card-title">Музыка</div>
          <div class="settings-card-sub">Треки по заявке из чата</div>
          <div class="settings-status">${core.music && core.music.ready ? '<span class="dot dot-green"></span>Готова к заявкам' : '<span class="dot" style="background:#5A5A5A"></span>Не готова'}</div>
          <div class="settings-row"><div><div class="settings-row-title">Награда</div><div class="settings-row-hint">${escapeHtml(core.music?.reward_title || 'не выбрана')} · ${core.music?.reward_cost || 0} баллов</div></div></div>
          <div class="settings-actions"><button class="btn btn-secondary" id="open-music-tab">Открыть вкладку «Музыка»</button></div>
        </div>
      </div>`;
  }

  function bindSettings(view) {
    $$('[data-setting]', content).forEach((btn) => {
      btn.addEventListener('click', async () => {
        const key = btn.dataset.setting;
        const on = btn.classList.contains('on');
        try {
          const result = await invoke('set_app_setting', { key, value: on ? '0' : '1' });
          if (result) {
            applyCoreView(result);
            state.core = result;
            render('settings');
          }
        } catch (err) {
          setFooter(String(err), 5000);
        }
      });
    });

    const volume = $('#settings-volume', content);
    if (volume) {
      const label = $('#settings-volume-value', content);
      bindSlider(volume, {
        onChange: (f) => {
          if (label) label.textContent = `${Math.round(f * 100)}%`;
        },
        onCommit: async (f) => {
          try {
            const result = await invoke('set_app_setting', {
              key: 'volume',
              value: f.toFixed(3),
            });
            if (result) applyCoreView(result);
          } catch (err) {
            setFooter(String(err), 5000);
          }
        },
      });
    }

    $('#twitch-connect')?.addEventListener('click', async () => {
      const input = $('#twitch-client-id');
      const clientId = input ? input.value.trim() : '';
      try {
        const result = await invoke('twitch_start_login', { clientId });
        if (result) {
          applyCoreView(result);
          state.core = result;
          render('settings');
        }
      } catch (err) {
        setFooter(String(err), 6000);
      }
    });
    $('#twitch-cancel')?.addEventListener('click', async () => {
      try {
        const result = await invoke('twitch_cancel_login');
        if (result) {
          applyCoreView(result);
          state.core = result;
          render('settings');
        }
      } catch (err) {
        setFooter(String(err));
      }
    });
    $('#twitch-disconnect')?.addEventListener('click', async () => {
      try {
        const result = await invoke('twitch_disconnect');
        if (result) {
          applyCoreView(result);
          state.core = result;
          render('settings');
        }
      } catch (err) {
        setFooter(String(err));
      }
    });
    $('#twitch-open-activate')?.addEventListener('click', () => {
      invoke('open_url', { url: 'https://www.twitch.tv/activate' });
      setFooter('Открываем twitch.tv/activate в браузере');
    });
    $('#open-music-tab')?.addEventListener('click', () => render('music'));
  }

  /* ---------- «Журнал» ---------- */
  function logLevelLabel(level) {
    const map = {
      ERROR: 'ошибка',
      WARN: 'предупреждение',
      INFO: 'инфо',
      DEBUG: 'отладка',
      TRACE: 'трассировка',
    };
    return map[level] || level.toLowerCase();
  }

  function logPage() {
    const ui = state.logUi;
    const logs = state.logs || [];
    const filtered = logs.filter((entry) => {
      if (ui.level !== 'all') {
        const matches =
          ui.level === 'error'
            ? entry.level === 'ERROR'
            : ui.level === 'warn'
              ? entry.level === 'WARN'
              : entry.level === 'INFO';
        if (!matches) return false;
      }
      if (!ui.search) return true;
      return (
        entry.message.toLowerCase().includes(ui.search.toLowerCase()) ||
        entry.level.toLowerCase().includes(ui.search.toLowerCase())
      );
    });
    const rows = filtered
      .map(
        (entry) => `
      <div class="log-row">
        <span class="log-time">${escapeHtml(entry.time.slice(5, 19))}</span>
        <span class="log-level log-level-${entry.level.toLowerCase()}">${escapeHtml(logLevelLabel(entry.level))}</span>
        <span class="log-message">${escapeHtml(entry.message)}</span>
      </div>`
      )
      .join('');
    return `
      <div class="page-head"><div><div class="h1">Журнал</div>
        <div class="sub">События наград, музыки, Twitch и ошибки приложения</div></div>
        <div class="head-actions"><button class="btn btn-secondary" id="log-refresh">Обновить</button></div></div>
      <div class="toolbar">
        <div class="search" style="width:340px"><svg width="15" height="15" viewBox="0 0 16 16" fill="none"><circle cx="7" cy="7" r="5" stroke="#8B8B8B" stroke-width="1.4"/><path d="M11 11l3 3" stroke="#8B8B8B" stroke-width="1.4" stroke-linecap="round"/></svg><input id="log-search" placeholder="Поиск по журналу" value="${escapeHtml(ui.search)}"></div>
        <div class="pills">
          <div class="pill ${ui.level === 'all' ? 'active' : ''}" data-log-level="all">Все ${logs.length}</div>
          <div class="pill ${ui.level === 'info' ? 'active' : ''}" data-log-level="info">Инфо</div>
          <div class="pill ${ui.level === 'warn' ? 'active' : ''}" data-log-level="warn">Предупреждения</div>
          <div class="pill ${ui.level === 'error' ? 'active' : ''}" data-log-level="error">Ошибки</div>
        </div>
      </div>
      <div class="card log-card">
        ${rows || `<div class="log-empty">Пока записей нет</div>`}
      </div>`;
  }

  function bindLog() {
    $('#log-refresh')?.addEventListener('click', () => loadLogs(true));
    $('#log-search')?.addEventListener('input', (event) => {
      state.logUi.search = event.target.value;
      content.innerHTML = logPage();
      bindLog();
    });
    $$('[data-log-level]').forEach((pill) => {
      pill.addEventListener('click', () => {
        state.logUi.level = pill.dataset.logLevel;
        content.innerHTML = logPage();
        bindLog();
      });
    });
  }

  async function loadLogs(rerender) {
    try {
      const logs = await invoke('get_logs', { limit: 400 });
      if (Array.isArray(logs)) state.logs = logs;
      if (rerender || state.tab === 'log') {
        content.innerHTML = logPage();
        bindLog();
      }
    } catch (err) {
      setFooter(String(err), 5000);
    }
  }

  /* ---------- заглушки ---------- */  /* ---------- рендер ---------- */
  function render(tab) {
    state.tab = tab;
    const navTab = tab === 'onboarding' ? 'rewards' : tab;
    $$('.nav-item').forEach((item) => {
      item.classList.toggle('active', item.dataset.tab === navTab);
    });

    if (tab === 'settings') {
      content.innerHTML = settingsPage(state.core || null);
      bindSettings(state.core || null);
      applyStatusToDom();
      return;
    }
    if (tab === 'log') {
      content.innerHTML = logPage();
      bindLog();
      applyStatusToDom();
      loadLogs(false);
      return;
    }

    const effective = tab === 'rewards' && !state.connected ? 'onboarding' : tab;
    content.innerHTML = window.SCREENS[effective] || '';
    applyStatusToDom();
    bindSlidersIn(content);

    if (effective === 'rewards') {
      bindRewards();
      if (state.core) renderCoreRewards(state.core);
    }
    if (effective === 'music') {
      bindMusic();
      if (state.core) renderMusicCore(state.core);
    }
    if (effective === 'onboarding') bindOnboarding();
  }

  function bindSlidersIn(root) {
    $$('.slider', root).forEach((slider) => {
      if (slider.id === 'top-volume') return;
      if (slider.closest('#music-player')) return;
      if (slider.classList.contains('disabled')) return;
      const card = slider.closest('.card');
      const volumeRow = slider.closest('.volrow');
      const label = volumeRow?.querySelector('.val') ||
        (slider.parentElement ? Array.from(slider.parentElement.children).find((el) => el.tagName === 'SPAN') : null);
      const max = 2;
      const rewardId = card?.dataset?.id;
      bindSlider(slider, {
        onChange: (f) => {
          if (label) label.textContent = `${Math.round(f * max * 100)}%`;
        },
        onCommit: async (f) => {
          if (!rewardId) return;
          try {
            const view = await invoke('set_sound_volume', { rewardId, volume: f * max });
            if (view) applyCoreView(view);
          } catch (err) {
            setFooter(String(err));
          }
        },
      });
    });
  }

  function bindOnboarding() {
    $$('[data-act="connect"]').forEach((btn) => {
      btn.addEventListener('click', () => {
        render('settings');
        setFooter('Укажите Client ID и нажмите «Подключить Twitch»');
      });
    });
    const buttons = $$('.card .btn', content);
    for (const btn of buttons) {
      const label = btn.textContent.trim();
      if (label.includes('Где взять Client ID')) {
        btn.addEventListener('click', () => {
          invoke('open_url', { url: 'https://dev.twitch.tv/console/apps' });
          setFooter('Открываем dev.twitch.tv/console/apps');
        });
      } else if (label.includes('Открыть инструкцию')) {
        btn.addEventListener('click', () => {
          invoke('open_url', { url: 'https://dev.twitch.tv/docs/authentication' });
          setFooter('Открываем инструкцию Twitch');
        });
      } else if (label.includes('Проверить подключение')) {
        btn.addEventListener('click', async () => {
          const view = await invoke('get_state');
          if (view) {
            applyCoreView(view);
            if (state.connected) render('rewards');
            else setFooter('Twitch ещё не подключён');
          }
        });
      }
    }
  }

  /* ---------- инициализация ---------- */
  async function init() {
    bindWindowControls();
    bindTopVolume();
    $$('.nav-item').forEach((item) => {
      item.addEventListener('click', async () => {
        const tab = item.dataset.tab;
        if (state.tab === tab) return;
        try {
          const view = await invoke('get_state');
          if (view) {
            applyCoreView(view);
            state.coreSig = coreSignature(view);
          }
        } catch {}
        if (tab === 'rewards' && !state.connected) render('onboarding');
        else render(tab);
      });
    });

    const status = await invoke('get_state');
    if (status) {
      applyCoreView(status);
      state.coreSig = coreSignature(status);
    }

    const params = new URLSearchParams(location.search);
    if (params.get('offline') === '1') state.connected = false;
    const initial = params.get('screen') || 'rewards';
    render(initial);
    applyStatusToDom();
    if (params.get('obs') === '1' && initial === 'music') {
      requestAnimationFrame(() => openObsModal());
    }
    setFooter('Готово', 0);

    // Периодически сверяем состояние наград с Rust-ядром.
    const poll = async () => {
      if (!state.core) return;
      const view = await invoke('get_state');
      if (!view) return;
      const signature = coreSignature(view);
      applyCoreView(view);
      if (state.tab === 'rewards' && signature !== state.coreSig) {
        state.coreSig = signature;
        renderCoreRewards(view);
      }
      if (state.tab === 'music') renderMusicCore(view);
      if (state.tab === 'settings') {
        content.innerHTML = settingsPage(view);
        bindSettings(view);
      }
    };
    setTimeout(poll, 800);
    setInterval(poll, 1500);

    // Демо первого запуска: Ctrl+Shift+O.
    document.addEventListener('keydown', (event) => {
      if (event.ctrlKey && event.shiftKey && event.key.toLowerCase() === 'o') {
        event.preventDefault();
        render('onboarding');
        setFooter('Показан экран первого запуска (демо)');
      }
    });
  }

  let lastUiSync = 0;
  async function uiSync() {
    if (!state.core) return;
    try {
      const view = await invoke('get_state');
      if (!view) return;
      const signature = coreSignature(view);
      const changed = signature !== state.coreSig;
      applyCoreView(view);
      if (changed) {
        state.coreSig = signature;
        if (state.tab === 'rewards') renderCoreRewards(view);
        if (state.tab === 'music') renderMusicCore(view);
      if (state.tab === 'settings') {
        content.innerHTML = settingsPage(view);
        bindSettings(view);
      }
      }
    } catch {}
  }

  function musicClockLoop() {
    updateMusicProgress();
    const now = performance.now();
    if (now - lastUiSync > 1500) {
      lastUiSync = now;
      uiSync();
    }
    requestAnimationFrame(musicClockLoop);
  }
  requestAnimationFrame(musicClockLoop);

  window.RS = { render, state, setFooter };
  document.addEventListener('DOMContentLoaded', init);
})();
