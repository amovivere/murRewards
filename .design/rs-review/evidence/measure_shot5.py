from PIL import Image
d = r"C:\Users\mur\Documents\deepseek-harness\default-workspace\.tmp\rs-review"
for name in ["32-user-min-rewards.png", "26-probe-min-size-rewards.png"]:
    im = Image.open(f"{d}\\{name}").convert("RGB")
    p = im.load(); w, h = im.size
    print("==", name, w, h)

    def runs_exact(y, color, tol=1, minlen=30):
        out, start = [], None
        for x in range(0, w):
            c = p[x, y]
            on = all(abs(c[i] - color[i]) <= tol for i in range(3))
            if on and start is None:
                start = x
            elif not on and start is not None:
                if x - start >= minlen:
                    out.append((start, x - 1))
                start = None
        if start is not None and w - start >= minlen:
            out.append((start, w - 1))
        return out

    for y in (250, 300, 350):
        print(f"  #141414 runs y={y}:", runs_exact(y, (20, 20, 20)))
    # grid card fill is tinted, detect non-bg between y 360..690 by columns
    for y in (400, 450, 550, 650):
        seg = []
        for x in range(236, w):
            c = p[x, y]
            on = c != (10, 10, 10) and c != (14, 14, 14)
            if on:
                seg.append(x)
        print(f"  non-bg span y={y}:", (seg[0], seg[-1]) if seg else None)
