# -*- coding: utf-8 -*-
"""FigCraft document generator helpers for Reward Sounds design.

Builds a .figcraft file (zip with document.json) directly, matching the
on-disk schema of FigCraft 0.18.1.  Verified by schema probes.
"""
import json
import math
import os
import zipfile

from PIL import ImageFont

BASE = os.path.dirname(os.path.abspath(__file__))
FONT_REG = r"F:\WorkSpaces\Mur rewards\.design\ux-review\2026-11-r2\examples\_screens-extract\Inter-400.ttf"
FONT_SEMI = r"F:\WorkSpaces\Mur rewards\.design\ux-review\2026-11-r2\examples\_screens-extract\Inter-600.ttf"
_THUMB = r"F:\WorkSpaces\Mur rewards\.design\figcraft\designs\reward-sounds.figcraft"

_font_cache = {}


def _font(weight, size):
    key = (weight, int(size * 2))
    if key not in _font_cache:
        path = FONT_SEMI if weight >= 600 else FONT_REG
        _font_cache[key] = ImageFont.truetype(path, max(1, int(round(size * 2))))
    return _font_cache[key]


def measure(text, size, weight=400):
    """Width in px of a single line (Inter approximation)."""
    f = _font(weight, size)
    return f.getlength(text) / 2.0


def trunc(text, size, weight, maxw):
    text = str(text)
    if measure(text, size, weight) <= maxw:
        return text
    out = text
    while out and measure(out + "…", size, weight) > maxw:
        out = out[:-1]
    return (out + "…") if out else ""


def wrap_lines(text, width, size, weight=400):
    out = []
    for raw in str(text).split("\n"):
        words = raw.split(" ")
        cur = ""
        for w in words:
            cand = (cur + " " + w).strip() if cur else w
            if measure(cand, size, weight) <= width or not cur:
                cur = cand
            else:
                out.append(cur)
                cur = w
        out.append(cur)
    return out or [""]


def text_height(text, width, size, weight=400, lh_ratio=1.2143, tracking=0.0):
    lines = wrap_lines(text, width, size, weight)
    return lines, max(1, len(lines)) * round(size * lh_ratio)


# ---------------------------------------------------------------- colours
def _hx(value):
    value = value.strip().lstrip("#")
    if len(value) == 8:
        r, g, b, a = (int(value[i:i + 2], 16) for i in (0, 2, 4, 6))
        return r / 255.0, g / 255.0, b / 255.0, a / 255.0
    r, g, b = (int(value[i:i + 2], 16) for i in (0, 2, 4))
    return r / 255.0, g / 255.0, b / 255.0, 1.0


def C(value):
    r, g, b, a = _hx(value)
    return {"r": round(r, 8), "g": round(g, 8), "b": round(b, 8), "a": round(a, 8)}


def solid(value, opacity=1.0, visible=True):
    return {"type": "solid", "color": C(value), "opacity": opacity,
            "visible": visible, "blend": "normal"}


def gradient(stops, p0=(0.0, 0.0), p1=(1.0, 0.0), kind="linear"):
    return {"type": "gradient", "kind": kind,
            "stops": [{"position": i / max(1, len(stops) - 1), "color": C(s)}
                      for i, s in enumerate(stops)],
            "from": list(p0), "to": list(p1), "width": [0.0, 1.0],
            "opacity": 1.0, "visible": True, "blend": "normal"}


def stroke(value, alpha=1.0):
    return {"type": "solid", "color": C(value), "opacity": alpha,
            "visible": True, "blend": "normal", "colorAlpha": alpha}


def shadow(color="#000000", alpha=0.35, dy=8, dx=0, radius=24, spread=0.0):
    return {"type": "dropShadow", "color": C(color + ("" if len(color) > 7 else "")),
            "opacity": alpha, "visible": True, "blend": "normal",
            "offset": [float(dx), float(dy)], "radius": float(radius),
            "spread": float(spread), "show_behind": False}


def _shadow(color, alpha, dy, dx, radius, spread=0.0):
    c = C(color)
    c["a"] = alpha
    return {"type": "dropShadow", "color": c, "offset": [float(dx), float(dy)],
            "radius": float(radius), "spread": float(spread),
            "blend": "normal", "show_behind": False, "visible": True}


def rotate_matrix(deg, tx, ty):
    rad = math.radians(deg)
    return [round(math.cos(rad), 6), round(math.sin(rad), 6),
            round(-math.sin(rad), 6), round(math.cos(rad), 6), float(tx), float(ty)]


