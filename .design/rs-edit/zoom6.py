from PIL import Image
import pathlib
base = pathlib.Path(r"C:\Users\mur\Documents\deepseek-harness\default-workspace\.tmp\rs-review")
out = base / "zoom6"; out.mkdir(exist_ok=True)
img = Image.open(base/"v18c"/"rewards.png")
for name, box in {"chips":(255,265,865,305),"buttons":(268,480,600,530),"account":(1080,45,1225,85)}.items():
    c=img.crop(box); c=c.resize((c.width*4,c.height*4), Image.NEAREST); c.save(out/(name+".png"))
mus=Image.open(base/"v18c"/"music.png")
for name, box in {"player":(255,240,1220,500),"queue":(255,480,1220,730),"bottom":(255,720,1220,840)}.items():
    c=mus.crop(box); c.save(out/(name+".png"))
print("saved")