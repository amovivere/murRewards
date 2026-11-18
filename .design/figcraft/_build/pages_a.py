# -*- coding: utf-8 -*-
"""Pages 00-04: cover, design system, buttons matrix, controls, app shell."""
import fc
from fc import solid, gradient, hexmix, measure, wrap_lines
import ui
import ui2
from ui import (BG, PAGE, SIDEBAR, PANEL, SURF, SURF2, SURF3, BORDER, BORDER2, BORDER3,
                TEXT, TEXT2, MUTED, DIM, ACCENT, ACCENT_TEXT, ACCENT_SOFT,
                ACCENT_BORDER, OK, WARN, DANGER, INFO, REWARD_COLORS, icon,
                window, sidebar, topbar, footer, page_head)
from ui2 import (page_title, spec_frame, label, chip, dot, slider, toggle, checkbox,
                 input_field, select_field, textarea, stepper, reward_card, reward_row,
                 settings_card, modal, dialog, _mini_button)

PAGE_W = 1220
MARGIN = 120
GAP = 80


# ============================================================== 00 COVER
def page_cover(doc, kit):
    p = doc.page("00 — Обложка", "#0A0A0B")
    page_title(doc, p, MARGIN, 90, "00 · ОБЛОЖКА",
               "Reward Sounds — дизайн приложения",
               "Тёмный студийный интерфейс для стримера: награды, музыка, чат, настройки и журнал.")
    hero = spec_frame(doc, p, MARGIN, 250, 1600, 820, "Cover", "", "")
    doc.text(hero, "Eyebrow", 56, 60, 600, "REWARD SOUNDS · DESIGN SYSTEM v1.0", size=12,
             weight=600, color=ACCENT_TEXT, tracking=2.4)
    doc.text(hero, "Title", 56, 92, 1180, "Стрим звучит так, как он задуман.", size=64,
             weight=600, color=TEXT)
    doc.text(hero, "Lead", 56, 264, 1000,
             "Локальные звуки наград Twitch Channel Points, музыка по заявке из чата, "
             "OBS-оверлеи и один понятный пульт. Дизайн-источник для React-переноса.",
             size=17, color=MUTED)
    # accent line
    doc.rect(hero, "Accent line", 56, 344, 180, 6, solid(ACCENT), 3)
    # principles
    principles = [
        ("Стрим не ждёт",
         "Любое действие — в один клик. Опасное — с подтверждением. Ошибка — с объяснением и кнопкой «Повторить»."),
        ("Статус всегда виден",
         "Один чип «Все системы работают» отвечает на вопрос «всё готово к эфиру?». Проблема сама выходит наверх."),
        ("Зритель понимает, что происходит",
         "Оверлей «Сейчас играет», очередь и алерты говорят на языке стримера и зрителя, а не разработчика."),
    ]
    for i, (title, text) in enumerate(principles):
        x = 56 + i * 500
        card = doc.frame(hero, "Principle/%d" % i, x, 384, 460, 210, fill=solid(PANEL),
                         radius=18, stroke_color=BORDER2)
        doc.text(card, "Num", 24, 22, 60, "0%d" % (i + 1), size=13, weight=600,
                 color=ACCENT_TEXT, tracking=1.6)
        doc.text(card, "Title", 24, 52, 400, title, size=20, weight=600, color=TEXT)
        doc.text(card, "Text", 24, 88, 410, text, size=12.8, color=MUTED)
    # meta row
    doc.text(hero, "Meta", 56, 660, 1060,
             "1220×840 и 980×680 · Inter · акцент #8B00FF · тёмная тема · FigCraft 0.18.1 · ноябрь 2026",
             size=12.4, color=DIM)
    doc.text(hero, "Source", 56, 688, 1060,
             "Референс: reward-sounds-tauri 1.7.0 и React-прототип .design/prototypes/react. Тексты — реальные из приложения.",
             size=11.6, color=DIM)
    # screen map
    mapf = spec_frame(doc, p, MARGIN, 1130, 1600, 920, "Screen map", "", "")
    doc.text(mapf, "Title", 32, 28, 700, "Карта экранов", size=24, weight=600, color=TEXT)
    doc.text(mapf, "Sub", 32, 62, 1000,
             "14 страниц файла. Основные экраны — в двух размерах: 1220×840 и 980×680.",
             size=12.8, color=MUTED)
    screens = [
        ("01", "Дизайн-система", "Токены, типографика, сетка, иконки"),
        ("02", "Кнопки", "9 вариантов × 6 состояний × 3 размера"),
        ("03", "Поля и контролы", "Inputs, select, toggle, menu, toast, modal"),
        ("04", "Каркас", "Titlebar, sidebar, topbar, footer, меню"),
        ("05", "Награды", "Плитка, список, состояния, пусто/ошибка"),
        ("06", "Музыка", "Плеер, очередь, OBS, пустое состояние"),
        ("07", "Чат", "Подключение, команды, лента, оверлей"),
        ("08", "Настройки", "Здоровье, Twitch, звук, акцент, данные"),
        ("09", "Журнал", "Уровни, поиск, строки, очистка"),
        ("10", "Онбординг", "Первый запуск, шаги, локальные привязки"),
        ("11", "Модалки", "Награда, цена, OBS, подтверждения"),
        ("12", "OBS-оверлеи", "«Сейчас играет», чат, темы"),
        ("13", "Состояния", "Hover/focus/disabled, контраст, 980, DPI"),
        ("00", "Обложка", "Назначение, принципы, карта"),
    ]
    for i, (num, title, text) in enumerate(screens):
        col = i % 7
        row = i // 7
        x = 32 + col * 218
        y = 110 + row * 190
        card = doc.frame(mapf, "Map/%s" % num, x, y, 204, 170, fill=solid(SURF),
                         radius=14, stroke_color=BORDER2)
        doc.text(card, "Num", 16, 14, 40, num, size=12, weight=600, color=ACCENT_TEXT)
        doc.text(card, "Title", 16, 38, 176, title, size=14.4, weight=600, color=TEXT)
        doc.text(card, "Text", 16, 66, 176, text, size=10.8, color=MUTED)
        icon(doc, card, "chevron-right", 176, 140, 12, DIM)
    # how to read
    how = spec_frame(doc, p, MARGIN, 2140, 1600, 340, "How to read", "", "")
    doc.text(how, "Title", 32, 26, 700, "Как читать файл", size=24, weight=600, color=TEXT)
    steps = [("01", "Сначала 01–02", "Палитра, типографика, сетка и матрица кнопок — это контракт для React."),
             ("02", "Потом 03–04", "Контролы и каркас приложения: всё, из чего собираются экраны."),
             ("03", "Затем 05–13", "Экраны и состояния. Каждый фрейм подписан и готов к экспорту в код."),
             ("04", "Справа — токены", "Каждый образец подписан токеном; inspect.code отдаёт React + Tailwind.")]
    for i, (num, title, text) in enumerate(steps):
        x = 32 + i * 388
        doc.text(how, "Num", x, 84, 40, num, size=12, weight=600, color=ACCENT_TEXT)
        doc.text(how, "Title", x, 108, 340, title, size=14, weight=600, color=TEXT)
        doc.text(how, "Text", x, 134, 340, text, size=11.4, color=MUTED)
    return p


