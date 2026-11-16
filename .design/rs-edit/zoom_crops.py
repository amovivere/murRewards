from PIL import Image
import pathlib
d = pathlib.Path(r"C:\Users\mur\Documents\deepseek-harness\default-workspace\.tmp\rs-review\zoom")
d.mkdir(parents=True, exist_ok=True)
img = Image.open(r"C:\Users\mur\Documents\deepseek-harness\default-workspace\reward-sounds\docs\screenshot.png")
crops = {
  "btn-zamenit": (270, 430, 470, 485),
  "btn-obnovit": (760, 200, 890, 250),
  "chip": (255, 200, 700, 250),
  "sound-chip": (270, 375, 600, 425),
  "topbar": (240, 40, 1230, 90),
}
for name, box in crops.items():
    c = img.crop(box)
    c = c.resize((c.width*4, c.height*4), Image.NEAREST)
    c.save(d / (name + ".png"))
img2 = Image.open(r"C:\Users\mur\Documents\deepseek-harness\default-workspace\reward-sounds\docs\music.png")
for name, box in {
  "music-player": (250, 300, 1210, 600),
  "music-controls": (500, 520, 680, 580),
  "music-queue": (250, 600, 1210, 830),
  "music-toggle": (250, 200, 400, 245),
}.items():
    c = img2.crop(box)
    c = c.resize((c.width*3, c.height*3), Image.NEAREST)
    c.save(d / (name + ".png"))
print("saved")