import re
p = r"F:\WorkSpaces\Mur rewards\.design\figcraft\_build\fc.py"
s = open(p, encoding="utf-8").read()
old = '''        lines, h = text_height(characters, w, size, weight,
                               lh_ratio=(line_height / size) if line_height else 1.2143,
                               tracking=tracking)
        chars = "\\n".join(lines)
        if auto_height:
            height = h
        else:
            height = max_height or h
'''
new = '''        single = "\\n" not in str(characters)
        lines, h = text_height(characters, w, size, weight,
                               lh_ratio=(line_height / size) if line_height else 1.2143,
                               tracking=tracking)
        if align in ("center", "right") and single:
            tw = measure(str(characters), size, weight)
            if align == "center":
                x = x + max(0, (w - tw) / 2.0)
            else:
                x = x + max(0, w - tw)
            w = tw
            lines = [str(characters)]
        chars = "\\n".join(lines)
        if auto_height:
            height = h
        else:
            height = max_height or h
'''
assert old in s
s = s.replace(old, new)
s = s.replace('''                "width": float(w), "height": float(height),
                "text_align": align,
                "fills": [solid(color)]}''',
'''                "width": float(w), "height": float(height),
                "fills": [solid(color)]}''')
open(p, "w", encoding="utf-8").write(s)
print("patched")
