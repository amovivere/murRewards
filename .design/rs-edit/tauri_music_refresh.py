import pathlib
p=pathlib.Path(r"C:\Users\mur\Documents\deepseek-harness\default-workspace\reward-sounds-tauri\src-tauri\ui\app.js")
s=p.read_text(encoding="utf-8")
# 1) свежий get_state при переключении вкладки
s=s.replace("""    $$('.nav-item').forEach((item) => {
      item.addEventListener('click', () => {
        const tab = item.dataset.tab;
        if (state.tab === tab) return;
        if (tab === 'rewards' && !state.connected) render('onboarding');
        else render(tab);
      });
    });""","""    $$('.nav-item').forEach((item) => {
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
    });""")
# 2) очередь: удалять и старый empty-маркер, ставить один
s=s.replace("""      queue.querySelectorAll('.queue-row').forEach((row) => row.remove());
      const rows = music.items
        .map((item, index) => musicQueueRow(item, index, current?.id, music.prefetched))
        .join('');
      header?.insertAdjacentHTML('afterend', rows);
      if (!music.items.length) {
        header?.insertAdjacentHTML(
          'afterend',
          `<div style="padding:8px 10px;font-size:12px;color:#8B8B8B">Очередь пуста. Ссылка из активации награды появится здесь.</div>`
        );
      }""","""      queue.querySelectorAll('.queue-row, .queue-empty').forEach((row) => row.remove());
      const rows = music.items
        .map((item, index) => musicQueueRow(item, index, current?.id, music.prefetched))
        .join('');
      header?.insertAdjacentHTML('afterend', rows);
      if (!music.items.length) {
        header?.insertAdjacentHTML(
          'afterend',
          `<div class="queue-empty" style="padding:8px 10px;font-size:12px;color:#8B8B8B">Очередь пуста. Ссылка из активации награды появится здесь.</div>`
        );
      }""")
# 3) строки состояния ищем по тексту
s=s.replace("""    const stateRows = $$('#state-card div[style*="font-size:11.4px"]');
    if (stateRows[0]) {
      stateRows[0].textContent = music.ytdlp_version
        ? `yt-dlp ${music.ytdlp_version} — готов`
        : 'yt-dlp не найден';
    }
    if (stateRows[1]) stateRows[1].textContent = view.connected ? 'Чат: команда !трек работает' : 'Чат: нужен Twitch';""","""    const stateRows = $$('#state-card div').filter((el) =>
      /^(yt-dlp|Чат:|Порт)/.test(el.textContent.trim())
    );
    for (const row of stateRows) {
      const text = row.textContent.trim();
      if (text.startsWith('yt-dlp')) {
        row.textContent = music.ytdlp_version
          ? `yt-dlp ${music.ytdlp_version} — готов`
          : 'yt-dlp не найден';
      } else if (text.startsWith('Чат:')) {
        row.textContent = view.connected
          ? 'Чат: команда !трек работает'
          : 'Чат: нужен Twitch';
      }
    }""")
# 4) rAF-цикл: обновляем прогресс и раз в 1.5 с тянем свежее состояние
s=s.replace("""  function musicClockLoop() {
    updateMusicProgress();
    requestAnimationFrame(musicClockLoop);
  }
  requestAnimationFrame(musicClockLoop);""","""  let lastUiSync = 0;
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
  requestAnimationFrame(musicClockLoop);""")
p.write_text(s,encoding="utf-8")
print("music refresh fixes")