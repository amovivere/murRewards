from PIL import Image
import pathlib
src = pathlib.Path(r"C:\Users\mur\Documents\deepseek-harness\default-workspace\.tmp\rs-review\v17i")
d = pathlib.Path(r"C:\Users\mur\Documents\deepseek-harness\default-workspace\.tmp\rs-review\zoom3")
d.mkdir(exist_ok=True)
img = Image.open(src/"rewards.png")
for name, box in {"play":(278,388,338,420),"refresh":(940,210,985,250),"dots":(525,335,555,355),"btn":(270,480,385,530)}.items():
    c=img.crop(box); c=c.resize((c.width*8,c.height*8), Image.NEAREST); c.save(d/(name+".png"))
mus=Image.open(src/"music.png")
for name, box in {"obspreview":(270,790,790,830),"state":(800,740,1220,830)}.items():
    c=mus.crop(box); c=c.resize((c.width*3,c.height*3), Image.NEAREST); c.save(d/(name+".png"))
print("zoom saved")