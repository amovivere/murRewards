import zipfile, json, os
b = r"F:\WorkSpaces\Mur rewards\.design\figcraft\_build"
src = os.path.join(b, "probe.figcraft")
with zipfile.ZipFile(src) as z:
    print("entries:", z.namelist())
    for n in z.namelist():
        if n.endswith(".json"):
            data = json.loads(z.read(n))
            print("----", n, "keys:", list(data.keys())[:12] if isinstance(data, dict) else type(data))
            out = os.path.join(b, "probe_" + os.path.basename(n))
            json.dump(data, open(out, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
