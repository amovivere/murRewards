import zipfile, json, os
b = r"F:\WorkSpaces\Mur rewards\.design\figcraft\_build"
with zipfile.ZipFile(os.path.join(b, "probe2.figcraft")) as z:
    doc = json.loads(z.read("document.json"))
open(os.path.join(b, "probe2_doc.json"), "w", encoding="utf-8").write(json.dumps(doc, ensure_ascii=False, indent=1))
for nid in ["6","7","8","9","10","11","12","13","14","15","16"]:
    n = doc["nodes"].get(nid)
    if n: print("NODE", nid, json.dumps(n, ensure_ascii=False)[:900]); print()
print("next_id", doc.get("next_id"))
