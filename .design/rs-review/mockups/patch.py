# -*- coding: utf-8 -*-
import pathlib
p = pathlib.Path(r"C:\Users\mur\Documents\deepseek-harness\default-workspace\.tmp\rs-review\mockups\build.py")
s = p.read_text(encoding="utf-8")
subs = [
    # --- мокап Музыка: компактнее ---
    ('<div class="card" style="margin-top:14px;height:178px;display:flex;gap:18px;align-items:center;padding:18px">',
     '<div class="card" style="margin-top:12px;height:156px;display:flex;gap:16px;align-items:center;padding:14px 16px">'),
    ("'<div style=\"width:118px;height:118px;border-radius:14px;flex:0 0 118px;'",
     "'<div style=\"width:102px;height:102px;border-radius:14px;flex:0 0 102px;'"),
    ('<div style="font-size:20px;font-weight:600;margin-top:4px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">Земляк — ДИНАСТИЯ</div>',
     '<div style="font-size:19px;font-weight:600;margin-top:3px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">Земляк — ДИНАСТИЯ</div>'),
    ('<div style="font-size:10.8px;letter-spacing:1px;color:#22C55E">СЕЙЧАС ИГРАЕТ</div>',
     '<div style="font-size:10.6px;letter-spacing:1px;color:#22C55E">СЕЙЧАС ИГРАЕТ</div>'),
    ("'<div style=\"margin-top:12px;display:flex;align-items:center;gap:10px\">'",
     "'<div style=\"margin-top:9px;display:flex;align-items:center;gap:10px\">'"),
    ("'<div style=\"display:flex;align-items:center;gap:10px;margin-top:12px\">'",
     "'<div style=\"display:flex;align-items:center;gap:9px;margin-top:9px\">'"),
    ("'<div style=\"width:34px;height:34px;border-radius:50%;background:rgba(255,255,255,.07);display:flex;align-items:center;justify-content:center\">'+ICON_PREV+'</div>'",
     "'<div style=\"width:32px;height:32px;border-radius:50%;background:rgba(255,255,255,.07);display:flex;align-items:center;justify-content:center\">'+ICON_PREV+'</div>'"),
    ("'<div style=\"width:44px;height:44px;border-radius:50%;background:#EDEDED;display:flex;align-items:center;justify-content:center\">'+ICON_PAUSE+'</div>'",
     "'<div style=\"width:40px;height:40px;border-radius:50%;background:#EDEDED;display:flex;align-items:center;justify-content:center\">'+ICON_PAUSE+'</div>'"),
    ("'<div style=\"width:34px;height:34px;border-radius:50%;background:rgba(255,255,255,.07);display:flex;align-items:center;justify-content:center\">'+ICON_NEXT+'</div>'",
     "'<div style=\"width:32px;height:32px;border-radius:50%;background:rgba(255,255,255,.07);display:flex;align-items:center;justify-content:center\">'+ICON_NEXT+'</div>'"),
    ("'<div style=\"width:206px;flex:0 0 206px;border-left:1px solid rgba(255,255,255,.07);padding-left:18px\">'",
     "'<div style=\"width:196px;flex:0 0 196px;border-left:1px solid rgba(255,255,255,.07);padding-left:16px\">'"),
    ("'<div style=\"font-size:11.4px;color:rgba(139,139,139,.75);margin-top:10px;line-height:16px\">Не меняет громкость Windows — только очередь.</div>'",
     "'<div style=\"font-size:11.2px;color:rgba(139,139,139,.75);margin-top:8px;line-height:15px\">Не меняет громкость Windows — только очередь.</div>'"),
    ('<div style="margin-top:14px;font-size:11px;color:#8B8B8B">Следующий: <span style="color:#CFCFCF">Kanye — Vulvas</span></div>',
     '<div style="margin-top:10px;font-size:10.8px;color:#8B8B8B;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">Следующий: <span style="color:#CFCFCF">Kanye — Vulvas</span></div>'),
    ('<div class="card" style="margin-top:12px;padding:16px 18px">\n        \'<div style="display:flex;align-items:center;gap:10px">\'',
     '<div class="card" style="margin-top:10px;padding:12px 16px">\n        \'<div style="display:flex;align-items:center;gap:10px">\''),
    ("'<div style=\"font-size:16.2px;font-weight:600\">Очередь · 2 из 10</div>'",
     "'<div style=\"font-size:15.4px;font-weight:600\">Очередь · 2 из 10</div>'"),
    ('height:42px;border-radius:10px;background:rgba(34,197,94,.07)', 'height:36px;border-radius:10px;background:rgba(34,197,94,.07)'),
    ('<div style="display:flex;align-items:center;gap:12px;height:42px;padding:0 10px">',
     '<div style="display:flex;align-items:center;gap:12px;height:36px;padding:0 10px">'),
    ('<div style="display:flex;align-items:center;gap:10px;margin-top:10px;padding-top:12px;border-top:1px solid rgba(255,255,255,.07)">',
     '<div style="display:flex;align-items:center;gap:10px;margin-top:8px;padding-top:10px;border-top:1px solid rgba(255,255,255,.07)">'),
    ('<div style="font-size:11.4px;color:rgba(139,139,139,.7);margin-top:6px">Ручная очередь не тратит баллы зрителей — удобно для проверки.</div>',
     '<div style="font-size:11px;color:rgba(139,139,139,.7);margin-top:4px">Ручная очередь не тратит баллы зрителей — удобно для проверки.</div>'),
    ('<div style="display:flex;gap:12px;margin-top:12px">\n        \'<div class="card" style="flex:1 1 55%;padding:14px 16px">\'',
     '<div style="display:flex;gap:12px;margin-top:10px">\n        \'<div class="card" style="flex:1 1 55%;height:128px;overflow:hidden;padding:12px 14px">\''),
    ('<div class="card" style="flex:1 1 45%;padding:14px 16px">',
     '<div class="card" style="flex:1 1 45%;height:128px;overflow:hidden;padding:12px 14px">'),
    ('<div style="margin-top:10px;border-radius:10px;background:rgba(255,255,255,.035);height:34px;',
     '<div style="margin-top:8px;border-radius:10px;background:rgba(255,255,255,.035);height:30px;'),
    ('<div style="margin-top:9px;display:flex;flex-direction:column;gap:7px;font-size:12px;color:#B9B9B9">',
     '<div style="margin-top:7px;display:flex;flex-direction:column;gap:5px;font-size:11.4px;color:#B9B9B9">'),
    # --- мокап онбординг: компактнее ---
    ("step(1, \"Подключите Twitch\",", "step(1, \"Подключите Twitch\","),
    ('<div style="display:flex;gap:14px;margin-top:18px">', '<div style="display:flex;gap:14px;margin-top:14px">'),
    ('<div class="card" style="flex:1 1 62%;padding:20px 22px">', '<div class="card" style="flex:1 1 62%;padding:16px 20px">'),
    ('<div style="font-size:20px;font-weight:600">Быстрый старт</div>', '<div style="font-size:19px;font-weight:600">Быстрый старт</div>'),
    ('<div style="font-size:13.2px;color:#8B8B8B;margin-top:4px">Три шага — и звуки будут играть на стриме автоматически.</div>',
     '<div style="font-size:12.8px;color:#8B8B8B;margin-top:3px">Три шага — и звуки будут играть на стриме автоматически.</div>'),
    ("'<div style=\"display:flex;gap:14px;padding:16px 0;border-bottom:1px solid rgba(255,255,255,.06)\">'",
     "'<div style=\"display:flex;gap:14px;padding:12px 0;border-bottom:1px solid rgba(255,255,255,.06)\">'"),
    ('<div style="font-size:15.6px;font-weight:600">{title}</div>', '<div style="font-size:15.2px;font-weight:600">{title}</div>'),
    ('<div style="font-size:13.2px;color:#8B8B8B;line-height:19px;margin-top:3px">{text}</div>',
     '<div style="font-size:12.8px;color:#8B8B8B;line-height:18px;margin-top:3px">{text}</div>'),
    ("(f'<div style=\"margin-top:10px;display:flex;align-items:center;gap:10px\">{actions}</div>' if actions else '')",
     "(f'<div style=\"margin-top:8px;display:flex;align-items:center;gap:10px\">{actions}</div>' if actions else '')"),
    ('<div style="display:flex;align-items:center;gap:10px;padding-top:14px">', '<div style="display:flex;align-items:center;gap:10px;padding-top:10px">'),
    ('<div class="card" style="margin-top:14px;padding:16px 18px">', '<div class="card" style="margin-top:12px;padding:14px 16px">'),
    ('<div style="margin-top:10px;display:flex;gap:10px">\n        + "".join(', '<div style="margin-top:8px;display:flex;gap:10px">\n        + "".join('),
    ('padding:10px 12px">', 'padding:8px 10px">'),
    ('<div style="font-size:11.6px;color:rgba(139,139,139,.75);margin-top:10px">Файлы', '<div style="font-size:11.2px;color:rgba(139,139,139,.75);margin-top:8px">Файлы'),
    ('<div class="card" style="padding:18px 18px">', '<div class="card" style="padding:16px 16px">'),
    ('<div style="margin-top:10px;display:flex;flex-direction:column;gap:9px;font-size:12.6px;color:#A8A8A8;line-height:17px">',
     '<div style="margin-top:9px;display:flex;flex-direction:column;gap:7px;font-size:12.2px;color:#A8A8A8;line-height:16px">'),
    ('<div class="card" style="padding:16px 18px;display:flex;align-items:center;gap:12px">',
     '<div class="card" style="padding:14px 16px;display:flex;align-items:center;gap:12px">'),
]
cnt = 0
for old, new in subs:
    if old in s:
        s = s.replace(old, new, 1)
        cnt += 1
    else:
        print("NOT FOUND:", old[:90])
p.write_text(s, encoding="utf-8")
print("applied", cnt, "of", len(subs))