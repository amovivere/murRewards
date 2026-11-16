import pathlib
# 1) account chip без никнейма
p=pathlib.Path(r"C:\Users\mur\Documents\deepseek-harness\default-workspace\reward-sounds-tauri\src-tauri\ui\index.html")
s=p.read_text(encoding="utf-8")
s=s.replace('<button class="account-chip" id="account-chip">@goshanmur</button>',
            '<button class="account-chip" id="account-chip" title="Настройки Twitch">Twitch</button>')
p.write_text(s,encoding="utf-8")

# 2) JS: ник только в статусной строке, сабтайтл без @login
p=pathlib.Path(r"C:\Users\mur\Documents\deepseek-harness\default-workspace\reward-sounds-tauri\src-tauri\ui\app.js")
s=p.read_text(encoding="utf-8")
s=s.replace("""    $('#account-chip').textContent = state.connected
      ? `@${state.login}`
      : 'Twitch: не подключён';""","""    $('#account-chip').textContent = 'Twitch';""")
s=s.replace("""    if (state.connected) {
      replaceText(content, 'goshanmur', state.login);
      const pill = $('.toolbar .pill.active', content);""","""    if (state.connected) {
      const pill = $('.toolbar .pill.active', content);""")
s=s.replace("""      sub.textContent =
        `@${state.login} · ${rewards.length} ${pluralRu(rewards.length, 'награда', 'награды', 'наград')}` +
        ` · ${withSound} со звуком`;""","""      sub.textContent =
        `${rewards.length} ${pluralRu(rewards.length, 'награда', 'награды', 'наград')}` +
        ` · ${withSound} со звуком`;""")
p.write_text(s,encoding="utf-8")
print("nickname cleaned")