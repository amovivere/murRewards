import zipfile, json, os
src = r"F:\WorkSpaces\Mur rewards\.design\figcraft\designs\reward-sounds.figcraft"
out = r"F:\WorkSpaces\Mur rewards\.design\figcraft\_build"
with zipfile.ZipFile(src) as z:
    print("entries:", z.namelist())
    for n in z.namelist():
        if n.endswith(".json"):
            data = z.read(n)
            open(os.path.join(out, os.path.basename(n)), "wb").write(data)
            print(n, len(data))
s = open(os.path.join(out,"document.json"), encoding="utf-8").read()
print(s[:7000])
