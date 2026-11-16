def lin(c):
    c = c / 255.0
    return c / 12.92 if c <= 0.03928 else ((c + 0.055) / 1.055) ** 2.4

def lum(rgb):
    r, g, b = rgb
    return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b)

def contrast(a, b):
    la, lb = lum(a), lum(b)
    hi, lo = max(la, lb), min(la, lb)
    return round((hi + 0.05) / (lo + 0.05), 2)

def blend(fg, bg, alpha):
    return tuple(round(f * alpha + b * (1 - alpha)) for f, b in zip(fg, bg))

BG = (0x0A, 0x0A, 0x0A)
PANEL = (0x0E, 0x0E, 0x0E)
CARD = (0x14, 0x14, 0x14)
CARD_HOVER = (0x1D, 0x1D, 0x1D)
CARD_ACTIVE = (0x22, 0x22, 0x22)
BORDER = (0x27, 0x27, 0x27)
TEXT = (0xF5, 0xF5, 0xF5)
DIM = (0x8B, 0x8B, 0x8B)
ACCENT = (0xED, 0xED, 0xED)
SUCCESS = (0x22, 0xC5, 0x5E)
DANGER = (0xEF, 0x44, 0x44)
WARN = (0xF5, 0x9E, 0x0B)
WHITE = (255, 255, 255)

print("base pairs (opaque):")
for name, fg, bg in [
    ("TEXT on BG", TEXT, BG),
    ("TEXT on CARD", TEXT, CARD),
    ("TEXT on CARD_ACTIVE", TEXT, CARD_ACTIVE),
    ("TEXT_DIM on BG", DIM, BG),
    ("TEXT_DIM on PANEL", DIM, PANEL),
    ("TEXT_DIM on CARD", DIM, CARD),
    ("TEXT_DIM on CARD_HOVER", DIM, CARD_HOVER),
    ("SUCCESS on BG", SUCCESS, BG),
    ("WARN on BG", WARN, BG),
    ("DANGER on BG", DANGER, BG),
    ("DANGER on CARD", DANGER, CARD),
    ("WHITE(5%) on BG", blend(WHITE, BG, 0.05), BG),
    ("DIM alpha220 on CARD", blend(DIM, CARD, 220 / 255), CARD),
]:
    print(f"  {name:26s} {fg} vs {bg} -> {contrast(fg, bg)}:1")

print()
print("alpha text (theme.with_alpha(TEXT_DIM, a)) on panels/cards:")
for bg_name, bg in [("BG", BG), ("PANEL", PANEL), ("CARD", CARD)]:
    for a in (120, 140, 160, 170, 190, 200, 220):
        fg = blend(DIM, bg, a / 255)
        print(f"  DIM alpha {a:3d} on {bg_name:5s} rgb{fg} -> {contrast(fg, bg)}:1")

print()
print("tinted reward card (CARD mixed with reward color #A970FF 0.12) and text on it:")
reward = (0xA9, 0x70, 0xFF)
for amt in (0.05, 0.12):
    fill = tuple(round(c * (1 - amt) + r * amt) for c, r in zip(CARD, reward))
    print(f"  fill {fill}")
    for nm, col in [("TEXT", TEXT), ("DIM", DIM), ("DIM a220", blend(DIM, fill, 220 / 255))]:
        print(f"    {nm:10s} on fill -> {contrast(col, fill)}:1")
