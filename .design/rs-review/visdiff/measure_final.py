# -*- coding: utf-8 -*-
"""Финальные замеры геометрии: музыка, онбординг, OBS, список."""
import analyze as A
from PIL import Image
import pathlib

BASE = pathlib.Path(r"C:\Users\mur\Documents\deepseek-harness\default-workspace")
SHOT = BASE / "reward-sounds" / "docs"
OUT = BASE / ".tmp" / "rs-review" / "visdiff" / "crops"


def crop(src, name, box, scale=8):
    im = Image.open(SHOT / (src + ".png")).convert("RGB")
    c = im.crop(box)
    c = c.resize((c.width * scale, c.height * scale), Image.NEAREST)
    c.save(OUT / name)


crop("screenshot", "px-account-8x.png", (1080, 42, 1130, 94), 8)
crop("screenshot", "px-logo-8x.png", (10, 12, 60, 62), 8)
crop("screenshot", "px-btn-8x.png", (268, 486, 330, 540), 8)
crop("screenshot", "px-search-8x.png", (255, 200, 310, 250), 8)

s = A.shot("screenshot")
m = A.shot("music")
o = A.shot("onboarding")
ob = A.shot("obs")
r = A.shot("rewards-list")

print("=== MUSIC: player card top/bottom (col x=600) ===")
A.show_runs(A.runs_v(m, 600, 240, 500, tol=4), 1)
print("=== MUSIC: queue card (col x=300) y=460..820 ===")
A.show_runs(A.runs_v(m, 300, 460, 830, tol=4), 1)
print("=== MUSIC: queue row1 (col x=300 y=500..560) ===")
A.show_runs(A.runs_v(m, 300, 500, 560, tol=4), 1)
print("=== MUSIC: bottom cards row (row y=700) ===")
A.show_runs(A.runs_h(m, 700, 250, 1235, tol=4), 2)
print("=== MUSIC: player right col (row y=270) ===")
A.show_runs(A.runs_h(m, 270, 800, 1235, tol=4), 2)
print("=== MUSIC: player cover bbox x 260..380 at y=300 ===")
A.show_runs(A.runs_h(m, 300, 250, 420, tol=4), 1)
print()
print("=== ONBOARDING: left card col x=300 y=190..640 ===")
A.show_runs(A.runs_v(o, 300, 190, 650, tol=4), 1)
print("=== ONBOARDING: right col x=900 y=190..560 ===")
A.show_runs(A.runs_v(o, 900, 190, 560, tol=4), 1)
print("=== ONBOARDING: columns row y=250 ===")
A.show_runs(A.runs_h(o, 250, 250, 1235, tol=4), 2)
print("=== ONBOARDING: local card row y=680 ===")
A.show_runs(A.runs_h(o, 680, 250, 1235, tol=4), 2)
print("=== ONBOARDING: local tiles row y=740 ===")
A.show_runs(A.runs_h(o, 740, 250, 1235, tol=8), 2)
print()
print("=== OBS: modal col x=500 y=95..520 ===")
A.show_runs(A.runs_v(ob, 500, 95, 520, tol=4), 1)
print("=== OBS: modal row y=140 ===")
A.show_runs(A.runs_h(ob, 140, 240, 780, tol=4), 2)
print("=== OBS: modal row y=250 ===")
A.show_runs(A.runs_h(ob, 250, 240, 780, tol=4), 2)
print()
print("=== LIST: rows col x=300 y=300..880 ===")
A.show_runs(A.runs_v(r, 300, 300, 879, tol=5), 1)
print("=== LIST: row1 row y=350 ===")
A.show_runs(A.runs_h(r, 350, 250, 1235, tol=5), 2)
