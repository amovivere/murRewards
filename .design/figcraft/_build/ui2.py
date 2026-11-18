# -*- coding: utf-8 -*-
"""Reward Sounds screens: cards, lists, player, chat, settings, modals, overlays."""
import fc
from fc import solid, gradient, hexmix, measure, wrap_lines
import ui
from ui import (BG, PAGE, SIDEBAR, PANEL, SURF, SURF2, SURF3, BORDER, BORDER2, BORDER3,
                TEXT, TEXT2, MUTED, DIM, ACCENT, ACCENT_TEXT, ACCENT_SOFT,
                ACCENT_BORDER, OK, WARN, DANGER, INFO, REWARD_COLORS, tint,
                border_tint, contrast_text, icon, window, sidebar, topbar, footer,
                page_head)


# ---------------------------------------------------------------- page helpers
def page_title(doc, page, x, y, index, title, sub):
    doc.text(page, "Page/index", x, y, 200, index, size=12.4, weight=600,
             color=ACCENT_TEXT, tracking=2)
    doc.text(page, "Page/title", x, y + 20, 1250, title, size=40, weight=600, color=TEXT)
    doc.text(page, "Page/sub", x, y + 74, 1250, sub, size=15.4, color=MUTED)


def spec(doc, page, x, y, w, h, name, caption="", note=""):
    """A frame on a FigCraft page with a caption above it."""
    if caption:
        doc.text(page, "Caption/" + name, x, y - 34, max(320, w), caption,
                 size=15.2, weight=600, color=TEXT2)
    if note:
        doc.text(page, "Note/" + name, x, y - 34 + 21, max(320, w), note,
                 size=11.6, color=DIM)
    return doc.frame(page, name, x, y, w, h, fill=solid(BG), radius=12,
                     stroke_color=BORDER, stroke_w=1, clip=True)


# ---------------------------------------------------------------- atoms
def label(doc, parent, x, y, w, text, color=DIM, size=10.6, tracking=1.6, weight=600):
    return doc.text(parent, "Label/" + text[:32], x, y, w, text, size=size,
                    weight=weight, color=color, tracking=tracking)


def chip(doc, kit, parent, x, y, text, color=MUTED, bg=SURF2, border=BORDER2,
         size=22, fs=10.6):
    w = int(measure(text, fs, 600) + 18)
    c = doc.frame(parent, "Chip/" + text, x, y, w, size, fill=solid(bg), radius=size / 2,
                  stroke_color=border)
    doc.text(c, "Text", 0, (size - fs * 1.2143) / 2, w, text, size=fs, weight=600,
             color=color, align="center")
    return c, w


def dot(doc, parent, x, y, color, size=7, name="Status dot"):
    return doc.ellipse(parent, name, x, y, size, size, solid(color))


def slider(doc, parent, x, y, w, pct, color="#EDEDED", track="#FFFFFF33",
           knob=True, name="Slider"):
    doc.rect(parent, name + " track", x, y, w, 2, solid(track), radius=1)
    fill_w = max(2, w * pct)
    doc.rect(parent, name + " fill", x, y, fill_w, 2, solid(color), radius=1)
    if knob:
        ks = 12
        doc.ellipse(parent, name + " knob", x + fill_w - ks / 2, y - ks / 2 + 1,
                    ks, ks, solid("#FFFFFF"), stroke_color="#FFFFFF",
                    stroke_w=1)


def toggle(doc, parent, x, y, on=True, color=ACCENT, size=38):
    h = 22
    t = doc.frame(parent, "Toggle", x, y, size, h, fill=solid(color if on else "#FFFFFF29"),
                  radius=h / 2)
    doc.ellipse(t, "Knob", 19 if on else 3, 3, 16, 16,
                solid("#0A0A0A" if on else "#F5F5F5"))
    return t


def checkbox(doc, parent, x, y, on=False, color=ACCENT):
    c = doc.frame(parent, "Checkbox", x, y, 15, 15, fill=solid(color if on else "#FFFFFF08"),
                  radius=4, stroke_color=color if on else "#FFFFFF4D",
                  stroke_w=1.2)
    if on:
        icon(doc, c, "check", 2.5, 2.5, 10, "#0A0A0A")
    return c


def input_field(doc, parent, x, y, w, placeholder, h=36, value=None, icon_kind=None,
                state="default", suffix=None, name="Input"):
    border = {"default": BORDER2, "hover": BORDER3, "focus": ACCENT_BORDER,
              "error": DANGER, "disabled": BORDER}[state]
    bg = SURF2 if state != "disabled" else "#121212"
    f = doc.frame(parent, name, x, y, w, h, fill=solid(bg), radius=9,
                  stroke_color=border, stroke_w=2 if state == "focus" else 1)
    tx = 12
    if icon_kind:
        icon(doc, f, icon_kind, 11, (h - 15) / 2, 15, DIM)
        tx = 34
    text = value if value is not None else placeholder
    color = TEXT if value else DIM
    doc.text(f, "Value", tx, (h - 13.6 * 1.2143) / 2, w - tx - 14, text, size=13.6,
             color=color if state != "disabled" else DIM)
    if suffix:
        doc.text(f, "Suffix", w - 36, (h - 12 * 1.2143) / 2, 26, suffix, size=12,
                 color=DIM, align="right")
    return f


def select_field(doc, parent, x, y, w, text, open=False, h=36, name="Select"):
    f = doc.frame(parent, name, x, y, w, h, fill=solid(SURF2), radius=9,
                  stroke_color=BORDER3 if open else BORDER2)
    doc.text(f, "Value", 12, (h - 13.4 * 1.2143) / 2, w - 40, text, size=13.4,
             color=TEXT2)
    icon(doc, f, "chevron-down", w - 24, (h - 12) / 2, 12, MUTED)
    return f


def textarea(doc, parent, x, y, w, h, text, placeholder=False):
    f = doc.frame(parent, "Textarea", x, y, w, h, fill=solid(SURF2), radius=9,
                  stroke_color=BORDER2)
    doc.text(f, "Text", 12, 10, w - 24, text, size=13.4, color=DIM if placeholder else TEXT)
    doc.text(f, "Counter", w - 70, h - 22, 58, "0/280", size=10.6, color=DIM, align="right")
    return f


def stepper(doc, parent, x, y, value="10", w=96, h=32):
    f = doc.frame(parent, "Stepper", x, y, w, h, fill=solid(SURF2), radius=9,
                  stroke_color=BORDER2)
    doc.text(f, "Minus", 6, (h - 13.4 * 1.2143) / 2, 18, "−", size=14, color=MUTED)
    doc.text(f, "Value", 26, (h - 13.4 * 1.2143) / 2, w - 50, value, size=12.6,
             color=TEXT, align="center")
    doc.text(f, "Plus", w - 22, (h - 13.4 * 1.2143) / 2, 18, "+", size=14, color=MUTED)
    return f