# ============================================================== 01 DESIGN SYSTEM
def page_design_system(doc, kit):
    p = doc.page("01 — Дизайн-система", "#0A0A0B")
    page_title(doc, p, MARGIN, 90, "01 · ДИЗАЙН-СИСТЕМА",
               "Дизайн-система",
               "Токены, типографика, сетка, радиусы, тени, motion и иконки. Слева — образец, справа — токен и применение.")

    # ---- palette
    f = doc.frame(p, "DS/Palette", MARGIN, 220, 1600, 1200, fill=solid(PANEL),
                  radius=20, stroke_color=BORDER2)
    doc.text(f, "Title", 32, 26, 700, "Палитра — роли, не оттенки", size=24, weight=600, color=TEXT)
    doc.text(f, "Sub", 32, 60, 1300,
             "Фон, поверхности, текст, акцент и семантика. Акцент меняется пользователем; статусы и опасные действия — нет.",
             size=12.6, color=MUTED)
    swatches = [
        ("canvas", "Canvas", "#0A0A0A", "Фон приложения"),
        ("page", "Page", "#0B0B0C", "Фон страницы FigCraft"),
        ("sidebar", "Sidebar", "#0E0E0E", "Сайдбар, рейл"),
        ("panel", "Panel", "#0D0D0D", "Карточки, панели"),
        ("surface", "Surface", "#111111", "Модалки, меню"),
        ("surface2", "Surface 2", "#161616", "Поля, input"),
        ("surface3", "Surface 3", "#1C1C1C", "Hover-поверхности"),
        ("text", "Text primary", "#F5F5F5", "Заголовки, значения"),
        ("text2", "Text secondary", "#B9B9B9", "Подписи, мета"),
        ("muted", "Text muted", "#8B8B8B", "Вторичные подписи"),
        ("dim", "Text dim", "#6E6E6E", "Декоративные подписи"),
        ("accent", "Accent", "#8B00FF", "Фокус, активное, играет"),
        ("accentText", "Accent text", "#C9A7FF", "Акцентный мелкий текст"),
        ("ok", "Success", "#22C55E", "Подключено, готово"),
        ("warn", "Warning", "#F59E0B", "Переподключение, внимание"),
        ("danger", "Danger", "#EF4444", "Ошибки, опасные действия"),
        ("info", "Info", "#7DD3FC", "Уровень «ИНФО» в журнале"),
        ("border", "Border", "#3A3A3A", "Границы, разделители"),
    ]
    for i, (key, name, hexv, use) in enumerate(swatches):
        col = i % 6
        row = i // 6
        x = 32 + col * 256
        y = 96 + row * 200
        card = doc.frame(f, "Swatch card/" + name, x, y, 244, 176, fill=solid("#121212"),
                         radius=12, stroke_color=BORDER2)
        block = doc.frame(card, "Swatch/" + name, 0, 0, 244, 104, fill=solid(hexv),
                          radius=[12, 12, 0, 0])
        dark = ui.luminance(hexv) < 0.2
        doc.text(block, "Name", 12, 64, 200, name, size=12.4, weight=600,
                 color="#F5F5F5" if dark else "#0A0A0A")
        doc.text(block, "Hex", 12, 82, 140, hexv, size=10.6,
                 color="#B9B9B9" if dark else "#3A3A3A")
        doc.text(card, "Role", 12, 114, 220, use, size=10.2, color=MUTED)
        doc.text(card, "Token", 12, 138, 220, "--" + key, size=9.6, color=DIM)
    # reward palette row
    doc.text(f, "Reward title", 32, 720, 600, "Цвета наград (8 + акцент)", size=15, weight=600,
             color=TEXT)
    doc.text(f, "Reward sub", 32, 744, 1300,
             "Хранятся на стороне Twitch у каждой награды. Тинт карточки — 13% цвета награды на #141414; рамка — 24% на #242424.",
             size=11.6, color=MUTED)
    for i, c in enumerate(REWARD_COLORS):
        x = 32 + i * 170
        block = doc.frame(f, "Reward color/%d" % i, x, 780, 156, 84, fill=solid(c),
                          radius=10)
        doc.text(f, "Reward hex/%d" % i, x, 872, 156, c, size=10.4, color=DIM)
    doc.text(f, "Rule", 32, 930, 1500,
             "Правило: акцент не заменяет статусы. OK/Warn/Danger и цвета наград остаются фиксированными при любой теме.",
             size=11.4, color=MUTED)
    doc.text(f, "Contrast", 32, 958, 1500,
             "Контраст: text/secondary/token подписи проверены на #0A0A0A (AA ≥ 4.5:1). Белый текст на акценте — только для #8B00FF.",
             size=11.4, color=MUTED)

    # ---- typography
    f = doc.frame(p, "DS/Type", MARGIN, 1380, 1600, 940, fill=solid(PANEL),
                  radius=20, stroke_color=BORDER2)
    doc.text(f, "Title", 32, 26, 700, "Типографика", size=24, weight=600, color=TEXT)
    doc.text(f, "Sub", 32, 60, 1100,
             "Inter. Шкала от 9 до 64 px, вес 400/500/600, трекинг только у капса. Высота строки — 1.21× кегля.",
             size=12.6, color=MUTED)
    types = [
        ("Display", 64, 600, 0, "Стрим звучит"),
        ("H1", 34, 600, 0, "Награды"),
        ("H2", 24, 600, 0, "Карта экранов"),
        ("H3", 19, 600, 0, "Быстрый старт"),
        ("H4", 15, 600, 0, "Подключение чата"),
        ("Body", 14, 400, 0, "Публичный Client ID вашего приложения на dev.twitch.tv — не пароль."),
        ("Body strong", 14, 600, 0, "Проверить звук"),
        ("Caption", 12, 400, 0, "Награды Channel Points подтянутся с канала."),
        ("Label", 11, 600, 2.4, "ГРОМКОСТЬ"),
        ("Micro", 9.4, 400, 0.3, "200 БАЛЛОВ · АКТИВНА"),
    ]
    yy = 96
    for name, size, weight, tracking, sample in types:
        doc.text(f, "Type name", 32, yy + 6, 120, name, size=11.6, weight=600, color=TEXT2)
        doc.text(f, "Type sample", 180, yy, 1100, sample, size=size, weight=weight,
                 color=TEXT, tracking=tracking, max_height=size * 1.6)
        doc.text(f, "Type token", 1300, yy + 6, 250,
                 "%s / %s / %s" % (size, "600" if weight >= 600 else "400",
                                   "tracking %.1f" % tracking if tracking else "auto"),
                 size=10.4, color=DIM)
        yy += max(58, size * 1.35)
        doc.line(f, "Type line", 32, yy - 12, 1536, "#FFFFFF", 0.04)

    # ---- grid & spacing
    f = doc.frame(p, "DS/Grid", MARGIN, 2400, 1600, 780, fill=solid(PANEL),
                  radius=20, stroke_color=BORDER2)
    doc.text(f, "Title", 32, 26, 700, "Сетка и отступы", size=24, weight=600, color=TEXT)
    doc.text(f, "Sub", 32, 60, 1100,
             "База 4 px, ритм 8 px. Контент 1220 — сайдбар 236 + 24 отступы; 980 — рейл 64. Карточки — 4 колонки, gap 10.",
             size=12.6, color=MUTED)
    spaces = [2, 4, 6, 8, 10, 12, 14, 16, 20, 24, 28, 32, 40, 48, 64]
    xx = 32
    for s in spaces:
        doc.rect(f, "Space/%d" % s, xx, 110, s * 8, 14, solid(ACCENT), 2)
        doc.text(f, "Space label/%d" % s, xx, 130, 40, str(s), size=9.4, color=DIM)
        xx += max(48, s * 8 + 16)
    # columns
    doc.text(f, "Cols title", 32, 180, 400, "1220×840 · 4 колонки", size=13, weight=600, color=TEXT)
    colw = (1220 - 48 - 236 - 3 * 10) / 4
    for i in range(4):
        doc.rect(f, "Col/%d" % i, 32 + i * (colw + 10), 208, colw, 90,
                 solid("#8B00FF1F"), 8, stroke_color=ACCENT_BORDER)
    doc.text(f, "Cols 980", 32, 330, 400, "980×680 · 2 колонки (рейл 64)", size=13, weight=600, color=TEXT)
    colw2 = (980 - 48 - 64 - 10) / 2
    for i in range(2):
        doc.rect(f, "Col980/%d" % i, 32 + i * (colw2 + 10), 358, colw2, 90,
                 solid("#8B00FF1F"), 8, stroke_color=ACCENT_BORDER)
    doc.text(f, "Rule", 32, 500, 1100,
             "Правило: карточки и списки живут в контенте с padding 24; сайдбар и шапка — вне сетки; тулбар — одна строка.",
             size=12, color=MUTED)
    doc.text(f, "Grid columns", 32, 540, 1200,
             "12-колоночная сетка для маркетинга не используется: приложение — модульная сетка карточек 4/2/1.",
             size=12, color=MUTED)

    # ---- radius / shadow / motion / icons in a row
    r = doc.frame(p, "DS/Radius", MARGIN, 3280, 780, 760, fill=solid(PANEL),
                  radius=20, stroke_color=BORDER2)
    doc.text(r, "Title", 28, 24, 500, "Радиусы и тени", size=20, weight=600, color=TEXT)
    radii = [("4", 4), ("6", 6), ("8", 8), ("10", 10), ("12", 12), ("14", 14),
             ("16", 16), ("18", 18), ("22", 22), ("pill", 999)]
    for i, (nm, rad) in enumerate(radii):
        x = 28 + (i % 5) * 148
        y = 78 + (i // 5) * 90
        doc.rect(r, "Radius/" + nm, x, y, 56, 48, solid(SURF2), min(rad, 24),
                 stroke_color=BORDER2)
        doc.text(r, "Radius label/" + nm, x + 66, y + 16, 60, nm, size=10.4, color=DIM)
    doc.text(r, "Shadow title", 28, 280, 400, "Тени", size=13, weight=600, color=TEXT)
    shadows = [("sm · 0 2 6", 2, 6, 0.4), ("md · 0 8 24", 8, 24, 0.45),
               ("lg · 0 24 80", 24, 80, 0.55)]
    for i, (nm, dy, blur, a) in enumerate(shadows):
        y = 308 + i * 86
        doc.frame(r, "Shadow/" + nm, 28, y, 96, 56, fill=solid(SURF2), radius=12,
                  stroke_color=BORDER2)
        doc.frame(r, "Shadow glow/" + nm, 28, y, 96, 56, fill=None, radius=12,
                  effects=[fc._shadow("#000000", a, dy, 0, blur)])
        doc.text(r, "Shadow label/" + nm, 140, y + 18, 260, nm, size=10.8, color=DIM)
    doc.text(r, "Glow title", 28, 580, 400, "Свечение акцента", size=13, weight=600, color=TEXT)
    doc.frame(r, "Glow", 28, 608, 96, 40, fill=solid(ACCENT), radius=20,
              effects=[fc._shadow(ACCENT, 0.45, -2, 0, 24)])

    s = doc.frame(p, "DS/Elevation", MARGIN + 800, 3280, 800, 760, fill=solid(PANEL),
                  radius=20, stroke_color=BORDER2)
    doc.text(s, "Title", 28, 24, 500, "Motion", size=20, weight=600, color=TEXT)
    doc.text(s, "Sub", 28, 52, 700,
             "Короткие, спокойные переходы. Всё, что мигает и пульсирует, отключается при reduced-motion.",
             size=11.6, color=MUTED)
    motions = [("120 ms", "hover / цвет / фон", "ease-out"),
               ("160 ms", "появление меню, тостов", "ease-out"),
               ("220 ms", "модалки, панели", "ease-in-out"),
               ("2.4 s", "пульсация «играет»", "ease-in-out, loop"),
               ("spring", "перетаскивание, слайдер", "mass 1 · stiffness 180")]
    for i, (dur, use, easing) in enumerate(motions):
        y = 96 + i * 62
        doc.text(s, "Dur", 28, y, 90, dur, size=12.4, weight=600, color=ACCENT_TEXT)
        doc.text(s, "Use", 130, y, 260, use, size=11.4, color=TEXT2)
        doc.text(s, "Easing", 400, y, 260, easing, size=10.6, color=DIM)
        doc.line(s, "Rule", 28, y + 34, 740, "#FFFFFF", 0.04)
    doc.text(s, "Title2", 28, 430, 500, "Состояния элемента", size=20, weight=600, color=TEXT)
    states = [("default", 1.0), ("hover", 1.0), ("pressed", 1.0), ("focus-visible", 1.0),
              ("disabled", 0.42), ("loading", 1.0)]
    for i, (nm, op) in enumerate(states):
        y = 470 + (i % 3) * 84
        x = 28 + (i // 3) * 380
        sample = doc.frame(s, "State/" + nm, x, y, 320, 56, fill=solid(SURF2), radius=10,
                           stroke_color=ACCENT_BORDER if nm == "focus-visible" else BORDER2,
                           stroke_w=2 if nm == "focus-visible" else 1, opacity=op)
        doc.text(sample, "Label", 16, 18, 200, "Состояние", size=12.6, color=TEXT2)
        doc.text(s, "State name/" + nm, x, y + 62, 300, nm, size=10.2, color=DIM)

    # icons
    ic = doc.frame(p, "DS/Icons", MARGIN, 4120, 1600, 640, fill=solid(PANEL),
                   radius=20, stroke_color=BORDER2)
    doc.text(ic, "Title", 32, 26, 700, "Иконки", size=24, weight=600, color=TEXT)
    doc.text(ic, "Sub", 32, 60, 1100,
             "Контур 16/20/24, толщина 1.6, currentColor. Примитивы собираются в один слой-иконку.",
             size=12.6, color=MUTED)
    kinds = ["grid", "music", "chat", "settings", "journal", "search", "play", "pause",
             "next", "prev", "plus", "check", "close", "chevron-down", "chevron-right",
             "refresh", "folder", "trash", "speaker", "mute", "dots", "external"]
    for i, k in enumerate(kinds):
        x = 32 + (i % 8) * 190
        y = 104 + (i // 8) * 120
        cell = doc.frame(ic, "Icon cell/" + k, x, y, 170, 100, fill=solid(SURF),
                         radius=12, stroke_color=BORDER2)
        icon(doc, cell, k, 70, 22, 24, TEXT)
        doc.text(cell, "Name", 0, 66, 170, k, size=10.2, color=MUTED, align="center")
    # dark theme rules
    dr = doc.frame(p, "DS/Rules", MARGIN, 4860, 1600, 460, fill=solid(PANEL),
                   radius=20, stroke_color=BORDER2)
    doc.text(dr, "Title", 32, 26, 700, "Тёмная тема — правила", size=24, weight=600, color=TEXT)
    do = ["Текст — #F5F5F5 / #B9B9B9; не чисто-белый.", "Поверхности на 2–4% светлее фона, без «дырок».",
          "Границы — тонкие и полупрозрачные.", "Акцент — только для интерактива и «играет».",
          "Тени мягкие, не чёрные плашки."]
    dont = ["Не красить статусы акцентом.", "Не делать чистый #000 и #FFF рядом.",
            "Не ставить мелкий текст на акцент без контраста.", "Не дублировать действия в трёх местах.",
            "Не использовать свечение на большой площади."]
    doc.text(dr, "Do title", 32, 82, 300, "МОЖНО", size=11, weight=600, color=OK, tracking=1.6)
    for i, t in enumerate(do):
        doc.text(dr, "Do/%d" % i, 32, 112 + i * 32, 700, "✓  " + t, size=12.4, color=TEXT2)
    doc.text(dr, "Dont title", 820, 82, 300, "НЕЛЬЗЯ", size=11, weight=600, color=DANGER, tracking=1.6)
    for i, t in enumerate(dont):
        doc.text(dr, "Dont/%d" % i, 820, 112 + i * 32, 700, "✕  " + t, size=12.4, color=TEXT2)
    return p


# ============================================================== 02 BUTTONS
def page_buttons(doc, kit):
    p = doc.page("02 — Кнопки", "#0A0A0B")
    page_title(doc, p, MARGIN, 90, "02 · КНОПКИ",
               "Кнопки",
               "Полная матрица: 9 вариантов × 6 состояний × 3 размера. Каждая ячейка подписана и снабжена токенами ниже.")
    variants = ["primary", "secondary", "ghost", "danger", "danger-ghost",
                "icon", "link", "pill", "segment"]
    states = ["default", "hover", "pressed", "focus-visible", "disabled", "loading"]
    sizes = ["sm", "md", "lg"]
    label_w = 250
    cell_w = 236
    cell_h = 104
    rows = [(v, s) for v in variants for s in sizes]
    H = 96 + len(rows) * cell_h + 120
    W = label_w + len(states) * cell_w + 64
    m = spec_frame(doc, p, MARGIN, 240, W, H, "Matrix",
                   "02.1 Матрица кнопок",
                   "Каждая ячейка: вариант / состояние / размер. Ниже ячейки — имя токена.")
    # header
    doc.text(m, "HLabel", 24, 44, label_w - 32, "ВАРИАНТ / РАЗМЕР", size=10, weight=600,
             color=DIM, tracking=1.6)
    for j, st in enumerate(states):
        doc.text(m, "H/%s" % st, 24 + label_w + j * cell_w + 16, 44, cell_w - 32, st,
                 size=11, weight=600, color=TEXT2)
        doc.text(m, "H token/%s" % st, 24 + label_w + j * cell_w + 16, 60, cell_w - 32,
                 {"default": "base", "hover": "+4% brightness", "pressed": "-8%",
                  "focus-visible": "2px accent ring", "disabled": "42% opacity / no events",
                  "loading": "spinner + 60% text"}[st], size=9, color=DIM)
    for i, (v, s) in enumerate(rows):
        y = 92 + i * cell_h
        if i % 3 == 0:
            doc.line(m, "Group line", 24, y - 10, W - 48, "#FFFFFF", 0.07)
        doc.text(m, "Row/%s/%s" % (v, s), 24, y + 20, label_w - 40, v, size=13.6,
                 weight=600, color=TEXT)
        doc.text(m, "Row size/%s/%s" % (v, s), 24, y + 40, label_w - 40, "size " + s,
                 size=10.6, color=MUTED)
        doc.text(m, "Row token/%s/%s" % (v, s), 24, y + 56, label_w - 40,
                 {"primary": "--btn-primary-bg: #EDEDED",
                  "secondary": "--btn-secondary-bg: #161616",
                  "ghost": "text: --fg-secondary",
                  "danger": "--danger: #EF4444",
                  "danger-ghost": "danger text + soft bg",
                  "icon": "40×40 · radius 999",
                  "link": "--accent-text",
                  "pill": "24–30px · radius 999",
                  "segment": "28px · radius 999"}[v],
                 size=9, color=DIM)
        for j, st in enumerate(states):
            x = 24 + label_w + j * cell_w
            cx = x + (cell_w - 24) / 2
            cy = y + cell_h / 2 - 8
            if v == "pill":
                wpx = 132
                pill_specs = {
                    "default": ("#FFFFFF09", "#B9B9B9", BORDER2, 400),
                    "hover": ("#FFFFFF14", "#F5F5F5", BORDER3, 400),
                    "pressed": ("#FFFFFF1F", "#EDEDED", BORDER3, 400),
                    "focus-visible": ("#FFFFFF09", "#B9B9B9", ACCENT_BORDER, 400),
                    "disabled": ("#FFFFFF05", "#6E6E6E", BORDER, 400),
                    "loading": ("#FFFFFF05", "#8B8B8B", BORDER, 400),
                }
                pbg, pfg, pbrd, pw = pill_specs[st]
                if st == "focus-visible":
                    doc.frame(m, "Ring", cx - wpx / 2 - 3, cy - 18, wpx + 6, 36, fill=None,
                              radius=18, stroke_color=ACCENT_TEXT, stroke_w=2)
                f = doc.frame(m, "Cell/%s/%s/%s" % (v, st, s), cx - wpx / 2, cy - 15, wpx, 30,
                              fill=solid(pbg), radius=15, stroke_color=pbrd)
                doc.ellipse(f, "Dot", 10, 12, 6, 6, solid(pfg))
                doc.text(f, "T", 22, 8.4, wpx - 40, "Со звуком", size=11.8,
                         weight=pw, color=pfg)
                if st == "loading":
                    doc.text(f, "N", wpx - 40, 8.4, 26, "12", size=10, color="#8B8B8B", align="right")
            elif v == "segment":
                wpx = 150
                f = doc.frame(m, "Cell/%s/%s/%s" % (v, st, s), cx - wpx / 2, cy - 15, wpx, 30,
                              fill=solid(SURF2), radius=15, stroke_color=BORDER2)
                doc.frame(f, "Seg active", 3, 3, 70, 24,
                          fill=solid("#EDEDED" if st != "disabled" else "#2A2A2A"), radius=12)
                doc.text(f, "T", 3, 8, 70, "Плитка", size=11.2, weight=600,
                         color="#0A0A0A" if st != "disabled" else "#6E6E6E", align="center")
                doc.text(f, "T2", 77, 8, 70, "Список", size=11.2, color="#8B8B8B", align="center")
            else:
                kit.button(m, cx - 70, cy - (18 if s == "md" else 15 if s == "sm" else 22),
                           {"primary": "Создать", "secondary": "Отмена", "ghost": "Проверить звук",
                            "danger": "Удалить", "danger-ghost": "Убрать", "icon": "",
                            "link": "Открыть журнал"}[v],
                           v, s, state=st, width=140 if v != "icon" else None)
                # caption under
            doc.text(m, "Cell cap/%s/%s/%s" % (v, st, s), x + 12, y + cell_h - 20,
                     cell_w - 24, "%s · %s · %s" % (v, st, s), size=8.6, color=DIM)
    # ---- compositions
    c = spec_frame(doc, p, MARGIN + W + 80, 240, 1500, 900, "Compositions",
                   "02.2 Композиции", "Иконка слева/справа, только иконка, full-width, группы кнопок.")
    doc.text(c, "Title", 28, 24, 700, "Композиции", size=20, weight=600, color=TEXT)
    for i, text in enumerate(("Иконка слева", "Иконка справа", "Только иконка",
                              "Полная ширина", "Группа: primary + ghost",
                              "Группа: danger-ghost + secondary")):
        doc.text(c, "Cap/%d" % i, 28, 76 + i * 130, 400, text, size=11, color=DIM)
    b1 = doc.frame(c, "Btn icon-left", 28, 96, 190, 40, fill=solid("#EDEDED"), radius=20)
    icon(doc, b1, "plus", 18, 12, 16, "#0A0A0A")
    doc.text(b1, "T", 42, 11, 140, "Создать награду", size=13.4, weight=600, color="#0A0A0A")
    b2 = doc.frame(c, "Btn icon-right", 28, 226, 190, 40, fill=solid(SURF2), radius=20,
                   stroke_color=BORDER2)
    doc.text(b2, "T", 18, 11, 130, "Открыть журнал", size=13.4, weight=600, color=TEXT)
    icon(doc, b2, "external", 152, 12, 16, TEXT2)
    b3 = doc.frame(c, "Btn icon-only", 28, 356, 40, 40, fill=solid(SURF2), radius=20,
                   stroke_color=BORDER2)
    icon(doc, b3, "dots", 12, 12, 16, MUTED)
    b4 = doc.frame(c, "Btn full", 28, 486, 560, 44, fill=solid("#EDEDED"), radius=22)
    doc.text(b4, "T", 0, 13, 560, "Подключить Twitch", size=14.4, weight=600,
             color="#0A0A0A", align="center")
    g1 = doc.frame(c, "Btn group", 28, 616, 560, 48, fill=None)
    b = doc.frame(g1, "B1", 0, 0, 150, 40, fill=solid("#EDEDED"), radius=20)
    doc.text(b, "T", 0, 11, 150, "Сохранить", size=13.4, weight=600, color="#0A0A0A", align="center")
    b = doc.frame(g1, "B2", 160, 0, 120, 40, fill=solid(SURF2), radius=20, stroke_color=BORDER2)
    doc.text(b, "T", 0, 11, 120, "Отмена", size=13.4, weight=600, color=TEXT, align="center")
    g2 = doc.frame(c, "Btn group2", 28, 746, 560, 48, fill=None)
    b = doc.frame(g2, "B3", 0, 0, 150, 40, fill=None, radius=20, stroke_color="#EF44445C")
    doc.text(b, "T", 0, 11, 150, "Остановить всё", size=13.4, weight=500, color=DANGER, align="center")
    b = doc.frame(g2, "B4", 160, 0, 150, 40, fill=solid(SURF2), radius=20, stroke_color=BORDER2)
    doc.text(b, "T", 0, 11, 150, "Обновить", size=13.4, weight=600, color=TEXT, align="center")
    # ---- tokens / anatomy
    a = spec_frame(doc, p, MARGIN + W + 80, 1240, 1500, 1060, "Anatomy",
                   "02.3 Анатомия и токены", "Высота, паддинги, радиус, гэп, типографика.")
    doc.text(a, "Title", 28, 24, 700, "Анатомия кнопки", size=20, weight=600, color=TEXT)
    big = doc.frame(a, "Anatomy sample", 28, 76, 300, 48, fill=solid("#EDEDED"), radius=24)
    doc.text(big, "T", 0, 14, 300, "Создать награду", size=14.4, weight=600,
             color="#0A0A0A", align="center")
    notes = [("Высота", "sm 30 · md 36 · lg 44"),
             ("Паддинг", "sm 12 · md 16 · lg 20"),
             ("Радиус", "половина высоты (pill)"),
             ("Гэп иконка/текст", "8"),
             ("Шрифт", "13.6 / SemiBold"),
             ("Иконка", "16 px, currentColor"),
             ("Фокус", "2 px accent, offset 2"),
             ("Disabled", "opacity 42%, cursor default"),
             ("Loading", "spinner 12 + текст 60%")]
    for i, (k, v) in enumerate(notes):
        y = 76 + i * 58
        doc.text(a, "K/%d" % i, 380, y, 200, k, size=12, weight=600, color=TEXT2)
        doc.text(a, "V/%d" % i, 580, y, 500, v, size=12, color=MUTED)
    doc.text(a, "Spec title", 28, 620, 700, "Таблица состояний", size=16, weight=600, color=TEXT)
    colx = [28, 300, 520, 740, 980]
    heads = ["Состояние", "Фон", "Текст", "Обработка", "Примечание"]
    for i, h in enumerate(heads):
        doc.text(a, "TH/%d" % i, colx[i], 660, 220, h, size=10, weight=600, color=DIM, tracking=1.2)
    table = [("default", "--btn-bg / #EDEDED", "#0A0A0A", "—", "основное действие"),
             ("hover", "+4% яркости", "—", "ease-out 120", "только для указателя"),
             ("pressed", "−8% яркости", "—", "scale 0.98", "тактильный отклик"),
             ("focus-visible", "2 px accent ring", "—", "offset 2", "клавиатура"),
             ("disabled", "opacity 42%", "—", "no pointer", "объяснить причину"),
             ("loading", "spinner 12", "60%", "spin 0.8s", "блокирует повтор")]
    for i, row in enumerate(table):
        y = 686 + i * 44
        doc.line(a, "TR", 28, y - 8, 1470, "#FFFFFF", 0.04)
        for j, cell in enumerate(row):
            doc.text(a, "TD/%d/%d" % (i, j), colx[j], y, 240, cell, size=11, color=TEXT2)
    # ---- components
    comp = spec_frame(doc, p, MARGIN + W + 80, 2400, 1500, 820, "Components",
                      "02.4 Компоненты FigCraft", "Мастера и инстансы: правки мастера долетают до всех экранов.")
    doc.text(comp, "Title", 28, 24, 800, "Компоненты кнопок", size=20, weight=600, color=TEXT)
    cnames = ["Button/Primary", "Button/Secondary", "Button/Ghost", "Button/Danger",
              "Button/DangerGhost", "Button/Icon", "Button/Link"]
    for i, nm in enumerate(cnames):
        y = 76 + i * 92
        doc.text(comp, "Name/%d" % i, 28, y + 14, 260, nm, size=12, weight=600, color=TEXT2)
        doc.text(comp, "Inst label/%d" % i, 300, y + 14, 260, "инстанс →", size=10.6, color=DIM)
        doc.text(comp, "Props/%d" % i, 900, y + 10, 500,
                 "variant / state / size · токены темы", size=10.6, color=DIM)
    return p


# ============================================================== 03 CONTROLS
def page_controls(doc, kit):
    p = doc.page("03 — Поля и контролы", "#0A0A0B")
    page_title(doc, p, MARGIN, 90, "03 · ПОЛЯ И КОНТРОЛЫ",
               "Поля и контролы",
               "Инпуты, переключатели, меню, уведомления и контейнеры. Состояния подписаны.")

    f = spec_frame(doc, p, MARGIN, 240, 1600, 1500, "Fields",
                   "03.1 Поля ввода", "Input, search, textarea, select, number, checkbox, toggle, slider, stepper.")
    doc.text(f, "Title", 28, 24, 700, "Поля и ввод", size=20, weight=600, color=TEXT)
    items = [
        ("Input / default", lambda x, y: input_field(doc, f, x, y, 320, "Например, «Сказать слово»")),
        ("Input / focus (2px accent)", lambda x, y: input_field(doc, f, x, y, 320, "Например, «Сказать слово»", state="focus")),
        ("Input / error + hint", lambda x, y: input_field(doc, f, x, y, 320, "Название длиннее 45 символов", state="error", value="Очень длинное название награды")),
        ("Input / disabled", lambda x, y: input_field(doc, f, x, y, 320, "Недоступно", state="disabled", value="Наследуется")),
        ("Search / с иконкой", lambda x, y: input_field(doc, f, x, y, 320, "Поиск награды", icon_kind="search")),
        ("Search / заполнен", lambda x, y: input_field(doc, f, x, y, 320, "", icon_kind="search", value="шиза", suffix="×")),
        ("Textarea / 280", lambda x, y: textarea(doc, f, x, y, 320, 120, "Шаблон сообщения для !трек", placeholder=True)),
        ("Select / closed", lambda x, y: select_field(doc, f, x, y, 320, "Все награды")),
        ("Select / open", lambda x, y: select_field(doc, f, x, y, 320, "Сначала дорогие", open=True)),
        ("Number / stepper", lambda x, y: stepper(doc, f, x, y, "10")),
        ("Checkbox / off", lambda x, y: doc.frame(f, "CB wrap", x, y, 320, 20, fill=None)),
        ("Checkbox / on", lambda x, y: doc.frame(f, "CB wrap", x, y, 320, 20, fill=None)),
    ]
    for i, (cap, _fn) in enumerate(items):
        col = i % 3
        row = i // 3
        x = 28 + col * 512
        y = 80 + row * 220
        doc.text(f, "Field cap/%d" % i, x, y, 400, cap, size=10.6, color=DIM)
    input_field(doc, f, 28, 100, 320, "Например, «Сказать слово»")
    input_field(doc, f, 28, 320, 320, "Например, «Сказать слово»", state="focus")
    input_field(doc, f, 28, 540, 320, "Название длиннее 45 символов", state="error",
                value="Очень длинное название награды")
    input_field(doc, f, 28, 760, 320, "Недоступно", state="disabled", value="Наследуется")
    input_field(doc, f, 540, 100, 320, "Поиск награды", icon_kind="search")
    input_field(doc, f, 540, 320, 320, "", icon_kind="search", value="шиза", suffix="×")
    textarea(doc, f, 540, 540, 320, 120, "Шаблон сообщения для !трек", placeholder=True)
    select_field(doc, f, 540, 760, 320, "Все награды")
    select_field(doc, f, 1052, 100, 320, "Сначала дорогие", open=True)
    stepper(doc, f, 1052, 320, "10")
    # checkbox/toggle/slider group
    cb = doc.frame(f, "Checkbox group", 1052, 540, 500, 120, fill=None)
    checkbox(doc, cb, 0, 8, True)
    doc.text(cb, "CB label", 24, 6, 420, "Нужен ввод текста от зрителя", size=12.4, color=TEXT2)
    checkbox(doc, cb, 0, 40, False)
    doc.text(cb, "CB label2", 24, 38, 420, "Показывать в оверлее", size=12.4, color=TEXT2)
    checkbox(doc, cb, 0, 72, True)
    doc.text(cb, "CB label3", 24, 70, 420, "Антиспам-фильтр", size=12.4, color=TEXT2)
    tg = doc.frame(f, "Toggle group", 540, 880, 500, 170, fill=None)
    doc.text(tg, "T1", 0, 4, 300, "Без звука", size=12.4, color=TEXT2)
    toggle(doc, tg, 360, 0, False)
    doc.text(tg, "T2", 0, 52, 300, "Воспроизводить звуки наград", size=12.4, color=TEXT2)
    toggle(doc, tg, 360, 48, True)
    doc.text(tg, "T3", 0, 100, 300, "Закрывать в трей", size=12.4, color=TEXT2)
    toggle(doc, tg, 360, 96, True)
    sl = doc.frame(f, "Slider group", 28, 980, 900, 260, fill=None)
    doc.text(sl, "S1", 0, 0, 300, "Громкость приложения", size=10.6, color=DIM)
    slider(doc, sl, 0, 26, 320, 0.29)
    doc.text(sl, "S1v", 336, 18, 60, "29%", size=12, color=TEXT)
    doc.text(sl, "S2", 0, 76, 300, "Громкость награды (до 200%)", size=10.6, color=DIM)
    slider(doc, sl, 0, 102, 320, 1.0)
    doc.text(sl, "S2v", 336, 94, 60, "200%", size=12, color=TEXT)
    doc.text(sl, "S3", 0, 152, 300, "Громкость музыки", size=10.6, color=DIM)
    slider(doc, sl, 0, 178, 320, 0.05, color=ACCENT)
    doc.text(sl, "S3v", 336, 170, 60, "5%", size=12, color=TEXT)
    doc.text(sl, "S4", 480, 0, 300, "Перемотка трека", size=10.6, color=DIM)
    slider(doc, sl, 480, 26, 380, 0.35)
    doc.text(sl, "S4a", 480, 18, 40, "0:58", size=10.6, color=MUTED)
    doc.text(sl, "S4b", 820, 18, 40, "2:44", size=10.6, color=MUTED, align="right")

    # ---- second column: overlays, toolkit
    f2 = spec_frame(doc, p, MARGIN + 1660, 240, 1500, 1500, "Overlays",
                    "03.2 Оверлеи и навигация", "Меню, поповер, тултип, тост, сегменты, фильтры, чипы, статусы.")
    doc.text(f2, "Title", 28, 24, 700, "Меню и уведомления", size=20, weight=600, color=TEXT)
    # menu
    menu = doc.frame(f2, "Menu", 28, 80, 300, 200, fill=solid(SURF2), radius=14,
                     stroke_color=BORDER2, effects=[fc._shadow("#000000", 0.5, 18, 0, 40)])
    items_menu = [("Изменить награду", "edit", False), ("Удалить награду", "trash", True),
                  ("Открыть журнал", "journal", False), ("Настройки", "settings", False),
                  ("Завершить работу…", "close", True)]
    yy = 8
    for text, kind, danger in items_menu:
        row = doc.frame(menu, "Menu item/" + text, 0, yy, 300, 34, fill=None, radius=8)
        icon(doc, row, kind, 12, 9, 16, DANGER if danger else MUTED)
        doc.text(row, "Text", 36, 9, 240, text, size=12.4,
                 color=DANGER if danger else TEXT2)
        yy += 34
    # tooltip + popover
    tt = doc.frame(f2, "Tooltip", 380, 80, 220, 40, fill=solid("#1F1F1F"), radius=9,
                   stroke_color=BORDER2)
    doc.text(tt, "Text", 0, 11, 220, "Остановить все звуки", size=11.4, color="#E6E6E6", align="center")
    pop = doc.frame(f2, "Popover", 380, 140, 340, 220, fill=solid(SURF2), radius=14,
                    stroke_color=BORDER2, effects=[fc._shadow("#000000", 0.45, 20, 0, 44)])
    doc.text(pop, "Title", 16, 14, 300, "СОСТОЯНИЕ СИСТЕМ", size=9.6, weight=600, color=DIM, tracking=1.4)
    for i, (name, value, c) in enumerate((("Twitch · goshanmur", "подключено", OK),
                                          ("EventSub · награды", "слушаем", OK),
                                          ("Чат · !трек", "работает", OK),
                                          ("yt-dlp", "нет обновлений 14 дней", WARN))):
        y = 44 + i * 30
        dot(doc, pop, 16, y + 6, c)
        doc.text(pop, "N", 28, y, 200, name, size=11.6, color=TEXT2)
        doc.text(pop, "V", 180, y, 140, value, size=10.6, color=MUTED, align="right")
    doc.text(pop, "Link", 16, 184, 300, "Открыть «Здоровье системы» →", size=11.4, color=ACCENT_TEXT)
    # toasts
    for i, (kind, title, text, color, action) in enumerate((
        ("success", "Файл привязан к «Шиза»", "Kanye - Vulvas.mp3 · 3:14 · 46%", OK, "Отменить"),
        ("warning", "Twitch переподключается…", "Попытка 3 из 5 · награды не сработают", WARN, "Журнал"),
        ("error", "Не удалось создать награду", "Twitch отклонил название: больше 45 символов", DANGER, "Исправить"))):
        t = doc.frame(f2, "Toast/%s" % kind, 780, 80 + i * 100, 660, 88,
                      fill=solid("#1A1213" if kind == "error" else SURF2), radius=13,
                      stroke_color=color + "66", effects=[fc._shadow("#000000", 0.4, 14, 0, 34)])
        doc.ellipse(t, "Icon bg", 14, 16, 22, 22, solid(color + "2E"))
        icon(doc, t, "check" if kind == "success" else ("close" if kind == "error" else "speaker"),
             20, 22, 10, color)
        doc.text(t, "Title", 46, 14, 500, title, size=12.6, weight=600, color=TEXT)
        doc.text(t, "Text", 46, 34, 540, text, size=11.4, color=MUTED)
        doc.text(t, "Action", 46, 58, 300, action, size=11.4, weight=600, color=ACCENT_TEXT)
        icon(doc, t, "close", 630, 18, 12, DIM)
    # segmented / pills / chips / statuses
    doc.text(f2, "Cap seg", 28, 340, 400, "Сегмент (вид: Плитка / Список)", size=10.6, color=DIM)
    seg = doc.frame(f2, "Segmented", 28, 360, 180, 34, fill=solid(SURF2), radius=17,
                    stroke_color=BORDER2)
    doc.frame(seg, "Active", 3, 3, 86, 28, fill=solid("#EDEDED"), radius=14)
    doc.text(seg, "T1", 3, 8.5, 86, "Плитка", size=12.4, weight=600, color="#0A0A0A", align="center")
    doc.text(seg, "T2", 92, 8.5, 80, "Список", size=12.4, color="#A8A8A8", align="center")
    doc.text(f2, "Cap pills", 28, 420, 400, "Чипы-фильтры", size=10.6, color=DIM)
    fx = 28
    for i, (nm, cnt, c) in enumerate((("Все", "11", None), ("Со звуком", "9", None),
                                      ("Играет", "0", ACCENT), ("Выключенные", "9", DIM))):
        wd = int(measure(nm, 12.2, 500) + 34 + (12 if c else 0))
        f3 = doc.frame(f2, "Pill/%d" % i, fx, 442, wd, 30,
                       fill=solid("#EDEDED" if i == 0 else "#FFFFFF09"), radius=15,
                       stroke_color="#EDEDED57" if i == 0 else BORDER2)
        tx = 12
        if c:
            dot(doc, f3, tx, 12, c)
            tx += 12
        doc.text(f3, "N", tx, 8.5, wd - tx - 24, nm, size=12.2,
                 color="#0A0A0A" if i == 0 else "#B9B9B9")
        doc.text(f3, "C", wd - 24, 8.5, 18, cnt, size=11, weight=600,
                 color="#0A0A0A" if i == 0 else "#EDEDED", align="right")
        fx += wd + 8
    doc.text(f2, "Cap badges", 28, 500, 400, "Бейджи и статусы", size=10.6, color=DIM)
    cy0 = 522
    for i, (nm, colr, bg, brd) in enumerate((("звук есть", ACCENT_TEXT, ACCENT_SOFT, ACCENT_BORDER),
                                            ("нет звука", WARN, "#F59E0B1F", "#F59E0B52"),
                                            ("выключена", MUTED, "#FFFFFF0A", BORDER2),
                                            ("музыка", ACCENT_TEXT, ACCENT_SOFT, ACCENT_BORDER))):
        chip(doc, kit, f2, 28 + i * 132, cy0, nm, color=colr, bg=bg, border=brd, size=24, fs=10.4)
    doc.text(f2, "Cap dots", 28, 570, 400, "Точки статуса", size=10.6, color=DIM)
    for i, (nm, c) in enumerate((("готово", OK), ("внимание", WARN), ("ошибка", DANGER),
                                 ("выключено", DIM))):
        dot(doc, f2, 28 + i * 130, 596, c, 8)
        doc.text(f2, "Dot label/%d" % i, 42 + i * 130, 592, 100, nm, size=10.8, color=MUTED)
    # progress + health chip + table row
    doc.text(f2, "Cap progress", 28, 640, 400, "Прогресс", size=10.6, color=DIM)
    doc.rect(f2, "Progress track", 28, 662, 420, 6, solid("#FFFFFF1A"), 3)
    doc.rect(f2, "Progress fill", 28, 662, 176, 6, solid(ACCENT), 3)
    doc.text(f2, "Progress label", 460, 654, 80, "42%", size=10.6, color=MUTED)
    doc.rect(f2, "Progress track2", 28, 686, 420, 6, solid("#FFFFFF1A"), 3)
    doc.rect(f2, "Progress fill2", 28, 686, 268, 6, solid(WARN), 3)
    doc.text(f2, "Progress label2", 460, 678, 180, "загрузка · 64%", size=10.6, color=MUTED)
    doc.text(f2, "Cap health", 560, 640, 400, "Health chip", size=10.6, color=DIM)
    hc = doc.frame(f2, "Health chip", 560, 660, 230, 30, fill=solid("#FFFFFF0A"), radius=15,
                   stroke_color=BORDER2)
    dot(doc, hc, 11, 11, OK)
    doc.text(hc, "T", 25, 8, 170, "Все системы работают", size=12.2, color="#CFCFCF")
    icon(doc, hc, "chevron-right", 206, 9, 12, DIM)
    hc2 = doc.frame(f2, "Health chip warn", 560, 700, 190, 30, fill=solid("#FFFFFF0A"), radius=15,
                    stroke_color="#F59E0B66")
    dot(doc, hc2, 11, 11, WARN)
    doc.text(hc2, "T", 25, 8, 140, "Есть замечания", size=12.2, color="#F5C97B")
    icon(doc, hc2, "chevron-right", 166, 9, 12, DIM)
    # list row shell
    row = doc.frame(f2, "Row shell", 780, 420, 660, 56, fill=solid("#FFFFFF05"), radius=10)
    doc.rect(row, "Tile", 10, 14, 26, 26, solid(REWARD_COLORS[0]), 7)
    doc.text(row, "Letter", 10, 19, 26, "Т", size=12, weight=600, color="#0A0A0A", align="center")
    doc.text(row, "Title", 46, 10, 300, "Ты новичок?", size=12.6, weight=600, color=TEXT)
    doc.text(row, "Meta", 46, 28, 300, "200 БАЛЛОВ · АКТИВНА", size=9.6, color="#8E8A8B")
    icon(doc, row, "dots", 620, 18, 14, MUTED)
    doc.text(f2, "Cap row", 780, 392, 400, "Строка списка / таблицы", size=10.6, color=DIM)
    # modal shell preview
    doc.text(f2, "Cap modal", 780, 510, 400, "Модальное окно", size=10.6, color=DIM)
    ms = doc.frame(f2, "Modal shell", 780, 532, 660, 240, fill=solid(SURF), radius=20,
                   stroke_color=BORDER2, effects=[fc._shadow("#000000", 0.55, 30, 0, 80)])
    doc.text(ms, "Title", 24, 20, 500, "Новая награда", size=19.2, weight=600, color=TEXT)
    doc.text(ms, "Sub", 24, 50, 560, "Награда создастся в канале через Twitch API.", size=12.2, color=MUTED)
    doc.text(ms, "Field label", 24, 80, 300, "НАЗВАНИЕ", size=9.6, color=DIM, tracking=1.2)
    fl = doc.frame(ms, "Input", 24, 96, 612, 34, fill=solid(SURF2), radius=9, stroke_color=BORDER2)
    doc.text(fl, "V", 10, 10, 580, "Например, «Сказать слово»", size=12.4, color=DIM)
    _mini_button(doc, ms, 24, 186, 100, "Отмена", "secondary")
    _mini_button(doc, ms, 516, 186, 120, "Создать")
    doc.text(ms, "Close", 620, 20, 20, "×", size=16, color=MUTED)
    # card shell
    cs = doc.frame(f2, "Card shell", 28, 800, 420, 160, fill=solid(PANEL), radius=16,
                   stroke_color=BORDER2)
    doc.text(cs, "Title", 16, 14, 300, "Карточка-контейнер", size=14, weight=600, color=TEXT)
    doc.text(cs, "Text", 16, 38, 380,
             "Используется для блоков настроек, музыки и «Здоровья системы»: padding 16, радиус 16, граница 1 px.",
             size=11.4, color=MUTED)
    return p


# ============================================================== 04 SHELL
def page_shell(doc, kit):
    p = doc.page("04 — Каркас приложения", "#0A0A0B")
    page_title(doc, p, MARGIN, 90, "04 · КАРКАС",
               "Каркас приложения",
               "Titlebar, сайдбар, рейл, шапка со статус-хабом, футер. Слева — 1220×840, справа — 980×680 с рейлом.")
    ui2.music_screen(doc, kit, p, MARGIN, 240, 1220, 840, empty=False)
    ui2.music_screen(doc, kit, p, MARGIN + 1330, 240, 980, 680, empty=True)
    # health popover, открыт поверх шапки
    pop = doc.frame(p, "Health popover", MARGIN + 250, 240 + 158, 340, 228,
                    fill=solid("#161616"), radius=14, stroke_color=ui.BORDER3,
                    effects=[fc._shadow("#000000", 0.55, 22, 0, 48)])
    doc.text(pop, "Title", 18, 16, 300, "СОСТОЯНИЕ СИСТЕМ", size=9.4, weight=600,
             color=ui.DIM, tracking=1.4)
    rows = [("Twitch · goshanmur", "подключено", ui.OK),
            ("EventSub · награды", "слушаем", ui.OK),
            ("Чат · !трек", "работает", ui.OK),
            ("yt-dlp", "нет обновлений 14 дней", ui.WARN),
            ("Аудиовыход", "Analogue 1/2", ui.OK)]
    for i, (label, value, colr) in enumerate(rows):
        y = 46 + i * 28
        doc.ellipse(pop, "Dot", 18, y + 6, 7, 7, solid(colr))
        doc.text(pop, "N", 32, y, 190, label, size=11.2, color=ui.TEXT2)
        doc.text(pop, "V", 180, y, 140, value, size=10.2, color=ui.MUTED, align="right")
    doc.line(pop, "Rule", 18, 192, 304, "#FFFFFF", 0.06)
    doc.text(pop, "Link", 18, 202, 304, "Открыть «Здоровье системы» →",
             size=10.6, color=ui.ACCENT_TEXT)
    # 04.3 anatomy
    an = spec_frame(doc, p, MARGIN, 1160, 1600, 1040, "Anatomy",
                    "04.3 Анатомия каркаса", "Размеры, зоны и правила для каждой части окна.")
    doc.text(an, "Title", 28, 24, 700, "Анатомия каркаса", size=20, weight=600, color=TEXT)
    parts = [("Titlebar", "38 px", "Слева — пусто (drag), справа — Свернуть / Развернуть / Закрыть, 28×22, hover #FFFFFF14."),
             ("Topbar", "56 px", "Статус-хаб (health chip) слева, справа mute + «ЗВУК» + слайдер + значение."),
             ("Sidebar / full", "236 px", "Логотип-зона 0, группы ОСНОВНОЕ / ЧАТ, СИСТЕМА прижата к низу, версия."),
             ("Sidebar / rail", "64 px", "Только иконки 16, активная — accent-soft, СИСТЕМА внизу после разделителя."),
             ("Content", "flex", "Padding 24, скролл, фон #0A0A0A. Заголовок 34, подзаголовок 14.6."),
             ("Footer", "36 px", "Подсказка слева, версия справа. Статусы и ошибки — тостами, не в футере."),
             ("Toasts", "340 px", "Справа снизу, стек до 3, ошибка не исчезает, у каждого действия — кнопка."),
             ("Menu «···»", "300 px", "Пункты 34 px, иконка 16 + текст, опасный — красным, последний — «Завершить».")]
    for i, (name, size, desc) in enumerate(parts):
        y = 76 + i * 106
        doc.text(an, "Part/%d" % i, 28, y, 220, name, size=13.4, weight=600, color=TEXT)
        doc.text(an, "Size/%d" % i, 250, y, 120, size, size=11.6, color=ACCENT_TEXT)
        doc.text(an, "Desc/%d" % i, 380, y, 1180, desc, size=11.8, color=MUTED)
        doc.line(an, "Line", 28, y + 36, 1540, "#FFFFFF", 0.04)
    # 04.4 menus and toasts
    mn = spec_frame(doc, p, MARGIN + 1660, 1160, 1000, 1040, "Menus",
                    "04.4 Меню «···» и тосты", "Единый паттерн меню и уведомлений на всех экранах.")
    m = doc.frame(mn, "Menu", 24, 80, 300, 200, fill=solid(SURF2), radius=14,
                  stroke_color=BORDER2, effects=[fc._shadow("#000000", 0.5, 18, 0, 40)])
    yy = 8
    for text, kind, danger in (("Изменить награду", "settings", False),
                               ("Удалить награду", "trash", True),
                               ("Открыть журнал", "journal", False),
                               ("Настройки", "settings", False),
                               ("Завершить работу…", "close", True)):
        row = doc.frame(m, "Item/" + text, 0, yy, 300, 34, fill=None, radius=8)
        icon(doc, row, kind, 12, 9, 16, DANGER if danger else MUTED)
        doc.text(row, "T", 36, 9, 240, text, size=12.4, color=DANGER if danger else TEXT2)
        yy += 34
    for i, (kind, title, text, color, action) in enumerate((
        ("success", "Файл привязан к «Шиза»", "Kanye - Vulvas.mp3 · 3:14 · 46%", OK, "Отменить"),
        ("error", "Не удалось создать награду", "Twitch отклонил название: больше 45 символов", DANGER, "Исправить"))):
        t = doc.frame(mn, "Toast/%s" % kind, 360, 80 + i * 190, 600, 88,
                      fill=solid("#1A1213" if kind == "error" else SURF2), radius=13,
                      stroke_color=color + "66")
        doc.ellipse(t, "Ico", 14, 16, 22, 22, solid(color + "2E"))
        icon(doc, t, "check" if kind == "success" else "close", 20, 22, 10, color)
        doc.text(t, "Title", 46, 14, 500, title, size=12.6, weight=600, color=TEXT)
        doc.text(t, "Text", 46, 34, 500, text, size=11.4, color=MUTED)
        doc.text(t, "Act", 46, 58, 300, action, size=11.4, weight=600, color=ACCENT_TEXT)
        icon(doc, t, "close", 570, 18, 12, DIM)
    doc.text(mn, "Rule", 24, 400, 900,
             "Правило: меню открывается по «···» и Esc, тосты не перекрывают основные действия на 980×680.",
             size=11.4, color=MUTED)
    return p
