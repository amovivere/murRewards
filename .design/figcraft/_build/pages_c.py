# -*- coding: utf-8 -*-
"""Pages 10-13: onboarding, modals, OBS overlays, states & accessibility."""
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
                 settings_card, modal, dialog, _mini_button, onboarding_screen,
                 rewards_screen, log_screen, now_playing_overlay, chat_overlay)

MARGIN = 120


def page_onboarding(doc, kit):
    p = doc.page("10 — Онбординг", "#0A0A0B")
    page_title(doc, p, MARGIN, 90, "10 · ОНБОРДИНГ",
               "Онбординг",
               "Первый запуск, шаги готовности, локальные привязки и проверка звука.")

    onboarding_screen(doc, kit, p, MARGIN, 240, 1220, 840)
    onboarding_screen(doc, kit, p, MARGIN + 1330, 240, 1220, 840, offline=True)
    onboarding_screen(doc, kit, p, MARGIN, 1160, 980, 680)

    st = spec_frame(doc, p, MARGIN, 1960, 1600, 640, "Ready states",
                    "10.4 Шаги готовности", "Один экран — понятный прогресс: подключён Twitch, привязан звук, проверка пройдена.")
    steps = [("1", "Twitch подключён", "Client ID сохранён, вход подтверждён, права chat:read/chat:edit", OK, True),
             ("2", "Звук привязан", "9 наград со звуком, 2 без звука — их можно дозаполнить позже", OK, True),
             ("3", "Проверка звука", "Файл проигран, индикатор в шапке подтвердил вывод", WARN, False),
             ("4", "Первый эфир", "Награда сработала — звук услышали зрители", DIM, False)]
    for i, (num, title, desc, colr, done) in enumerate(steps):
        x = 24 + i * 392
        card = doc.frame(st, "Step/%d" % i, x, 56, 372, 300, fill=solid(PANEL),
                         radius=16, stroke_color=colr + "4D" if done else BORDER2)
        doc.ellipse(card, "Circle", 20, 20, 34, 34,
                    solid(colr + "1F") if done else solid("#FFFFFF0A"),
                    stroke_color=colr + "8C" if done else BORDER2, stroke_w=1.4)
        if done:
            icon(doc, card, "check", 29, 29, 16, colr)
        else:
            doc.text(card, "Num", 20, 27, 34, num, size=14, weight=600, color=TEXT, align="center")
        doc.text(card, "Title", 66, 22, 280, title, size=15, weight=600, color=TEXT)
        doc.text(card, "Desc", 20, 72, 330, desc, size=11.6, color=MUTED)
        doc.text(card, "State", 20, 240, 330,
                 "готово" if done else "следующий шаг" if i == 2 else "ждёт",
                 size=10.4, weight=600, color=colr if done else DIM)
        if i == 2:
            kit.button(card, 20, 200, "Проверить звук", "primary", "sm", width=170)
    doc.text(st, "Rule", 24, 400, 1500,
             "Правило: шаг нельзя «проскочить» — кнопка ведёт к конкретному действию, а не в общий раздел.",
             size=11.4, color=MUTED)
    return p