# ---------------------------------------------------------------- card
def reward_card(doc, kit, parent, x, y, w, h, title, cost, color, state="normal",
                file_name="newbie.mp3", fmt="MP3", duration="0:08", volume=100,
                letter=None, playing=0, flags=(), name=None):
    bg = tint(color, 0.13)
    brd = border_tint(color, 0.24)
    if state == "disabled":
        bg = "#171717"
        brd = "#2A2A2A"
    card = doc.frame(parent, name or ("Card/" + title), x, y, w, h,
                     fill=solid(bg), radius=14, stroke_color=brd, clip=True)
    if state == "selected":
        doc.frame(parent, "Card selected ring", x - 2, y - 2, w + 4, h + 4, fill=None,
                  radius=16, stroke_color=ACCENT, stroke_w=2)
    if state == "playing":
        doc.frame(card, "Playing ring", -1, -1, w + 2, h + 2, fill=None, radius=15,
                  stroke_color=ACCENT, stroke_w=1.5)
    letter = letter or (title.strip()[:1].upper() if title.strip() else "R")
    t = doc.frame(card, "Tile", 12, 12, 28, 28, fill=solid(color), radius=8)
    doc.text(t, "Letter", 0, 3.5, 28, letter, size=14, weight=600,
             color=contrast_text(color), align="center")
    if playing:
        doc.ellipse(card, "Playing dot", 36, 36, 10, 10, solid(ACCENT),
                    stroke_color="#0A0A0A", stroke_w=2)
    meta = "%d БАЛЛОВ · %s" % (cost, "АКТИВНА" if state != "disabled" else "ВЫКЛЮЧЕНА")
    title_lines_raw = wrap_lines(title, w - 90, 13.2, 600)
    if len(title_lines_raw) > 2:
        second = title_lines_raw[1]
        while second and measure(second + "…", 13.2, 600) > w - 90:
            second = second[:-1]
        title = title_lines_raw[0] + "\n" + second + "…"
        title_lines_raw = title_lines_raw[:2]
    else:
        title = "\n".join(title_lines_raw)
    title_lines = len(title_lines_raw)
    meta_y = 44 if title_lines > 1 else 27
    doc.text(card, "Title", 48, 10 if title_lines > 1 else 11, w - 90, title,
             size=13.2, weight=600, color=TEXT, max_height=32)
    doc.text(card, "Meta", 48, meta_y, w - 96,
             fc.trunc(meta, 8.8, 400, w - 104), size=8.8, color="#8E8A8B", tracking=0.2)
    if flags:
        fx = w - 44 - (len(flags) - 1) * 20
        for flag in flags:
            c, cw2 = chip(doc, kit, card, fx, 33, flag, color="#B9B9B9",
                          bg="#FFFFFF0F", border="#FFFFFF1F", size=15, fs=8.4)
            fx += cw2 + 4
    icon(doc, card, "dots", w - 30, 14, 15, "#A8A8A8")
    # sound chip
    fy = 56
    has = state != "nosound"
    if not has:
        chip_f = doc.frame(card, "Sound empty", 12, fy, w - 24, 30, fill=None, radius=9,
                           stroke_color="#FFFFFF2E")
        doc.text(chip_f, "Empty text", 10, 8, w - 36, "Звук не выбран", size=11, color="#B0B0B0")
        doc.text(chip_f, "Empty hint", w - 24, 9, 18, "·", size=11, color=DIM, align="right")
    else:
        fchip = doc.frame(card, "Sound chip", 12, fy, w - 24, 30, fill=solid("#FFFFFF0E"),
                          radius=9)
        doc.ellipse(fchip, "Play", 6, 5, 20, 20, solid("#FFFFFF16"))
        icon(doc, fchip, "play", 12, 9, 9, "#EDEDED")
        doc.text(fchip, "File", 31, 7, w - 70, fc.trunc(file_name, 10.8, 400, w - 146),
                 size=10.8, color="#DADADA")
        doc.text(fchip, "Fmt", w - 100, 8, 64, fmt, size=9.4, color=DIM, align="right")
    # volume
    vy = fy + 38
    slider(doc, card, 12, vy + 6, w - 108, 0.5 if has else 0,
           color="#EDEDED" if has else "#FFFFFF12", track="#FFFFFF29")
    doc.text(card, "Vol", w - 74, vy, 62, ("%d%%" % volume) if has else "—",
             size=9.6, color="#B3B3B3", align="right")
    # action slot
    ay = vy + 24
    if not has:
        kit.button(card, 12, ay, "Выбрать звук", "primary", "sm", width=w - 24)
    if playing:
        chip(doc, kit, card, w - 86, ay + 2, "играет ×%d" % playing,
             color=ACCENT_TEXT, bg=ACCENT_SOFT, border=ACCENT_BORDER, size=20, fs=9.6)
    return card


def reward_row(doc, kit, parent, x, y, w, title, cost, color, state="normal",
               file_name="newbie.mp3", fmt="MP3", duration="0:08", volume=100,
               playing=0, badge=None, compact=False):
    h = 48
    row = doc.frame(parent, "Row/" + title, x, y, w, h, fill=solid("#FFFFFF05"),
                    radius=10)
    if compact:
        title_w = int(w * 0.33)
        filex = int(w * 0.40)
        volx = int(w * 0.63)
        statusx = int(w * 0.84)
    else:
        title_w = int(w * 0.27)
        filex = int(w * 0.36)
        volx = int(w * 0.60)
        statusx = int(w * 0.79)
    doc.rect(row, "Tile", 10, 11, 26, 26, solid(color), 7)
    doc.text(row, "Letter", 10, 16, 26, title.strip()[:1].upper(), size=12.6,
             weight=600, color=contrast_text(color), align="center")
    doc.text(row, "Title", 46, 8, title_w, title, size=13.2, weight=600, color=TEXT)
    doc.text(row, "Meta", 46, 25, title_w, "%d БАЛЛОВ · АКТИВНА" % cost,
             size=10, color="#8E8A8B", tracking=0.3)
    if playing and compact:
        px = 46 + min(measure(title, 13.2, 600) + 8, title_w - 30)
        doc.ellipse(row, "Playing dot", px, 16, 8, 8, solid(ACCENT))
        doc.text(row, "Playing x", px + 12, 14, 40, "×%d" % playing, size=9.4,
                 weight=600, color=ACCENT_TEXT)
    if badge:
        bx = 46 + min(measure(title, 13.2, 600) + 12, title_w - 96)
        chip(doc, kit, row, bx, 14, badge, color="#B0B0B0", bg="#FFFFFF0F",
             border="#FFFFFF1F", size=18, fs=9)
    if file_name:
        doc.ellipse(row, "Play bg", filex, 13, 26, 26, solid("#FFFFFF16"))
        icon(doc, row, "play", filex + 7, 19, 10, "#EDEDED")
        doc.text(row, "File", filex + 34, 15, volx - filex - 80,
                 fc.trunc(file_name, 12.2, 400, volx - filex - 124),
                 size=12.2, color="#DADADA")
        doc.text(row, "Fmt", volx - 78, 15, 74, "%s · %s" % (fmt, duration),
                 size=10.2, color=DIM, align="right")
        slider(doc, row, volx, 23, 112, volume / 200.0)
        doc.text(row, "Vol", volx + 120, 15, 56, "%d%%" % volume, size=10.6,
                 color="#CFCFCF")
    else:
        doc.text(row, "No sound", filex, 15, 240, "Звук не выбран", size=11.6, color=DIM)
    if not compact:
        if playing:
            chip(doc, kit, row, statusx, 14, "играет ×%d" % playing,
                 color=ACCENT_TEXT, bg=ACCENT_SOFT, border=ACCENT_BORDER, size=20, fs=9.4)
        else:
            doc.text(row, "Status", statusx, 15, 90, "—", size=10.6, color=DIM, align="left")
    icon(doc, row, "dots", w - 30, 16, 15, "#A8A8A8")
    return row


