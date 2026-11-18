# -*- coding: utf-8 -*-
"""Reward Sounds UI kit: dark studio components built from FigCraft primitives."""
import fc
from fc import solid, stroke, gradient, hexmix, measure, wrap_lines

# ------------------------------------------------------------------ tokens
BG = "#0A0A0A"
PAGE = "#0B0B0C"
SIDEBAR = "#0E0E0E"
PANEL = "#0D0D0D"
SURF = "#111111"
SURF2 = "#161616"
SURF3 = "#1C1C1C"
BORDER = "#FFFFFF12"
BORDER2 = "#FFFFFF1F"
BORDER3 = "#FFFFFF33"
TEXT = "#F5F5F5"
TEXT2 = "#B9B9B9"
MUTED = "#8B8B8B"
DIM = "#6E6E6E"
ACCENT = "#8B00FF"
ACCENT_TEXT = "#C9A7FF"
ACCENT_SOFT = "#8B00FF24"
ACCENT_BORDER = "#8B00FF59"
OK = "#22C55E"
WARN = "#F59E0B"
DANGER = "#EF4444"
INFO = "#7DD3FC"

REWARD_COLORS = ["#FF5A5F", "#4E7CFF", "#A970FF", "#2DD4BF", "#F5C97B",
                 "#EC4899", "#00C8FF", "#A3A3A3", "#8B00FF"]

RADIUS = {"xs": 4, "sm": 6, "md": 8, "lg": 10, "xl": 12, "2xl": 14, "3xl": 16,
          "4xl": 18, "5xl": 22, "pill": 999}


def luminance(hexcolor):
    h = hexcolor.lstrip("#")[:6]
    vals = [int(h[i:i + 2], 16) / 255.0 for i in (0, 2, 4)]
    ch = [(v / 12.92 if v <= 0.03928 else ((v + 0.055) / 1.055) ** 2.4) for v in vals]
    return 0.2126 * ch[0] + 0.7152 * ch[1] + 0.0722 * ch[2]


def contrast_text(bg):
    l = luminance(bg)
    return "#0A0A0A" if (l + 0.05) / 0.05 >= 1.05 / (l + 0.05) else "#FFFFFF"


def tint(color, amount=0.13):
    return hexmix("#141414", color, amount)


def border_tint(color, amount=0.24):
    return hexmix("#242424", color, amount)


# ------------------------------------------------------------------ icons
def diag(doc, parent, name, x1, y1, x2, y2, thickness, color, alpha=1.0):
    import math
    dx, dy = x2 - x1, y2 - y1
    length = math.hypot(dx, dy)
    ang = math.degrees(math.atan2(dy, dx))
    cx, cy = (x1 + x2) / 2.0, (y1 + y2) / 2.0
    rad = math.radians(ang)
    x0 = cx - (length / 2.0) * math.cos(rad) + (thickness / 2.0) * math.sin(rad)
    y0 = cy - (length / 2.0) * math.sin(rad) - (thickness / 2.0) * math.cos(rad)
    return doc.rect(parent, name, x0, y0, length, thickness, solid(color, alpha),
                    radius=max(0.5, thickness / 2.0 - 0.2), rotation=ang)


