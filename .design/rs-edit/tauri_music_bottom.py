import pathlib
p=pathlib.Path(r"C:\Users\mur\Documents\deepseek-harness\default-workspace\reward-sounds-tauri\src-tauri\ui\app.js")
s=p.read_text(encoding="utf-8")
# мета: ручная заявка
s=s.replace("""      meta.textContent = current
        ? `заказал @${current.user_login}${current.channel ? ` · ${current.channel}` : ''}${current.duration_sec ? ` · ${fmtDuration(current.duration_sec)}` : ''}`
        : 'Активируйте награду на канале — трек встанет в очередь';""","""      const who = current
        ? current.user_login === 'manual'
          ? 'ручная заявка'
          : `заказал @${current.user_login}`
        : '';
      meta.textContent = current
        ? `${who}${current.channel ? ` · ${current.channel}` : ''}${current.duration_sec ? ` · ${fmtDuration(current.duration_sec)}` : ''}`
        : 'Активируйте награду на канале — трек встанет в очередь';""")
# нижний ряд: аккуратно обновляем OBS-превью и карточку состояния
s=s.replace("""    // Нижний ряд.
    const obsPreview = $('#obs-card div[style*="font-size:11.4px"]');
    if (obsPreview && current) obsPreview.textContent = current.title;
    const stateRows = $$('#state-card div').filter((el) =>
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
    }""","""    // Нижний ряд: ссылка OBS и превью.
    const obsCard = $('#obs-card');
    if (obsCard) {
      const url = Array.from(obsCard.querySelectorAll('div')).find((el) =>
        el.textContent.includes('127.0.0.1:8770')
      );
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
          `<div style="display:flex;align-items:center;gap:8px"><span style="color:#22C55E">✓</span><span>${escapeHtml(text)}</span></div>`;
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
    }""")
p.write_text(s,encoding="utf-8")
print("music bottom fixed")