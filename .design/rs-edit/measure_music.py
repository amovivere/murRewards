from PIL import Image
img = Image.open(r"C:\Users\mur\Documents\deepseek-harness\default-workspace\.tmp\rs-review\v18c\music.png").convert("RGB")
for x in [300, 258, 900]:
    runs=[]; inside=False; start=0
    for y in range(100, 850):
        r,g,b = img.getpixel((x,y))
        bright = (r+g+b) > 45
        if bright and not inside: inside=True; start=y
        if not bright and inside: inside=False; runs.append((start,y-1))
    if inside: runs.append((start,849))
    print(x, [run for run in runs if run[1]-run[0] > 8][:12])