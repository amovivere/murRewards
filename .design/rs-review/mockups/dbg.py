p = r"C:\Users\mur\Documents\deepseek-harness\default-workspace\.tmp\rs-review\mockups\build.py"
lines = open(p, encoding="utf-8").read().splitlines()
for i in range(128, 146):
    print(i+1, repr(lines[i]))