# ---------------------------------------------------------------- rewards screen
def rewards_screen(doc, kit, x, y, w=1220, h=840, view="grid", active="Награды",
                   cursor_state=None):
    win = window(doc, kit, _page_of(doc, x, y, w, h), x, y, w, h, "Награды / %s / %d×%d" % (view, w, h))
    sidebar(doc, kit, win, h=h, active=active, rail=(w < 1000))
    topbar(doc, kit, win, x=64 if w < 1000 else 236, w=w - (64 if w < 1000 else 236))
    footer(doc, kit, win, x=64 if w < 1000 else 236, w=w - (64 if w < 1000 else 236))
    cx = 64 if w < 1000 else 236
    cw = w - cx
    pad = 24
    area = doc.frame(win, "Content", cx, 94, cw, h - 94 - 36, fill=solid(BG), clip=True)
    page_head(doc, kit, area, pad, 16, cw - pad * 2, "Награды",
              "@goshanmur · 11 наград · 9 со звуком")
    # toolbar
    ty = 92
    search = doc.frame(area, "Search", pad, ty, 250 if w > 1000 else 196, 34,
                       fill=solid("#FFFFFF0D"), radius=17, stroke_color=BORDER2)
    icon(doc, search, "search", 11, 9.5, 15, DIM)
    doc.text(search, "Placeholder", 33, 9.4, 200, "Поиск награды", size=13.4, color=DIM)
    seg = doc.frame(area, "Segmented", pad + (256 if w > 1000 else 202), ty, 170, 34,
                    fill=solid("#FFFFFF0D"), radius=17, stroke_color=BORDER2)
    doc.frame(seg, "Seg active", 3, 3, 82, 28, fill=solid("#EDEDED"), radius=14)
    doc.text(seg, "Grid", 3, 8.5, 82, "Плитка", size=12.6, weight=600, color="#0A0A0A", align="center")
    doc.text(seg, "List", 88, 8.5, 78, "Список", size=12.6, color="#A8A8A8", align="center")
    if w > 1000:
        select_field(doc, area, pad + 432, ty, 160, "Все награды", h=34)
        icon(doc, area, "refresh", cw - pad - 214, ty + 9, 16, MUTED)
        kit.button(area, cw - pad - 190, ty - 1, "Остановить всё", "ghost", "sm", width=166)
    else:
        icon(doc, area, "refresh", cw - pad - 210, ty + 9, 16, MUTED)
        kit.button(area, cw - pad - 186, ty - 1, "Остановить всё", "ghost", "sm", width=162)
    # filters
    fy = ty + 46
    if w > 1000:
        filt = [("Все", "11", None), ("Со звуком", "9", None), ("Без звука", "2", WARN),
                ("Играет", "0", ACCENT), ("Выключенные", "9", DIM)]
    else:
        filt = [("Все", "11", None), ("Со звуком", "9", None),
                ("Без звука", "2", WARN), ("Играет", "0", ACCENT)]
    fx = pad
    for i, (name, count, dotc) in enumerate(filt):
        active_f = i == 0
        wd = int(measure(name, 12.2, 500) + measure(count, 11, 600) + 64)
        if dotc:
            wd += 12
        f = doc.frame(area, "Filter/" + name, fx, fy, wd, 30,
                      fill=solid("#EDEDED" if active_f else "#FFFFFF09"),
                      radius=15,
                      stroke_color="#EDEDED57" if active_f else BORDER2)
        tx = 12
        if dotc:
            doc.ellipse(f, "Dot", tx, 12, 6, 6, solid(dotc))
            tx += 12
        doc.text(f, "Name", tx, 8.5, measure(name, 12.2, 500) + 6, name, size=12.2,
                 weight=500 if not active_f else 600,
                 color="#0A0A0A" if active_f else "#B9B9B9")
        doc.text(f, "Count", wd - 30, 8.5, 26, count, size=11, weight=600,
                 color="#0A0A0A" if active_f else "#EDEDED", align="right")
        fx += wd + 8
    if w <= 1000:
        doc.text(area, "More filters", fx + 4, fy + 8, 90, "Ещё 9", size=11.6,
                 color=MUTED)
    # cards
    gy = fy + 44
    if view == "grid":
        cols = 4 if w > 1000 else 2
        card_w = (cw - pad * 2 - (cols - 1) * 10) / cols
        card_h = 168
        data = [
            ("Ты новичок?", 200, REWARD_COLORS[0], "normal", "newbie.mp3", "MP3", 200),
            ("Мне нравится как он", 150, REWARD_COLORS[1], "normal", "ilikehowhesmoving.mp3", "0:12", 168),
            ("МУЗЫКА ЮТУБ", 50, REWARD_COLORS[2], "nosound", "", "", 0),
            ("СКАЗАНУТЬ ЧЕТО", 250, REWARD_COLORS[3], "nosound", "", "", 0),
            ("А где донаты", 100, REWARD_COLORS[4], "normal", "wheredonats.mp3", "0:05", 185),
            ("Смешок", 200, REWARD_COLORS[5], "normal", "shitpost-laugh.mp3", "0:02", 109),
            ("Шиза", 250, REWARD_COLORS[6], "playing", "Kanye - Vulvas.mp3", "3:14", 46),
            ("Беги", 200, REWARD_COLORS[7], "normal", "run.mp3", "0:02", 133),
            ("Выстрел", 50, REWARD_COLORS[8], "normal", "shot.mp3", "0:01", 200),
            ("Звук доната", 300, REWARD_COLORS[2], "normal", "donate100webm.mp3", "0:05", 128),
            ("Доброе утро", 150, "#C9A227", "normal", "dobroeUTRO.mp3", "0:02", 98),
        ]
        for i, (title, cost, colr, state, fname, fmt, vol) in enumerate(data):
            cc = i % cols
            rr = i // cols
            if gy + rr * (card_h + 10) + card_h > h - 36 - 40:
                break
            flags = ("♪",) if title == "МУЗЫКА ЮТУБ" else ()
            if title == "СКАЗАНУТЬ ЧЕТО":
                flags = ("Aa",)
            reward_card(doc, kit, area, pad + cc * (card_w + 10),
                        gy + rr * (card_h + 10) - 12, card_w, card_h, title, cost,
                        colr, state=state, file_name=fname, fmt=fmt, volume=vol,
                        playing=1 if state == "playing" else 0, flags=flags)
    else:
        rows = [
            ("Ты новичок?", 200, REWARD_COLORS[0], "newbie.mp3", "MP3", 200, 0),
            ("Мне нравится как он", 150, REWARD_COLORS[1], "ilikehowhesmoving.mp3", "MP3", 168, 0),
            ("МУЗЫКА ЮТУБ", 50, REWARD_COLORS[2], "", "", 0, 0),
            ("СКАЗАНУТЬ ЧЕТО", 250, REWARD_COLORS[3], "", "", 0, 0),
            ("А где донаты", 100, REWARD_COLORS[4], "wheredonats.mp3", "MP3", 185, 0),
            ("Смешок", 200, REWARD_COLORS[5], "shitpost-laugh.mp3", "MP3", 109, 0),
            ("Шиза", 250, REWARD_COLORS[6], "Kanye - Vulvas.mp3", "MP3", 46, 1),
            ("Беги", 200, REWARD_COLORS[7], "run.mp3", "MP3", 133, 0),
            ("Выстрел", 50, REWARD_COLORS[8], "shot.mp3", "MP3", 200, 0),
        ]
        for i, row in enumerate(rows):
            title, cost, colr, fname, fmt = row[0], row[1], row[2], row[3], row[4]
            numbers = [v for v in row[5:] if isinstance(v, (int, float))]
            vol = int(numbers[0]) if numbers else 0
            playing = numbers[1] if len(numbers) > 1 else 0
            yy = gy + i * 52 - 8
            if yy + 52 > h - 36 - 10:
                break
            reward_row(doc, kit, area, pad, yy, cw - pad * 2 - 8, title, cost, colr,
                       file_name=fname, fmt=fmt, volume=vol, playing=playing,
                       compact=(w < 1000),
                       badge="МУЗЫКА" if title == "МУЗЫКА ЮТУБ" else None)
    return win


def _page_of(doc, x, y, w, h):
    # find a page that contains the frame (callers pass page explicitly elsewhere)
    for pid in doc.pages:
        p = doc.nodes[str(pid)]
        children = p.get("children", [])
        # if this frame is not yet created we assume last page; callers pass page mostly
    return doc.pages[-1]


