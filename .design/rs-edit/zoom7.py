from PIL import Image
import pathlib
base = pathlib.Path(r"C:\Users\mur\Documents\deepseek-harness\default-workspace\.tmp\rs-review")
out = base / "zoom7"; out.mkdir(exist_ok=True)
img = Image.open(base/"v18f"/"rewards.png")
for name, box in {"btn":(268,480,430,540),"chips":(255,265,865,305),"account":(1090,48,1222,82)}.items():
    c=img.crop(box); c=c.resize((c.width*6,c.height*6), Image.NEAREST); c.save(out/(name+".png"))
mus=Image.open(base/"v18f"/"music.png")
for name, box in {"player":(255,245,1225,425),"queue":(255,425,1225,670),"bottom":(255,675,1225,830)}.items():
    c=mus.crop(box); c=c.resize((int(c.width*1.2),int(c.height*1.2)), Image.LANCZOS); c.save(out/(name+".png"))
print("ok")