def icon(doc, parent, kind, x, y, size=16, color=TEXT2, alpha=1.0, name=None):
    s = size
    c = color
    nm = name or ("Icon/" + kind)
    if kind == "grid":
        q = s / 2 - 1.2
        doc.rect(parent, nm, x, y, q, q, solid(c, alpha), 1.6)
        doc.rect(parent, nm, x + s - q, y, q, q, solid(c, alpha), 1.6)
        doc.rect(parent, nm, x, y + s - q, q, q, solid(c, alpha), 1.6)
        doc.rect(parent, nm, x + s - q, y + s - q, q, q, solid(c, alpha), 1.6)
    elif kind == "music":
        doc.ellipse(parent, nm, x, y + s * 0.62, s * 0.34, s * 0.34, None,
                    stroke_color=c, stroke_w=max(1.4, s / 11))
        doc.ellipse(parent, nm, x + s * 0.52, y + s * 0.5, s * 0.34, s * 0.34, None,
                    stroke_color=c, stroke_w=max(1.4, s / 11))
        doc.rect(parent, nm, x + s * 0.27, y + s * 0.05, max(1.4, s / 11), s * 0.75, solid(c, alpha))
        doc.rect(parent, nm, x + s * 0.79, y, max(1.4, s / 11), s * 0.62, solid(c, alpha))
    elif kind == "chat":
        doc.frame(parent, nm, x, y + s * 0.08, s * 0.9, s * 0.68, fill=None,
                  radius=s * 0.22, stroke_color=c, stroke_w=max(1.3, s / 12))
        doc.rect(parent, nm, x + s * 0.2, y + s * 0.76, s * 0.22, max(1.3, s / 12), solid(c, alpha))
    elif kind == "settings":
        gap = s / 3.4
        for i in range(3):
            yy = y + s * 0.15 + gap * i
            doc.rect(parent, nm, x, yy, s * 0.92, max(1.3, s / 12), solid(c, alpha))
        for i, fx in enumerate((0.32, 0.62, 0.46)):
            yy = y + s * 0.15 + gap * i
            doc.ellipse(parent, nm, x + s * fx - s * 0.09, yy - s * 0.09,
                        s * 0.18, s * 0.18, solid("#0E0E0E"))
            doc.ellipse(parent, nm, x + s * fx - s * 0.09, yy - s * 0.09,
                        s * 0.18, s * 0.18, None, stroke_color=c, stroke_w=max(1.2, s / 14))
    elif kind == "journal":
        for i in range(3):
            yy = y + s * 0.16 + (s / 3.4) * i
            doc.ellipse(parent, nm, x, yy - s * 0.07, s * 0.14, s * 0.14, solid(c, alpha))
            doc.rect(parent, nm, x + s * 0.3, yy, s * 0.62, max(1.3, s / 12), solid(c, alpha))
    elif kind == "search":
        doc.ellipse(parent, nm, x, y, s * 0.68, s * 0.68, None, stroke_color=c,
                    stroke_w=max(1.3, s / 12))
        doc.rect(parent, nm, x + s * 0.58, y + s * 0.6, s * 0.42, max(1.3, s / 12),
                 solid(c, alpha), radius=1, rotation=45)
    elif kind == "play":
        doc.polygon(parent, nm, x + s * 0.15, y, s * 0.75, s,
                    [(0, 0), (1, 0.5), (0, 1)], solid(c, alpha))
    elif kind == "pause":
        doc.rect(parent, nm, x + s * 0.18, y, s * 0.2, s, solid(c, alpha), radius=1)
        doc.rect(parent, nm, x + s * 0.58, y, s * 0.2, s, solid(c, alpha), radius=1)
    elif kind == "next":
        doc.polygon(parent, nm, x + s * 0.1, y, s * 0.55, s,
                    [(0, 0), (1, 0.5), (0, 1)], solid(c, alpha))
        doc.rect(parent, nm, x + s * 0.72, y, s * 0.18, s, solid(c, alpha), radius=1)
    elif kind == "prev":
        doc.polygon(parent, nm, x + s * 0.35, y, s * 0.55, s,
                    [(1, 0), (0, 0.5), (1, 1)], solid(c, alpha))
        doc.rect(parent, nm, x + s * 0.1, y, s * 0.18, s, solid(c, alpha), radius=1)
    elif kind == "plus":
        doc.rect(parent, nm, x + s * 0.44, y, s * 0.12, s, solid(c, alpha), radius=1)
        doc.rect(parent, nm, x, y + s * 0.44, s, s * 0.12, solid(c, alpha), radius=1)
    elif kind == "check":
        t = max(1.4, s * 0.1)
        diag(doc, parent, nm, x + s * 0.12, y + s * 0.52, x + s * 0.4, y + s * 0.8, t, c, alpha)
        diag(doc, parent, nm, x + s * 0.4, y + s * 0.8, x + s * 0.9, y + s * 0.2, t, c, alpha)
    elif kind == "close":
        t = max(1.2, s * 0.09)
        diag(doc, parent, nm, x + s * 0.18, y + s * 0.18, x + s * 0.82, y + s * 0.82, t, c, alpha)
        diag(doc, parent, nm, x + s * 0.18, y + s * 0.82, x + s * 0.82, y + s * 0.18, t, c, alpha)
    elif kind == "chevron-down":
        doc.rect(parent, nm, x + s * 0.1, y + s * 0.38, s * 0.42, s * 0.1,
                 solid(c, alpha), radius=1, rotation=45)
        doc.rect(parent, nm, x + s * 0.42, y + s * 0.38, s * 0.42, s * 0.1,
                 solid(c, alpha), radius=1, rotation=-45)
    elif kind == "chevron-right":
        doc.rect(parent, nm, x + s * 0.35, y + s * 0.1, s * 0.42, s * 0.1,
                 solid(c, alpha), radius=1, rotation=45)
        doc.rect(parent, nm, x + s * 0.35, y + s * 0.42, s * 0.42, s * 0.1,
                 solid(c, alpha), radius=1, rotation=-45)
    elif kind == "refresh":
        doc.ellipse(parent, nm, x, y, s, s, None, stroke_color=c, stroke_w=max(1.3, s / 12))
        doc.polygon(parent, nm, x + s * 0.62, y - s * 0.02, s * 0.34, s * 0.3,
                    [(0, 0), (1, 0), (0.5, 1)], solid(c, alpha))
    elif kind == "folder":
        doc.frame(parent, nm, x, y + s * 0.15, s, s * 0.7, fill=None, radius=s * 0.14,
                  stroke_color=c, stroke_w=max(1.3, s / 12))
    elif kind == "external":
        doc.frame(parent, nm, x, y + s * 0.2, s * 0.64, s * 0.64, fill=None,
                  radius=s * 0.12, stroke_color=c, stroke_w=max(1.2, s / 14))
        doc.rect(parent, nm, x + s * 0.52, y, s * 0.48, max(1.3, s / 14), solid(c, alpha), rotation=0)
    elif kind == "trash":
        doc.rect(parent, nm, x + s * 0.13, y + s * 0.2, s * 0.74, s * 0.72,
                 None, radius=s * 0.14, stroke_color=c, stroke_w=max(1.3, s / 12))
        doc.rect(parent, nm, x + s * 0.33, y, s * 0.34, max(1.4, s / 12), solid(c, alpha))
        doc.rect(parent, nm, x + s * 0.02, y + s * 0.12, s * 0.96, max(1.4, s / 12), solid(c, alpha))
    elif kind == "speaker":
        doc.rect(parent, nm, x, y + s * 0.32, s * 0.3, s * 0.36, solid(c, alpha), radius=1)
        doc.polygon(parent, nm, x + s * 0.26, y + s * 0.12, s * 0.42, s * 0.76,
                    [(0, 0.5), (1, 0), (1, 1), (0, 0.5)], solid(c, alpha))
    elif kind == "dots":
        for i in range(3):
            doc.ellipse(parent, nm, x + s * 0.12 + i * s * 0.36, y + s * 0.4,
                        s * 0.16, s * 0.16, solid(c, alpha))
    elif kind == "mute":
        doc.rect(parent, nm, x, y + s * 0.32, s * 0.26, s * 0.36, solid(c, alpha), radius=1)
        doc.polygon(parent, nm, x + s * 0.22, y + s * 0.12, s * 0.36, s * 0.76,
                    [(0, 0.5), (1, 0), (1, 1), (0, 0.5)], solid(c, alpha))
        doc.rect(parent, nm, x + s * 0.6, y + s * 0.3, s * 0.32, max(1.3, s / 12),
                 solid(c, alpha), rotation=45)
        doc.rect(parent, nm, x + s * 0.6, y + s * 0.3, s * 0.32, max(1.3, s / 12),
                 solid(c, alpha), rotation=-45)
    elif kind == "dot":
        doc.ellipse(parent, nm, x, y, s, s, solid(c, alpha))
    return None


