# -*- coding: utf-8 -*-
"""Builds .design/figcraft/designs/reward-sounds-app.figcraft"""
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import fc
from fc import Doc, Kit, solid, gradient, measure
from ui import TEXT, TEXT2, MUTED, DIM, icon, ACCENT_TEXT, SURF2, BORDER2, ACCENT
import ui
import ui2
import pages_a
import pages_b
import pages_c

OUT = r"F:\WorkSpaces\Mur rewards\.design\figcraft\designs\reward-sounds-app.figcraft"


def tokens(doc):
    coll = doc.collection("Theme", modes=("Dark", "Light"))
    colors = {
        "color/canvas": "#0A0A0A", "color/sidebar": "#0E0E0E",
        "color/panel": "#0D0D0D", "color/surface": "#111111",
        "color/surface-2": "#161616", "color/surface-3": "#1C1C1C",
        "color/text-primary": "#F5F5F5", "color/text-secondary": "#B9B9B9",
        "color/text-muted": "#8B8B8B", "color/text-dim": "#6E6E6E",
        "color/accent": "#8B00FF", "color/accent-text": "#C9A7FF",
        "color/success": "#22C55E", "color/warning": "#F59E0B",
        "color/danger": "#EF4444", "color/info": "#7DD3FC",
        "color/border": "#FFFFFF1F", "color/border-strong": "#FFFFFF33",
    }
    for name, value in colors.items():
        doc.variable(coll, name, "color", value)
    nums = {
        "space/1": 4, "space/2": 8, "space/3": 12, "space/4": 16, "space/5": 24,
        "space/6": 32, "radius/sm": 6, "radius/md": 9, "radius/lg": 14,
        "radius/xl": 16, "radius/pill": 999, "control/height-sm": 30,
        "control/height-md": 36, "control/height-lg": 44, "icon/sm": 14,
        "icon/md": 16, "icon/lg": 20, "layout/sidebar": 236, "layout/rail": 64,
        "layout/topbar": 56, "layout/footer": 36, "breakpoint/min": 980,
    }
    for name, value in nums.items():
        doc.variable(coll, name, "number", value)
    strs = {"brand/name": "Reward Sounds", "brand/version": "1.7.0",
            "font/family": "Inter", "motion/hover": "120ms ease-out",
            "motion/panel": "220ms ease-in-out", "motion/pulse": "2.4s ease-in-out"}
    for name, value in strs.items():
        doc.variable(coll, name, "string", value)

    paint_styles = {
        "Accent/Primary": "#8B00FF", "Accent/Text": "#C9A7FF",
        "Surface/Canvas": "#0A0A0A", "Surface/Panel": "#0D0D0D",
        "Surface/Card": "#111111", "Surface/Field": "#161616",
        "Text/Primary": "#F5F5F5", "Text/Secondary": "#B9B9B9", "Text/Muted": "#8B8B8B",
        "Status/Success": "#22C55E", "Status/Warning": "#F59E0B",
        "Status/Danger": "#EF4444", "Status/Info": "#7DD3FC",
        "Border/Subtle": "#FFFFFF1F", "Border/Strong": "#FFFFFF33",
        "Button/Primary": "#EDEDED", "Button/Secondary": "#161616",
        "Button/Danger": "#EF4444",
    }
    for name, value in paint_styles.items():
        doc.color_style(name, value)
    return coll


def attach_paint_styles(doc):
    by_hex = {}
    for style in doc.styles:
        if style["type"] == "paint":
            paint = style["paints"][0]
            c = paint["color"]
            key = "#%02X%02X%02X" % (round(c["r"] * 255), round(c["g"] * 255), round(c["b"] * 255))
            if key not in by_hex:
                by_hex[key] = style["id"]
    for node in doc.nodes.values():
        if node.get("type") not in ("frame", "rectangle", "component", "ellipse"):
            continue
        fills = node.get("fills") or []
        if len(fills) != 1 or fills[0].get("type") != "solid":
            continue
        c = fills[0]["color"]
        key = "#%02X%02X%02X" % (round(c["r"] * 255), round(c["g"] * 255), round(c["b"] * 255))
        sid = by_hex.get(key)
        if sid:
            node.setdefault("styles", {})
            node["styles"]["fill"] = sid


