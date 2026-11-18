p = r"F:\WorkSpaces\Mur rewards\.design\figcraft\_build\fc.py"
s = open(p, encoding="utf-8").read()
# add polygon method after line() method definition block (before def text)
anchor = "    def text(self, parent, name, x, y, w, characters, size=14, weight=400,"
poly = '''    def polygon(self, parent, name, x, y, w, h, points, fill=None,
                stroke_color=None, stroke_w=1.0):
        verts = [{"x": round(px * w, 4), "y": round(py * h, 4), "radius": 0.0}
                 for px, py in points]
        n = len(verts)
        segs = [{"a": i, "b": (i + 1) % n, "ta": [0.0, 0.0], "tb": [0.0, 0.0]}
                for i in range(n)]
        regions = [{"loops": [list(range(n))], "winding": "nonZero"}]
        nid = self._id()
        node = {"id": nid, "name": name, "type": "vector",
                "network": {"vertices": verts, "segments": segs, "regions": regions},
                "parent": parent, "blend": "normal",
                "transform": [1.0, 0.0, 0.0, 1.0, float(x), float(y)],
                "width": float(w), "height": float(h)}
        if fill is not None:
            node["fills"] = [fill]
        if stroke_color is not None:
            node["strokes"] = [stroke(stroke_color)]
            node["stroke"] = {"weight": float(stroke_w), "align": "center",
                              "sides": None, "cap_start": "none", "cap_end": "none",
                              "join": "miter", "miter_limit": 4.0, "dashes": []}
        self._add(node)
        self._parent(parent, nid)
        return nid

'''
assert anchor in s
s = s.replace(anchor, poly + anchor, 1)
open(p, "w", encoding="utf-8").write(s)
print("fc.py polygon added")

p2 = r"F:\WorkSpaces\Mur rewards\.design\figcraft\_build\ui.py"
u = open(p2, encoding="utf-8").read()
u = u.replace('def window(doc, kit, page, x, y, w, h, name, bg=None):\n    win = doc.frame(page, name, x, y, w, h, fill=solid(bg or BG), radius=12,\n                    stroke_color=BORDER2, stroke_w=1, clip=True)\n    doc.text(win, "Caption/titlebar", 0, 0, 0, "", size=1, color=BG)\n',
          'def window(doc, kit, page, x, y, w, h, name, bg=None):\n    win = doc.frame(page, name, x, y, w, h, fill=solid(bg or BG), radius=12,\n                    stroke_color=BORDER2, stroke_w=1, clip=True)\n')
u = u.replace('doc.frame(sb, "Nav active", 12, y, 212, 38, fill=solid("#FFFFFF0F"), radius=10)',
              'doc.frame(sb, "Nav active", 12, y, 212, 38, fill=solid(ACCENT_SOFT), radius=10)')
# focus ring: draw before button - restructure button tail
old_ring = '''        nid = self.d.frame(parent, name or ("Btn/%s/%s/%s" % (variant, size, state)),
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
new_ring = '''        if state == "focus-visible":
            self.d.frame(parent, "Focus ring", x - 3, y - 3, w + 6, H + 6,
                         fill=None, radius=H / 2 + 3, stroke_color="rgba",
                         stroke_w=2)
        nid = self.d.frame(parent, name or ("Btn/%s/%s/%s" % (variant, size, state)),
                           x, y, w, H,
                           fill=(solid(fill) if fill else None),
                           radius=H / 2,
                           stroke_color=border if border else None)
'''
assert old_ring in u
u = u.replace(old_ring, new_ring)
u = u.replace('stroke_color="rgba"', 'stroke_color=ACCENT_TEXT')
# remove weird no-op lines
u = u.replace('        doc.line(parent, nm, x + s * 0.3, y + s * 0.78, 0, c, alpha, 0) if False else None\n', '')
u = u.replace('        doc.polygon(parent, nm, x + s * 0.62, y - s * 0.02, s * 0.3, s * 0.3,\n                    [(0, 1), (1, 0), (1, 1)], solid(c, alpha)) if False else None\n', '')
u = u.replace('    doc.line(tb, "Topbar border", 0, 55, w, "#FFFFFF", 0.0) if False else None\n', '')
open(p2, "w", encoding="utf-8").write(u)
print("ui.py patched")
