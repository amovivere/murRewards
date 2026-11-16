# -*- coding: utf-8 -*-
import pathlib
from PIL import Image, ImageDraw, ImageFont

WS = pathlib.Path(r"C:\Users\mur\Documents\deepseek-harness\default-workspace")
SRC = WS / ".tmp" / "rs-review"
OUT = SRC / "mockups"
FONTS = WS / "reward-sounds" / "assets" / "fonts"
BG = (10, 10, 10)
TEXT = (245, 245, 245)
DIM = (139, 139, 139)
GREEN = (34, 197, 94)
BORDER = (39, 39, 39)

font_semi_20 = ImageFont.truetype(str(FONTS / "Inter-SemiBold.ttf"), 26)
font_semi_14 = ImageFont.truetype(str(FONTS / "Inter-SemiBold.ttf"), 19)
font_reg_12 = ImageFont.truetype(str(FONTS / "Inter-Regular.ttf"), 16)


def rounded(img, radius=14):
    w, h = img.size
    mask = Image.new("L", (w, h), 0)
    d = ImageDraw.Draw(mask)
    d.rounded_rectangle([0, 0, w - 1, h - 1], radius=radius, fill=255)
    out = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    out.paste(img.convert("RGBA"), (0, 0), mask)
    return out


def compose(before_path, after_path, out_path, before_label, after_label, caption):
    before = Image.open(before_path)
    after = Image.open(after_path)
    target_h = 840
    bw = round(before.width * target_h / before.height)
    before = before.resize((bw, target_h), Image.LANCZOS)
    aw = after.width
    if after.height != target_h:
        aw = round(after.width * target_h / after.height)
        after = after.resize((aw, target_h), Image.LANCZOS)

    margin, gap, label_h, caption_h = 44, 26, 86, 64
    W = margin * 2 + bw + gap + aw
    H = margin + label_h + target_h + caption_h
    canvas = Image.new("RGB", (W, H), BG)
    d = ImageDraw.Draw(canvas)

    x1 = margin
    x2 = margin + bw + gap
    y_img = margin + label_h

    b = rounded(before)
    a = rounded(after)
    canvas.paste(b, (x1, y_img), b)
    canvas.paste(a, (x2, y_img), a)
    d.rounded_rectangle([x1, y_img, x1 + bw - 1, y_img + target_h - 1], radius=14, outline=BORDER, width=1)
    d.rounded_rectangle([x2, y_img, x2 + aw - 1, y_img + target_h - 1], radius=14, outline=GREEN, width=2)

    d.text((x1, margin + 8), "СЕЙЧАС", font=font_reg_12, fill=DIM)
    d.text((x1, margin + 32), before_label, font=font_semi_20, fill=TEXT)
    d.text((x2, margin + 8), "ПРЕДЛАГАЮ", font=font_reg_12, fill=GREEN)
    d.text((x2, margin + 32), after_label, font=font_semi_20, fill=TEXT)
    d.text((margin, y_img + target_h + 18), caption, font=font_reg_12, fill=DIM)
    canvas.save(out_path, quality=95)
    print("saved", out_path, canvas.size)


compose(SRC / "16-check-rewards.png", OUT / "mockup-01-rewards.png", OUT / "before-after-rewards.png",
        "Награды — 6 карточек, 1.6.2", "Награды — предложение (1 строка действий + фильтры)",
        "Слева: реальный интерфейс 1.6.2 (скриншот 1236×879). Справа: предложение в той же теме и размере 1220×840.")
compose(SRC / "17-check-music.png", OUT / "mockup-02-music.png", OUT / "before-after-music.png",
        "Музыка — 1.6.2", "Музыка — предложение (очередь, ручная ссылка, OBS)",
        "Слева: реальный интерфейс 1.6.2. Справа: предложение — статусы очереди, ручная ссылка, предпросмотр оверлея.")