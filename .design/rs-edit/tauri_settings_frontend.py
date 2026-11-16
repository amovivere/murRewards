# -*- coding: utf-8 -*-
"""Экран «Настройки» в Tauri-прототипе."""
import pathlib

p = pathlib.Path(r"C:\Users\mur\Documents\deepseek-harness\default-workspace\reward-sounds-tauri\src-tauri\ui\app.js")
s = p.read_text(encoding="utf-8")

start = s.index("  /* ---------- заглушки ---------- */")
end = s.index("  /* ---------- рендер ---------- */")

new = r'''  /* ---------- «Настройки» ---------- */
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
        <div class="settings-status">${connected ? '<span class="dot dot-green"></span>Подключено' : '<span class="dot" style="background:#5A5A5A"></span>Не подключено'}${connected && login ? ` · ${escapeHtml(login)}` : ''}</div>
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

  /* ---------- заглушки ---------- */
  function stubPage(title, subtitle) {
    return `
      <div class="page-head"><div><div class="h1">${title}</div><div class="sub">${subtitle}</div></div></div>
      <div class="stub-page">
        <div class="stub-card"><b>Прототип Tauri</b><br><br>
          Этот экран ещё не перенесён из egui-версии. Здесь будут те же секции и данные,
          что и в рабочем приложении, но уже на HTML/CSS.</div>
        <div class="stub-card">Следующие шаги: подключить Rust-команды настроек и авторизации,
          затем перенести «Награды» и «Музыку» на реальные данные.</div>
      </div>`;
  }

'''

s = s[:start] + new + s[end:]

# render: реальные настройки вместо заглушки
s = s.replace("""    if (tab === 'settings') {
      content.innerHTML = stubPage('Настройки', 'Подключение к Twitch, звук, автозапуск и трей');
      bindSlidersIn(content);
      applyStatusToDom();
      return;
    }""","""    if (tab === 'settings') {
      content.innerHTML = settingsPage(state.core || null);
      bindSettings(state.core || null);
      applyStatusToDom();
      return;
    }""")

# poll: обновлять настройки при изменениях авторизации
s = s.replace("""      if (state.tab === 'music') renderMusicCore(view);""","""      if (state.tab === 'music') renderMusicCore(view);
      if (state.tab === 'settings') {
        content.innerHTML = settingsPage(view);
        bindSettings(view);
      }""")

# coreSignature: добавить auth/clientid/settings
s = s.replace("""      rewards: view.rewards,
      volume: view.volume,
    });""","""      rewards: view.rewards,
      volume: view.volume,
      client_id: view.client_id,
      auth: view.auth,
      autostart: view.autostart,
      close_to_tray: view.close_to_tray,
      start_minimized: view.start_minimized,
      muted: view.muted,
      playback_enabled: view.playback_enabled,
    });""")

p.write_text(s, encoding="utf-8")
print("settings frontend wired")
