from PIL import Image
d = r"C:\Users\mur\Documents\deepseek-harness\default-workspace\.tmp\rs-review"
im6 = Image.open(f"{d}\\06-editor.png").convert("RGB"); p6 = im6.load()
im5 = Image.open(f"{d}\\05-rewards-top.png").convert("RGB"); p5 = im5.load()

def region_stats(px, x0, y0, x1, y1):
    from collections import Counter
    c = Counter()
    for y in range(y0, y1):
        for x in range(x0, x1):
            c[px[x, y]] += 1
    return c.most_common(3)

print("06 editor 'Создать' region (780..866, 634..666):", region_stats(p6, 780, 634, 866, 666))
print("06 editor 'Отмена' region (690..770, 634..666):", region_stats(p6, 690, 634, 770, 666))
print("06 top 'Создать награду' region (1060..1210, 143..178):", region_stats(p6, 1060, 143, 1210, 178))
print("05 top 'Создать награду' region (1060..1210, 143..178):", region_stats(p5, 1060, 143, 1210, 178))
print("06 name field region (347..880, 330..355):", region_stats(p6, 347, 330, 880, 355))
print("06 window fill sample (400,500):", p6[400, 500], " page bg (300,600):", p6[300, 600])
