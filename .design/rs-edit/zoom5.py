from PIL import Image
import pathlib
base = pathlib.Path(r"C:\Users\mur\Documents\deepseek-harness\default-workspace\.tmp\rs-review")
out = base / "zoom5"; out.mkdir(exist_ok=True)
img = Image.open(base/"v18b"/"rewards.png")
for name, box in {"chips":(255,265,865,305),"toolbar":(200,205,980,255),"buttons":(268,480,600,530),"account":(1080,45,1225,85)}.items():
    c=img.crop(box); c=c.resize((c.width*4,c.height*4), Image.NEAREST); c.save(out/(name+".png"))
mus = Image.open(base/"v18b"/"music.png")
for name, box in {"input":(268,690,960,725),"queue":(268,445,1215,700),"vol":(990,285,1085,330)}.items():
    c=mus.crop(box); c=c.resize((c.width*3,c.height*3), Image.NEAREST); c.save(out/(name+".png"))
print("zoom saved")