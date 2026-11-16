from PIL import Image
d = r"C:\Users\mur\Documents\deepseek-harness\default-workspace\.tmp\rs-review"
im = Image.open(f"{d}\\05-rewards-top.png").convert("RGB")
px = im.load()
BG = (10, 10, 10)
for (y0, y1, x0, x1, label) in [(165, 200, 240, 540, "subtitle"), (115, 165, 240, 540, "heading")]:
    xs, ys = [], []
    for y in range(y0, y1):
        for x in range(x0, x1):
            c = px[x, y]
            if sum(abs(c[i]-BG[i]) for i in range(3)) > 60:
                xs.append(x); ys.append(y)
    print(label, (min(xs), min(ys), max(xs), max(ys)) if xs else None, "width", (max(xs)-min(xs)+1) if xs else None)
# status block text extents between 500 and 670 at rows 145..170
xs, ys = [], []
for y in range(140, 172):
    for x in range(495, 670):
        c = px[x, y]
        if sum(abs(c[i]-BG[i]) for i in range(3)) > 60:
            xs.append(x); ys.append(y)
print("status block", (min(xs), min(ys), max(xs), max(ys)) if xs else None)
