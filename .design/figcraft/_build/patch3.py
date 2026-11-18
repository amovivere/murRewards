p = r"F:\WorkSpaces\Mur rewards\.design\figcraft\_build\fc.py"
s = open(p, encoding="utf-8").read()
old = '''        nid = self.d.frame(parent, name or ("Btn/%s/%s/%s" % (variant, size, state)),
                           x, y, w, H,
                           fill=solid(("rgba" if False else "#")) if False else (solid(fill) if fill else None),
                           radius=H / 2,
                           stroke_color=border if border else None)
        # focus ring
        if state == "focus-visible":
            self.d.frame(parent, "Focus ring", x - 3, y - 3, w + 6, H + 6,
                         fill=None, radius=H / 2 + 3, stroke_color="#C9A7FF",
                         stroke_w=2)
            # re-add visual above ring: ring is drawn after button -> move? simpler: ring behind
'''
new = '''        if state == "focus-visible":
            self.d.frame(parent, "Focus ring", x - 3, y - 3, w + 6, H + 6,
                         fill=None, radius=H / 2 + 3, stroke_color="#C9A7FF",
                         stroke_w=2)
        nid = self.d.frame(parent, name or ("Btn/%s/%s/%s" % (variant, size, state)),
                           x, y, w, H,
                           fill=(solid(fill) if fill else None),
                           radius=H / 2,
                           stroke_color=border if border else None)
'''
assert old in s
s = s.replace(old, new)
open(p, "w", encoding="utf-8").write(s)
print("button ring patched")

p2 = r"F:\WorkSpaces\Mur rewards\.design\figcraft\_build\ui.py"
u = open(p2, encoding="utf-8").read()
u = u.replace('doc.frame(sb, "Nav active", 12, y, 212, 38, fill=solid("#FFFFFF0F"), radius=10)',
              'doc.frame(sb, "Nav active", 12, y, 212, 38, fill=solid(ACCENT_SOFT), radius=10)')
u = u.replace('def window(doc, kit, page, x, y, w, h, name, bg=None):\n    win = doc.frame(page, name, x, y, w, h, fill=solid(bg or BG), radius=12,\n                    stroke_color=BORDER2, stroke_w=1, clip=True)\n    doc.text(win, "Caption/titlebar", 0, 0, 0, "", size=1, color=BG)\n',
          'def window(doc, kit, page, x, y, w, h, name, bg=None):\n    win = doc.frame(page, name, x, y, w, h, fill=solid(bg or BG), radius=12,\n                    stroke_color=BORDER2, stroke_w=1, clip=True)\n')
for junk in ('        doc.line(parent, nm, x + s * 0.3, y + s * 0.78, 0, c, alpha, 0) if False else None\n',
             '        doc.polygon(parent, nm, x + s * 0.62, y - s * 0.02, s * 0.3, s * 0.3,\n                    [(0, 1), (1, 0), (1, 1)], solid(c, alpha)) if False else None\n',
             '    doc.line(tb, "Topbar border", 0, 55, w, "#FFFFFF", 0.0) if False else None\n'):
    u = u.replace(junk, '')
open(p2, "w", encoding="utf-8").write(u)
print("ui patched")
