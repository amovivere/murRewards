from PIL import Image
import pathlib
base = pathlib.Path(r"C:\Users\mur\Documents\deepseek-harness\default-workspace\.tmp\rs-review")
out = base / "zoom4"; out.mkdir(exist_ok=True)
for tag in ["v17h", "v18a"]:
    img = Image.open(base / tag / "rewards.png")
    c = img.crop((255, 265, 865, 305)); c = c.resize((c.width*4, c.height*4), Image.NEAREST); c.save(out / f"chips-{tag}.png")
    c = img.crop((200, 205, 980, 255)); c = c.resize((c.width*4, c.height*4), Image.NEAREST); c.save(out / f"toolbar-{tag}.png")
    c = img.crop((268, 480, 600, 530)); c = c.resize((c.width*6, c.height*6), Image.NEAREST); c.save(out / f"buttons-{tag}.png")
mus = Image.open(base / "v18a" / "music.png")
for name, box in {"placeholder":(268,695,960,720), "prefetch":(268,700,700,720), "player-volume":(990,285,1085,330)}.items():
    c = mus.crop(box); c=c.resize((c.width*4,c.height*4), Image.NEAREST); c.save(out/(name+".png"))
print("saved")