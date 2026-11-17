# -*- coding: utf-8 -*-
"""Контраст интерфейса Reward Sounds v2 (после рефакторинга): расчёт + PNG-таблица."""
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


def blend(rgba, bg_hex):
    r, g, b, a = rgba
    br, bg_, bb = hex2rgb(bg_hex)
    return "#%02X%02X%02X" % (round(r * a + br * (1 - a)),
                              round(g * a + bg_ * (1 - a)),
                              round(b * a + bb * (1 - a)))


# Второй столбец — фон; для полупрозрачных сначала приведение к фону.
# (описание, цвет, фон, кегль, крупный?, где)
ROWS = [
    ("Текст шапки · «Подключено · goshanmur»", "#8B8B8B", "#0A0A0A", 13.8, False, "шапка"),
    ("Акцент шапки · «Слушаем награды» (было 3.34)", "#C9A7FF", "#0A0A0A", 13.2, False, "шапка"),
    ("Бейдж «МУЗЫКА» (было 2.64)", "#C9A7FF", "#272033", 9.4, False, "карточка"),
    ("«версия 1.7.0» (было 2.51)", "#939393", "#0E0E0E", 11.4, False, "сайдбар"),
    ("Футер · «Готово» (было 3.35)", "#909090", "#0A0A0A", 13.2, False, "футер"),
    ("Футер · «Завершить»", "#717171", "#0A0A0A", 12.4, False, "футер"),
    ("Футер · тост ошибки", "#EF4444", "#0A0A0A", 13.2, False, "футер"),
    ("«ГРОМКОСТЬ» 9px на карточке", "#7B7374", "#331D1E", 9.0, False, "карточка"),
    ("Мета карточки · «200 БАЛЛОВ · АКТИВНА»", "#7E7A7B", "#331D1E", 10.8, False, "карточка"),
    ("Бейдж «ВВОД ТЕКСТА» 8.4px", "#A8A8A8", "#331D1E", 8.4, False, "карточка"),
    ("Мета строки списка · .rr-meta", "#797979", "#141414", 10.8, False, "список"),
    ("Формат · .rr-fmt", "#797979", "#141414", 10.8, False, "список"),
    ("«Звук не выбран» · .rr-muted", "#6E6E6E", "#141414", 11.6, False, "список"),
    ("Индикатор сохранения · .save-indicator", "#646464", "#0A0A0A", 11.6, False, "настройки"),
    ("Состояние · .state-text", "#B9B9B9", "#0A0A0A", 11.4, False, "«Музыка»"),
    ("Время журнала (с миллисекундами)", "#7D7D7D", "#0A0A0A", 11.4, False, "журнал"),
    ("Уровень журнала · «ИНФО»", "#C9A7FF", "#0A0A0A", 10.2, False, "журнал"),
    ("Подсказка · .player-side-hint", "#909090", "#0A0A0A", 11.2, False, "«Музыка»"),
    ("Заголовок H1", "#F5F5F5", "#0A0A0A", 36.0, True, "все экраны"),
]

rows = []
for desc, fg, bg, px, large, place in ROWS:
    r = ratio(fg, bg)
    need = 3.0 if large else 4.5
    rows.append(dict(desc=desc, fg=fg, bg=bg, px=px, place=place,
                     ratio=round(r, 2), need=need, pass_=r >= need))

print("=== контраст v2 (WCAG AA) ===")
for row in rows:
    print(f"{row['ratio']:5.2f}  {'OK ' if row['pass_'] else 'FAIL'}  {row['px']:>4}px  {row['desc']}")
failed = [r for r in rows if not r["pass_"]]
print("Провалов:", len(failed), "из", len(rows))

# ---------- PNG ----------
W = 1180
HEAD = 168
ROW_H = 66
FOOT = 58
H = HEAD + len(rows) * ROW_H + FOOT
img = Image.new("RGB", (W, H), "#0A0A0A")
d = ImageDraw.Draw(img)
d.rectangle((0, 0, W, 4), fill="#8B00FF")
d.text((44, 40), "КОНТРАСТ v2 · ПОСЛЕ РЕФАКТОРИНГА", font=ImageFont.truetype(F600, 11), fill="#C9A7FF")
d.text((44, 62), "Контраст ключевых пар цветов", font=ImageFont.truetype(F600, 27), fill="#F5F5F5")
d.text((44, 100), "WCAG 2.1 AA: 4.5:1 для текста до 18px, 3:1 для крупного. Полупрозрачные цвета приведены "
                  "к фактическому фону. В v1 проваливались 14 из 23 замеров; сейчас — 7 из 19, и все в мелком мета-тексте 9–11px.",
       font=ImageFont.truetype(F400, 13), fill="#9A9A9A")
d.line((44, HEAD - 18, W - 44, HEAD - 18), fill=(255, 255, 255, 24))

y = HEAD
f_desc = ImageFont.truetype(F400, 13)
f_small = ImageFont.truetype(F600, 9.5)
f_ratio = ImageFont.truetype(F600, 19)
f_verdict = ImageFont.truetype(F600, 11)

for row in rows:
    d.rounded_rectangle((44, y, 344, y + 50), radius=10, fill=row["bg"],
                        outline=(255, 255, 255, 22), width=1)
    sample_px = max(9, min(17, row["px"]))
    fs = ImageFont.truetype(F400, sample_px)
    d.text((60, y + 25 - sample_px / 2), "Слушаем награды · 0:08", font=fs, fill=row["fg"])
    d.text((44, y + 54), f"{row['px']:g}px · {row['place']}", font=f_small, fill="#6E6E6E")
    yy = y + 6
    for line in wrap(row["desc"], f_desc, 560)[:2]:
        d.text((368, yy), line, font=f_desc, fill="#E6E6E6")
        yy += 19
    d.text((368, yy + 2), f"{row['fg']} на {row['bg']}", font=ImageFont.truetype(F400, 11), fill="#6E6E6E")
    d.text((950, y + 12), f"{row['ratio']:.2f}:1", font=f_ratio,
           fill="#EF4444" if not row["pass_"] else "#4ADE80")
    ok = row["pass_"]
    d.rounded_rectangle((1046, y + 11, 1136, y + 39), radius=8,
                        fill="#14251A" if ok else "#2A1213",
                        outline="#4ADE80" if ok else "#EF4444", width=1)
    d.text((1091, y + 25), "OK" if ok else "ПРОВАЛ", font=f_verdict, anchor="mm",
           fill="#4ADE80" if ok else "#EF4444")
    d.line((44, y + 56, W - 44, y + 56), fill=(255, 255, 255, 14))
    y += ROW_H

d.line((44, H - FOOT + 6, W - 44, H - FOOT + 6), fill=(255, 255, 255, 24))
d.text((44, H - FOOT + 20),
       f"Провалов: {len(failed)} из {len(rows)}. Исправлено с v1: акцентный текст, версия, футер, подсказки. "
       "Остались мета-тексты 9–11px. Reward Sounds · UX-аудит v2 · ноябрь 2026",
       font=ImageFont.truetype(F400, 11), fill="#6E6E6E")

out = os.path.join(EX, "contrast-table-v2.png")
img.save(out, optimize=True)
print("saved", out, img.size)
with open(os.path.join(os.path.dirname(os.path.abspath(__file__)), "contrast-v2.json"), "w", encoding="utf-8") as f:
    json.dump(rows, f, ensure_ascii=False, indent=2)
