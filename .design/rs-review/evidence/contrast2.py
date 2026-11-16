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

DIM = (139, 139, 139)
DANGER = (239, 68, 68)
TEXT = (245, 245, 245)
CARD = (20, 20, 20)
reward = (0xA9, 0x70, 0xFF)
fill = tuple(round(c * 0.88 + r * 0.12) for c, r in zip(CARD, reward))
print("tinted fill:", fill)
for a in (190, 200, 220):
    c = blend(DIM, fill, a / 255)
    print(f"  DIM a{a} on fill -> {c} {contrast(c, fill)}")
print("  DANGER on fill ->", contrast(DANGER, fill))
print("  TEXT on fill ->", contrast(TEXT, fill))
# list card state text alpha220 on fill
# disabled button look: same as enabled; no contrast number needed
