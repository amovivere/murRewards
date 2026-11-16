p = r"C:\Users\mur\Documents\deepseek-harness\default-workspace\.tmp\rs-review\mockups\build.py"
lines = open(p, encoding="utf-8").read().splitlines()
for idx in [139, 140]:
    line = lines[idx]
    print("LINE", idx+1, "len", len(line))
    for i, ch in enumerate(line):
        if ord(ch) > 126 or ch in "'\"":
            print("  pos", i, "char", repr(ch), "ord", ord(ch))
