from PIL import Image
d = r"C:\Users\mur\Documents\deepseek-harness\default-workspace\.tmp\rs-review"
for name in ["20-probe-rewards-disconnected.png", "05-rewards-top.png"]:
    im = Image.open(f"{d}\\{name}").convert("RGB")
    px = im.load()
    BG = (10, 10, 10)
    print("==", name)
    for (y0, y1, x0, x1, label) in [(120, 168, 240, 500, "heading"), (168, 200, 240, 560, "subtitle")]:
        xs, ys = [], []
        for y in range(y0, y1):
            for x in range(x0, x1):
                c = px[x, y]
                if sum(abs(c[i]-BG[i]) for i in range(3)) > 60:
                    xs.append(x); ys.append(y)
        print(" ", label, (min(xs), min(ys), max(xs), max(ys)) if xs else None)
