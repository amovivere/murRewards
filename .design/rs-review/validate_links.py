# -*- coding: utf-8 -*-
import pathlib, re, sys
root = pathlib.Path(r"C:\Users\mur\Documents\deepseek-harness\default-workspace\reward-sounds-audit")
bad = []
for md in [root / "ОТЧЁТ.md", root / "README.md"]:
    text = md.read_text(encoding="utf-8")
    links = re.findall(r"\]\(([^)]+)\)", text)
    print(md.name, "links:", len(links))
    for link in links:
        link = link.strip()
        if link.startswith("http") or link.startswith("#") or link.startswith("<mailto"):
            continue
        target = (md.parent / link).resolve()
        if not target.exists():
            bad.append((md.name, link))
            print("  MISSING:", link)
print("bad:", bad)
# проверим, что все изображения из screens/ упомянуты
report = (root / "ОТЧЁТ.md").read_text(encoding="utf-8")
for sub in ["screens", "mockups"]:
    files = sorted(p.name for p in (root / sub).iterdir() if p.is_file() and p.suffix == ".png")
    for f in files:
        if f not in report:
            print("not referenced:", sub + "/" + f)