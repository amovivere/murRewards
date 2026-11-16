# -*- coding: utf-8 -*-
"""Аннотатор скриншотов для UX-аудита Reward Sounds.

Кладёт маркеры/обводки поверх реального скриншота и добавляет справа
тёмную панель-легенду в стиле приложения (фон #0A0A0A, акцент #8B00FF,
шрифт InterMock, извлечённый из style.css приложения).
"""
import os
from PIL import Image, ImageDraw, ImageFont

BASE = os.path.dirname(os.path.abspath(__file__))
EX = os.path.dirname(BASE)  # examples/
FONT_DIR = os.path.join(EX, "_screens-extract")
F400 = os.path.join(FONT_DIR, "Inter-400.ttf")
F600 = os.path.join(FONT_DIR, "Inter-600.ttf")

BG = "#0A0A0A"
PANEL_BG = "#0D0D0D"
TEXT = "#F5F5F5"
DIM = "#9A9A9A"
DIM2 = "#6E6E6E"
ACCENT = "#8B00FF"
ACCENT_LIGHT = "#C9A7FF"
BORDER = (255, 255, 255, 30)


def font(weight, size):
    return ImageFont.truetype(F600 if weight >= 600 else F400, size)


def wrap(text, fnt, max_w):
    """Перенос по словам; возвращает список строк."""
    words = text.split()
    lines, cur = [], ""
    for w in words:
        cand = (cur + " " + w).strip()
        if fnt.getlength(cand) <= max_w or not cur:
            cur = cand
        else:
            lines.append(cur)
            cur = w
    if cur:
        lines.append(cur)
    return lines


def text_block(draw, x, y, text, fnt, fill, max_w, line_h=None, max_lines=None):
    line_h = line_h or int(fnt.size * 1.42)
    lines = wrap(text, fnt, max_w)
    if max_lines and len(lines) > max_lines:
        lines = lines[:max_lines]
        lines[-1] = lines[-1].rstrip(" ,.;") + "…"
    for i, line in enumerate(lines):
        draw.text((x, y + i * line_h), line, font=fnt, fill=fill)
    return y + len(lines) * line_h


def badge(draw, cx, cy, n, color, r=12):
    # тёмный ореол, затем цветной кружок и номер
    draw.ellipse((cx - r - 2, cy - r - 2, cx + r + 2, cy + r + 2), fill=(10, 10, 10, 235))
    draw.ellipse((cx - r, cy - r, cx + r, cy + r), fill=color)
    draw.ellipse((cx - r + 1, cy - r + 1, cx + r - 1, cy + r - 1), outline=(255, 255, 255, 90), width=1)
    f = font(600, 13)
    draw.text((cx, cy + 1), str(n), font=f, fill="#FFFFFF", anchor="mm")


def round_rect(draw, rect, color, radius=9, width=2, alpha=26):
    x1, y1, x2, y2 = rect
    draw.rounded_rectangle((x1, y1, x2, y2), radius=radius, fill=color + (alpha,))
    draw.rounded_rectangle((x1, y1, x2, y2), radius=radius, outline=color + (255,), width=width)