def clone_instance(doc, main_id, parent, x, y, name=None):
    """Create a real instance of a component inside the document JSON."""
    main = doc.nodes[str(main_id)]

    def copy_tree(src_id, new_parent, transform):
        src = doc.nodes[str(src_id)]
        nid = doc._id()
        node = {}
        for k, v in src.items():
            if k in ("id", "parent", "children", "transform"):
                continue
            node[k] = v
        node["id"] = nid
        node["parent"] = new_parent
        node["transform"] = list(transform)
        node["source"] = src_id
        if "children" in src:
            node["children"] = []
        doc.nodes[str(nid)] = node
        pnode = doc.nodes[str(new_parent)]
        pnode.setdefault("children", []).append(nid)
        for child_id in src.get("children", []):
            child = doc.nodes[str(child_id)]
            cp = copy_tree(child_id, nid, child.get("transform", [1, 0, 0, 1, 0, 0]))
        return nid

    inst = copy_tree(main_id, parent, [1.0, 0.0, 0.0, 1.0, float(x), float(y)])
    node = doc.nodes[str(inst)]
    node["type"] = "instance"
    node["component"] = main_id
    node["name"] = name or (main.get("name", "Component") + " (instance)")
    return inst


def make_component(doc, parent, name, w, h, draw):
    nid = doc.frame(parent, name, 0, 0, w, h, fill=None, clip=False)
    draw(nid)
    node = doc.nodes[str(nid)]
    node["type"] = "component"
    node["description"] = ""
    node["props"] = {}
    return nid