# ---------------------------------------------------------------- music
def music_screen(doc, kit, page, x, y, w=1220, h=840, empty=False, active="Музыка", queue_rows=None):
    win = window(doc, kit, page, x, y, w, h, "Музыка / %d×%d" % (w, h))
    sidebar(doc, kit, win, h=h, active=active, rail=(w < 1000))
    cx = 64 if w < 1000 else 236
    cw = w - cx
    topbar(doc, kit, win, x=cx, w=cw)
    footer(doc, kit, win, x=cx, w=cw)
    area = doc.frame(win, "Content", cx, 94, cw, h - 130, fill=solid(BG), clip=True)
    pad = 24
    page_head(doc, kit, area, pad, 16, cw - pad * 2, "Музыка",
              "Треки по заявке: зритель присылает ссылку на YouTube в чат")
    # header actions
    icon(doc, area, "dots", cw - pad - 404, 36, 16, MUTED)
    kit.button(area, cw - pad - 380, 24, "Оверлей OBS", "secondary", "md", width=146)
    kit.button(area, cw - pad - 196, 24, "Принимаем заявки", "primary", "md", width=168)
    # reward pill row
    ty = 84
    pill = doc.frame(area, "Music reward pill", pad, ty, 268, 30,
                     fill=solid("#EDEDED1F"), radius=15, stroke_color="#EDEDED57")
    doc.text(pill, "Reward text", 12, 8.5, 244,
             "Награда: МУЗЫКА ЮТУБ · 50 баллов", size=12.2, color=TEXT)
    doc.text(area, "Edit reward", pad + 280, ty + 6, 80, "Изменить", size=12.2, color=MUTED)
    ytdlp = doc.frame(area, "yt-dlp pill", cw - pad - 200, ty, 200, 30,
                      fill=solid(ACCENT_SOFT), radius=15, stroke_color=ACCENT_BORDER)
    icon(doc, ytdlp, "check", 12, 9, 12, ACCENT_TEXT)
    doc.text(ytdlp, "text", 30, 8.5, 160, "yt-dlp 2026.10.26", size=12.2, color=ACCENT_TEXT)
    # player card
    py = ty + 44
    player = doc.frame(area, "Player", pad, py, cw - pad * 2, 156,
                       fill=solid(PANEL), radius=16, stroke_color=BORDER2)
    if empty:
        doc.frame(player, "Art", 16, 16, 102, 102, fill=gradient(["#242424", "#161616"]),
                  radius=14)
        icon(doc, player, "music", 52, 56, 30, "#6E6E6E")
        doc.text(player, "State", 138, 16, 300, "НИЧЕГО НЕ ИГРАЕТ", size=10.6, weight=600,
                 color=MUTED, tracking=1.4)
        doc.text(player, "Title", 138, 34, 420, "Ничего не играет", size=19, weight=600, color=TEXT)
        doc.text(player, "Hint", 138, 62, 460,
                 "Активируйте награду на канале — трек встанет в очередь", size=12.8, color=MUTED)
        kit.button(player, 138, 92, "Поставить трек вручную", "secondary", "sm", width=196)
        doc.text(player, "Hint2", 138, 124, 420,
                 "Плеер появится, когда придёт первый трек — из награды или ручной очереди.",
                 size=11.2, color=DIM)
    else:
        doc.frame(player, "Art", 16, 16, 102, 102, fill=gradient(["#2A2A2A", "#141414"]),
                  radius=14)
        icon(doc, player, "music", 52, 56, 30, "#6E6E6E")
        doc.text(player, "State", 138, 14, 420, "СЕЙЧАС ИГРАЕТ", size=10.6, weight=600,
                 color=ACCENT_TEXT, tracking=1.4)
        doc.text(player, "Title", 138, 32, 520, "ДИНАСТИЯ — Земляк", size=19, weight=600, color=TEXT)
        doc.text(player, "Meta", 138, 60, 460, "заказал @nix · YouTube · 2:44", size=12.8, color=MUTED)
        slider(doc, player, 170, 84, 470, 0.35, knob=True)
        doc.text(player, "Pos", 138, 78, 40, "0:58", size=11, color=MUTED)
        doc.text(player, "Dur", 646, 78, 42, "2:44", size=11, color=MUTED, align="right")
        for i, k in enumerate(("prev", "pause", "next")):
            doc.ellipse(player, "Ctrl btn", 138 + i * 44, 104, 34, 34,
                        solid("#FFFFFF1A") if k == "pause" else solid("#FFFFFF0F"))
            icon(doc, player, k, 138 + i * 44 + 11, 104 + 11, 12,
                 "#0A0A0A" if k == "pause" else "#EDEDED")
        doc.text(player, "Skip label", 290, 112, 160, "Пропустить трек", size=13, color="#B9B9B9")
    # player side
    side = doc.frame(player, "Player side", cw - pad * 2 - 220, 0, 220, 156,
                     fill=None)
    doc.line(side, "Side divider", 0, 14, 0, "#FFFFFF", 0.07)
    doc.text(side, "Vol label", 18, 16, 160, "Громкость музыки", size=11.6, color=MUTED)
    slider(doc, side, 18, 40, 120, 0.05)
    doc.text(side, "Vol value", 150, 32, 50, "5%", size=12, color=TEXT)
    doc.text(side, "Vol hint", 18, 58, 190,
             "Не меняет громкость Windows — только очередь.", size=11, color=DIM)
    doc.text(side, "Next", 18, 112, 190, "Следующий: —", size=11, color=MUTED)
    # queue card
    qy = py + 168
    queue = doc.frame(area, "Queue", pad, qy, cw - pad * 2, 206, fill=solid(PANEL),
                      radius=16, stroke_color=BORDER2)
    qcount = len(queue_rows) if queue_rows else 0
    doc.text(queue, "Queue title", 16, 16, 300, "Очередь · %d из 10" % qcount, size=16.4, weight=600, color=TEXT)
    doc.text(queue, "Clear", cw - pad * 2 - 100, 19, 84, "Очистить", size=12.2,
             color=DANGER, align="right")
    if queue_rows:
        yy = 48
        for (title, user, dur, status, scolor) in queue_rows:
            row = doc.frame(queue, "Queue row/" + title, 12, yy, cw - pad * 2 - 24, 34,
                            fill=solid("#FFFFFF05"), radius=8)
            doc.text(row, "Title", 10, 8, 320, title, size=11.8, color=TEXT2)
            doc.text(row, "User", 340, 8, 120, user, size=10.8, color=DIM)
            doc.text(row, "Dur", 470, 8, 50, dur, size=10.8, color=DIM)
            chip(doc, kit, queue, 12 + cw - pad * 2 - 260, yy + 7, status, color=scolor,
                 bg=scolor + "1A", border=scolor + "52", size=20, fs=9.4)
            yy += 38
    else:
        doc.text(queue, "Queue hint", 16, 46, 520,
                 "Очередь пуста. Ссылка из активации награды появится здесь.", size=12.6, color=MUTED)
    addrow = doc.frame(queue, "Add row", 16, 74, cw - pad * 2 - 32, 40,
                       fill=solid("#FFFFFF0A"), radius=10, stroke_color=BORDER2)
    icon(doc, addrow, "plus", 12, 12, 16, DIM)
    doc.text(addrow, "Placeholder", 36, 12, 520,
             "Вставьте ссылку YouTube и нажмите Enter — трек встанет в очередь", size=12.8, color=DIM)
    kit.button(queue, cw - pad * 2 - 132, 76, "В очередь", "primary", "sm", width=100)
    # bottom cards
    by = qy + 218
    obs = doc.frame(area, "OBS card", pad, by, (cw - pad * 2) * 0.55, 128,
                    fill=solid(PANEL), radius=16, stroke_color=BORDER2)
    doc.text(obs, "Title", 16, 14, 300, "OBS — строка «Сейчас играет»", size=14, weight=600, color=TEXT)
    doc.text(obs, "Settings", (cw - pad * 2) * 0.55 - 96, 16, 80, "Настроить", size=12, color=MUTED,
             align="right")
    url = doc.frame(obs, "URL", 16, 44, 280, 28, fill=solid("#FFFFFF0A"), radius=8,
                    stroke_color=BORDER2)
    doc.text(url, "Url", 10, 7, 230, "http://127.0.0.1:8770/overlay", size=10.8, color="#CFCFCF")
    kit.button(obs, (cw - pad * 2) * 0.55 - 188, 44, "Показать сейчас", "secondary", "sm", width=120)
    doc.text(obs, "Preview", 16, 86, 400, "Ничего не играет", size=11.4, color=DIM)
    state = doc.frame(area, "State card", pad + (cw - pad * 2) * 0.55 + 12, by,
                      (cw - pad * 2) * 0.45 - 12, 128, fill=solid(PANEL), radius=16,
                      stroke_color=BORDER2)
    doc.text(state, "Title", 16, 14, 200, "Состояние", size=14, weight=600, color=TEXT)
    rows = [("check", OK, "yt-dlp 2026.10.26 — готов"),
            ("check", OK, "Чат: команда !трек включена"),
            ("check", OK, "Звук: Analogue 1/2 (Audient iD4)")]
    yy = 42
    for k, c, t in rows:
        icon(doc, state, "check", 18, yy + 1, 11, c)
        doc.text(state, "Row", 36, yy, 340, t, size=11.6, color="#DADADA")
        yy += 24
    return win