# ------------------------------------------------------------------ chrome
def window(doc, kit, page, x, y, w, h, name, bg=None):
    win = doc.frame(page, name, x, y, w, h, fill=solid(bg or BG), radius=12,
                    stroke_color=BORDER2, stroke_w=1, clip=True)
    # titlebar
    tb = doc.frame(win, "Titlebar", 0, 0, w, 38, fill=solid("#0A0A0A"), clip=True)
    for i, kind in enumerate(("min", "max", "close")):
        bx = w - 8 - (3 - i) * 34
        btn = doc.frame(tb, "WinBtn/%s" % kind, bx, 6, 28, 22, fill=None, radius=7)
        if kind == "min":
            doc.rect(btn, "Min", 8, 10, 12, 1.5, solid(TEXT2))
        elif kind == "max":
            doc.frame(btn, "Max", 8, 5, 12, 12, fill=None, radius=2,
                      stroke_color=TEXT2, stroke_w=1.2)
        else:
            doc.rect(btn, "Close 1", 8, 10.5, 12, 1.5, solid(TEXT2), rotation=45)
            doc.rect(btn, "Close 2", 8, 10.5, 12, 1.5, solid(TEXT2), rotation=-45)
    return win


def sidebar(doc, kit, win, h=840, active="Награды", rail=False):
    w = 64 if rail else 236
    inner = h - 74
    sb = doc.frame(win, "Sidebar", 0, 38, w, inner, fill=solid(SIDEBAR), clip=True)
    doc.line(sb, "Sidebar border", w - 1, 0, 0, "#FFFFFF", 0.05)
    if rail:
        rail_items = [("Награды", "grid", True), ("Музыка", "music", False),
                      ("Чат", "chat", False), ("Настройки", "settings", False),
                      ("Журнал", "journal", False)]
        yy = 12
        for label, kind, on in rail_items[:3]:
            if on:
                doc.frame(sb, "Rail active", 12, yy, 40, 38, fill=solid(ACCENT_SOFT),
                          radius=10)
            icon(doc, sb, kind, 24, yy + 11, 16, TEXT if on else MUTED)
            yy += 42
        doc.frame(sb, "Rail divider", 16, inner - 190, 32, 1, fill=solid(BORDER2))
        yy = inner - 178
        for label, kind, on in rail_items[3:]:
            icon(doc, sb, kind, 24, yy + 11, 16, TEXT if on else MUTED)
            yy += 42
        doc.ellipse(sb, "Audio dot", 28, inner - 108, 7, 7, solid(OK))
        return sb
    y = 10
    doc.text(sb, "Label/ОСНОВНОЕ", 20, y + 4, 120, "ОСНОВНОЕ", size=10.6, weight=600,
             color=DIM, tracking=2)
    y += 26
    for label, kind, on in (("Награды", "grid", active == "Награды"),
                            ("Музыка", "music", active == "Музыка"),
                            ("Чат", "chat", active == "Чат")):
        if on:
            doc.frame(sb, "Nav active", 12, y, 212, 38, fill=solid(ACCENT_SOFT), radius=10)
        icon(doc, sb, kind, 28, y + 11, 16, TEXT if on else MUTED)
        doc.text(sb, "Nav/" + label, 54, y + 9, 150, label, size=13.8,
                 weight=600 if on else 400, color=TEXT if on else MUTED)
        y += 40
    # chat label group
    doc.text(sb, "Label/ЧАТ", 20, y + 4, 120, "ЧАТ", size=10.6, weight=600,
             color=DIM, tracking=2)
    y += 82
    # system at bottom
    sy = inner - 148
    doc.line(sb, "System divider", 16, sy - 12, 204, "#FFFFFF", 0.06)
    doc.text(sb, "Label/СИСТЕМА", 20, sy, 120, "СИСТЕМА", size=10.6, weight=600,
             color=DIM, tracking=2)
    sy += 22
    for label, kind, on in (("Настройки", "settings", active == "Настройки"),
                            ("Журнал", "journal", active == "Журнал")):
        if on:
            doc.frame(sb, "Nav active", 12, sy, 212, 38, fill=solid(ACCENT_SOFT), radius=10)
        icon(doc, sb, kind, 28, sy + 11, 16, TEXT if on else MUTED)
        doc.text(sb, "Nav/" + label, 54, sy + 9, 150, label, size=13.8,
                 weight=600 if on else 400, color=TEXT if on else MUTED)
        sy += 40
    doc.text(sb, "Version", 20, inner - 24, 190, "версия 1.7.0", size=10.2, color=DIM,
             opacity=0.9)
    return sb


