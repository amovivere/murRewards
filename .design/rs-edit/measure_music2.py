from PIL import Image
img = Image.open(r"C:\Users\mur\Documents\deepseek-harness\default-workspace\.tmp\rs-review\v18f\music.png").convert("RGB")
for x in [700, 1100, 300]:
    runs=[]; inside=False; start=0
    for y in range(90, 850):
        r,g,b=img.getpixel((x,y))
        fill = (r+g+b) > 42
        if fill and not inside: inside=True; start=y
        if not fill and inside: inside=False; runs.append((start,y-1))
    if inside: runs.append((start,849))
    print(x,[(a,b) for a,b in runs if b-a>8][:14])