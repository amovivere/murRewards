import sys
sys.path.insert(0, r"F:\WorkSpaces\Mur rewards\.design\figcraft\_build")
import fc
from fc import Doc, Kit, solid, stroke, gradient, C, shadow

d = Doc("test-open")
k = Kit(d)
col = d.collection("Theme")
d.variable(col, "accent/primary", "color", "#8B00FF")
d.variable(col, "radius/md", "number", 10)
d.color_style("Accent/Primary", "#8B00FF")
d.color_style("Bg/Canvas", "#0A0A0A")

p = d.page("Page Test", "#070708")
fr = d.frame(p, "Frame", 100, 100, 600, 300, fill=solid(solid="#0A0A0A") if False else solid("#0A0A0A"), radius=14, stroke_color="#FFFFFF1F")
d.text(fr, "Title", 24, 20, 540, "Reward Sounds — тест", size=28, weight=600)
d.text(fr, "Sub", 24, 66, 540, "Создайте награду, привяжите звук и проверьте его на стриме.", size=14, color="#8B8B8B")
k.button(fr, 24, 110, "Создать награду", "primary")
k.button(fr, 200, 110, "Отмена", "secondary")
k.button(fr, 300, 110, "Убрать", "danger-ghost")
k.button(fr, 400, 110, "Остановить всё", "ghost")
d.rect(fr, "Accent bar", 24, 180, 120, 6, solid("#8B00FF"), radius=3)
d.frame(fr, "Gradient", 160, 180, 200, 60, fill=gradient(["#8B00FF", "#00C8FF"]), radius=10)
d.line(fr, "Divider", 24, 260, 540, "#FFFFFF", 0.1)
k.pill(fr, 24, 270, "Со звуком 9", color="#C9A7FF", bg="#8B00FF24", border="#8B00FF59")

path = r"F:\WorkSpaces\Mur rewards\.design\figcraft\_build\test-open.figcraft"
d.save(path)
print("saved", path, "nodes", len(d.nodes))
