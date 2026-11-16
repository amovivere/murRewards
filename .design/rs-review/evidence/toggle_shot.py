from PIL import Image
d = r"C:\Users\mur\Documents\deepseek-harness\default-workspace\.tmp\rs-review"
im = Image.open(f"{d}\\02-settings-top.png").convert("RGB")
p = im.load()
# detect toggle pills: rows where x 275..325 are mostly non-background (track/knob)
active_rows = []
for y in range(500, 660):
    xs = [x for x in range(275, 326) if p[x, y][0] > 30]
    if len(xs) > 25:
        active_rows.append((y, xs[0], xs[-1]))
# group contiguous
groups = []
cur = []
for r in active_rows:
    if cur and r[0] - cur[-1][0] > 1:
        groups.append(cur); cur = []
    cur.append(r)
if cur: groups.append(cur)
for g in groups:
    ys = [r[0] for r in g]
    ymid = (ys[0] + ys[-1]) // 2
    # sample track at left edge+6 and knob expected right side
    print("group y", ys[0], "-", ys[-1], "samples:", p[283, ymid], p[295, ymid], p[307, ymid], p[317, ymid])
