# -*- coding: utf-8 -*-
"""Расчёт контраста ключевых пар цветов интерфейса Reward Sounds
и генерация таблицы-примера contrast-table.png."""
import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from annotate import F400, F600, EX, wrap  # noqa: E402
from PIL import Image, ImageDraw, ImageFont  # noqa: E402


def hex2rgb(h):
    h = h.lstrip("#")
    return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))


def lum(rgb):
    def ch(c):
        c = c / 255
        return c / 12.92 if c <= 0.03928 else ((c + 0.055) / 1.055) ** 2.4
    r, g, b = (ch(c) for c in rgb)
    return 0.2126 * r + 0.7152 * g + 0.0722 * b


def ratio(fg, bg):
    l1, l2 = lum(hex2rgb(fg)), lum(hex2rgb(bg))
    a, b = max(l1, l2), min(l1, l2)
    return (a + 0.05) / (b + 0.05)


def blend(fg_rgba, bg_hex):
    """rgba(139,139,139,.72) поверх фона -> результирующий hex."""
    r, g, b, a = fg_rgba
    br, bg_, bb = hex2rgb(bg_hex)
    return "#%02X%02X%02X" % (round(r * a + br * (1 - a)),
                              round(g * a + bg_ * (1 - a)),
                              round(b * a + bb * (1 - a)))


# (описание, цвет текста, фон, размер px, «крупный?», где)
PAIRS = [
    ("Вторичный текст · «Подключено · goshanmur»", "#8B8B8B", "#0A0A0A", 13.8, False, "шапка"),
    ("Акцентный текст · «Слушаем награды»", "#8B00FF", "#0A0A0A", 13.2, False, "шапка"),
    ("Акцентный текст · бейдж «МУЗЫКА»", "#8B00FF", "#272033", 9.4, False, "карточка"),
    ("Пилюля «yt-dlp 2026.10.26»", "#8B00FF", "#0A0A0A", 13.2, False, "«Музыка»"),
    ("Мета карточки · «200 БАЛЛОВ · АКТИВНА»", "#7D7D7D", "#331D1E", 10.8, False, "карточка"),
    ("Подпись · «ГРОМКОСТЬ»", "#6E6E6E", "#331D1E", 9.0, False, "карточка"),
    ("Время в журнале", "#7D7D7D", "#0A0A0A", 11.4, False, "журнал"),
    ("Уровень в журнале · «ИНФО»", "#8B8B8B", "#0A0A0A", 10.2, False, "журнал"),
    ("Уровень в журнале · «ОШИБКА»", "#EF4444", "#0A0A0A", 10.2, False, "журнал"),
    ("Версия в сайдбаре", "#515151", "#0E0E0E", 11.4, False, "сайдбар"),
    ("Заголовок навигации · «ОСНОВНОЕ»", "#676767", "#0E0E0E", 10.8, False, "сайдбар"),
    ("Бренд в футере · «REWARD SOUNDS»", "#484848", "#0A0A0A", 10.2, False, "футер"),
    ("Сообщение журнала", "#D6D6D6", "#0A0A0A", 12.4, False, "журнал"),
    ("Текст пилюли-фильтра", "#A0A0A0", "#141414", 13.2, False, "«Награды»"),
    ("Подзаголовок экрана · 15px", "#8B8B8B", "#0A0A0A", 15.0, False, "все экраны"),
    ("Кнопка «Убрать» · danger", "#EF4444", "#331D1E", 13.6, False, "карточка"),
    ("Предупреждение · «загружается»", "#F59E0B", "#0A0A0A", 11.4, False, "«Музыка»"),
    ("Заголовок H1 наград", "#F5F5F5", "#0A0A0A", 36.0, True, "все экраны"),
]

rows = []
for desc, fg, bg, px, large, place in PAIRS:
    r = ratio(fg, bg)
    need = 3.0 if large else 4.5
    rows.append(dict(desc=desc, fg=fg, bg=bg, px=px, place=place, ratio=round(r, 2),
                     need=need, pass_=r >= need))

# добавим расчёт полупрозрачных токенов
ALPHA_TOKENS = [
    ("nav-label rgba(139,139,139,.72) на #0E0E0E", (139, 139, 139, .72), "#0E0E0E", 10.8),
    ("version rgba(139,139,139,.55) на #0E0E0E", (139, 139, 139, .55), "#0E0E0E", 11.4),
    ("brand rgba(139,139,139,.45) на #0A0A0A", (139, 139, 139, .45), "#0A0A0A", 10.2),
    ("footer rgba(139,139,139,.7) на #0A0A0A", (139, 139, 139, .70), "#0A0A0A", 13.2),
    ("card-meta rgba(139,139,139,.85) на #331D1E", (139, 139, 139, .85), "#331D1E", 10.8),
]
alpha_rows = []
for name, rgba, bg, px in ALPHA_TOKENS:
    out = blend(rgba, bg)
    r = ratio(out, bg)
    alpha_rows.append(dict(desc=name, fg=out, bg=bg, px=px, place="alpha", ratio=round(r, 2),
                           need=4.5, pass_=r >= 4.5))

