import pathlib
ui=pathlib.Path(r"C:\Users\mur\Documents\deepseek-harness\default-workspace\reward-sounds-tauri\src-tauri\ui")
p=ui/"index.html"; s=p.read_text(encoding="utf-8")
s=s.replace('<span class="listen-inline"><span class="dot dot-green"></span>Слушаем награды</span>',
            '<span class="listen-inline" id="eventsub-status"><span class="dot dot-green"></span><span id="eventsub-text">Слушаем награды</span></span>')
p.write_text(s,encoding="utf-8")
p=ui/"app.js"; s=p.read_text(encoding="utf-8")
s=s.replace("""    $('#account-chip').textContent = 'Twitch';""","""    $('#account-chip').textContent = 'Twitch';
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
    }""")
s=s.replace("""      client_id: view.client_id,
      auth: view.auth,""","""      client_id: view.client_id,
      eventsub: view.eventsub,
      auth: view.auth,""")
p.write_text(s,encoding="utf-8")
print("eventsub status UI")