# ---------------------------------------------------------------- chat
def chat_screen(doc, kit, page, x, y, w=1220, h=840, view="setup", active="Чат"):
    win = window(doc, kit, page, x, y, w, h, "Чат / %s / %d×%d" % (view, w, h))
    sidebar(doc, kit, win, h=h, active=active, rail=(w < 1000))
    cx = 64 if w < 1000 else 236
    cw = w - cx
    topbar(doc, kit, win, x=cx, w=cw)
    footer(doc, kit, win, x=cx, w=cw)
    area = doc.frame(win, "Content", cx, 94, cw, h - 130, fill=solid(BG), clip=True)
    pad = 24
    page_head(doc, kit, area, pad, 16, cw - pad * 2, "Чат",
              "Подключение, команды, модерация и оверлей — в одном приложении")
    kit.button(area, cw - pad - 214, 24, "Открыть чат на Twitch", "secondary", "md", width=200)
    # status pills
    ty = 84
    fx = pad
    for text, colr, pbg, pbrd in (("Подключён · goshanmur", OK, "#22C55E1A", "#22C55E47"),
                                  ("chat:read · chat:edit", ACCENT_TEXT, ACCENT_SOFT, ACCENT_BORDER),
                                  ("Команд: 6", TEXT2, "#FFFFFF0D", BORDER2)):
        wd = int(measure(text, 12.2, 500) + 26)
        f = doc.frame(area, "Chat status", fx, ty, wd, 30, fill=solid(pbg), radius=15,
                      stroke_color=pbrd)
        doc.text(f, "Text", 0, 8.5, wd, text, size=12.2, color=colr, align="center")
        fx += wd + 8
    doc.text(area, "Reconnect", cw - pad - 130, ty + 7, 122, "Переподключить", size=12,
             color=MUTED, align="right")
    # cards
    if view == "setup":
        cy = ty + 44
        c1 = doc.frame(area, "Connection card", pad, cy, 430, 300, fill=solid(PANEL),
                       radius=16, stroke_color=BORDER2)
        doc.text(c1, "Title", 16, 14, 300, "Подключение чата", size=15, weight=600, color=TEXT)
        doc.text(c1, "Sub", 16, 36, 380,
                 "Тот же вход Twitch, что и у наград — отдельный Client ID не нужен", size=11.8, color=MUTED)
        rows = [("Статус", "Подключено · модератор канала"),
                ("Права", "chat:read, chat:edit, moderator:manage:banned_users"),
                ("Токен", "обновлён 12 минут назад · автоматически")]
        yy = 66
        for name, value in rows:
            doc.text(c1, "K", 16, yy, 90, name, size=12.4, color=TEXT2)
            doc.text(c1, "V", 16, yy + 18, 380, value, size=11, color=MUTED)
            yy += 46
        kit.button(c1, 16, 206, "Проверить подключение", "primary", "sm", width=200)
        kit.button(c1, 228, 206, "Отключить", "ghost", "sm", width=110)
        c2 = doc.frame(area, "Commands card", pad + 442, cy, 430, 300, fill=solid(PANEL),
                       radius=16, stroke_color=BORDER2)
        doc.text(c2, "Title", 16, 14, 300, "Команды", size=15, weight=600, color=TEXT)
        doc.text(c2, "Sub", 16, 36, 300, "Кто может вызывать и что происходит", size=11.8, color=MUTED)
        cmds = [("!трек", "Ссылка YouTube → очередь", "все"),
                ("!queue", "Показать очередь в чате", "все"),
                ("!song", "Что играет сейчас", "все"),
                ("!skip", "Пропустить текущий трек", "модератор"),
                ("!звук", "Проиграть звук награды без баллов", "модератор")]
        yy = 64
        for cmd, desc, acc in cmds:
            doc.text(c2, "Cmd", 16, yy, 70, cmd, size=12, weight=600, color=TEXT)
            doc.text(c2, "Desc", 92, yy, 240, desc, size=11.8, color=MUTED)
            chip(doc, kit, c2, 336, yy - 3, acc, color=ACCENT_TEXT if acc == "модератор" else "#9A9A9A",
                 bg=ACCENT_SOFT if acc == "модератор" else "#FFFFFF0A",
                 border=ACCENT_BORDER if acc == "модератор" else BORDER2, size=18, fs=9)
            yy += 40
        kit.button(c2, 16, 258, "+ Добавить команду", "secondary", "sm", width=168)
        c3 = doc.frame(area, "Wide card", pad, cy + 312, cw - pad * 2, 250, fill=solid(PANEL),
                       radius=16, stroke_color=BORDER2)
        doc.text(c3, "Title", 16, 14, 400, "Модерация и автосообщения", size=15, weight=600, color=TEXT)
        doc.text(c3, "Sub", 16, 36, 420, "Базовые правила вместо ручного контроля", size=11.8, color=MUTED)
        toggles = [("Антиспам-фильтр", "Повторы, капс, флуд — таймаут 10 мин", True),
                   ("Блокировать ссылки", "Кроме ссылок YouTube в !трек", True),
                   ("Приветствие новых", "Шаблон: «Привет, {user}! Команда — !трек»", False)]
        yy = 64
        for name, hint, on in toggles:
            doc.text(c3, "Name", 16, yy, 320, name, size=12.6, weight=600, color=TEXT)
            doc.text(c3, "Hint", 16, yy + 18, 420, hint, size=10.8, color=MUTED)
            toggle(doc, c3, 520, yy - 2, on)
            yy += 56
    else:
        feed = doc.frame(area, "Chat feed", pad, ty + 44, 640, 560, fill=solid(PANEL),
                         radius=16, stroke_color=BORDER2)
        doc.text(feed, "Title", 16, 14, 300, "Чат канала", size=15, weight=600, color=TEXT)
        doc.text(feed, "Sub", 16, 36, 320, "Лента сообщений и команд", size=11.8, color=MUTED)
        messages = [
            ("nix", ACCENT_TEXT, "заказал трек — сейчас в очереди #2", "обычный"),
            ("женька", "#7DD3FC", "!queue", "команда"),
            ("druzhba", "#F5C97B", "рейд от @druzhba — 24 зрителя", "событие"),
            ("goshanmur", "#22C55E", "всем привет, сегодня музыка по заявкам", "стример"),
            ("mod_anya", "#EC4899", "@spamer123 таймаут 10 минут — повтор сообщений", "модератор"),
        ]
        yy = 64
        for nick, colr, text, kind in messages:
            doc.ellipse(feed, "Avatar", 16, yy + 2, 26, 26, solid(colr))
            doc.text(feed, "Nick", 52, yy, 110, nick, size=12.6, weight=600, color=colr)
            chip(doc, kit, feed, 150, yy - 1, kind, color="#B9B9B9", bg="#FFFFFF0A",
                 border=BORDER2, size=18, fs=9)
            doc.text(feed, "Message", 52, yy + 20, 540, text, size=12.6, color="#DDDDDD")
            doc.line(feed, "Divider", 16, yy + 50, 590, "#FFFFFF", 0.05)
            yy += 62
        send = doc.frame(feed, "Send row", 16, 500, 590, 40, fill=solid("#FFFFFF0B"),
                         radius=10, stroke_color=BORDER2)
        doc.text(send, "Placeholder", 12, 12, 420, "Написать сообщение…", size=12.8, color=DIM)
        kit.button(feed, 500, 0, "Отправить", "primary", "sm", width=90) if False else None
        doc.frame(send, "Send btn", 494, 6, 86, 28, fill=solid("#EDEDED"), radius=14)
        doc.text(send, "Send label", 494, 11, 86, "Отправить", size=11.4, weight=600,
                 color="#0A0A0A", align="center")
        right = doc.frame(area, "Overlay card", pad + 652, ty + 44, cw - pad * 2 - 652, 560,
                          fill=solid(PANEL), radius=16, stroke_color=BORDER2)
        doc.text(right, "Title", 16, 14, 300, "Оверлей чата", size=15, weight=600, color=TEXT)
        doc.text(right, "Sub", 16, 36, 300, "Источник «Браузер» в OBS", size=11.8, color=MUTED)
        url = doc.frame(right, "URL", 16, 62, 260, 30, fill=solid("#FFFFFF0A"), radius=8,
                        stroke_color=BORDER2)
        doc.text(url, "Url", 10, 8, 220, "127.0.0.1:8770/chat", size=10.6, color="#CFCFCF")
        doc.text(right, "Theme", 16, 112, 200, "Тема: тёмная · 60%", size=11.4, color=MUTED)
        doc.frame(right, "Preview", 16, 140, 250, 180, fill=solid("#0A0A0A"), radius=10,
                  stroke_color=BORDER2)
        doc.text(right, "Preview line1", 26, 154, 230, "@nix: заказал трек", size=10.6, color="#DDDDDD")
        doc.text(right, "Preview line2", 26, 172, 230, "@goshanmur: скоро включу", size=10.6, color="#C9A7FF")
    return win


# ---------------------------------------------------------------- settings
def settings_card(doc, kit, parent, x, y, w, h, title, sub):
    card = doc.frame(parent, "Settings/" + title, x, y, w, h, fill=solid(PANEL),
                     radius=16, stroke_color=BORDER2)
    doc.text(card, "Title", 16, 14, w - 32, title, size=15, weight=600, color=TEXT)
    doc.text(card, "Sub", 16, 36, w - 32, sub, size=11.8, color=MUTED)
    return card


