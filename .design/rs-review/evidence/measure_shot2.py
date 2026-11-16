from PIL import Image

d = r"C:\Users\mur\Documents\deepseek-harness\default-workspace\.tmp\rs-review"
im = Image.open(f"{d}\\05-rewards-top.png").convert("RGB")
w, h = im.size
px = im.load()
BG = (10, 10, 10)

def runs_on_row(y, x0, x1, tol=3):
    runs = []
    start = None
    for x in range(x0, x1):
        c = px[x, y]
        on = (abs(c[0]-BG[0]) + abs(c[1]-BG[1]) + abs(c[2]-BG[2])) > tol
        if on and start is None:
            start = x
        elif not on and start is not None:
            runs.append((start, x - 1, x - start))
            start = None
    if start is not None:
        runs.append((start, x1 - 1, x1 - start))
    return runs

for y in (150, 155, 160, 168):
    print("y=", y, "runs:", runs_on_row(y, 400, 1215))

# subtitle bbox
xs, ys = [], []
for y in range(168, 200):
    for x in range(250, 700):
        c = px[x, y]
        if sum(abs(c[i]-BG[i]) for i in range(3)) > 60:
            xs.append(x); ys.append(y)
print("subtitle-ish bbox:", (min(xs), min(ys), max(xs), max(ys)) if xs else None)

# heading bbox
xs, ys = [], []
for y in range(110, 168):
    for x in range(250, 500):
        c = px[x, y]
        if c[0] > 150:
            xs.append(x); ys.append(y)
print("heading bbox:", (min(xs), min(ys), max(xs), max(ys)) if xs else None)
