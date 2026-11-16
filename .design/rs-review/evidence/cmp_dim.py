from PIL import Image
d = r"C:\Users\mur\Documents\deepseek-harness\default-workspace\.tmp\rs-review"
a = Image.open(f"{d}\\05-rewards-top.png").convert("RGB").load()
b = Image.open(f"{d}\\06-editor.png").convert("RGB").load()
pts = [(300, 300), (300, 700), (1000, 300), (1000, 800), (600, 100), (800, 250), (500, 700)]
for p in pts:
    print(p, "05:", a[p], "06:", b[p])