def settings_screen(doc, kit, page, x, y, w=1220, h=840):
    win = window(doc, kit, page, x, y, w, h, "Настройки / %d×%d" % (w, h))
    sidebar(doc, kit, win, h=h, active="Настройки", rail=(w < 1000))
    cx = 64 if w < 1000 else 236
    cw = w - cx
    topbar(doc, kit, win, x=cx, w=cw)
    footer(doc, kit, win, x=cx, w=cw)
    area = doc.frame(win, "Content", cx, 94, cw, h - 130, fill=solid(BG), clip=True)
    pad = 24
    page_head(doc, kit, area, pad, 16, cw - pad * 2, "Настройки",
              "Twitch, звук и поведение приложения", actions=False)
    doc.text(area, "Autosave", cw - pad - 200, 34, 200,
             "Изменения сохраняются автоматически", size=10.6, color=DIM, align="right")
    icon(doc, area, "dots", cw - pad - 10, 36, 15, MUTED)
    gy = 100
    health = settings_card(doc, kit, area, pad, gy, cw - pad * 2, 160, "Здоровье системы",
                           "Все подсистемы в порядке")
    chip(doc, kit, health, cw - pad * 2 - 60, 16, "ОК", color=ACCENT_TEXT,
         bg=ACCENT_SOFT, border=ACCENT_BORDER, size=24, fs=10.4)
    rows = [("Twitch", "Подключено · @goshanmur", OK),
            ("EventSub", "Слушаем активации наград", OK),
            ("Чат", "Только чтение — нет прав на отправку", WARN),
            ("Звук", "Analogue 1/2 (Audient iD4)", OK)]
    yy = 58
    for name, value, colr in rows:
        doc.ellipse(health, "Status dot", 18, yy + 3, 7, 7, solid(colr))
        doc.text(health, "Name", 34, yy, 92, name, size=11.8, weight=600, color="#E6E6E6")
        doc.text(health, "Value", 130, yy, 520, value, size=11.4, color=MUTED)
        doc.text(health, "Open", cw - pad * 2 - 92, yy, 66, "Открыть", size=10.8,
                 color=ACCENT_TEXT, align="right")
        yy += 16
    kit.button(health, 16, 128, "Скопировать диагностику", "secondary", "sm", width=196)
    kit.button(health, 222, 128, "Открыть журнал", "ghost", "sm", width=140)
    cy = gy + 170
    col_w = (cw - pad * 2 - 24) / 3
    twitch = settings_card(doc, kit, area, pad, cy, col_w, 258, "Twitch",
                           "Аккаунт канала, с которого читаются награды")
    doc.text(twitch, "Connected", 16, 58, col_w - 32, "Подключено · @goshanmur",
             size=12.2, weight=600, color=TEXT)
    doc.text(twitch, "EventSub", 16, 78, col_w - 32, "Активации наград слушаются",
             size=10.8, color=MUTED)
    kit.button(twitch, 16, 100, "Обновить данные", "primary", "sm", width=172)
    kit.button(twitch, 16, 138, "Переподключить события", "secondary", "sm", width=230)
    doc.text(twitch, "Account", 16, 182, 120, "Аккаунт", size=11.8, weight=600, color=TEXT)
    doc.text(twitch, "Account hint", 16, 200, 168,
             "Сменить можно после отключения текущего", size=9.6, color=MUTED)
    kit.button(twitch, col_w - 96, 200, "Сменить…", "ghost", "sm", width=84)
    danger = doc.frame(twitch, "Danger zone", 12, 218, col_w - 24, 32,
                       fill=solid("#EF44440F"), radius=10, stroke_color="#EF44444D")
    doc.text(danger, "Label", 10, 6, 180, "ОПАСНАЯ ЗОНА", size=9.2, weight=600,
             color="#FCA5A5", tracking=1.2)
    doc.text(danger, "Text", 10, 21, col_w - 44,
             "Отключить Twitch — награды и чат перестанут работать", size=9.8, color=MUTED)
    sound = settings_card(doc, kit, area, pad + col_w + 12, cy, col_w, 258, "Звук",
                          "Громкость приложения и воспроизведение")
    doc.text(sound, "Vol", 16, 62, 120, "ГРОМКОСТЬ", size=9.2, color=DIM, tracking=1.2)
    slider(doc, sound, 112, 68, 132, 0.29)
    doc.text(sound, "Vol val", col_w - 60, 56, 44, "29%", size=11.8, color=TEXT, align="right")
    doc.text(sound, "Mute", 16, 96, 200, "Без звука", size=12.2, weight=600, color=TEXT)
    doc.text(sound, "Mute hint", 16, 114, 220, "Заглушить все звуки наград", size=10, color=MUTED)
    toggle(doc, sound, col_w - 56, 100, False)
    doc.text(sound, "Play", 16, 152, 220, "Воспроизводить звуки наград", size=12.2,
             weight=600, color=TEXT)
    toggle(doc, sound, col_w - 56, 154, True)
    doc.text(sound, "Play hint", 16, 176, col_w - 32,
             "Активации будут игнорироваться, пока выключено", size=10, color=MUTED)
    audio = settings_card(doc, kit, area, pad + (col_w + 12) * 2, cy, col_w, 258,
                          "Аудиовыход", "Куда играют звуки наград")
    doc.ellipse(audio, "Dot", 18, 62, 7, 7, solid(OK))
    doc.text(audio, "Device", 34, 56, col_w - 50, "Analogue 1/2 (Audient iD4)",
             size=11.8, color=TEXT)
    for i, t in enumerate(("Проверить звук", "Перезапустить аудио",
                           "Остановить все звуки", "Выровнять громкость")):
        kit.button(audio, 16, 82 + i * 38, t, "secondary", "sm", width=col_w - 32)
    ay = cy + 270
    if w < 1000:
        return win
    app = settings_card(doc, kit, area, pad, ay, col_w, 160, "Внешний вид",
                        "Акцентный цвет интерфейса. Не меняет статусы")
    kit.button(app, 16, 56, "Пример кнопки", "primary", "sm", width=120)
    chip(doc, kit, app, 144, 58, "Акцент", color=ACCENT_TEXT, bg=ACCENT_SOFT,
         border=ACCENT_BORDER, size=26, fs=10.6)
    doc.frame(app, "Accent swatch", 16, 92, 30, 30, fill=solid(ACCENT), radius=8,
              stroke_color=BORDER3)
    hexf = doc.frame(app, "Hex", 54, 92, 92, 30, fill=solid(SURF2), radius=8,
                     stroke_color=BORDER2)
    doc.text(hexf, "Hex", 9, 8, 76, "#8B00FF", size=11.4, color=TEXT)
    doc.text(app, "Reset", 154, 99, 88, "Сбросить", size=10.6, color=MUTED)
    for i, c in enumerate(REWARD_COLORS[:8]):
        doc.ellipse(app, "Preset", 16 + i * 24, 112, 18, 18, solid(c),
                    stroke_color="#F5F5F5" if i == 0 else None, stroke_w=2)
    doc.text(app, "Note", 16, 136, col_w - 32,
             "Меняется только акцент, статусы — нет", size=9, color=DIM)
    appbtn = settings_card(doc, kit, area, pad + col_w + 12, ay, col_w, 160, "Приложение",
                           "Запуск и поведение окна")
    for i, (name, hint, on) in enumerate((("Запускать с Windows", "", False),
                                          ("Закрывать в трей", "Крестик прячет окно", True),
                                          ("Запускать свёрнутым", "", False))):
        doc.text(appbtn, "Name", 16, 54 + i * 36, 200, name, size=11.6, weight=600, color=TEXT)
        if hint:
            doc.text(appbtn, "Hint", 16, 69 + i * 36, 200, hint, size=9.4, color=MUTED)
        toggle(doc, appbtn, col_w - 54, 56 + i * 36, on)
    music = settings_card(doc, kit, area, pad + (col_w + 12) * 2, ay, col_w, 160, "Музыка",
                          "Треки по заявке из чата")
    doc.ellipse(music, "Dot", 18, 60, 7, 7, solid(OK))
    doc.text(music, "Ready", 34, 54, 200, "Готова к заявкам", size=11.4, color=TEXT)
    doc.text(music, "Reward", 16, 82, 110, "НАГРАДА", size=9.2, color=DIM, tracking=1.2)
    doc.text(music, "Reward value", 16, 98, col_w - 32, "МУЗЫКА ЮТУБ · 50 баллов",
             size=11.4, color=TEXT)
    kit.button(music, 16, 108, "Настроить музыку", "secondary", "sm", width=col_w - 32)
    doc.text(music, "Link", 16, 140, col_w - 32, "Открыть вкладку «Музыка» →", size=11.2, color=ACCENT_TEXT)
    return win


