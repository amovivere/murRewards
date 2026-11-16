# -*- coding: utf-8 -*-
"""Подключает реальные награды из Rust-ядра к вкладке «Награды»."""
import pathlib

p = pathlib.Path(r"C:\Users\mur\Documents\deepseek-harness\default-workspace\reward-sounds-tauri\src-tauri\ui\app.js")
s = p.read_text(encoding="utf-8")

old_start = "  /* ---------- «Награды» ---------- */"
old_end = "  /* ---------- «Музыка» ---------- */"
start = s.index(old_start)
end = s.index(old_end)

new = r'''  /* ---------- «Награды»: реальные данные из Rust-ядра ---------- */
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

  function rewardCardHtml(reward) {
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
           <div class="slider sm"><div class="track"></div><div class="fill" style="width:0%"></div></div>
           <span class="val">—</span></div>`;

    const actions = file
      ? `<div class="card-actions"><div class="btn btn-sm btn-secondary" data-act="replace">Заменить</div><div class="ghost-red" data-act="remove">Убрать</div></div>`
      : `<div class="card-actions"><div class="btn btn-sm btn-primary" data-act="choose">Выбрать звук</div></div>`;

    return `<div class="card reward-card" data-id="${escapeHtml(reward.id)}"
      data-title="${title}" data-cost="${Number(reward.cost) || 0}"
      data-has-sound="${has ? '1' : '0'}" data-playing="${reward.playing ? '1' : '0'}"
      data-available="${reward.available ? '1' : '0'}"
      style="background:${bg};border-color:${border}">
      <div class="card-top">
        <div class="tile" style="background:${color}">${letter}</div>
        <div style="flex:1 1 auto;min-width:0">
          <div class="card-title">${title}</div>
          <div class="card-meta">${Number(reward.cost) || 0} БАЛЛОВ · ${reward.available ? 'АКТИВНА' : 'ВЫКЛЮЧЕНА'}</div>
        </div>
        <div class="dots">•••</div>
      </div>
      ${chip}
      ${volrow}
      ${actions}
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
        `@${state.login} · ${rewards.length} ${pluralRu(rewards.length, 'награда', 'награды', 'наград')}` +
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
      grid.innerHTML = rewards.map(rewardCardHtml).join('');
    }
    updateRewardCounts(view);
    applyRewardFilters();
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
      const action = event.target.closest('[data-act]');
      if (!action) return;
      const act = action.dataset.act;
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

    $('.head-actions .btn-primary')?.addEventListener('click', () => {
      setFooter('Создание награды появится на следующем этапе');
    });

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

'''

s = s[:start] + new + s[end:]

# state: core/rewardUi
s = s.replace(
    "    musicCost: 50,\n    playing: true,\n  };",
    "    musicCost: 50,\n    playing: true,\n    core: null,\n    coreSig: '',\n    rewardUi: { search: '', filter: 'all', sort: 'Все награды' },\n  };"
)

# bindSlidersIn: реальная громкость наград
s = s.replace(
    """      const max = card && !card.closest('.onboarding') ? 2 : 2;
      bindSlider(slider, {
        onChange: (f) => {
          if (label) label.textContent = `${Math.round(f * max * 100)}%`;
        },
      });""",
    """      const max = 2;
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
      });"""
)

# render: после bindRewards подставить реальные карточки
s = s.replace(
    "    if (effective === 'rewards') bindRewards();\n    if (effective === 'music') bindMusic();",
    """    if (effective === 'rewards') {
      bindRewards();
      if (state.core) renderCoreRewards(state.core);
    }
    if (effective === 'music') bindMusic();"""
)

# init: get_state вместо core_status + polling
s = s.replace(
    """    const status = await invoke('core_status');
    if (status) {
      state.connected = !!status.connected;
      state.login = status.login || status.display_name || state.login;
      state.displayName = status.display_name || '';
      state.volume = Number(status.volume) || 0;
      state.version = status.version || state.version;
      state.musicTitle = status.music_reward_title || state.musicTitle;
      state.musicCost = status.music_reward_cost ?? state.musicCost;
    }""",
    """    const status = await invoke('get_state');
    if (status) {
      applyCoreView(status);
      state.coreSig = coreSignature(status);
    }"""
)

s = s.replace(
    """    setFooter('Готово', 0);

    // Демо первого запуска: Ctrl+Shift+O.""",
    """    setFooter('Готово', 0);

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
    };
    setInterval(poll, 1500);

    // Демо первого запуска: Ctrl+Shift+O."""
)

p.write_text(s, encoding="utf-8")
print("dynamic rewards wired")