class Doc:
    def __init__(self, name):
        self.name = name
        self.nodes = {}
        self.next_id = 1
        self.pages = []
        self.styles = []
        self.next_style = 1
        self.variables = {"collections": [], "variables": []}
        self._style_by_key = {}

    # ------------------------------------------------------------ core
    def _id(self):
        i = self.next_id
        self.next_id += 1
        return i

    def _add(self, node):
        self.nodes[str(node["id"])] = node
        return node["id"]

    def page(self, name, bg="#0B0B0C", x=0, y=0):
        pid = self._id()
        node = {"id": pid, "name": name, "type": "page",
                "background": C(bg), "flows": [],
                "prototype": {"device": "None", "background": C("#0A0A0A"),
                              "rotation": "portrait"},
                "children": [], "width": 0.0, "height": 0.0}
        self.nodes[str(pid)] = node
        self.pages.append(pid)
        return pid

    def _parent(self, parent, child_id):
        if parent is not None:
            p = self.nodes[str(parent)]
            p.setdefault("children", []).append(child_id)

    # ------------------------------------------------------------ shapes
    def frame(self, parent, name, x, y, w, h, fill=None, radius=None,
              stroke_color=None, stroke_w=1.0, clip=True, effects=None,
              layout=None, gap=8.0, padding=None, opacity=None, visible=True,
              styles=None, rotation=None):
        nid = self._id()
        node = {"id": nid, "name": name, "type": "frame", "parent": parent,
                "children": [], "transform": [1.0, 0.0, 0.0, 1.0, float(x), float(y)],
                "width": float(w), "height": float(h)}
        if rotation:
            node["transform"] = rotate_matrix(rotation, x, y)
        if fill is not None:
            node["fills"] = fill if isinstance(fill, list) else [fill]
        if stroke_color is not None:
            node["strokes"] = [stroke(stroke_color)]
            node["stroke"] = {"weight": float(stroke_w), "align": "inside",
                              "sides": None, "cap_start": "none", "cap_end": "none",
                              "join": "miter", "miter_limit": 4.0, "dashes": []}
        if radius:
            rad = radius if isinstance(radius, (list, tuple)) else [radius] * 4
            node["corners"] = {"radii": [float(r) for r in rad], "smoothing": 0.0}
        if clip:
            node["clip"] = True
        if opacity is not None:
            node["opacity"] = float(opacity)
        if not visible:
            node["visible"] = False
        if effects:
            node["effects"] = effects
        if layout:
            node["layout"] = {"mode": layout, "wrap": False, "gap": float(gap),
                              "cross_gap": 10.0,
                              "padding": [float(v) for v in (padding or [0, 0, 0, 0])],
                              "main_align": "min", "cross_align": "min",
                              "content_align": "auto", "grid_columns": 2,
                              "grid_rows": 2, "column_tracks": [], "row_tracks": [],
                              "strokes_included": True, "reverse_z": False}
        if styles:
            node["styles"] = styles
        self._add(node)
        self._parent(parent, nid)
        return nid

    def rect(self, parent, name, x, y, w, h, fill=None, radius=0,
             stroke_color=None, stroke_w=1.0, opacity=None, rotation=None,
             effects=None, visible=True):
        nid = self._id()
        node = {"id": nid, "name": name, "type": "rectangle", "parent": parent,
                "blend": "normal",
                "transform": rotate_matrix(rotation, x, y) if rotation
                else [1.0, 0.0, 0.0, 1.0, float(x), float(y)],
                "width": float(w), "height": float(h)}
        if fill is not None:
            node["fills"] = fill if isinstance(fill, list) else [fill]
        if stroke_color is not None:
            node["strokes"] = [stroke(stroke_color)]
            node["stroke"] = {"weight": float(stroke_w), "align": "inside",
                              "sides": None, "cap_start": "none", "cap_end": "none",
                              "join": "miter", "miter_limit": 4.0, "dashes": []}
        if radius:
            rad = radius if isinstance(radius, (list, tuple)) else [radius] * 4
            node["corners"] = {"radii": [float(r) for r in rad], "smoothing": 0.0}
        if opacity is not None:
            node["opacity"] = float(opacity)
        if not visible:
            node["visible"] = False
        if effects:
            node["effects"] = effects
        self._add(node)
        self._parent(parent, nid)
        return nid

    def ellipse(self, parent, name, x, y, w, h, fill=None, stroke_color=None,
                stroke_w=1.0, opacity=None):
        nid = self._id()
        node = {"id": nid, "name": name, "type": "ellipse", "start": 0.0,
                "sweep": 6.283185307179586, "inner": 0.0, "parent": parent,
                "blend": "normal",
                "transform": [1.0, 0.0, 0.0, 1.0, float(x), float(y)],
                "width": float(w), "height": float(h)}
        if fill is not None:
            node["fills"] = fill if isinstance(fill, list) else [fill]
        if stroke_color is not None:
            node["strokes"] = [stroke(stroke_color)]
            node["stroke"] = {"weight": float(stroke_w), "align": "inside",
                              "sides": None, "cap_start": "none", "cap_end": "none",
                              "join": "miter", "miter_limit": 4.0, "dashes": []}
        if opacity is not None:
            node["opacity"] = float(opacity)
        self._add(node)
        self._parent(parent, nid)
        return nid

    def line(self, parent, name, x, y, w, color="#FFFFFF", alpha=0.12, weight=1.0):
        nid = self._id()
        node = {"id": nid, "name": name, "type": "line", "parent": parent,
                "blend": "normal",
                "transform": [1.0, 0.0, 0.0, 1.0, float(x), float(y)],
                "width": float(w), "height": 0.0,
                "strokes": [stroke(color, alpha)],
                "stroke": {"weight": float(weight), "align": "center", "sides": None,
                           "cap_start": "none", "cap_end": "none", "join": "miter",
                           "miter_limit": 4.0, "dashes": []}}
        self._add(node)
        self._parent(parent, nid)
        return nid

    def polygon(self, parent, name, x, y, w, h, points, fill=None,
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

    def text(self, parent, name, x, y, w, characters, size=14, weight=400,
             color="#F5F5F5", align="left", tracking=0.0, case="original",
             max_height=None, auto_height=True, line_height=None, opacity=None,
             style_name=None):
        """Text node. Width is fixed; height follows wrapped lines."""
        single = "\n" not in str(characters)
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
        chars = "\n".join(lines)
        if auto_height:
            height = h + 2
        else:
            height = (max_height or h) + 2
        w = w + 6
        nid = self._id()
        fstyle = {"font_family": "Inter", "font_style": weight_name(weight),
                  "font_size": float(size),
                  "line_height": {"unit": "pixels", "value": float(line_height)} if line_height
                  else {"unit": "auto"},
                  "letter_spacing": {"unit": "percent", "value": float(tracking)},
                  "decoration": "none", "case": case, "fills": None, "link": None}
        node = {"id": nid, "name": name, "type": "text", "characters": chars,
                "style": fstyle, "auto_resize": "none", "parent": parent,
                "blend": "normal",
                "transform": [1.0, 0.0, 0.0, 1.0, float(x), float(y)],
                "width": float(w), "height": float(height),
                "fills": [solid(color)]}
        if opacity is not None:
            node["opacity"] = float(opacity)
        sid = self.text_style(size, weight, tracking, line_height)
        if sid:
            node["styles"] = {"fill": None, "stroke": None, "effect": None,
                              "grid": None, "text": sid}
        self._add(node)
        self._parent(parent, nid)
        return nid

    # ------------------------------------------------------------ styles
    def color_style(self, name, value):
        key = ("paint", value)
        if key in self._style_by_key:
            return self._style_by_key[key]
        sid = "S:%d" % self.next_style
        self.next_style += 1
        self.styles.append({"id": sid, "name": name, "description": "",
                            "type": "paint", "paints": [solid(value)]})
        self._style_by_key[key] = sid
        return sid

    def text_style(self, size, weight, tracking=0.0, line_height=None):
        key = ("text", size, weight, tracking, line_height)
        if key in self._style_by_key:
            return self._style_by_key[key]
        sid = "S:%d" % self.next_style
        self.next_style += 1
        self.styles.append({"id": sid, "name": "Type/%s/%s" % (weight_name(weight), fmt(size)),
                            "description": "", "type": "text",
                            "style": {"font_family": "Inter",
                                      "font_style": weight_name(weight),
                                      "font_size": float(size),
                                      "line_height": {"unit": "auto"},
                                      "letter_spacing": {"unit": "percent", "value": float(tracking)},
                                      "decoration": "none", "case": "original",
                                      "fills": None, "link": None}})
        self._style_by_key[key] = sid
        return sid

    # ------------------------------------------------------------ variables
    def collection(self, name, modes=("Dark",)):
        cid = "VariableCollectionId:%d" % (len(self.variables["collections"]) + 1)
        self.variables["collections"].append(
            {"id": cid, "name": name,
             "modes": [{"id": "%s/mode%d" % (cid, i + 1), "name": m}
                       for i, m in enumerate(modes)]})
        return cid

    def variable(self, collection, name, kind, value):
        coll = next(c for c in self.variables["collections"] if c["id"] == collection)
        vid = "VariableID:%d" % (len(self.variables["variables"]) + 1)
        vals = {}
        for mode in coll["modes"]:
            if kind == "color":
                vals[mode["id"]] = {"type": "color", "value": C(value)}
            elif kind == "number":
                vals[mode["id"]] = {"type": "number", "value": float(value)}
            else:
                vals[mode["id"]] = {"type": kind, "value": str(value)}
        self.variables["variables"].append(
            {"id": vid, "name": name, "collection": collection,
             "resolvedType": kind, "values": vals, "description": ""})
        return vid

    # ------------------------------------------------------------ save
    def save(self, path):
        data = {
            "format": "figcraft", "version": 1, "imageIndex": [],
            "name": self.name, "pages": self.pages, "nodes": self.nodes,
            "next_id": self.next_id, "styles": self.styles,
            "variables": self.variables,
            "current_page": self.pages[0] if self.pages else None,
            "document_colors": [], "comments": [],
        }
        raw = json.dumps(data, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
        os.makedirs(os.path.dirname(path), exist_ok=True)
        thumb = b""
        try:
            with zipfile.ZipFile(_THUMB) as z:
                thumb = z.read("thumbnail.png")
        except Exception:
            thumb = b""
        with zipfile.ZipFile(path, "w", zipfile.ZIP_DEFLATED) as z:
            z.writestr("document.json", raw)
            if thumb:
                z.writestr("thumbnail.png", thumb)
        return path


def weight_name(weight):
    if weight >= 700:
        return "Bold"
    if weight >= 600:
        return "SemiBold"
    if weight >= 500:
        return "Medium"
    return "Regular"


def fmt(v):
    return ("%g" % v)


# ---------------------------------------------------------------- UI kit
class Kit:
    """Reward Sounds dark studio kit on top of Doc."""

    def __init__(self, doc):
        self.d = doc
        self.colors = {
            "bg": "#0A0A0A", "panel": "#0D0D0D", "surface": "#111111",
            "surface2": "#161616", "surface3": "#1C1C1C",
            "border": "#FFFFFF12", "border2": "#FFFFFF1F", "border3": "#FFFFFF33",
            "text": "#F5F5F5", "text2": "#B9B9B9", "muted": "#8B8B8B", "dim": "#6E6E6E",
            "accent": "#8B00FF", "accentText": "#C9A7FF",
            "ok": "#22C55E", "warn": "#F59E0B", "danger": "#EF4444", "info": "#7DD3FC",
        }
        self.tokens = {}

    def c(self, name):
        return self.colors[name]

    def frame(self, parent, **kw):
        nid = self.d.frame(parent, **kw)
        return nid

    def text(self, parent, **kw):
        return self.d.text(parent, **kw)

    # ---- primitives
    def dot(self, parent, x, y, color, size=6, name="Dot"):
        return self.d.ellipse(parent, name, x, y, size, size, solid(color))

    def icon_play(self, parent, x, y, size=12, color="#EDEDED"):
        s = size
        d = self.d
        d.rect(parent, "Icon/Play", x, y, s, s, None)
        # triangle via two rotated rects is messy; use 3-point polygon impossible;
        # draw rounded play using two rectangles approximation: ball + caret skipped
        return None

    def pill(self, parent, x, y, label, size=24, color=None, bg=None,
             border=None, weight=400, font_size=None):
        fs = font_size or (11.2 if size <= 24 else 12.4)
        color = color or self.c("text2")
        bg = bg if bg is not None else self.c("surface2")
        border = border if border is not None else self.c("border2")
        w = int(measure(label, fs, weight) + (18 if size <= 24 else 22) * 2)
        fid = self.d.frame(parent, "Pill/%s" % label, x, y, w, size,
                           fill=solid(bg) if bg != "none" else None,
                           radius=size / 2,
                           stroke_color=border if border != "none" else None)
        self.d.text(fid, "Label", 0, (size - fs * 1.2143) / 2, w, label,
                    size=fs, weight=weight, color=color, align="center")
        return fid, w

    def button(self, parent, x, y, label, variant="primary", size="md",
               state="default", width=None, icon=False, name=None):
        H = {"sm": 30, "md": 36, "lg": 44}[size]
        fs = {"sm": 12.4, "md": 13.6, "lg": 15}[size]
        pad = {"sm": 12, "md": 16, "lg": 20}[size]
        specs = {
            "primary": dict(fill="#EDEDED", txt="#0A0A0A", border=None, weight=600),
            "secondary": dict(fill="#161616", txt="#F5F5F5", border="#FFFFFF21", weight=600),
            "ghost": dict(fill=None, txt="#B9B9B9", border=None, weight=500),
            "danger": dict(fill="#EF4444", txt="#0A0A0A", border=None, weight=600),
            "danger-ghost": dict(fill=None, txt="#EF4444", border="rgba", weight=500),
            "icon": dict(fill="#161616", txt="#B9B9B9", border="#FFFFFF21", weight=500),
            "link": dict(fill=None, txt="#C9A7FF", border=None, weight=500),
        }
        sp = specs[variant]
        if state == "hover":
            hov = {
                "primary": ("#FFFFFF", "#0A0A0A"),
                "secondary": ("#1C1C1C", "#F5F5F5"),
                "ghost": ("#FFFFFF0F", "#F5F5F5"),
                "danger": ("#F87171", "#0A0A0A"),
                "danger-ghost": ("#EF44441A", "#EF4444"),
                "icon": ("#222222", "#F5F5F5"),
                "link": (None, "#EDEDED"),
            }[variant]
            fill = hov[0] if hov[0] else sp["fill"]
            txt = hov[1]
        elif state == "pressed":
            pr = {
                "primary": ("#DADADA", "#0A0A0A"),
                "secondary": ("#111111", "#EDEDED"),
                "ghost": ("#FFFFFF1A", "#EDEDED"),
                "danger": ("#DC2626", "#0A0A0A"),
                "danger-ghost": ("#EF444426", "#DC2626"),
                "icon": ("#1A1A1A", "#EDEDED"),
                "link": (None, "#B98BFF"),
            }[variant]
            fill = pr[0] if pr[0] else sp["fill"]
            txt = pr[1]
        elif state == "disabled":
            fill = "#171717" if sp["fill"] else None
            txt = "#5A5A5A"
            border = "#FFFFFF0F"
        elif state == "loading":
            fill = sp["fill"]
            txt = "#8B8B8B" if sp["fill"] is None else sp["txt"]
        else:
            fill = sp["fill"]
            txt = sp["txt"]
        border = sp["border"] if state not in ("disabled",) else ("#FFFFFF0F" if variant in ("secondary", "icon") else None)
        if border == "rgba":
            border = "#EF444440"
        label_w = measure(label, fs, sp["weight"])
        w = width or int(label_w + pad * 2 + (18 if icon else 0))
        if variant == "icon":
            w = width or H
        if state == "focus-visible":
            self.d.frame(parent, "Focus ring", x - 3, y - 3, w + 6, H + 6,
                         fill=None, radius=H / 2 + 3, stroke_color="#C9A7FF",
                         stroke_w=2)
        nid = self.d.frame(parent, name or ("Btn/%s/%s/%s" % (variant, size, state)),
                           x, y, w, H,
                           fill=(solid(fill) if fill else None),
                           radius=H / 2,
                           stroke_color=border if border else None)
        if state == "loading":
            self.d.ellipse(nid, "Spinner", 12, (H - 12) / 2, 12, 12, None,
                           stroke_color="#8B8B8B", stroke_w=1.5)
            self.d.text(nid, "Label", 30, (H - fs * 1.2143) / 2, w - 40, label,
                        size=fs, weight=sp["weight"], color="#B9B9B9")
        elif variant == "icon":
            self.d.ellipse(nid, "Icon dot", (w - 14) / 2, (H - 14) / 2, 14, 14,
                           solid(txt), opacity=0.9)
        else:
            off = (18 if icon else 0)
            self.d.text(nid, "Label", off, (H - fs * 1.2143) / 2, w - off, label,
                        size=fs, weight=sp["weight"], color=txt, align="center")
        return nid, w


def hexmix(a, b, t):
    aa = _hx(a)
    bb = _hx(b)
    return "#%02X%02X%02X" % tuple(
        round((aa[i] * (1 - t) + bb[i] * t) * 255) for i in range(3))