def topbar(doc, kit, win, x=236, w=984, health="ok", playing=None):
    tb = doc.frame(win, "Topbar", x, 38, w, 56, fill=solid("#0A0A0A"), clip=True)
    # health chip
    state_color = {"ok": OK, "warn": WARN, "error": DANGER}[health]
    label = {"ok": "Все системы работают", "warn": "Есть замечания",
             "error": "Требует внимания"}[health]
    cw = int(measure(label, 12.4, 500) + 54)
    chip = doc.frame(tb, "Health chip", 20, 13, cw, 30, fill=solid("#FFFFFF0A"),
                     radius=15, stroke_color=BORDER2)
    doc.ellipse(chip, "Health dot", 11, 11, 7, 7, solid(state_color))
    doc.text(chip, "Health text", 25, 8, cw - 50, label, size=12.4, color="#CFCFCF")
    icon(doc, chip, "chevron-right", cw - 20, 9, 12, DIM)
    # playing indicator
    if playing:
        pw = int(measure("■ %d звучит" % playing, 10.8, 600) + 20)
        p = doc.frame(tb, "Playing indicator", 20 + cw + 10, 17, pw, 22,
                      fill=solid(ACCENT_SOFT), radius=11, stroke_color=ACCENT_BORDER)
        doc.text(p, "Playing text", 8, 4, pw - 16, "■ %d звучит" % playing,
                 size=10.8, weight=600, color=ACCENT_TEXT)
    # right side
    doc.frame(tb, "Mute", w - 268, 17, 22, 22, fill=None, radius=6)
    icon(doc, tb, "speaker", w - 264, 17, 15, MUTED)
    doc.text(tb, "Label/ЗВУК", w - 238, 16, 40, "ЗВУК", size=10.6, color=DIM, tracking=1.4)
    sx = w - 190
    doc.rect(tb, "Volume track", sx, 21, 88, 2, solid("#FFFFFF33"), radius=1)
    doc.rect(tb, "Volume fill", sx, 21, 26, 2, solid("#EDEDED"), radius=1)
    doc.ellipse(tb, "Volume knob", sx + 21, 17, 10, 10, solid("#FFFFFF"))
    doc.text(tb, "Volume value", w - 90, 15, 50, "29%", size=13, color=TEXT)
    return tb