def assets_page(doc, kit):
    p = doc.page("14 — Компоненты (ассеты)", "#0A0A0B")
    ui2.page_title(doc, p, 120, 90, "14 · КОМПОНЕНТЫ (АССЕТЫ)",
                   "Мастера и инстансы",
                   "Библиотека элементов: правка мастера обновляет все экраны. Инстансы показаны справа.")
    frame = ui2.spec_frame(doc, p, 120, 260, 1600, 1180, "Asset library",
                           "", "")
    doc.text(frame, "Title", 32, 26, 800, "Библиотека компонентов", size=26, weight=600, color=TEXT)
    doc.text(frame, "Sub", 32, 62, 1200,
             "Кнопки, карточка награды, фильтр-чип, поле поиска, точка статуса, модалка. Цвета и радиусы — из коллекции Theme.",
             size=12.8, color=MUTED)

    def draw_primary(parent):
        f = doc.frame(parent, "Bg", 0, 0, 190, 40, fill=solid("#EDEDED"), radius=20)
        icon(doc, f, "plus", 18, 12, 16, "#0A0A0A")
        doc.text(f, "Label", 42, 11, 140, "Создать награду", size=13.4, weight=600, color="#0A0A0A")

    def draw_secondary(parent):
        f = doc.frame(parent, "Bg", 0, 0, 160, 40, fill=solid(ui.SURF2), radius=20,
                      stroke_color=ui.BORDER2)
        doc.text(f, "Label", 0, 11, 160, "Отмена", size=13.4, weight=600, color=ui.TEXT, align="center")

    def draw_danger_ghost(parent):
        f = doc.frame(parent, "Bg", 0, 0, 160, 40, fill=None, radius=20,
                      stroke_color="#EF44445C")
        icon(doc, f, "trash", 18, 12, 15, ui.DANGER)
        doc.text(f, "Label", 42, 11, 120, "Убрать", size=13.4, weight=500, color=ui.DANGER)

    def draw_icon(parent):
        f = doc.frame(parent, "Bg", 0, 0, 40, 40, fill=solid(ui.SURF2), radius=20,
                      stroke_color=ui.BORDER2)
        icon(doc, f, "dots", 12, 12, 16, ui.MUTED)

    def draw_pill(parent):
        f = doc.frame(parent, "Bg", 0, 0, 140, 30, fill=solid(ui.SURF2), radius=15,
                      stroke_color=ui.BORDER2)
        doc.ellipse(f, "Dot", 10, 12, 6, 6, solid(ui.ACCENT))
        doc.text(f, "Label", 22, 8.4, 110, "Играет 0", size=12.2, color="#C9A7FF")

    masters = [("Button/Primary", draw_primary), ("Button/Secondary", draw_secondary),
               ("Button/DangerGhost", draw_danger_ghost), ("Button/Icon", draw_icon),
               ("Filter/Pill", draw_pill)]
    ids = {}
    for i, (name, draw) in enumerate(masters):
        y = 110 + i * 96
        doc.text(frame, "Name/%d" % i, 32, y + 14, 260, name, size=12.4, weight=600, color=ui.TEXT2)
        doc.text(frame, "Kind/%d" % i, 32, y + 34, 260, "component · master", size=9.6, color=ui.DIM)
        comp = make_component(doc, frame, name, 200, 48, draw)
        comp_node = doc.nodes[str(comp)]
        comp_node["transform"] = [1.0, 0.0, 0.0, 1.0, 300.0, float(y)]
        ids[name] = comp
        # instance
        clone_instance(doc, comp, frame, 640, y + 4, name + " instance")

    doc.text(frame, "Inst label", 640, 88, 300, "инстансы (используются на экранах)", size=10.4, color=ui.DIM)
    # reward card component preview
    doc.text(frame, "Card label", 32, 640, 300, "Reward/Card", size=12.4, weight=600, color=ui.TEXT2)
    doc.text(frame, "Card kind", 32, 660, 300, "component · master", size=9.6, color=ui.DIM)
    card_comp = doc.frame(frame, "Reward/Card", 300, 620, 286, 168, fill=None, clip=False)
    ui2.reward_card(doc, kit, card_comp, 0, 0, 286, 168, "Ты новичок?", 200,
                    ui.REWARD_COLORS[0], file_name="newbie.mp3", fmt="MP3", volume=200)
    cn = doc.nodes[str(card_comp)]
    cn["type"] = "component"
    cn["description"] = ""
    cn["props"] = {}
    clone_instance(doc, card_comp, frame, 640, 620, "Reward/Card instance")
    doc.text(frame, "Card note", 640, 800, 400,
             "Инстанс повторяет мастера: для React — один компонент карточки с пропсами title/cost/color/state.",
             size=10.4, color=ui.DIM)
    # token list of styles
    doc.text(frame, "Styles", 32, 900, 600, "Стили", size=16, weight=600, color=ui.TEXT)
    for i, st in enumerate(doc.styles[:18]):
        y = 934 + (i % 9) * 26
        x = 32 + (i // 9) * 500
        doc.text(frame, "Style/%d" % i, x, y, 460, "%s · %s" % (st["id"], st["name"]),
                 size=10.6, color=ui.MUTED)
    return p


def main():
    doc = Doc("reward-sounds-app")
    kit = Kit(doc)
    tokens(doc)
    p00 = pages_a.page_cover(doc, kit)
    p01 = pages_a.page_design_system(doc, kit)
    p02 = pages_a.page_buttons(doc, kit)
    p03 = pages_a.page_controls(doc, kit)
    p04 = pages_a.page_shell(doc, kit)
    p05 = pages_b.page_rewards(doc, kit)
    p06 = pages_b.page_music(doc, kit)
    p07 = pages_b.page_chat(doc, kit)
    p08 = pages_b.page_settings(doc, kit)
    p09 = pages_b.page_log(doc, kit)
    p10 = pages_c.page_onboarding(doc, kit)
    p11 = pages_c.page_modals(doc, kit)
    p12 = pages_c.page_obs(doc, kit)
    p13 = pages_c.page_states(doc, kit)
    p14 = assets_page(doc, kit)
    attach_paint_styles(doc)
    path = doc.save(OUT)
    frames = sum(1 for n in doc.nodes.values() if n.get("type") in ("frame", "component", "instance"))
    comps = sum(1 for n in doc.nodes.values() if n.get("type") == "component")
    insts = sum(1 for n in doc.nodes.values() if n.get("type") == "instance")
    print("saved", path)
    print("pages", len(doc.pages), "nodes", len(doc.nodes), "frames", frames,
          "components", comps, "instances", insts,
          "styles", len(doc.styles), "variables", len(doc.variables["variables"]))
    print("size", os.path.getsize(path))
    import json as _json
    manifest = {"file": path, "pages": []}
    for pid in doc.pages:
        page = doc.nodes[str(pid)]
        children = []
        for cid in page.get("children", []):
            node = doc.nodes[str(cid)]
            if node.get("type") in ("frame", "component", "section"):
                children.append({"id": cid, "name": node.get("name"),
                                 "w": node.get("width"), "h": node.get("height")})
        manifest["pages"].append({"id": pid, "name": page.get("name"), "frames": children})
    mpath = os.path.join(HERE, "manifest.json")
    open(mpath, "w", encoding="utf-8").write(_json.dumps(manifest, ensure_ascii=False, indent=1))
    print("manifest", mpath, "frames", sum(len(x["frames"]) for x in manifest["pages"]))


if __name__ == "__main__":
    main()
