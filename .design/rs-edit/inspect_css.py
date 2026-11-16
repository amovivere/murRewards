import re, pathlib
css=pathlib.Path(r"C:\Users\mur\Documents\deepseek-harness\default-workspace\.tmp\rs-edit\mockup.css").read_text(encoding="utf-8")
# вырезаем base64, чтобы удобно читать
css2=re.sub(r'url\(data:[^)]+\)','url(FONT)',css)
for sel in ['.app ', '.sidebar ', '.main ', '.titlebar', '.topbar', '.content ', '.footer', '.winbtn', '.page-head', '.grid', '.card ', '.slider ']:
    idx=css2.find(sel)
    print("=====",sel, idx)
    print(css2[idx:idx+700])