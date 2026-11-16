import base64, subprocess, pathlib
root = pathlib.Path(r"C:\Users\mur\Documents\deepseek-harness\default-workspace\reward-sounds\assets\fonts")
outdir = pathlib.Path(r"C:\Users\mur\Documents\deepseek-harness\default-workspace\.tmp\rs-review\mockups")
reg = base64.b64encode((root / "Inter-Regular.ttf").read_bytes()).decode()
semi = base64.b64encode((root / "Inter-SemiBold.ttf").read_bytes()).decode()
html = """<!doctype html><html><head><meta charset="utf-8"><style>
@font-face { font-family: 'InterMock'; src: url(data:font/ttf;base64,__REG__) format('truetype'); font-weight: 400; }
@font-face { font-family: 'InterMock'; src: url(data:font/ttf;base64,__SEMI__) format('truetype'); font-weight: 600; }
html,body { margin:0; padding:0; background:#0A0A0A; color:#F5F5F5; font-family: 'InterMock'; }
.box { width: 1220px; height: 840px; display:flex; align-items:center; justify-content:center; font-size:40px; font-weight:600; }
</style></head><body><div class="box">Reward Sounds — тест шрифта</div></body></html>"""
html = html.replace("__REG__", reg).replace("__SEMI__", semi)
p = outdir / "font_test.html"
p.write_text(html, encoding="utf-8")
chrome = r"C:\Program Files\Google\Chrome\Application\chrome.exe"
out = outdir / "font_test.png"
subprocess.run([chrome, "--headless=new", "--disable-gpu", "--hide-scrollbars",
                "--force-device-scale-factor=1", "--window-size=1220,840",
                f"--screenshot={out}", p.as_uri()], check=True, capture_output=True)
print("saved", out, out.exists(), out.stat().st_size if out.exists() else 0)