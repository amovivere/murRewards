# -*- coding: utf-8 -*-
"""Батч измерений текстовых bbox и цветов: REAL и MOCK (2x, координаты = 2*real)."""
import analyze as A

REAL = {
    "h1": (255, 105, 470, 175),
    "sub": (255, 168, 560, 200),
    "create_btn": (1050, 128, 1220, 178),
    "dots_menu": (990, 138, 1050, 170),
    "search_box": (255, 200, 570, 250),
    "seg_box": (570, 200, 795, 250),
    "sort_box": (800, 200, 940, 250),
    "refresh_btn": (940, 200, 990, 250),
    "stop": (990, 200, 1140, 250),
    "pills_row": (255, 258, 880, 300),
    "card1_toprow": (258, 315, 575, 380),
    "card1_title_capH": (330, 325, 352, 360),
    "card1_meta": (330, 356, 560, 380),
    "card1_chip": (258, 385, 575, 440),
    "card1_vol": (258, 448, 575, 485),
    "card1_buttons": (258, 486, 575, 540),
    "card1_border_top": (300, 312, 500, 330),
}


def bbox(im, box, thr=30, bg=None):
    return A.text_bbox(im, box, thr, bg)


def show(name, s, m, thr=30):
    r = bbox(s, REAL[name], thr)
    box2 = tuple(2 * v for v in REAL[name])
    q = bbox(m, box2, thr)
    print("== %s ==" % name)
    if r:
        print("  REAL   x=%4d..%4d y=%4d..%4d w=%3d h=%2d" % (r[0], r[2], r[1], r[3], r[4], r[5]))
    else:
        print("  REAL    -")
    if q:
        print("  MOCK/2 x=%6.1f..%6.1f y=%6.1f..%6.1f w=%5.1f h=%4.1f"
              % (q[0] / 2, q[2] / 2, q[1] / 2, q[3] / 2, q[4] / 2, q[5] / 2))
    else:
        print("  MOCK    -")
    print()


if __name__ == "__main__":
    s = A.shot("screenshot")
    m = A.mock("rewards")
    for n in REAL:
        show(n, s, m)
