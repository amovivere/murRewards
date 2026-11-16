# -*- coding: utf-8 -*-
"""Подключает реальные данные MusicService к экрану «Музыка»."""
import pathlib

p = pathlib.Path(r"C:\Users\mur\Documents\deepseek-harness\default-workspace\reward-sounds-tauri\src-tauri\ui\app.js")
s = p.read_text(encoding="utf-8")
start = s.index("  function bindMusic() {")
end = s.index("  function updateQueueCount() {")
new = r'''  function fmtDuration(seconds) {
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
        ? '#22C55E'
        : item.state === 'loading'
          ? '#F59E0B'
          : '#B9B9B9';
    const stateBorder =
      item.state === 'playing'
        ? 'rgba(34,197,94,.3)'
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
        ? `<span style="font-size:10.4px;color:#22C55E">загружен</span>`
        : '';
    return `<div class="queue-row" data-id="${escapeHtml(item.id)}"
      style="display:flex;align-items:center;gap:12px;height:36px;border-radius:10px;padding:0 10px;position:relative;${playing ? 'background:rgba(34,197,94,.07)' : ''}">
      ${playing ? '<span style="position:absolute;left:0;top:8px;bottom:8px;width:3px;border-radius:2px;background:#22C55E"></span>' : ''}
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
      statusBtn.innerHTML = `<span class="dot ${music.enabled && music.ready ? 'dot-green' : ''}" style="background:${music.enabled && music.ready ? '#22C55E' : '#8B8B8B'}"></span>${label}`;
    }

    // Плашка награды и версия yt-dlp.
    const rewardPill = $('.toolbar .pill.active', content);
    if (rewardPill) {
      rewardPill.textContent = `Награда: ${music.reward_title || 'МУЗЫКА ЮТУБ'} · ${music.reward_cost} баллов`;
    }
    const ytdlpPill = $('.toolbar .pill:not(.active)', content);
    if (ytdlpPill) {
      if (music.ytdlp_version) {
        ytdlpPill.innerHTML = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#22C55E" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"/></svg>yt-dlp ${escapeHtml(music.ytdlp_version)}`;
        ytdlpPill.style.color = '#22C55E';
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
      label.style.color = current && current.state === 'loading' ? '#F59E0B' : '#22C55E';
    }
    const title = player.querySelector('div[style*="font-size:19px"]');
    if (title) title.textContent = current ? current.title : 'Ничего не играет';
    const meta = player.querySelector('div[style*="font-size:12.8px"]');
    if (meta) {
      meta.textContent = current
        ? `заказал @${current.user_login}${current.channel ? ` · ${current.channel}` : ''}${current.duration_sec ? ` · ${fmtDuration(current.duration_sec)}` : ''}`
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
      queue.querySelectorAll('.queue-row').forEach((row) => row.remove());
      const rows = music.items
        .map((item, index) => musicQueueRow(item, index, current?.id, music.prefetched))
        .join('');
      header?.insertAdjacentHTML('afterend', rows);
      if (!music.items.length) {
        header?.insertAdjacentHTML(
          'afterend',
          `<div style="padding:8px 10px;font-size:12px;color:#8B8B8B">Очередь пуста. Ссылка из активации награды появится здесь.</div>`
        );
      }
    }

    // Нижний ряд.
    const obsPreview = $('#obs-card div[style*="font-size:11.4px"]');
    if (obsPreview && current) obsPreview.textContent = current.title;
    const stateRows = $$('#state-card div[style*="font-size:11.4px"]');
    if (stateRows[0]) {
      stateRows[0].textContent = music.ytdlp_version
        ? `yt-dlp ${music.ytdlp_version} — готов`
        : 'yt-dlp не найден';
    }
    if (stateRows[1]) stateRows[1].textContent = view.connected ? 'Чат: команда !трек работает' : 'Чат: нужен Twitch';
  }

  function bindMusic() {
    const player = $('#music-player');
    const queue = $('#music-queue');
    if (!player) return;
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

'''
s = s[:start] + new + s[end:]

# render: после bindMusic подставить реальные данные
s = s.replace(
    "    if (effective === 'music') bindMusic();",
    """    if (effective === 'music') {
      bindMusic();
      if (state.core) renderMusicCore(state.core);
    }"""
)

# poll: применять и музыку
s = s.replace(
    """      applyCoreView(view);
      if (state.tab === 'rewards' && signature !== state.coreSig) {
        state.coreSig = signature;
        renderCoreRewards(view);
      }""",
    """      applyCoreView(view);
      if (state.tab === 'rewards' && signature !== state.coreSig) {
        state.coreSig = signature;
        renderCoreRewards(view);
      }
      if (state.tab === 'music') renderMusicCore(view);"""
)

# rAF-обновление прогресса
s = s.replace(
    "  window.RS = { render, state, setFooter };",
    """  function musicClockLoop() {
    updateMusicProgress();
    requestAnimationFrame(musicClockLoop);
  }
  requestAnimationFrame(musicClockLoop);

  window.RS = { render, state, setFooter };"""
)

p.write_text(s, encoding="utf-8")
print("music frontend wired")
