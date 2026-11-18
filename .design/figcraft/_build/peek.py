p = r"F:\WorkSpaces\Mur rewards\.design\figcraft\_build\ui.py"
s = open(p, encoding="utf-8").read()
i = s.find("        label_w = measure(label, fs, sp[\"weight\"])")
print(s[i:i+1400])