print("=== контраст (WCAG 2.1 AA) ===")
for row in rows + alpha_rows:
    print(f"{row['ratio']:5.2f}  {'OK ' if row['pass_'] else 'FAIL'}  {row['px']:>4}px  {row['desc']}  ({row['fg']} на {row['bg']})")

stats = dict(total=len(rows + alpha_rows), failed=sum(1 for r in rows + alpha_rows if not r["pass_"]))
print("\nПровалов:", stats["failed"], "из", stats["total"])

# ---------------- таблица ----------------
W = 1180
HEAD = 168
ROW_H = 66
FOOT = 58
H = HEAD + len(rows) * ROW_H + 36 + len(alpha_rows) * ROW_H + FOOT
img = Image.new("RGB", (W, H), "#0A0A0A")
d = ImageDraw.Draw(img)
d.rectangle((0, 0, W, 4), fill="#8B00FF")
d.text((44, 40), "КОНТРАСТ ИНТЕРФЕЙСА", font=ImageFont.truetype(F600, 11), fill="#C9A7FF")
d.text((44, 62), "Контраст ключевых пар цветов", font=ImageFont.truetype(F600, 27), fill="#F5F5F5")
d.text((44, 100), "Замеры по WCAG 2.1 AA: 4.5:1 для текста до 18px, 3:1 для крупного. "
                  "Полупрозрачные токены приведены к результирующему цвету.",
       font=ImageFont.truetype(F400, 13), fill="#9A9A9A")
d.line((44, HEAD - 18, W - 44, HEAD - 18), fill=(255, 255, 255, 24))

y = HEAD
f_desc = ImageFont.truetype(F400, 13)
f_small = ImageFont.truetype(F600, 9.5)
f_ratio = ImageFont.truetype(F600, 19)
f_verdict = ImageFont.truetype(F600, 11)


def draw_row(row, y):
    # образец: реальный цвет на реальном фоне
    d.rounded_rectangle((44, y, 344, y + 50), radius=10, fill=row["bg"],
                        outline=(255, 255, 255, 22), width=1)
    sample_px = max(9, min(17, row["px"]))
    fs = ImageFont.truetype(F400, sample_px)
    d.text((60, y + 25 - sample_px / 2), "Слушаем награды · 0:08", font=fs, fill=row["fg"])
    d.text((44, y + 54), f"{row['px']:g}px · {row['place']}", font=f_small, fill="#6E6E6E")
    # описание
    yy = y + 6
    for line in wrap(row["desc"], f_desc, 560)[:2]:
        d.text((368, yy), line, font=f_desc, fill="#E6E6E6")
        yy += 19
    d.text((368, yy + 2), f"{row['fg']} на {row['bg']}", font=ImageFont.truetype(F400, 11), fill="#6E6E6E")
    # коэффициент
    d.text((950, y + 12), f"{row['ratio']:.2f}:1", font=f_ratio,
           fill="#EF4444" if not row["pass_"] else "#4ADE80")
    # вердикт
    ok = row["pass_"]
    d.rounded_rectangle((1046, y + 11, 1136, y + 39), radius=8,
                        fill="#14251A" if ok else "#2A1213",
                        outline="#4ADE80" if ok else "#EF4444", width=1)
    d.text((1091, y + 25), "OK" if ok else "ПРОВАЛ", font=f_verdict, anchor="mm",
           fill="#4ADE80" if ok else "#EF4444")
    d.line((44, y + 56, W - 44, y + 56), fill=(255, 255, 255, 14))


for row in rows:
    draw_row(row, y)
    y += ROW_H

# подзаголовок для полупрозрачных токенов
y += 6
d.text((44, y), "ПОЛУПРОЗРАЧНЫЕ ТОКЕНЫ — ПРИВЕДЕНЫ К ФОНУ", font=f_small, fill="#C9A7FF")
y += 24
for row in alpha_rows:
    draw_row(row, y)
    y += ROW_H

d.line((44, H - FOOT + 6, W - 44, H - FOOT + 6), fill=(255, 255, 255, 24))
d.text((44, H - FOOT + 20),
       f"Провалов: {stats['failed']} из {stats['total']} замеров. Полный список — в tools-контрасте отчёта. "
       "Reward Sounds · UX-аудит · ноябрь 2026",
       font=ImageFont.truetype(F400, 11), fill="#6E6E6E")

out = os.path.join(EX, "contrast-table.png")
img.save(out, optimize=True)
print("saved", out, img.size)

with open(os.path.join(os.path.dirname(os.path.abspath(__file__)), "contrast.json"), "w", encoding="utf-8") as f:
    json.dump(dict(rows=rows, alpha=alpha_rows, stats=stats), f, ensure_ascii=False, indent=2)
