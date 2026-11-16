from PIL import ImageFont

fonts = r"C:\Users\mur\Documents\deepseek-harness\default-workspace\reward-sounds\assets\fonts"
reg = ImageFont.truetype(rf"{fonts}\Inter-Regular.ttf", 15)
reg132 = ImageFont.truetype(rf"{fonts}\Inter-Regular.ttf", 13)
semi36 = ImageFont.truetype(rf"{fonts}\Inter-SemiBold.ttf", 36)
reg15 = ImageFont.truetype(rf"{fonts}\Inter-Regular.ttf", 15)

def w(font, text):
    return font.getlength(text)

buttons = [
    ("Создать награду", 34),
    ("Обновить", 34),
    ("Панель Twitch", 34),
    ("Список", 34),
    ("Стоп", 34),
]
total = 0
print("button widths (text + 34px padding):")
for text, pad in buttons:
    tw = w(reg, text)
    total += tw + pad
    print(f"  {text:16s} text={tw:6.1f}  button={tw + pad:6.1f}")
listen = w(reg132, "Слушаем награды")
status = w(reg, "●")  # placeholder
listen_block = listen + 4 + 9 + 10 + 12
print(f"  status block      text={listen:6.1f}  block≈{listen_block:6.1f} (incl. spaces)")
# The "●" is drawn as label at size 9.6 -> width approx 9
listen_block = listen + 4 + 9 + 10 + 12
total += listen_block
# gaps: item_spacing 9.0 between widgets in horizontal layout
n_widgets = 6  # 5 buttons + status dot/text block roughly
gaps = 9 * 5
print(f"\nsum of right cluster: {total + gaps:.1f}  (+ gaps {gaps})")

heading = w(semi36, "Награды")
subtitle = w(reg15, "@goshanmur · 20 наград")
print(f"heading 36px: {heading:.1f}; subtitle 15px w/ typical login: {subtitle:.1f}")
left_block = max(heading, w(reg15, "@goshanmur") + 3 + w(reg15, " · 20 наград"))
print(f"left block ≈ {left_block:.1f}")
print(f"row need ≈ {left_block + total + gaps:.1f}")
for window in (980, 1100, 1220, 1236, 1440):
    avail = window - 236 - 48
    print(f"  window {window}: central content {avail} -> {'OVERFLOW' if left_block + total + gaps > avail else 'fits'}")