def footer(doc, kit, win, x=236, w=984, hint="Готово", version="версия 1.7.0"):
    ft = doc.frame(win, "Footer", x, 804, w, 36, fill=solid("#0A0A0A"), clip=True)
    doc.line(ft, "Footer top", 0, 0, w, "#FFFFFF", 0.04)
    doc.text(ft, "Hint", 20, 10, 600, hint, size=12.6, color=MUTED)
    doc.text(ft, "Version", w - 200, 11, 180, "версия 1.7.0", size=11, color=DIM,
             align="right")
    return ft


# ------------------------------------------------------------------ page head
def page_head(doc, kit, area, x, y, w, title, sub, actions=True, w_action=200):
    doc.text(area, "H1/" + title, x, y, w - 260, title, size=34, weight=600, color=TEXT)
    doc.text(area, "Sub/" + title, x, y + 46, w - 260, sub, size=14.6, color=MUTED)
    if actions:
        if w >= 820:
            icon(doc, area, "dots", w - 232, y + 16, 16, MUTED)
            btn, _ = kit.button(area, w - 214, y + 6, "Создать награду", "primary",
                                "md", width=190, name="Btn/Create")
        else:
            btn, _ = kit.button(area, w - 166, y + 6, "Создать", "primary",
                                "md", width=150, name="Btn/Create")
        return btn
    return None
