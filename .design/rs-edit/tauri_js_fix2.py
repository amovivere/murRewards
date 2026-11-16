import pathlib
p=pathlib.Path(r"C:\Users\mur\Documents\deepseek-harness\default-workspace\reward-sounds-tauri\src-tauri\ui\app.js")
s=p.read_text(encoding="utf-8")
s=s.replace("""      const nextRow = queue?.querySelector('.queue-row:nth-child(3) .card-title') ||
        queue?.querySelector('.queue-row .card-title');
      setFooter(nextRow ? `Пропуск: «${nextRow.textContent}» (прототип)` : 'Очередь пуста');""","""      const rows = queue ? Array.from(queue.querySelectorAll('.queue-row')) : [];
      const next = rows[1] || rows[0];
      const title = next ? next.querySelector('div[style*="font-size:13.8px"]') : null;
      setFooter(title ? `Пропуск: «${title.textContent}» (прототип)` : 'Очередь пуста');""")
s=s.replace("""    const title = row.querySelector('.card-title') || row.querySelector('div div');
    if (title) title.textContent = label.length > 70 ? `${label.slice(0, 67)}…` : label;
    const meta = Array.from(row.querySelectorAll('div')).find((el) => el.textContent.trim().startsWith('@'));
    if (meta) meta.textContent = '@manual · —';""","""    const title = row.querySelector('div[style*="font-size:13.8px"]');
    if (title) title.textContent = label.length > 70 ? `${label.slice(0, 67)}…` : label;
    const meta = title?.nextElementSibling;
    if (meta) meta.textContent = '@manual · —';""")
p.write_text(s,encoding="utf-8")
print("queue js fixed")