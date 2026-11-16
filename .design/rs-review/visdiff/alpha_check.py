# -*- coding: utf-8 -*-
from PIL import Image
from collections import Counter
import pathlib, struct

p = pathlib.Path(r"C:\Users\mur\Documents\deepseek-harness\default-workspace\reward-sounds\docs")
for name in ["screenshot", "music", "onboarding", "obs", "rewards-list"]:
    im = Image.open(p / (name + ".png"))
    a = im.getchannel("A")
    c = Counter(a.getdata())
    print(name, im.mode, "alpha extrema:", a.getextrema(), "top:", c.most_common(5))
    if name == "screenshot":
        for xy in [(300, 400), (1150, 65), (290, 600)]:
            print("  ", xy, "RGBA=", im.getpixel(xy))
    if name == "music":
        for xy in [(300, 300), (1000, 300), (1200, 300)]:
            print("  ", xy, "RGBA=", im.getpixel(xy))
    print()

print("---- PNG chunks ----")
for n in ["screenshot", "music"]:
    data = (p / (n + ".png")).read_bytes()
    i = 8
    chunks = []
    while i < len(data):
        ln = struct.unpack(">I", data[i:i + 4])[0]
        typ = data[i + 4:i + 8].decode("latin1")
        chunks.append((typ, ln))
        i += 12 + ln
        if typ == "IEND":
            break
    print(n, chunks)
