from PIL import Image
import pathlib
src = pathlib.Path(r"C:\Users\mur\Documents\deepseek-harness\default-workspace\.tmp\rs-review\v17d")
d = pathlib.Path(r"C:\Users\mur\Documents\deepseek-harness\default-workspace\.tmp\rs-review\zoom2")
d.mkdir(exist_ok=True)
img = Image.open(src / "rewards.png")
for name, box in {
  "play-icon": (278, 385, 340, 420),
  "refresh-icon": (938, 205, 990, 250),
  "sort": (895, 200, 1060, 250),
  "dots": (520, 330, 560, 360),
  "chip": (255, 265, 480, 310),
  "stop": (985, 205, 1150, 250),
}.items():
    c = img.crop(box); c = c.resize((c.width*6, c.height*6), Image.NEAREST); c.save(d/(name+".png"))
mus = Image.open(src / "music.png")
for name, box in {
  "m-play-pause": (545, 455, 655, 505),
  "m-volume": (960, 300, 1080, 350),
  "m-next": (995, 390, 1080, 430),
  "m-chip": (425, 620, 580, 650),
  "m-queue-arrow": (1125, 650, 1180, 700),
}.items():
    c = mus.crop(box); c = c.resize((c.width*6, c.height*6), Image.NEAREST); c.save(d/(name+".png"))
print("saved")