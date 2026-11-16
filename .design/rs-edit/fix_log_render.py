import pathlib
p=pathlib.Path(r"C:\Users\mur\Documents\deepseek-harness\default-workspace\reward-sounds-tauri\src-tauri\ui\app.js")
s=p.read_text(encoding="utf-8")
old="""    if (tab === 'log') {
      content.innerHTML = stubPage('Журнал', 'Локальные события и ошибки приложения');
      bindSlidersIn(content);
      applyStatusToDom();
      return;
    }"""
new="""    if (tab === 'log') {
      content.innerHTML = logPage();
      bindLog();
      applyStatusToDom();
      loadLogs(false);
      return;
    }"""
assert old in s
s=s.replace(old,new,1)
p.write_text(s,encoding="utf-8")
print("log render fixed")