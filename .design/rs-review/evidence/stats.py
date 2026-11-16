import re, collections

with open(r"C:\Users\mur\Documents\deepseek-harness\default-workspace\reward-sounds\src\app.rs", encoding="utf-8") as f:
    src = f.read()

sizes = collections.Counter(re.findall(r"\.size\(([0-9]+(?:\.[0-9]+)?)\)", src))
print("font sizes used in app.rs (size -> count):")
for k, v in sorted(sizes.items(), key=lambda kv: float(kv[0])):
    print(f"  {k:>5} : {v}")
print("distinct sizes:", len(sizes))

alphas = collections.Counter(re.findall(r"with_alpha\(([A-Z_]+),\s*([0-9]+)\)", src))
print("\nwith_alpha usages:")
for (c, a), v in sorted(alphas.items(), key=lambda kv: (kv[0][0], int(kv[0][1]))):
    print(f"  {c} alpha {a}: {v}")

print("\nsize>='line count' for labels with explicit sizes:", sum(1 for _ in re.finditer(r"\.size\(", src)))
