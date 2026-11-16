# -*- coding: utf-8 -*-
"""Измерительный инструмент для сверки макетов (2440x1680, 2x) и скриншотов (1236x879, 1x)."""
import sys
from PIL import Image

BASE = r"C:\Users\mur\Documents\deepseek-harness\default-workspace"
MOCK = BASE + r"\.tmp\rs-review\mockups"
SHOT = BASE + r"\reward-sounds\docs"
CACHE = {}


def img(path):
    if path not in CACHE:
        CACHE[path] = Image.open(path).convert("RGB")
    return CACHE[path]


def mock(name):
    num = {"rewards": "01", "music": "02", "onboarding": "03"}[name]
    return img(MOCK + "\\mockup-%s-%s.png" % (num, name))


def shot(name):
    return img(SHOT + "\\" + name + ".png")


def col(im, x, y):
    return im.getpixel((x, y))


def hexc(c):
    return "#%02X%02X%02X" % c


def near(a, b, tol=6):
    return abs(a[0] - b[0]) <= tol and abs(a[1] - b[1]) <= tol and abs(a[2] - b[2]) <= tol


def runs_h(im, y, x0, x1, tol=6):
    """Горизонтальные пробеги цветов: список (x_start, x_end, color)."""
    out = []
    cur = col(im, x0, y)
    start = x0
    for x in range(x0 + 1, x1 + 1):
        c = col(im, x, y)
        if not near(c, cur, tol):
            out.append((start, x - 1, cur))
            cur = c
            start = x
    out.append((start, x1, cur))
    return out


def runs_v(im, x, y0, y1, tol=6):
    out = []
    cur = col(im, x, y0)
    start = y0
    for y in range(y0 + 1, y1 + 1):
        c = col(im, x, y)
        if not near(c, cur, tol):
            out.append((start, y - 1, cur))
            cur = c
            start = y
    out.append((start, y1, cur))
    return out


def show_runs(runs, minlen=1):
    for a, b, c in runs:
        if b - a + 1 >= minlen:
            print("  %4d..%4d (%3d) %s" % (a, b, b - a + 1, hexc(c)))


def top_colors(im, x0=0, y0=0, x1=None, y1=None, n=25):
    from collections import Counter
    x1 = x1 or im.width
    y1 = y1 or im.height
    cnt = Counter()
    for y in range(y0, y1):
        for x in range(x0, x1):
            cnt[im.getpixel((x, y))] += 1
    tot = (x1 - x0) * (y1 - y0)
    for c, k in cnt.most_common(n):
        print("  %s  %7d  %5.2f%%" % (hexc(c), k, 100.0 * k / tot))


def text_bbox(im, box, thr=60, bg=None):
    """bbox ярких/отличных от bg пикселей внутри box=(x0,y0,x1,y1)."""
    x0, y0, x1, y1 = box
    bgpix = bg if bg is not None else col(im, x0, y0)
    xs, ys = [], []
    for y in range(y0, y1):
        for x in range(x0, x1):
            c = im.getpixel((x, y))
            if max(abs(c[0] - bgpix[0]), abs(c[1] - bgpix[1]), abs(c[2] - bgpix[2])) > thr:
                xs.append(x)
                ys.append(y)
    if not xs:
        return None
    return (min(xs), min(ys), max(xs), max(ys), max(xs) - min(xs) + 1, max(ys) - min(ys) + 1)


def region_colors(im, box, n=8):
    from collections import Counter
    x0, y0, x1, y1 = box
    cnt = Counter()
    for y in range(y0, y1):
        for x in range(x0, x1):
            cnt[im.getpixel((x, y))] += 1
    tot = (x1 - x0) * (y1 - y0)
    return [(hexc(c), k, 100.0 * k / tot) for c, k in cnt.most_common(n)]


def col_profile(im, x0, x1, y, minlen=1):
    runs = runs_h(im, y, x0, x1)
    show_runs(runs, minlen)


def row_profile(im, y0, y1, x, minlen=1):
    runs = runs_v(im, x, y0, y1)
    show_runs(runs, minlen)