# ---------------------------------------------------------------- log
def log_screen(doc, kit, page, x, y, w=1220, h=840):
    win = window(doc, kit, page, x, y, w, h, "Журнал / %d×%d" % (w, h))
    sidebar(doc, kit, win, h=h, active="Журнал", rail=(w < 1000))
    cx = 64 if w < 1000 else 236
    cw = w - cx
    topbar(doc, kit, win, x=cx, w=cw)
    footer(doc, kit, win, x=cx, w=cw)
    area = doc.frame(win, "Content", cx, 94, cw, h - 130, fill=solid(BG), clip=True)
    pad = 24
    page_head(doc, kit, area, pad, 16, cw - pad * 2, "Журнал",
              "События наград, музыки, Twitch и ошибки приложения", actions=False)
    kit.button(area, cw - pad - 300, 30, "Папка журнала", "secondary", "sm", width=142)
    kit.button(area, cw - pad - 190, 30, "Очистить", "danger-ghost", "sm", width=108)
    kit.button(area, cw - pad - 78, 30, "Обновить", "secondary", "sm", width=100)
    icon(doc, area, "dots", cw - pad - 18, 38, 15, MUTED)
    ty = 92
    search = doc.frame(area, "Log search", pad, ty, 300, 34, fill=solid("#FFFFFF0D"),
                       radius=17, stroke_color=BORDER2)
    icon(doc, search, "search", 11, 9.5, 15, DIM)
    doc.text(search, "Placeholder", 33, 9.4, 240, "Поиск по журналу", size=13.4, color=DIM)
    fx = pad + 310
    for i, t in enumerate(("Все", "Инфо", "Предупреждения", "Ошибки")):
        wd = int(measure(t, 12.2, 500) + 28)
        f = doc.frame(area, "Level/" + t, fx, ty, wd, 30,
                      fill=solid("#EDEDED" if i == 0 else "#FFFFFF09"), radius=15,
                      stroke_color="#EDEDED57" if i == 0 else BORDER2)
        doc.text(f, "Text", 0, 8.5, wd, t, size=12.2, color="#0A0A0A" if i == 0 else "#B9B9B9",
                 weight=600 if i == 0 else 400, align="center")
        fx += wd + 8
    checkbox(doc, area, cw - pad - 176, ty + 9, False)
    doc.text(area, "Debug", cw - pad - 154, ty + 8, 60, "Отладка", size=12.2, color=TEXT2)
    doc.text(area, "Count", cw - pad - 84, ty + 8, 80, "Записей: 361", size=11.6,
             color=MUTED, align="right")
    # log rows
    log = doc.frame(area, "Log card", pad, ty + 44, cw - pad * 2, 560, fill=solid(PANEL),
                    radius=16, stroke_color=BORDER2, clip=True)
    entries = [("2026-11-17 20:46:37.606", "ИНФО", ACCENT_TEXT, "Чат: подключён к #goshanmur в режиме только чтения"),
               ("2026-11-17 20:46:37.501", "ИНФО", ACCENT_TEXT, "Чат: подключён к каналу #goshanmur (только чтение)"),
               ("2026-11-17 20:46:36.548", "ПРЕДУПРЕЖДЕНИЕ", WARN, "Чат: Twitch не принял токен (нет прав chat:read?) — подключаемся анонимно"),
               ("2026-11-17 20:46:27.448", "ИНФО", ACCENT_TEXT, "EventSub: слушаем активации наград"),
               ("2026-11-17 20:46:27.153", "ИНФО", ACCENT_TEXT, "EventSub: подписка на награды активна (сессия AqoQip…Vbsc1h)"),
               ("2026-11-17 20:46:27.103", "ИНФО", ACCENT_TEXT, "Музыка: yt-dlp 2026.10.26 (F:\\WorkSpaces\\Mur rewards\\…\\yt-dlp.exe)"),
               ("2026-11-17 20:46:26.823", "ИНФО", ACCENT_TEXT, "Twitch: получено наград — 20"),
               ("2026-11-17 20:46:26.311", "ИНФО", ACCENT_TEXT, "Трей создан; start_minimized=false, close_to_tray=true"),
               ("2026-11-17 20:46:26.062", "ИНФО", ACCENT_TEXT, "Аудиовыход открыт: Analogue 1/2 (Audient iD4)"),
               ("2026-11-17 20:46:26.043", "ИНФО", ACCENT_TEXT, "Оверлей: http://127.0.0.1:8770/overlay")]
    yy = 10
    for time, level, colr, msg in entries:
        doc.text(log, "Time", 14, yy + 4, 150, time, size=10.6, color="#7D7D7D")
        doc.text(log, "Level", 170, yy + 4, 120, level, size=9.6, weight=600, color=colr,
                 tracking=0.4)
        doc.text(log, "Message", 296, yy + 3, cw - pad * 2 - 330, msg, size=11.6,
                 color="#D6D6D6")
        doc.line(log, "Row line", 14, yy + 30, cw - pad * 2 - 28, "#FFFFFF", 0.045)
        yy += 52
    return win


# ---------------------------------------------------------------- onboarding
def onboarding_screen(doc, kit, page, x, y, w=1220, h=840, offline=False):
    win = window(doc, kit, page, x, y, w, h, "Онбординг / %d×%d" % (w, h))
    sidebar(doc, kit, win, h=h, active="Награды", rail=(w < 1000))
    cx = 64 if w < 1000 else 236
    cw = w - cx
    topbar(doc, kit, win, x=cx, w=cw, health="warn" if offline else "ok")
    footer(doc, kit, win, x=cx, w=cw)
    area = doc.frame(win, "Content", cx, 94, cw, h - 130, fill=solid(BG), clip=True)
    pad = 24
    page_head(doc, kit, area, pad, 16, cw - pad * 2, "Награды",
              "Подключите Twitch, чтобы увидеть награды канала", actions=False)
    gy = 92
    quick = doc.frame(area, "Quick start", pad, gy, (cw - pad * 2) * 0.62, 430,
                      fill=solid(PANEL), radius=18, stroke_color=BORDER2)
    doc.text(quick, "Title", 20, 18, 300, "Быстрый старт", size=19, weight=600, color=TEXT)
    doc.text(quick, "Sub", 20, 44, 380,
             "Три шага — и звуки будут играть на стриме автоматически.", size=12.4, color=MUTED)
    chip(doc, kit, quick, 20, 74, "2 из 3", color=ACCENT_TEXT, bg=ACCENT_SOFT,
         border=ACCENT_BORDER, size=24, fs=10.8)
    steps = [("1", "Подключите Twitch",
              "Публичный Client ID вашего приложения на dev.twitch.tv — не пароль. Вход подтверждается кодом на сайте Twitch.", True),
             ("2", "Выберите награду и привяжите звук",
              "Награды Channel Points подтянутся с канала. Можно создать награду прямо здесь — и сразу выбрать файл.", True),
             ("3", "Проверьте звук",
              "Кнопка «Проверить звук» проиграет файл так же, как при активации награды, и покажет индикатор в шапке.", False)]
    yy = 112
    for num, title, text, done in steps:
        col = OK if done else "#F5F5F5"
        doc.ellipse(quick, "Step circle", 20, yy + 2, 30, 30,
                    solid("#22C55E1F") if done else solid("#FFFFFF14"),
                    stroke_color=OK if done else "#FFFFFF38", stroke_w=1.4)
        if done:
            icon(doc, quick, "check", 28, yy + 12, 14, OK)
        else:
            doc.text(quick, "Step num", 20, yy + 8, 30, num, size=13, weight=600, color=TEXT, align="center")
        doc.text(quick, "Step title", 62, yy, 400, title, size=15, weight=600, color=TEXT)
        doc.text(quick, "Step text", 62, yy + 22, 420, text, size=12, color=MUTED)
        if num == "1" or num == "3":
            kit.button(quick, 62, yy + 62, "Подключить Twitch" if num == "1" else "Проверить звук",
                       "primary", "sm", width=168 if num == "1" else 150)
        yy += 96
    right = doc.frame(area, "Why client id", pad + (cw - pad * 2) * 0.62 + 14, gy,
                      (cw - pad * 2) * 0.38 - 14, 240, fill=solid(PANEL), radius=18,
                      stroke_color=BORDER2)
    doc.text(right, "Title", 18, 16, 320, "Почему нужен Client ID?", size=15, weight=600, color=TEXT)
    bullets = ["Это идентификатор приложения, а не логин и не пароль.",
               "Нужен один раз: приложение запоминает вход между запусками.",
               "Понадобится 2FA на аккаунте Twitch — этого требует сам Twitch."]
    yy = 48
    for b in bullets:
        doc.ellipse(right, "Bullet", 18, yy + 4, 5, 5, solid(ACCENT))
        doc.text(right, "Bullet text", 30, yy, 300, b, size=11.2, color="#A8A8A8")
        yy += 46
    kit.button(right, 18, 190, "Открыть инструкцию", "secondary", "sm", width=180)
    audio = doc.frame(area, "Audio ok card", pad + (cw - pad * 2) * 0.62 + 14, gy + 254,
                      (cw - pad * 2) * 0.38 - 14, 162, fill=solid(PANEL), radius=18,
                      stroke_color=BORDER2)
    doc.frame(audio, "Audio icon", 18, 18, 38, 38, fill=solid(ACCENT_SOFT), radius=12)
    icon(doc, audio, "speaker", 28, 28, 16, ACCENT_TEXT)
    doc.text(audio, "Title", 66, 18, 240, "Звук готов", size=14, weight=600, color=TEXT)
    doc.text(audio, "Sub", 66, 38, 250,
             "Можно проверить его без Twitch — ниже локальные привязки.", size=11, color=MUTED)
    kit.button(audio, 18, 112, "Проверить звук", "secondary", "sm", width=160)
    # local bindings
    ly = gy + 444
    local = doc.frame(area, "Local bindings", pad, ly, cw - pad * 2, 180,
                      fill=solid(PANEL), radius=18, stroke_color=BORDER2)
    doc.text(local, "Title", 18, 16, 360, "Локальные привязки · 9", size=15, weight=600, color=TEXT)
    chip(doc, kit, local, 210, 16, "работают без Twitch", color=MUTED, bg="#FFFFFF0A",
         border=BORDER2, size=22, fs=10)
    doc.text(local, "Show all", cw - pad * 2 - 100, 20, 84, "Показать все", size=11.6,
             color=ACCENT_TEXT, align="right")
    for i, (title, colr, fname) in enumerate((("Ты новичок?", REWARD_COLORS[0], "newbie.mp3"),
                                              ("Мне нравится как он", REWARD_COLORS[1], "ilikehowhesmoving.mp3"),
                                              ("А где донаты", REWARD_COLORS[4], "wheredonats.mp3"))):
        bx = 18 + i * ((cw - pad * 2 - 36) / 3 + 6)
        bw = (cw - pad * 2 - 48) / 3
        c = doc.frame(local, "Local card", bx, 58, bw, 100, fill=solid("#FFFFFF08"),
                      radius=12, stroke_color=BORDER2)
        doc.rect(c, "Tile", 10, 10, 22, 22, solid(colr), 6)
        doc.text(c, "Letter", 10, 14, 22, title.strip()[:1].upper(), size=11, weight=600,
                 color=contrast_text(colr), align="center")
        doc.text(c, "Title", 40, 8, bw - 50, title, size=12, weight=600, color=TEXT)
        doc.text(c, "File", 10, 44, bw - 20, fname, size=10, color=MUTED)
        slider(doc, c, 10, 68, bw - 90, 0.5)
        doc.text(c, "Vol", bw - 64, 60, 54, "200%", size=9.6, color="#B3B3B3", align="right")
    return win


