import pathlib, json
p=pathlib.Path(r"C:\Users\mur\Documents\deepseek-harness\default-workspace\.tmp\tauri-probe\tauri.conf.json")
conf={"$schema":"https://schema.tauri.app/config/2","productName":"Probe","version":"0.1.0","identifier":"com.probe.test","build":{"frontendDist":"ui"},"app":{"windows":[{"title":"Probe","width":600,"height":400}],"security":{"csp":None}},"bundle":{"active":False,"icon":[]}}
p.write_text(json.dumps(conf,ensure_ascii=False,indent=2),encoding="utf-8")
pathlib.Path(r"C:\Users\mur\Documents\deepseek-harness\default-workspace\.tmp\tauri-probe\ui\index.html").write_text("<!doctype html><html><body style='background:#111;color:#fff'>probe</body></html>",encoding="utf-8")
print("fixed")