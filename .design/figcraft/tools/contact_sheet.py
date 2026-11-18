from PIL import Image, ImageDraw, ImageFont
import os

base = r"F:\WorkSpaces\Mur rewards\.design\figcraft\out\screens"
out = r"F:\WorkSpaces\Mur rewards\.design\figcraft\out\overview-all-pages.png"
items = [
    ("00", "Обложка", "00-обложка-cover.png"),
    ("01", "Дизайн-система", "01-дизайн-система-палитра.png"),
    ("02", "Кнопки: матрица 162", "02-кнопки-матрица.png"),
    ("03", "Поля и контролы", "03-поля-и-ввод.png"),
    ("04", "Каркас приложения", "04-каркас-1220x840.png"),
    ("05", "Награды: плитка", "05-награды-плитка-1220x840.png"),
    ("06", "Музыка: сейчас играет", "06-музыка-сейчас-играет-1220x840.png"),
    ("07", "Чат: подключение", "07-чат-подключение-1220x840.png"),
    ("08", "Настройки", "08-настройки-1220x840.png"),
    ("09", "Журнал", "09-журнал-1220x840.png"),
    ("10", "Онбординг", "10-онбординг-1220x840.png"),
    ("11", "Модалка награды", "11-модалки-создание-награды.png"),
    ("12", "OBS: сейчас играет", "12-obs-сейчас-играет-стекло.png"),
    ("13", "Состояния и доступность", "13-состояния-элементов.png"),
    ("14", "Компоненты", "14-компоненты-инстансы.png"),
]


def font(size, bold=False):
    name = "seguisb.ttf" if bold else "segoeui.ttf"
    return ImageFont.truetype(os.path.join(r"C:\Windows\Fonts", name), size)


cols, cell_w, cell_h = 3, 620, 460
pad, top, label_h = 28, 96, 46
rows = (len(items) + cols - 1) // cols
W = pad * 2 + cols * cell_w + (cols - 1) * 18
H = top + rows * (cell_h + label_h) + pad
img = Image.new("RGB", (W, H), "#08080b")
d = ImageDraw.Draw(img)
d.text((pad, 26), "Reward Sounds — дизайн в FigCraft", font=font(34, True), fill="#ffffff")
d.text(
    (pad, 66),
    "14 страниц + библиотека компонентов · 64 фрейма · 162 состояния кнопок · 6 602 слоя",
    font=font(15),
    fill="#9a9aa6",
)
for index, (num, title, name) in enumerate(items):
    row, col = divmod(index, cols)
    x = pad + col * (cell_w + 18)
    y = top + row * (cell_h + label_h)
    d.text((x, y), f"{num} · {title}", font=font(16, True), fill="#e8e8ee")
    thumb_y = y + 24
    box = (x, thumb_y, x + cell_w, thumb_y + cell_h - 6)
    d.rounded_rectangle(box, radius=12, fill="#121218", outline="#26262f")
    path = os.path.join(base, name)
    if os.path.exists(path):
        im = Image.open(path).convert("RGB")
        im.thumbnail((cell_w - 16, cell_h - 22), Image.LANCZOS)
        img.paste(im, (x + (cell_w - im.width) // 2, thumb_y + (cell_h - 6 - im.height) // 2))
    else:
        d.text((x + 20, thumb_y + 20), "missing", font=font(14), fill="#f2555f")
img.save(out, "PNG")
print(out, img.size)