class Annotator:
    """items: [{n, color, title, sub, marks:[('rect',(x1,y1,x2,y2))|('point',(x,y))]}]"""

    def __init__(self, src, title, kicker, lead="", panel_w=402):
        self.img = Image.open(src).convert("RGBA")
        self.w, self.h = self.img.size
        self.panel_w = panel_w
        self.title = title
        self.kicker = kicker
        self.lead = lead
        self.items = []
        self.overlay = Image.new("RGBA", self.img.size, (0, 0, 0, 0))
        self.od = ImageDraw.Draw(self.overlay)

    def add(self, n, color, title, sub="", marks=()):
        self.items.append(dict(n=n, color=color, title=title, sub=sub, marks=list(marks)))
        for mark in marks:
            kind, geom = mark[0], mark[1]
            if kind == "rect":
                round_rect(self.od, geom, self._rgb(color))
            elif kind == "point":
                pass  # точки рисуются значками в render
        return self

    @staticmethod
    def _badge_pos(mark):
        """Позиция значка для отметки: rect (+ необязательная точка/угол) или point."""
        kind, geom = mark[0], mark[1]
        extra = mark[2] if len(mark) > 2 else None
        if kind == "point":
            return geom
        x1, y1, x2, y2 = geom
        if isinstance(extra, tuple):
            return extra
        corner = extra or "tl"
        return {
            "tl": (x1, y1),
            "tr": (x2, y1),
            "bl": (x1, y2),
            "br": (x2, y2),
            "top": ((x1 + x2) / 2, y1),
            "bottom": ((x1 + x2) / 2, y2),
            "left": (x1, (y1 + y2) / 2),
            "right": (x2, (y1 + y2) / 2),
        }[corner]

    @staticmethod
    def _rgb(hexcolor):
        h = hexcolor.lstrip("#")
        return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))

    def _panel_height(self):
        pad = 26
        col_w = self.panel_w - pad * 2
        y = pad
        f_kick = font(600, 10)
        y += len(wrap(self.kicker.upper(), f_kick, col_w)) * 15 + 12
        f_title = font(600, 21)
        y += len(wrap(self.title, f_title, col_w)) * 27 + 10
        f_lead = font(400, 12.5)
        if self.lead:
            y += len(wrap(self.lead, f_lead, col_w)) * 19 + 14
        f_bt = font(600, 13)
        f_bs = font(400, 12)
        for it in self.items:
            y += len(wrap(it["title"], f_bt, col_w - 34)) * 18
            if it["sub"]:
                y += len(wrap(it["sub"], f_bs, col_w - 34)) * 17 + 2
            y += 20
        y += 26 + 40  # footer
        return y

    def render(self, out, footer="Reward Sounds · UX-аудит · ноябрь 2026"):
        ph = max(self._panel_height(), self.h)
        W = self.w + self.panel_w
        H = max(self.h, ph)
        canvas = Image.new("RGBA", (W, H), BG)
        # аннотации поверх скриншота
        base = Image.alpha_composite(self.img, self.overlay)
        canvas.paste(base, (0, 0))
        d = ImageDraw.Draw(canvas)
        # панель
        px = self.w
        d.rectangle((px, 0, W, H), fill=PANEL_BG)
        d.rectangle((px, 0, px + 3, H), fill=ACCENT)
        d.rectangle((px + 3, 0, px + 4, H), fill=(255, 255, 255, 14))

        pad = 26
        x = px + pad
        col_w = self.panel_w - pad * 2
        y = pad
        # kicker (может переноситься)
        f_kick = font(600, 10)
        for line in wrap(self.kicker.upper(), f_kick, col_w):
            d.text((x, y), line, font=f_kick, fill=ACCENT_LIGHT)
            y += 15
        y += 12
        f_title = font(600, 21)
        for line in wrap(self.title, f_title, col_w):
            d.text((x, y), line, font=f_title, fill=TEXT)
            y += 27
        y += 8
        if self.lead:
            f_lead = font(400, 12.5)
            for line in wrap(self.lead, f_lead, col_w):
                d.text((x, y), line, font=f_lead, fill=DIM)
                y += 19
            y += 12
        y += 6
        f_bt = font(600, 13)
        f_bs = font(400, 12)
        for it in self.items:
            if y > 40:
                d.line((x, y - 6, x + col_w, y - 6), fill=(255, 255, 255, 16))
            # бейдж в легенде
            badge(d, x + 11, y + 10, it["n"], self._rgb(it["color"]), r=11)
            lx = x + 34
            for line in wrap(it["title"], f_bt, col_w - 34):
                d.text((lx, y), line, font=f_bt, fill="#EDEDED")
                y += 18
            if it["sub"]:
                for line in wrap(it["sub"], f_bs, col_w - 34):
                    d.text((lx, y + 1), line, font=f_bs, fill=DIM)
                    y += 17
            y += 18
        # футер панели
        fy = H - 40
        d.line((x, fy - 2, x + col_w, fy - 2), fill=(255, 255, 255, 16))
        d.text((x, fy + 8), footer, font=font(400, 10.5), fill=DIM2)
        # маркеры на скриншоте
        for it in self.items:
            for mark in it["marks"]:
                bx, by = self._badge_pos(mark)
                bx = max(13, min(self.w - 13, bx))
                by = max(13, min(self.h - 13, by))
                badge(d, bx, by, it["n"], self._rgb(it["color"]))
        canvas.convert("RGB").save(out, optimize=True)
        return out
