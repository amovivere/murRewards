from PIL import Image
img = Image.open(r"C:\Users\mur\Documents\deepseek-harness\default-workspace\.tmp\rs-review\mockups\mockup-02-music.png").convert("RGB")
w,h = img.size
for x in [600, 700, 1500]:
    runs=[]; inside=False; start=0
    for y in range(150, 1650):
        r,g,b = img.getpixel((x,y))
        bright = (r+g+b) > 45
        if bright and not inside: inside=True; start=y
        if not bright and inside: inside=False; runs.append((start,y-1))
    if inside: runs.append((start,1649))
    print(x, [(a/2,b/2) for a,b in runs if b-a > 20][:10])