p = r"C:\Users\mur\Documents\deepseek-harness\default-workspace\.tmp\rs-review\mockups\build.py"
lines = open(p, encoding="utf-8").read().splitlines()
for idx in [133, 136, 137, 138, 139, 140, 141, 142, 143, 144]:
    line = lines[idx]
    try:
        compile(line, "<line>", "exec")
        print(idx+1, "OK", len(line))
    except SyntaxError as e:
        print(idx+1, "FAIL", e.msg, e.offset, repr(line[-30:]))
