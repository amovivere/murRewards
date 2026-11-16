from PIL import ImageFont

fonts = r"C:\Users\mur\Documents\deepseek-harness\default-workspace\reward-sounds\assets\fonts"
def f(px, semi=False):
    name = "Inter-SemiBold.ttf" if semi else "Inter-Regular.ttf"
    return ImageFont.truetype(rf"{fonts}\{name}", px)

def w(font, text):
    return round(font.getlength(text), 1)

print("grid card volume row at min window 980 (column content width ~194):")
label = w(f(9.0), "ГРОМКОСТЬ")
slider = 100.0
pct = w(f(10.8), "200%")
print(f"  label(9px)={label} slider={slider} pct(10.8px)={pct} spacings=18 -> total {label + slider + pct + 18}")

print("\ngrid card buttons row:")
replace = w(f(15.0), "Заменить") + 34
remove = w(f(13.8), "Убрать")  # ghost frame(false): no padding
print(f"  'Заменить' btn={replace} 'Убрать' ghost={remove} total~{replace + remove + 9}")

print("\nlist card right cluster at 980 (card content width ~660):")
title45 = w(f(19.2, True), "Очень длинное название награды для стримера!")
print(f"  title(45 chars, 19.2 semibold)={title45}")
print(f"  menu ~ text('...')+2*14 =", w(f(16.0), "···") + 28)
print(f"  'Заменить звук' btn=", w(f(15.0), "Заменить звук") + 34, " 'Убрать' ghost=", w(f(13.8), "Убрать"))
print(f"  sum ~ {title45 + 46 + w(f(15.0),'Заменить звук')+34 + w(f(13.8),'Убрать') + 9*4}")

print("\nmisc:")
print("  'Остановить все звуки' (15px)+34 =", w(f(15.0), "Остановить все звуки") + 34)
print("  'Выровнять громкость звуков'+34 =", w(f(15.0), "Выровнять громкость звуков") + 34)
print("  header 'Слушаем награды' 13.2 =", w(f(13.2), "Слушаем награды"))
print("  footer typical error len 120 chars at 13.2 =", w(f(13.2), "x" * 120))
