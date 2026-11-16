# -*- coding: utf-8 -*-
"""Нарезка кропов (x4) для визуальной проверки пиксельности и деталей."""
from PIL import Image
import pathlib

BASE = pathlib.Path(r"C:\Users\mur\Documents\deepseek-harness\default-workspace")
SHOT = BASE / "reward-sounds" / "docs"
OUT = BASE / ".tmp" / "rs-review" / "visdiff" / "crops"
OUT.mkdir(parents=True, exist_ok=True)


def crop(src, name, box, scale=4):
    im = Image.open(SHOT / (src + ".png")).convert("RGB")
    c = im.crop(box)
    c = c.resize((c.width * scale, c.height * scale), Image.NEAREST)
    c.save(OUT / name)
    print(name, box, c.size)


# ── Reward Sounds: шапка / тулбар / чипы
crop("screenshot", "r-topbar-right.png", (790, 20, 1236, 96), 4)
crop("screenshot", "r-topbar-left.png", (240, 20, 620, 96), 4)
crop("screenshot", "r-hero-right.png", (960, 100, 1236, 200), 4)
crop("screenshot", "r-toolbar1.png", (250, 195, 720, 250), 4)
crop("screenshot", "r-toolbar2.png", (700, 195, 1236, 250), 4)
crop("screenshot", "r-pills.png", (250, 255, 900, 300), 4)
crop("screenshot", "r-card1-top.png", (255, 310, 580, 400), 4)
crop("screenshot", "r-card1-mid.png", (255, 385, 580, 470), 4)
crop("screenshot", "r-card1-bottom.png", (255, 470, 580, 555), 4)
crop("screenshot", "r-card-corner.png", (255, 310, 320, 360), 8)
crop("screenshot", "r-sidebar-logo.png", (0, 0, 236, 120), 4)
crop("screenshot", "r-sidebar-bottom.png", (0, 740, 236, 879), 4)
crop("screenshot", "r-bottom.png", (236, 780, 1236, 879), 4)
crop("screenshot", "r-nav-active.png", (0, 96, 236, 160), 4)
# ── Music
crop("music", "m-hero.png", (240, 100, 1236, 200), 3)
crop("music", "m-toolbar.png", (250, 195, 1236, 250), 4)
crop("music", "m-player-left.png", (255, 250, 780, 480), 3)
crop("music", "m-player-right.png", (780, 250, 1236, 480), 3)
crop("music", "m-progress.png", (255, 330, 1000, 400), 3)
crop("music", "m-transport.png", (500, 400, 780, 470), 4)
crop("music", "m-queue-head.png", (255, 480, 1236, 520), 4)
crop("music", "m-queue-rows.png", (255, 500, 1236, 630), 3)
crop("music", "m-queue-row1.png", (255, 505, 1236, 560), 4)
crop("music", "m-queue-input.png", (255, 615, 1236, 675), 4)
crop("music", "m-bottom.png", (255, 680, 1236, 830), 3)
crop("music", "m-bottom-left.png", (255, 685, 800, 825), 4)
# ── Onboarding
crop("onboarding", "o-left-top.png", (250, 195, 870, 430), 3)
crop("onboarding", "o-left-bottom.png", (250, 420, 870, 640), 3)
crop("onboarding", "o-right.png", (855, 195, 1236, 550), 3)
crop("onboarding", "o-local.png", (250, 640, 1236, 830), 3)
# ── Rewards list
crop("rewards-list", "rl-seg.png", (560, 200, 1000, 250), 4)
crop("rewards-list", "rl-row1.png", (255, 310, 1236, 420), 3)
crop("rewards-list", "rl-row1-right.png", (980, 310, 1236, 420), 4)
# ── OBS modal
crop("obs", "obs-modal-top.png", (250, 100, 760, 290), 3)
crop("obs", "obs-modal-bottom.png", (250, 280, 760, 510), 3)
crop("obs", "obs-modal-corner.png", (255, 105, 340, 180), 6)
crop("obs", "obs-bg-behind.png", (760, 500, 1236, 700), 3)
