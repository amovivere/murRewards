from PIL import Image

d = r"C:\Users\mur\Documents\deepseek-harness\default-workspace\.tmp\rs-review"
for name in ["05-rewards-top.png", "20-probe-rewards-disconnected.png"]:
    im = Image.open(f"{d}\\{name}").convert("RGB")
    w, h = im.size
    px = im.load()
    print(f"== {name} {w}x{h}")

    def bbox(x0, y0, x1, y1, pred):
        xs, ys = [], []
        for y in range(y0, min(y1, h)):
            for x in range(x0, min(x1, w)):
                if pred(px[x, y]):
                    xs.append(x); ys.append(y)
        if not xs:
            return None
        return (min(xs), min(ys), max(xs), max(ys))

    bright = lambda c: c[0] > 180 and c[1] > 180 and c[2] > 180
    # heading area under header
    print(" heading bbox:", bbox(240, 100, 700, 185, bright))
    # button row area right side
    print(" buttons bbox:", bbox(420, 135, w - 10, 185, lambda c: max(c) > 40 and abs(c[0]-c[1]) < 20 and abs(c[1]-c[2]) < 20))
    # sidebar boundary: find where x has panel color 0x0E at y=500
    row = [px[x, 500] for x in range(0, 320)]
    boundary = None
    for x in range(1, 320):
        if row[x] != row[x-1]:
            boundary = x
    print(" first color change on y=500:", [(x, row[x-1], row[x]) for x in range(1, 320) if row[x] != row[x-1]][:4])
    # sample text pixel colors
    print(" sample colors:", px[300, 140], px[330, 150], px[700, 155])