# ---------------------------------------------------------------- modal shell
def modal(doc, page, x, y, w, h, title, sub="", close=True):
    m = doc.frame(page, "Modal/" + title, x, y, w, h, fill=solid("#111111"),
                  radius=22, stroke_color=BORDER2, effects=[fc._shadow("#000000", 0.55, 30, 0, 80)])
    doc.text(m, "Title", 26, 20, w - 80, title, size=21.6, weight=600, color=TEXT)
    if sub:
        doc.text(m, "Sub", 26, 52, w - 70, sub, size=13, color=MUTED)
    if close:
        icon(doc, m, "close", w - 44, 22, 16, MUTED)
    return m


def dialog(doc, page, x, y, w, title, text, confirm="Подтвердить", danger=False,
           cancel="Отмена"):
    d = doc.frame(page, "Dialog/" + title, x, y, w, 170, fill=solid("#111111"), radius=20,
                  stroke_color=BORDER2)
    doc.text(d, "Title", 24, 20, w - 48, title, size=18, weight=600, color=TEXT)
    doc.text(d, "Text", 24, 52, w - 48, text, size=12.6, color=MUTED)
    kit_btn = None
    _mini_button(doc, w - 44 - 120, 118, 120, confirm, "danger" if danger else "primary")
    _mini_button(doc, 24, 118, 96, cancel, "secondary")
    return d


def _mini_button(doc, parent, x, y, w, label, variant="primary", h=34):
    specs = {"primary": ("#EDEDED", "#0A0A0A", None),
             "secondary": ("#160E0E", "#F5F5F5", BORDER2),
             "danger": ("#EF4444", "#0A0A0A", None),
             "ghost": (None, "#B9B9B9", None)}
    fill, txt, brd = specs[variant]
    b = doc.frame(parent, "Btn/" + label, x, y, w, h,
                  fill=solid(fill) if fill else None, radius=h / 2,
                  stroke_color=brd)
    doc.text(b, "Label", 0, (h - 13.6 * 1.2143) / 2, w, label, size=13.2,
             weight=600 if variant != "ghost" else 500, color=txt, align="center")
    return b


# ---------------------------------------------------------------- OBS overlays
def now_playing_overlay(doc, page, x, y, w=960, variant="glass"):
    h = 132
    if variant == "glass":
        f = doc.frame(page, "Overlay/Now Playing / glass", x, y, w, h,
                      fill=gradient(["#0F0F14E6", "#121220E6"]), radius=20,
                      stroke_color="#FFFFFF2E", clip=True)
        doc.rect(f, "Accent line", 0, 18, 4, h - 36, solid(ACCENT), radius=2)
        doc.frame(f, "Art", 24, 18, 96, 96, fill=gradient(["#2A2A3A", "#141420"]), radius=14)
        icon(doc, f, "music", 56, 50, 32, "#7A7A8A")
        doc.text(f, "State", 140, 18, 300, "СЕЙЧАС ИГРАЕТ", size=11, weight=600,
                 color=ACCENT_TEXT, tracking=1.6)
        doc.text(f, "Title", 140, 36, w - 200, "ДИНАСТИЯ — Земляк", size=25, weight=600, color=TEXT)
        doc.text(f, "Meta", 140, 68, 400, "заказал @nix · YouTube · 2:44", size=13, color=MUTED)
        slider(doc, f, 170, 98, w - 220, 0.36)
        doc.text(f, "Pos", 140, 92, 40, "0:58", size=11, color=MUTED)
        doc.text(f, "Dur", w - 54, 92, 40, "2:44", size=11, color=MUTED, align="right")
        icon(doc, f, "speaker", w - 40, 22, 16, MUTED)
    else:
        f = doc.frame(page, "Overlay/Now Playing / minimal", x, y, w, h,
                      fill=solid("#050505E0"), radius=0, stroke_color="#FFFFFF1A")
        doc.rect(f, "Accent", 0, 0, w, 6, solid(ACCENT))
        doc.text(f, "State", 28, 22, 300, "СЕЙЧАС ИГРАЕТ", size=11, weight=600,
                 color=ACCENT_TEXT, tracking=1.6)
        doc.text(f, "Title", 28, 42, w - 120, "ДИНАСТИЯ — Земляк", size=28, weight=600, color=TEXT)
        doc.text(f, "Meta", 28, 80, 500, "заказал @nix · YouTube · 2:44 · следующий: run.mp3",
                 size=13, color=MUTED)
        slider(doc, f, 60, 112, w - 140, 0.36)
    return f


def chat_overlay(doc, page, x, y, w=380, h=560, theme="dark"):
    bg = "#08080AE6" if theme == "dark" else "#F5F5F5F0"
    txt = TEXT if theme == "dark" else "#0A0A0A"
    muted = MUTED if theme == "dark" else "#5A5A5A"
    border = "#FFFFFF1F" if theme == "dark" else "#00000014"
    f = doc.frame(page, "Overlay/Chat / " + theme, x, y, w, h, fill=solid(bg),
                  radius=16, stroke_color=border, clip=True)
    doc.text(f, "Title", 16, 14, w - 32, "ЧАТ", size=11, weight=600,
             color=ACCENT_TEXT if theme == "dark" else ACCENT, tracking=1.6)
    rows = [("nix", "#C9A7FF", "заказал трек — в очереди #2"),
            ("женька", "#7DD3FC", "!queue"),
            ("druzhba", "#F5C97B", "рейд от @druzhba — 24 зрителя"),
            ("goshanmur", "#22C55E", "всем привет, сегодня музыка по заявкам"),
            ("mod_anya", "#EC4899", "@spamer123 таймаут 10 минут")]
    yy = 44
    for nick, colr, text in rows:
        doc.text(f, "Nick", 16, yy, 100, nick, size=11.6, weight=600, color=colr)
        lines = wrap_lines(text, w - 110, 11.4, 400)
        doc.text(f, "Text", 100, yy, w - 116, text, size=11.4, color=txt,
                 auto_height=True)
        yy += 22 + len(lines) * 14 + 10
    return f


# ---------------------------------------------------------------- document spec
def spec_frame(doc, page, x, y, w, h, name, caption="", note="", fill=PANEL):
    if caption:
        doc.text(page, "Caption/" + name, x, y - 34, max(320, w), caption,
                 size=15.2, weight=600, color=TEXT2)
    if note:
        doc.text(page, "Note/" + name, x, y - 13, max(320, w), note,
                 size=11.6, color=DIM)
    return doc.frame(page, name, x, y, w, h, fill=solid(fill), radius=16,
                     stroke_color=BORDER, clip=False)
