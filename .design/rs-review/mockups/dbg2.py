p = r"C:\Users\mur\Documents\deepseek-harness\default-workspace\.tmp\rs-review\mockups\build.py"
src = open(p, encoding="utf-8").read()
lines = src.splitlines()
for i in range(118, 132):
    print(i+1, repr(lines[i]))
print("---")
import ast
try:
    ast.parse(src)
    print("parse ok")
except SyntaxError as e:
    print("syntax:", e.lineno, e.offset, e.msg)
    for i in range(max(0, e.lineno-4), min(len(lines), e.lineno+2)):
        print(i+1, repr(lines[i]))
