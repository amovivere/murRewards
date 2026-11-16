from PIL import Image
img=Image.open(r"D:\reward-sounds\tauri-proto\hover-winbtn.png")
c=img.crop((1050,0,1236,50)); c=c.resize((c.width*4,c.height*4), Image.NEAREST); c.save(r"D:\reward-sounds\tauri-proto\winbtns.png")
print(img.size)