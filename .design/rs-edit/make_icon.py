from PIL import Image, ImageDraw, ImageFont
import pathlib
out = pathlib.Path(r"C:\Users\mur\Documents\deepseek-harness\default-workspace\reward-sounds-tauri\src-tauri\icons")
img = Image.new("RGBA",(256,256),(10,10,10,255))
d = ImageDraw.Draw(img)
d.rounded_rectangle([16,16,240,240], radius=54, fill=(20,20,20,255), outline=(60,60,60,255), width=3)
try:
    font = ImageFont.truetype(r"C:\Users\mur\Documents\deepseek-harness\default-workspace\reward-sounds\assets\fonts\Inter-SemiBold.ttf", 150)
except Exception:
    font = ImageFont.load_default()
bbox = d.textbbox((0,0),"R",font=font)
w=bbox[2]-bbox[0]; h=bbox[3]-bbox[1]
d.text(((256-w)/2, (256-h)/2-18+bbox[1] if False else (256-h)/2-20), "R", font=font, fill=(237,237,237,255))
img.save(out/"icon.png")
img.save(out/"icon.ico", sizes=[(256,256),(128,128),(64,64),(48,48),(32,32),(16,16)])
print("icon done")