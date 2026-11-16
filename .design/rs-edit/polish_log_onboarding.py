import pathlib
# backend: не показывать технический шум get_state/событий Twitch в журнале
p=pathlib.Path(r"C:\Users\mur\Documents\deepseek-harness\default-workspace\reward-sounds-tauri\src-tauri\src\core.rs")
s=p.read_text(encoding="utf-8")
s=s.replace("""            let message = rest[level_end..].trim_start().to_string();
            Some(LogEntryView {""","""            let message = rest[level_end..].trim_start().to_string();
            if message.starts_with("Tauri core: get_state")
                || message.starts_with("Tauri core: событий Twitch")
            {
                return None;
            }
            Some(LogEntryView {""")
p.write_text(s,encoding="utf-8")
# onboarding: живые кнопки
p=pathlib.Path(r"C:\Users\mur\Documents\deepseek-harness\default-workspace\reward-sounds-tauri\src-tauri\ui\app.js")
s=p.read_text(encoding="utf-8")
old="""  function bindOnboarding() {
    $$('[data-act="connect"]').forEach((btn) => {
      btn.addEventListener('click', () => {
        setFooter('Откроется авторизация Twitch — на следующем этапе');
      });
    });
  }"""
new="""  function bindOnboarding() {
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
  }"""
assert old in s
s=s.replace(old,new,1)
p.write_text(s,encoding="utf-8")
print("journal noise + onboarding")