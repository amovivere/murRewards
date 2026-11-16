from PIL import Image
import os
d = r"C:\Users\mur\Documents\deepseek-harness\default-workspace\.tmp\rs-review"
img = Image.open(os.path.join(d, "02-settings-top.png"))
for name, box in {
 "z-toggles-launch": (255, 170, 360, 325),
 "z-toggle-mute": (560, 545, 690, 600),
 "z-toggle-playback": (250, 595, 420, 645),
}.items():
    c = img.crop(box); c = c.resize((c.width*5, c.height*5), Image.NEAREST); c.save(os.path.join(d, name + ".png"))
img2 = Image.open(os.path.join(d, "14-settings-bottom2.png"))
c = img2.crop((560, 130, 690, 180)); c = c.resize((c.width*5, c.height*5), Image.NEAREST); c.save(os.path.join(d, "z-toggle-mute2.png"))
for name, box in {"z-toggle-playback2": (250, 175, 430, 230), "z-danger-buttons": (260, 215, 840, 300)}.items():
    c = img2.crop(box); c = c.resize((c.width*3, c.height*3), Image.NEAREST); c.save(os.path.join(d, name + ".png"))
print("done")
