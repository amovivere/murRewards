from PIL import Image
import os
d = r"C:\Users\mur\Documents\deepseek-harness\default-workspace\.tmp\rs-review"
img = Image.open(os.path.join(d, "02-settings-top.png"))
# toggles area: three launch toggles + volume toggles
crops = {
 "z-toggles-launch": (255, 170, 360, 325),
 "z-toggle-mute": (560, 545, 690, 600),
 "z-toggle-playback": (250, 595, 420, 645),
}
for name, box in crops.items():
    c = img.crop(box)
    c = c.resize((c.width*5, c.height*5), Image.NEAREST)
    c.save(os.path.join(d, name + ".png"))
img2 = Image.open(os.path.join(d, "12-settings-bottom2.png"))
c = img2.crop((560, 385, 690, 435)); c = c.resize((c.width*5, c.height*5), Image.NEAREST); c.save(os.path.join(d, "z-toggle-mute2.png"))
c = img2.crop((250, 435, 420, 485)); c = c.resize((c.width*5, c.height*5), Image.NEAREST); c.save(os.path.join(d, "z-toggle-playback2.png"))
# color sampling
for name, (x,y) in {"toggle1_track":(315,193),"toggle1_knob_left":(283,193),"toggle1_knob_right":(327,193)}.items():
    print(name, img.getpixel((x,y)))
print("done")
