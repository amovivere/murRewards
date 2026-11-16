# -*- coding: utf-8 -*-
"""Батч измерений текстовых bbox и цветов для реальных скриншотов и макетов."""
import analyze as A

# кроп-боксы в координатах соответствующего изображения
REAL = {
    "h1": (255, 108, 470, 170),
    "sub": (255, 170, 560, 196),
    "create_btn_text": (1060, 130, 1215, 172),
    "create_btn_dots": (1000, 130, 1060, 170),
    "search_text": (280, 205, 560, 240),
    "seg_plitka_text": (585, 205, 700, 240),
    "seg_spisok_text": (700, 205, 790, 240),
    "sort_text": (835, 205, 940, 240),
    "refresh_icon": (945, 205, 985, 240),
    "stop_text": (995, 205, 1130, 240),
    "pill_all_text": (270, 265, 400, 292),
    "card_title": (320, 330, 560, 356),
    "card_meta": (320, 355, 560, 375),
    "card_chip_fname": (310, 395, 470, 430),
    "card_vol_label": (275, 455, 350, 482),
    "btn_zamenit_text": (290, 495, 380, 530),
    "btn_ubrat_text": (395, 495, 460, 530),
}
MOCK = {
    "h1": (510, 210, 940, 290),
    "sub": (510, 280, 940, 310),
    "create_btn_text": (1930, 220, 2400, 310),
    "create_btn_dots": (1900, 220, 1975, 310),
    "search_text": (545, 400, 1060, 445),
    "seg_plitka_text": (1075, 400, 1370, 445),
    "seg_spisok_text": (1380, 400, 1540, 445),
    "sort_text": (1610, 400, 1830, 445),
    "refresh_icon": (1880, 400, 1930, 445),
    "stop_text": (1980, 400, 2260, 445),
    "pill_all_text": (540, 520, 760, 565),
    "card_title": (630, 585, 1070, 635),
    "card_meta": (630, 630, 1070, 665),
    "card_chip_fname": (600, 675, 950, 745),
    "card_vol_label": (540, 790, 700, 840),
    "btn_zamenit_text": (570, 900, 700, 950),
    "btn_ubrat_text": (790, 900, 890, 950),
}


def bbox(im, box, bg=None, thr=40):
    r = A.text_bbox(im, box, thr, bg)
    if not r:
        return "   (нет пикселей)"
    x0, y0, x1, y1, w, h = r
    return "x=%4d..%4d y=%4d..%4d  w=%3d h=%2d" % (x0, x1, y0, y1, w, h)


def run(name, real, mock, bg_real=None, bg_mock=None, thr=40):
    s = A.shot("screenshot")
    m = A.mock("rewards")
    print("== %s ==" % name)
    print("  REAL:", bbox(s, REAL[name], bg_real, thr))
    print("  MOCK(2x):", bbox(m, MOCK[name], bg_mock, thr))
    # пересчёт mock в 1x
    r = A.text_bbox(m, MOCK[name], thr, bg_mock)
    if r:
        print("  MOCK/2 : x=%6.1f..%6.1f y=%6.1f..%6.1f w=%5.1f h=%4.1f"
              % (r[0] / 2, r[2] / 2, r[1] / 2, r[3] / 2, r[4] / 2, r[5] / 2))
    if name in ("h1", "card_title", "btn_zamenit_text"):
        print()


if __name__ == "__main__":
    pass