def page_modals(doc, kit):
    p = doc.page("11 — Модалки и подтверждения", "#0A0A0B")
    page_title(doc, p, MARGIN, 90, "11 · МОДАЛКИ И ПОДТВЕРЖДЕНИЯ",
               "Модалки и подтверждения",
               "Награда, цена, музыка, OBS и опасные действия. Esc и клик вне окна закрывают; опасные — только кнопкой.")

    # 11.1 create reward over rewards screen
    rewards_screen(doc, kit, MARGIN, 240, 1220, 840, view="grid")
    scrim = doc.frame(p, "Scrim", MARGIN, 240, 1220, 840, fill=solid("#040404B0"), radius=12)
    m = modal(doc, p, MARGIN + 330, 240 + 96, 560, 620, "Новая награда",
              "Награда создастся в канале через Twitch API и сразу появится в списке.")
    fields = [("НАЗВАНИЕ", "Например, «Сказать слово»", None),
              ("ЦЕНА, БАЛЛОВ", "100", None),
              ("ОПИСАНИЕ", "Что получит зритель и как это работает", None)]
    yy = 92
    for lbl, val, _ in fields:
        doc.text(m, "Label/" + lbl, 24, yy, 300, lbl, size=9.4, weight=600, color=DIM, tracking=1.2)
        input_field(doc, m, 24, yy + 16, 512, val, value=None if val.startswith("Наприм") is False else None)
        yy += 66
    doc.text(m, "Color label", 24, yy, 300, "ЦВЕТ КАРТОЧКИ", size=9.4, weight=600, color=DIM, tracking=1.2)
    for i, c in enumerate(REWARD_COLORS[:8]):
        doc.ellipse(m, "Palette/%d" % i, 24 + i * 32, yy + 20, 24, 24, solid(c),
                    stroke_color="#F5F5F5" if i == 2 else None, stroke_w=2)
    # native color picker + HEX (как в приложении)
    doc.text(m, "Pick label", 24, yy + 52, 200, "СВОЙ ЦВЕТ", size=9.2, weight=600,
             color=DIM, tracking=1.2)
    sw = doc.frame(m, "Color picker", 24, yy + 68, 40, 32, fill=solid("#A970FF"),
                   radius=9, stroke_color=BORDER3)
    hexf = doc.frame(m, "Hex field", 72, yy + 68, 100, 32, fill=solid(SURF2),
                     radius=9, stroke_color=BORDER2)
    doc.text(hexf, "Hex", 10, 9, 80, "#A970FF", size=11.6, color=TEXT)
    doc.text(m, "Picker hint", 180, yy + 77, 356,
             "Системный color picker и HEX — любой цвет, не только пресеты", size=9.6, color=DIM)
    doc.text(m, "Color note", 24, yy + 108, 480,
             "Цвет награды хранится в Twitch; на фон карточки влияет как 13%-й тинт.", size=9.6, color=DIM)
    doc.text(m, "Input label", 24, 420, 300, "ЧТО НУЖНО ОТ ЗРИТЕЛЯ", size=9.4, weight=600,
             color=DIM, tracking=1.2)
    checkbox(doc, m, 24, 442, True)
    doc.text(m, "CB1", 48, 439, 400, "Текст сообщения (до 280 символов)", size=11.8, color=TEXT2)
    checkbox(doc, m, 24, 468, False)
    doc.text(m, "CB2", 48, 465, 400, "Ссылка YouTube — для музыки", size=11.8, color=TEXT2)
    doc.line(m, "Footer line", 24, 498, 512, "#FFFFFF", 0.06)
    _mini_button(doc, m, 24, 516, 120, "Отмена", "secondary")
    _mini_button(doc, m, 352, 516, 184, "Создать награду")
    doc.text(m, "Hint", 24, 566, 500, "Награду можно создать и в Twitch — приложение подхватит её при обновлении.",
             size=9.8, color=DIM)

    # 11.2 edit + delete
    ed = spec_frame(doc, p, MARGIN + 1330, 240, 760, 840, "Edit modal",
                    "11.2 Редактирование и удаление", "")
    e = modal(doc, ed, 100, 90, 560, 380, "Награда «Шиза»",
              "Меняется только привязка звука и громкость. Сама награда — в Twitch.")
    doc.text(e, "Label1", 24, 92, 300, "ЗВУК", size=9.4, weight=600, color=DIM, tracking=1.2)
    fc_chip = doc.frame(e, "File", 24, 110, 512, 44, fill=solid(SURF2), radius=10,
                        stroke_color=BORDER2)
    icon(doc, fc_chip, "play", 14, 14, 12, "#EDEDED")
    doc.text(fc_chip, "Name", 36, 14, 380, "Kanye - Vulvas.mp3", size=12.4, color=TEXT)
    doc.text(fc_chip, "Meta", 36, 30, 380, "MP3 · 3:14 · 4.2 МБ", size=9.6, color=DIM)
    kit.button(e, 444, 114, "Заменить", "secondary", "sm", width=92)
    doc.text(e, "Label2", 24, 170, 300, "ГРОМКОСТЬ", size=9.4, weight=600, color=DIM, tracking=1.2)
    slider(doc, e, 24, 196, 380, 0.46)
    doc.text(e, "Vol", 416, 188, 80, "46%", size=12.2, color=TEXT)
    doc.text(e, "Label3", 24, 226, 300, "ПОВЕДЕНИЕ", size=9.4, weight=600, color=DIM, tracking=1.2)
    toggle(doc, e, 24, 246, True)
    doc.text(e, "Toggle text", 74, 249, 400, "Останавливать текущий звук при новом", size=11.8, color=TEXT2)
    doc.line(e, "Line", 24, 292, 512, "#FFFFFF", 0.06)
    kit.button(e, 24, 310, "Отвязать звук", "danger-ghost", "sm", width=150)
    _mini_button(doc, e, 352, 310, 184, "Сохранить")
    d = modal(doc, ed, 100, 520, 560, 260, "Удалить награду?",
              "Действие необратимо: звук отвяжется, локальная привязка исчезнет.")
    doc.text(d, "Body", 24, 92, 512,
             "Награда «Шиза» останется в Twitch, но Reward Sounds больше не будет на неё реагировать. Это можно включить заново через «Добавить привязку».",
             size=12, color=MUTED)
    _mini_button(doc, d, 24, 170, 120, "Отмена", "secondary")
    _mini_button(doc, d, 352, 170, 184, "Удалить привязку", "danger")
    doc.text(d, "Hint", 24, 222, 512, "Отключить саму награду в Twitch — отдельное действие в настройках.", size=9.8, color=DIM)

    # 11.3 reward & price
    rp = spec_frame(doc, p, MARGIN, 1160, 760, 900, "Reward price",
                    "11.3 «Награда и цена»", "Быстрое создание награды с ценой в Channel Points и звуком.")
    m3 = modal(doc, rp, 100, 50, 560, 430, "Награда и цена",
               "Один экран: название, цена, звук и цвет — без перехода в Twitch.")
    doc.text(m3, "L1", 24, 92, 300, "НАЗВАНИЕ", size=9.4, weight=600, color=DIM, tracking=1.2)
    input_field(doc, m3, 24, 110, 512, "Например, «Сказать слово»", value="Сказать слово")
    doc.text(m3, "L2", 24, 158, 300, "ЦЕНА, БАЛЛОВ", size=9.4, weight=600, color=DIM, tracking=1.2)
    stepper(doc, m3, 24, 176, "100", w=160)
    chip(doc, kit, m3, 196, 178, "мин. 1 · макс. 1 000 000", color=MUTED, bg="#FFFFFF0A",
         border=BORDER2, size=28, fs=10)
    doc.text(m3, "L3", 24, 224, 300, "ЗВУК", size=9.4, weight=600, color=DIM, tracking=1.2)
    sf = doc.frame(m3, "Sound field", 24, 242, 512, 44, fill=solid(SURF2), radius=10,
                   stroke_color=BORDER2)
    icon(doc, sf, "plus", 14, 14, 14, MUTED)
    doc.text(sf, "Ph", 36, 14, 380, "Выбрать файл или записать с микрофона", size=11.8, color=DIM)
    doc.text(m3, "Hint", 24, 300, 512,
             "Если звук не выбран, награда создастся без звука — это нормально для теста.", size=10, color=DIM)
    doc.line(m3, "Line", 24, 340, 512, "#FFFFFF", 0.06)
    _mini_button(doc, m3, 24, 360, 120, "Отмена", "secondary")
    _mini_button(doc, m3, 352, 360, 184, "Создать и привязать")

    # 11.4 music + obs modals
    mo = spec_frame(doc, p, MARGIN + 820, 1160, 760, 900, "Music modal",
                    "11.4 «Настройки музыки» и «Оверлей OBS»", "")
    m4 = modal(doc, mo, 100, 50, 560, 390, "Настройки музыки",
               "Лимиты очереди и правила заявок.")
    rows = [("Награда для заявки", "МУЗЫКА ЮТУБ · 50 баллов"),
            ("Лимит очереди", "10 треков"),
            ("Максимум от одного зрителя", "2 трека"),
            ("Команда !трек", "включена · только для модераторов"),
            ("Префикс без ссылки", "YouTube, youtu.be, music.youtube.com")]
    for i, (k, v) in enumerate(rows):
        y = 92 + i * 44
        doc.text(m4, "K/%d" % i, 24, y, 250, k, size=11, color=DIM)
        doc.text(m4, "V/%d" % i, 260, y, 280, v, size=11.4, color=TEXT2, align="right")
        doc.line(m4, "L/%d" % i, 24, y + 24, 512, "#FFFFFF", 0.04)
    _mini_button(doc, m4, 24, 330, 120, "Отмена", "secondary")
    _mini_button(doc, m4, 352, 330, 184, "Сохранить")
    m5 = modal(doc, mo, 100, 470, 560, 370, "Оверлей OBS",
               "Добавьте источник «Браузер» в OBS и вставьте ссылку.")
    doc.text(m5, "L1", 24, 92, 300, "ССЫЛКА «СЕЙЧАС ИГРАЕТ»", size=9.4, weight=600, color=DIM, tracking=1.2)
    u = doc.frame(m5, "URL", 24, 110, 440, 36, fill=solid(SURF2), radius=9, stroke_color=BORDER2)
    doc.text(u, "U", 10, 10, 400, "http://127.0.0.1:8770/overlay", size=11.2, color=TEXT2)
    kit.button(m5, 472, 110, "Копировать", "secondary", "sm", width=64)
    doc.text(m5, "L2", 24, 158, 300, "ССЫЛКА ЧАТА", size=9.4, weight=600, color=DIM, tracking=1.2)
    u2 = doc.frame(m5, "URL2", 24, 176, 440, 36, fill=solid(SURF2), radius=9, stroke_color=BORDER2)
    doc.text(u2, "U", 10, 10, 400, "http://127.0.0.1:8770/chat?theme=dark", size=11.2, color=TEXT2)
    doc.text(m5, "L3", 24, 224, 300, "ПАРАМЕТРЫ", size=9.4, weight=600, color=DIM, tracking=1.2)
    for i, (k, v) in enumerate((("Тема", "тёмная"), ("Прозрачность", "60%"), ("Скорость", "0.8×"))):
        x = 24 + i * 174
        doc.text(m5, "PK/%d" % i, x, 246, 160, k, size=10.4, color=DIM)
        sel = doc.frame(m5, "PS/%d" % i, x, 262, 160, 32, fill=solid(SURF2), radius=8,
                        stroke_color=BORDER2)
        doc.text(sel, "V", 10, 8, 120, v, size=11, color=TEXT2)
        icon(doc, sel, "chevron-down", 138, 11, 10, MUTED)
    _mini_button(doc, m5, 352, 316, 184, "Показать сейчас")

    # 11.5 confirmations
    cf = spec_frame(doc, p, MARGIN, 2120, 1600, 760, "Confirm dialogs",
                    "11.5 Подтверждения опасных действий", "Опасное — красное, с последствием. Обратимое — с «Отменить» в тосте.")
    dialogs = [("Отключить Twitch?", "Награды и чат перестанут работать до повторного входа. Локальные привязки останутся.", "Отключить", True),
               ("Выйти из приложения?", "Звуки наград перестанут играть. Если включён трей — окно можно свернуть вместо выхода.", "Выйти", True),
               ("Очистить очередь?", "Треки в очереди будут удалены без возможности восстановления. Текущий трек доиграет.", "Очистить", True),
               ("Остановить все звуки?", "Все активные звуки наград остановятся. Награды продолжат срабатывать.", "Остановить", False)]
    for i, (title, text, confirm, danger) in enumerate(dialogs):
        x = 24 + (i % 2) * 780
        y = 56 + (i // 2) * 340
        d = doc.frame(cf, "Dialog/%d" % i, x, y, 760, 300, fill=solid(SURF), radius=20,
                      stroke_color=BORDER2, effects=[fc._shadow("#000000", 0.55, 30, 0, 80)])
        doc.text(d, "Title", 24, 20, 700, title, size=20, weight=600, color=TEXT)
        doc.text(d, "Text", 24, 58, 700, text, size=12.6, color=MUTED)
        if danger:
            warn = doc.frame(d, "Warn", 24, 122, 712, 42, fill=solid("#EF44440D"), radius=10,
                             stroke_color="#EF44444D")
            icon(doc, warn, "trash", 12, 12, 14, DANGER)
            doc.text(warn, "T", 34, 10, 660,
                     "Отменить нельзя · архив журнала и данные не удаляются", size=10.6, color="#FCA5A5")
        else:
            warn = doc.frame(d, "Warn", 24, 122, 712, 42, fill=solid("#F59E0B0D"), radius=10,
                             stroke_color="#F59E0B40")
            icon(doc, warn, "speaker", 12, 12, 14, WARN)
            doc.text(warn, "T", 34, 10, 660,
                     "Можно снова включить — звуки продолжат играть после старта", size=10.6, color="#F5C97B")
        _mini_button(doc, d, 24, 236, 140, "Отмена", "secondary")
        _mini_button(doc, d, 560, 236, 176, confirm, "danger" if danger else "primary")
    doc.text(cf, "Rule", 24, 716, 1500,
             "Правило: подтверждение — только для необратимого или «тихого» вреда. Всё остальное — тост с «Отменить».",
             size=11.4, color=MUTED)
    return p


def page_obs(doc, kit):
    p = doc.page("12 — OBS-оверлеи", "#0A0A0B")
    page_title(doc, p, MARGIN, 90, "12 · OBS-ОВЕРЛЕИ",
               "OBS-оверлеи",
               "«Сейчас играет» (3 варианта) и оверлей чата (тёмный/светлый). Прозрачный фон, крупный текст.")
    # 12.1
    f1 = spec_frame(doc, p, MARGIN, 240, 1920, 300, "Now playing glass",
                    "12.1 «Сейчас играет» — стекло", "Основной вариант: 1920×220, скругление 20, прозрачный фон, тень не требуется.")
    now_playing_overlay(doc, f1, 24, 40, 960, "glass")
    now_playing_overlay(doc, f1, 24, 40, 960, "glass")
    # duplicate because helper draws at x,y relative to page? it takes page; use frame as page
    doc.text(f1, "Caption", 24, 200, 1200,
             "1920×220 · скейл 0.5 в OBS · фон 90% · акцентная полоса 4 px слева", size=11, color=DIM)
    # 12.2 minimal
    f2 = spec_frame(doc, p, MARGIN, 620, 1920, 300, "Now playing minimal",
                    "12.2 «Сейчас играет» — минимал", "Без иконки арта: для оверлеев с камерой и минималистичных тем.")
    now_playing_overlay(doc, f2, 24, 40, 960, "minimal")
    doc.text(f2, "Caption", 24, 200, 1200,
             "1920×220 · акцентная полоса сверху · строка «следующий» — опционально", size=11, color=DIM)
    # 12.3 queue overlay
    f3 = spec_frame(doc, p, MARGIN, 1000, 1920, 460, "Queue overlay",
                    "12.3 Оверлей очереди", "Отдельный источник для стримов с очередью заявок.")
    q = doc.frame(f3, "Queue overlay", 24, 40, 560, 380, fill=solid("#08080AE6"), radius=16,
                  stroke_color="#FFFFFF1F", clip=True)
    doc.text(q, "Title", 16, 14, 400, "ОЧЕРЕДЬ · 3", size=11, weight=600, color=ACCENT_TEXT, tracking=1.6)
    for i, (title, user, status, colr) in enumerate((("ДИНАСТИЯ — Земляк", "@nix", "играет", ACCENT),
                                                      ("Kanye - Vulvas", "@druzhba", "2", MUTED),
                                                      ("Sweet Dreams", "@mod_anya", "3", MUTED))):
        row = doc.frame(q, "Row/%d" % i, 12, 44 + i * 92, 536, 80, fill=solid("#FFFFFF08"),
                        radius=12, stroke_color=ACCENT_BORDER if i == 0 else BORDER2)
        doc.frame(row, "Art", 10, 10, 60, 60, fill=solid(SURF2), radius=10)
        icon(doc, row, "music", 30, 30, 20, MUTED)
        doc.text(row, "T", 84, 14, 380, title, size=15, weight=600, color=TEXT)
        doc.text(row, "U", 84, 40, 300, "заказал " + user, size=11.4, color=MUTED)
        chip(doc, kit, row, 452, 28, status, color=colr, bg=colr + "1F", border=colr + "52",
             size=24, fs=10)
    doc.text(f3, "Caption", 24, 440, 1200, "560×380 · прозрачный фон · очередь из 3 последних", size=11, color=DIM)
    # 12.4 / 12.5 chat overlays
    f4 = spec_frame(doc, p, MARGIN + 1360, 1000, 460, 700, "Chat dark",
                    "12.4 Чат — тёмный", "Основная тема: 60% прозрачности, крупный шрифт.")
    chat_overlay(doc, f4, 40, 40, 380, 560, "dark")
    f5 = spec_frame(doc, p, MARGIN + 1840, 1000, 460, 700, "Chat light",
                    "12.5 Чат — светлый", "Для светлых оверлеев и дневных стримов.")
    chat_overlay(doc, f5, 40, 40, 380, 560, "light")
    doc.text(f5, "Caption", 24, 620, 400, "Прозрачность 70–90% · без обводки текста", size=10.6, color=DIM)
    return p


def page_states(doc, kit):
    p = doc.page("13 — Состояния и доступность", "#0A0A0B")
    page_title(doc, p, MARGIN, 90, "13 · СОСТОЯНИЯ И ДОСТУПНОСТЬ",
               "Состояния и доступность",
               "Hover, focus-visible, disabled, контраст, reduced-motion, 980×680 и масштаб 150%.")

    # 13.1 states
    st = spec_frame(doc, p, MARGIN, 240, 1600, 720, "States",
                    "13.1 Состояния элементов", "Все интерактивные элементы обязаны иметь hover, focus-visible и disabled.")
    items = [("Кнопка", "primary", "#EDEDED", "#0A0A0A"),
             ("Кнопка", "secondary", SURF2, TEXT2),
             ("Пункт сайдбара", "nav", None, TEXT2),
             ("Поле ввода", "input", SURF2, TEXT)]
    for i, (name, kind, bg, fg) in enumerate(items):
        x = 24 + i * 392
        if kind in ("primary", "secondary"):
            kit.button(st, x, 60, "Действие", kind, "md", state="default")
            doc.text(st, "L/%d" % i, x, 116, 300, "hover: +4% яркости", size=10, color=DIM)
            kit.button(st, x, 140, "Действие", kind, "md", state="hover")
            doc.text(st, "L2/%d" % i, x, 196, 300, "pressed: −8%", size=10, color=DIM)
            kit.button(st, x, 220, "Действие", kind, "md", state="pressed")
            doc.text(st, "L3/%d" % i, x, 276, 300, "focus-visible: ring 2 px", size=10, color=DIM)
            kit.button(st, x, 300, "Действие", kind, "md", state="focus-visible")
            doc.text(st, "L4/%d" % i, x, 356, 300, "disabled: 42%", size=10, color=DIM)
            kit.button(st, x, 380, "Действие", kind, "md", state="disabled")
        elif kind == "nav":
            nav = doc.frame(st, "Nav default", x, 60, 320, 40, fill=None, radius=10)
            icon(doc, nav, "grid", 12, 12, 16, MUTED)
            doc.text(nav, "T", 40, 12, 200, "Награды", size=13.4, color=MUTED)
            nav = doc.frame(st, "Nav hover", x, 120, 320, 40, fill=solid("#FFFFFF0A"), radius=10)
            icon(doc, nav, "grid", 12, 12, 16, TEXT2)
            doc.text(nav, "T", 40, 12, 200, "Награды", size=13.4, color=TEXT2)
            nav = doc.frame(st, "Nav active", x, 180, 320, 40, fill=solid(ACCENT_SOFT), radius=10)
            icon(doc, nav, "grid", 12, 12, 16, TEXT)
            doc.text(nav, "T", 40, 12, 200, "Награды", size=13.4, weight=600, color=TEXT)
            nav = doc.frame(st, "Nav focus", x, 240, 320, 40, fill=solid("#FFFFFF0A"), radius=10,
                            stroke_color=ACCENT_TEXT, stroke_w=2)
            icon(doc, nav, "grid", 12, 12, 16, TEXT2)
            doc.text(nav, "T", 40, 12, 200, "Награды", size=13.4, color=TEXT2)
            doc.text(st, "Lnav", x, 300, 320,
                     "hover: #FFFFFF0A · active: accent .14 · focus: ring", size=9.6, color=DIM)
        else:
            input_field(doc, st, x, 60, 320, "Название награды")
            input_field(doc, st, x, 120, 320, "Название награды", state="hover")
            input_field(doc, st, x, 180, 320, "Название награды", state="focus")
            input_field(doc, st, x, 240, 320, "Название награды", state="error",
                        value="Слишком длинное")
            input_field(doc, st, x, 300, 320, "Название награды", state="disabled")
            doc.text(st, "Linput", x, 360, 320,
                     "focus: 2 px accent · error: danger + hint", size=9.6, color=DIM)
    doc.text(st, "Rule", 24, 440, 1500,
             "Правило: focus-visible виден на любом фоне и не заменяет hover; disabled не прячет элемент и объясняет причину рядом.",
             size=11.4, color=MUTED)
    doc.text(st, "Tab", 24, 470, 1500,
             "Порядок Tab: titlebar → статус-хаб → сайдбар → тулбар → контент → футер. Esc закрывает меню/модалку.",
             size=11.4, color=MUTED)

    # 13.2 contrast
    ct = spec_frame(doc, p, MARGIN + 1700, 240, 900, 720, "Contrast",
                    "13.2 Контраст", "Пары «текст на фоне» — AA 4.5:1 для мелкого текста, 3:1 для крупного и границ.")
    pairs = [("#F5F5F5", "#0A0A0A", "Основной текст", True),
             ("#B9B9B9", "#0A0A0A", "Вторичный текст", True),
             ("#8B8B8B", "#0A0A0A", "Подписи", True),
             ("#C9A7FF", "#0A0A0A", "Акцентный мелкий текст", True),
             ("#0A0A0A", "#8B00FF", "Текст на акцентной кнопке", True),
             ("#0A0A0A", "#3B82F6", "Синий пресет — тёмный текст", True),
             ("#0A0A0A", "#22C55E", "Зелёный пресет — тёмный текст", True),
             ("#FFFFFF", "#8B00FF", "Белый на фиолетовом", True),
             ("#7DD3FC", "#0A0A0A", "ИНФО в журнале", True),
             ("#EF4444", "#0A0A0A", "Ошибки и danger", True)]
    for i, (fgc, bgc, name, ok) in enumerate(pairs):
        y = 56 + i * 52
        box = doc.frame(ct, "Pair/%d" % i, 24, y, 852, 44, fill=solid(bgc), radius=8,
                        stroke_color=BORDER2)
        doc.text(box, "Sample", 12, 10, 280, name, size=12, color=fgc)
        ratio = ui.contrast_ratio(fgc, bgc) if hasattr(ui, "contrast_ratio") else None
        if ratio is None:
            def _lum(hexc):
                h = hexc.lstrip("#")
                vals = [int(h[j:j + 2], 16) / 255.0 for j in (0, 2, 4)]
                ch = [(v / 12.92 if v <= 0.03928 else ((v + 0.055) / 1.055) ** 2.4) for v in vals]
                return 0.2126 * ch[0] + 0.7152 * ch[1] + 0.0722 * ch[2]
            l1, l2 = _lum(fgc), _lum(bgc)
            ratio = (max(l1, l2) + 0.05) / (min(l1, l2) + 0.05)
        doc.text(box, "Ratio", 620, 10, 100, "%.2f:1" % ratio, size=12, weight=600,
                 color=fgc, align="right")
        chip(doc, kit, box, 736, 10, "AA" if ratio >= 4.5 else "крупный", color=fgc,
             bg="#FFFFFF10", border=BORDER3, size=24, fs=9.6)
    doc.text(ct, "Rule", 24, 590, 840,
             "Правило: любой новый цвет проверяется в реальной паре с фоном. Белый текст на акценте — только для #8B00FF; для синего и зелёного ink тёмный.",
             size=10.4, color=DIM)

    # 13.3 min size / dpi
    md = spec_frame(doc, p, MARGIN, 1020, 900, 560, "Min size",
                    "13.3 Минимум 980×680 и масштаб 150%", "Ничего не обрезается, сайдбар становится рейлом, фильтры переносятся.")
    mini = doc.frame(md, "Mini app", 24, 56, 640, 440, fill=solid(BG), radius=14,
                     stroke_color=BORDER2, clip=True)
    sidebar(doc, kit, mini, h=440, active="Награды", rail=True)
    topbar(doc, kit, mini, x=64, w=576)
    doc.text(mini, "H", 84, 110, 400, "Награды", size=24, weight=600, color=TEXT)
    for i in range(4):
        ui2.reward_row(doc, kit, mini, 84, 150 + i * 54, 540, "Награда %d" % (i + 1), 100,
                       REWARD_COLORS[i], file_name="sound%d.mp3" % i, volume=120 + i * 10)
    doc.text(md, "Note", 24, 520, 840,
             "980×680: рейл 64, контент 876, карточки в 2 колонки. 150%: физический размер тот же — растёт только шрифт и отступы (clamp).",
             size=10.8, color=DIM)

    # 13.4 checklist + reduced motion
    ck = spec_frame(doc, p, MARGIN + 940, 1020, 900, 560, "A11y",
                    "13.4 Чеклист доступности", "Проверяется на каждом ревью — до переноса в код.")
    checks = [("Контраст основного текста ≥ 4.5:1", True),
              ("Контраст крупного текста ≥ 3:1", True),
              ("Видимый focus-visible на всех интерактивных", True),
              ("Все действия доступны с клавиатуры", True),
              ("Esc закрывает меню и модалки", True),
              ("prefers-reduced-motion отключает пульсацию", True),
              ("Ошибки объяснены текстом, не только цветом", True),
              ("Минимум 980×680 без горизонтального скролла", True),
              ("Масштаб 150% не ломает сетку", True),
              ("Кнопки ≥ 32×32, в списке — 32 px play", True)]
    for i, (text, ok) in enumerate(checks):
        y = 56 + i * 40
        icon(doc, ck, "check", 24, y + 2, 14, OK)
        doc.text(ck, "T", 48, y, 700, text, size=11.8, color=TEXT2)
    doc.text(ck, "Footer", 24, 470, 840,
             "Reduced motion: анимация точки «играет» и тостов — none; переходы — 0.01s; спиннеры остаются, потому что означают ожидание.",
             size=10.4, color=DIM)
    return p
