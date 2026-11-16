# -*- coding: utf-8 -*-
"""Точная геометрия прямоугольников по цвету заливки."""
import analyze as A
from collections import defaultdict


def find_color_bbox(im, target, tol=6, x0=0, y0=0, x1=None, y1=None):
    x1 = x1 if x1 is not None else im.width
    y1 = y1 if y1 is not None else im.height
    xs, ys = [], []
    for y in range(y0, y1):
        for x in range(x0, x1):
            c = im.getpixel((x, y))
            if A.near(c, target, tol):
                xs.append(x)
                ys.append(y)
    if not xs:
        return None
    return (min(xs), min(ys), max(xs), max(ys))


def find_region_rows(im, target, tol=6, x=0, x1=None):
    """Вертикальный профиль присутствия цвета в столбце x."""
    x1 = x1 if x1 is not None else im.width
    out = []
    inrun = False
    start = 0
    for y in range(im.height):
        hit = False
        for xx in range(x, x1):
            if A.near(im.getpixel((xx, y)), target, tol):
                hit = True
                break
        if hit and not inrun:
            start = y
            inrun = True
        if not hit and inrun:
            out.append((start, y - 1))
            inrun = False
    if inrun:
        out.append((start, im.height - 1))
    return out


def card_metrics(im, targets, label):
    print("== %s : bbox по цвету фона карточек ==" % label)
    for name, c in targets:
        bb = find_color_bbox(im, c, tol=4)
        if bb:
            print("  %-22s %s  w=%d h=%d" % (name, A.hexc(c), bb[2] - bb[0] + 1, bb[3] - bb[1] + 1))
            print("      bbox=", bb)
    print()


if __name__ == "__main__":
    # карточки: цвета фонов (mockup 2x = те же цвета, т.к. mix(#141414,color,.13))
    cards = [
        ("red   Ты новичок?", (0x33, 0x1D, 0x1E)),
        ("blue  Мне нравится", (0x1D, 0x1F, 0x33)),
        ("purple Шиза", (0x27, 0x20, 0x33)),
        ("green Беги", (0x16, 0x2B, 0x1E)),
        ("violet Выстрел", (0x1C, 0x22, 0x33)),
        ("pink  МУЗЫКА", (0x33, 0x1C, 0x27)),
    ]
    s = A.shot("screenshot")
    m = A.mock("rewards")
    card_metrics(s, cards, "REAL 1236x879")
    card_metrics(m, [(n, c) for n, c in cards], "MOCK 2440x1680 (2x)")
