# -*- coding: utf-8 -*-
"""Реальный журнал событий для Tauri-прототипа."""
import pathlib

# --- backend ---
p = pathlib.Path(r"C:\Users\mur\Documents\deepseek-harness\default-workspace\reward-sounds-tauri\src-tauri\src\core.rs")
s = p.read_text(encoding="utf-8")

needle = """/// Состояние входа в Twitch для экрана настроек."""
assert needle in s
s = s.replace(needle, """/// Запись журнала для экрана «Журнал».
#[derive(Clone, Serialize)]
pub struct LogEntryView {
    pub time: String,
    pub level: String,
    pub message: String,
}

/// Состояние входа в Twitch для экрана настроек.""", 1)

needle = """#[tauri::command]
pub fn open_url(url: String) -> Result<(), String> {"""
assert needle in s
s = s.replace(needle, """#[tauri::command]
pub fn get_logs(limit: Option<usize>) -> Vec<LogEntryView> {
    let paths = AppPaths::resolve();
    let Ok(text) = std::fs::read_to_string(&paths.log_file) else {
        return Vec::new();
    };
    let limit = limit.unwrap_or(400).clamp(1, 2000);
    let mut entries: Vec<LogEntryView> = text
        .lines()
        .rev()
        .take(limit)
        .filter_map(|line| {
            let line = line.trim();
            if line.is_empty() {
                return None;
            }
            let mut parts = line.splitn(3, ' ');
            let date = parts.next()?;
            let clock = parts.next()?;
            let rest = parts.next()?.trim_start();
            let level_end = rest.find(char::is_whitespace).unwrap_or(rest.len());
            let level = rest[..level_end].to_string();
            let message = rest[level_end..].trim_start().to_string();
            Some(LogEntryView {
                time: format!("{date} {clock}"),
                level,
                message,
            })
        })
        .collect();
    entries.reverse();
    entries
}

#[tauri::command]
pub fn open_url(url: String) -> Result<(), String> {""", 1)
p.write_text(s, encoding="utf-8")

# --- main command registration ---
p = pathlib.Path(r"C:\Users\mur\Documents\deepseek-harness\default-workspace\reward-sounds-tauri\src-tauri\src\main.rs")
s = p.read_text(encoding="utf-8")
s = s.replace("""            core::open_url,
        ])""", """            core::open_url,
            core::get_logs,
        ])""")
p.write_text(s, encoding="utf-8")

# --- frontend ---
p = pathlib.Path(r"C:\Users\mur\Documents\deepseek-harness\default-workspace\reward-sounds-tauri\src-tauri\ui\app.js")
s = p.read_text(encoding="utf-8")

# state for logs
s = s.replace("""    coreSig: '',
    rewardUi: {""", """    coreSig: '',
    logs: [],
    logUi: { search: '', level: 'all' },
    rewardUi: {""")

start = s.index("  /* ---------- заглушки ---------- */")
end = s.index("  /* ---------- рендер ---------- */")
log_js = r'''  /* ---------- «Журнал» ---------- */
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
        <span class="log-time">${escapeHtml(entry.time.slice(11))}</span>
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

  /* ---------- заглушки ---------- */'''
s = s[:start] + log_js + s[end:]

# render log
s = s.replace("""    if (tab === 'log') {
      content.innerHTML = stubPage('Журнал', 'История активаций наград, музыки и ошибок');
      applyStatusToDom();
      return;
    }""", """    if (tab === 'log') {
      content.innerHTML = logPage();
      bindLog();
      applyStatusToDom();
      loadLogs(false);
      return;
    }""")

# uiSync: обновлять журнал при открытой вкладке
s = s.replace("""        if (state.tab === 'settings') {
        content.innerHTML = settingsPage(view);
        bindSettings(view);
      }""", """        if (state.tab === 'settings') {
          content.innerHTML = settingsPage(view);
          bindSettings(view);
        }""")

p.write_text(s, encoding="utf-8")
print("log feature wired")
