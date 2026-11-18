# -*- coding: utf-8 -*-
"""Pages 05-09: rewards, music, chat, settings, log."""
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
                 settings_card, modal, dialog, _mini_button, rewards_screen,
                 music_screen, chat_screen, settings_screen, log_screen)

MARGIN = 120


def page_rewards(doc, kit):
    p = doc.page("05 — Награды", "#0A0A0B")
    page_title(doc, p, MARGIN, 90, "05 · НАГРАДЫ",
               "Награды",
               "Плитка и список, все состояния карточки, пусто/загрузка/ошибка. Главный экран приложения.")

    rewards_screen(doc, kit, MARGIN, 240, 1220, 840, view="grid")
    rewards_screen(doc, kit, MARGIN + 1330, 240, 1220, 840, view="list")
    rewards_screen(doc, kit, MARGIN, 1160, 980, 680, view="grid")
    rewards_screen(doc, kit, MARGIN + 1090, 1160, 980, 680, view="list")

    # 05.5 card states
    st = spec_frame(doc, p, MARGIN, 1940, 1600, 330, "Card states",
                    "05.5 Карточка — состояния", "Одна карточка, семь состояний: обычная, играет, выключена, нет звука, музыка, ввод, выбрана.")
    states = [("обычная", "normal", ""), ("играет", "playing", ""), ("выключена", "disabled", ""),
              ("нет звука", "nosound", ""), ("музыка", "normal", "♪"),
              ("ввод текста", "normal", "Aa"), ("выбрана", "selected", "")]
    for i, (cap, state, flag) in enumerate(states):
        x = 20 + i * 226
        reward_card(doc, kit, st, x, 50, 204, 168, ["Ты новичок?", "Смешок", "Шиза", "МУЗЫКА ЮТУБ",
                                                     "Сказать слово", "Вопрос за 100", "Донат"][i],
                    200 + i * 25, REWARD_COLORS[i], state=state,
                    file_name="" if state == "nosound" else "newbie.mp3",
                    fmt="MP3", volume=200 if i != 2 else 120,
                    playing=1 if state == "playing" else 0,
                    flags=(flag,) if flag else ())
        doc.text(st, "Cap/%d" % i, x, 240, 204, cap, size=10.4, color=DIM, align="center")

    # 05.6 empty / loading / error
    sv = spec_frame(doc, p, MARGIN, 2380, 1600, 520, "Empty states",
                    "05.6 Пусто / загрузка / ошибка", "Каждое состояние объясняет, что произошло и что делать дальше.")
    empt = doc.frame(sv, "Empty panel", 20, 40, 490, 440, fill=solid(PANEL), radius=16,
                     stroke_color=BORDER2)
    doc.rect(empt, "Icon bg", 24, 32, 44, 44, None, fill=None) if False else None
    doc.frame(empt, "Icon wrap", 24, 32, 44, 44, fill=solid(ACCENT_SOFT), radius=13,
              stroke_color=ACCENT_BORDER)
    icon(doc, empt, "grid", 37, 45, 18, ACCENT_TEXT)
    doc.text(empt, "Title", 24, 96, 420, "Наград пока нет", size=18, weight=600, color=TEXT)
    doc.text(empt, "Text", 24, 128, 430,
             "Создайте награду в Twitch или локальную привязку — она появится здесь и сразу будет готова к эфиру.",
             size=12.2, color=MUTED)
    kit.button(empt, 24, 220, "Создать награду", "primary", "md", width=180)
    kit.button(empt, 216, 220, "Открыть Twitch", "secondary", "md", width=160)
    doc.text(empt, "Hint", 24, 290, 420, "Если награды есть в Twitch, но не видны — проверьте Client ID и права.",
             size=10.8, color=DIM)
    load = doc.frame(sv, "Loading panel", 530, 40, 490, 440, fill=solid(PANEL), radius=16,
                     stroke_color=BORDER2)
    doc.text(load, "Title", 24, 32, 420, "Загружаем награды…", size=18, weight=600, color=TEXT)
    doc.text(load, "Text", 24, 64, 430,
             "Twitch отвечает — обычно это меньше секунды. Не закрывайте окно.",
             size=12.2, color=MUTED)
    for i in range(3):
        y = 110 + i * 96
        sk = doc.frame(load, "Skeleton/%d" % i, 24, y, 440, 84, fill=solid("#FFFFFF08"),
                       radius=12)
        doc.frame(sk, "Sk tile", 12, 12, 28, 28, fill=solid("#FFFFFF14"), radius=8)
        doc.frame(sk, "Sk title", 48, 12, 190, 12, fill=solid("#FFFFFF14"), radius=6)
        doc.frame(sk, "Sk line", 48, 34, 260, 10, fill=solid("#FFFFFF0D"), radius=5)
        doc.frame(sk, "Sk chip", 12, 54, 300, 20, fill=solid("#FFFFFF0A"), radius=8)
    err = doc.frame(sv, "Error panel", 1040, 40, 490, 440, fill=solid("#1A1213"), radius=16,
                    stroke_color="#EF444452")
    doc.frame(err, "Icon wrap", 24, 32, 44, 44, fill=solid("#EF44441A"), radius=13,
              stroke_color="#EF444452")
    icon(doc, err, "close", 38, 46, 16, DANGER)
    doc.text(err, "Title", 24, 96, 420, "Twitch не ответил", size=18, weight=600, color=TEXT)
    doc.text(err, "Text", 24, 128, 430,
             "Награды не загружены. Проверьте подключение и повторите — локальные звуки работают и без Twitch.",
             size=12.2, color=MUTED)
    kit.button(err, 24, 220, "Повторить", "primary", "md", width=140)
    kit.button(err, 176, 220, "Открыть журнал", "secondary", "md", width=160)
    doc.text(err, "Code", 24, 300, 430, "Код: TWITCH_HTTP_503 · 2026-11-17 20:46", size=10.4, color=DIM)

    # 05.7 disabled + local bindings
    win = window(doc, kit, p, MARGIN, 3020, 1220, 840, "Награды / выключенные привязки")
    sidebar(doc, kit, win, h=840, active="Награды")
    topbar(doc, kit, win, x=236, w=984)
    footer(doc, kit, win, x=236, w=984, hint="9 наград выключено · 3 локальные привязки")
    area = doc.frame(win, "Content", 236, 94, 984, 710, fill=solid(BG), clip=True)
    ui2.page_head(doc, kit, area, 24, 16, 936, "Награды",
                  "@goshanmur · 11 наград · 2 выключено · 3 локальные")
    doc.text(area, "Section title", 24, 96, 500, "АКТИВНЫЕ НАГРАДЫ · 2", size=10.6,
             weight=600, color=DIM, tracking=1.6)
    reward_row(doc, kit, area, 24, 120, 936, "Ты новичок?", 200, REWARD_COLORS[0],
               file_name="newbie.mp3", fmt="MP3", volume=200)
    reward_row(doc, kit, area, 24, 172, 936, "Смешок", 200, REWARD_COLORS[5],
               file_name="shitpost-laugh.mp3", fmt="MP3", volume=109)
    doc.text(area, "Section disabled", 24, 240, 600, "ВЫКЛЮЧЕННЫЕ И НЕДОСТУПНЫЕ · 9", size=10.6,
             weight=600, color=DIM, tracking=1.6)
    for i, (title, cost, colr) in enumerate((("Шиза", 250, REWARD_COLORS[6]),
                                             ("Беги", 200, REWARD_COLORS[7]),
                                             ("Выстрел", 50, REWARD_COLORS[8]),
                                             ("Звук доната", 300, REWARD_COLORS[2]))):
        y = 264 + i * 56
        row = doc.frame(area, "Disabled row/%d" % i, 24, y, 936, 48, fill=solid("#FFFFFF04"),
                        radius=10, opacity=0.62)
        doc.rect(row, "Tile", 10, 11, 26, 26, solid(colr), 7)
        doc.text(row, "T", 10, 16, 26, title[:1], size=12.6, weight=600,
                 color=ui.contrast_text(colr), align="center")
        doc.text(row, "Title", 46, 8, 320, title, size=13.2, weight=600, color=TEXT)
        doc.text(row, "Meta", 46, 25, 320, "%d БАЛЛОВ · ВЫКЛЮЧЕНА" % cost, size=10, color="#8E8A8B")
        doc.text(row, "Reason", 400, 15, 320, "Награда недоступна в канале", size=11, color=DIM)
        icon(doc, row, "dots", 910, 16, 15, MUTED)
    doc.line(area, "Split", 24, 500, 936, "#FFFFFF", 0.06)
    doc.text(area, "Section local", 24, 516, 700, "ЛОКАЛЬНЫЕ ПРИВЯЗКИ · 3", size=10.6,
             weight=600, color=DIM, tracking=1.6)
    for i, (title, colr, fname) in enumerate((("Ты новичок?", REWARD_COLORS[0], "newbie.mp3"),
                                              ("А где донаты", REWARD_COLORS[4], "wheredonats.mp3"),
                                              ("Смешок", REWARD_COLORS[5], "shitpost-laugh.mp3"))):
        x = 24 + i * 308
        c = doc.frame(area, "Local/%d" % i, x, 540, 300, 128, fill=solid("#FFFFFF07"),
                      radius=12, stroke_color=BORDER2)
        doc.rect(c, "Tile", 12, 12, 28, 28, solid(colr), 8)
        doc.text(c, "L", 12, 17, 28, title[:1], size=13, weight=600,
                 color=ui.contrast_text(colr), align="center")
        doc.text(c, "Title", 50, 14, 240, title, size=12.6, weight=600, color=TEXT)
        doc.text(c, "File", 12, 52, 276, fname, size=10.4, color=MUTED)
        slider(doc, c, 12, 78, 200, 0.6)
        kit.button(c, 12, 96, "Проверить", "secondary", "sm", width=140)
    return p


def page_music(doc, kit):
    p = doc.page("06 — Музыка", "#0A0A0B")
    page_title(doc, p, MARGIN, 90, "06 · МУЗЫКА",
               "Музыка",
               "Плеер, очередь, пустое состояние и OBS-карточка. Заявка из чата: ссылка → очередь → эфир.")

    music_screen(doc, kit, p, MARGIN, 240, 1220, 840)
    music_screen(doc, kit, p, MARGIN + 1330, 240, 1220, 840, queue_rows=[
        ("ДИНАСТИЯ — Земляк", "@nix", "2:44", "играет", ACCENT),
        ("Kanye - Vulvas", "@druzhba", "3:14", "загрузка 64%", WARN),
        ("Sweet Dreams", "@mod_anya", "4:52", "загружен", OK),
        ("run.mp3", "@goshanmur", "0:02", "в очереди", MUTED),
        ("prefetch · next", "—", "—", "готов к старту", OK),
    ])
    music_screen(doc, kit, p, MARGIN, 1160, 980, 680, empty=True)
    music_screen(doc, kit, p, MARGIN + 1090, 1160, 980, 680)

    # queue states
    st = spec_frame(doc, p, MARGIN, 1960, 1600, 460, "Queue states",
                    "06.3 Строки очереди", "Каждый статус: играет / загрузка / загружен / в очереди / prefetch.")
    statuses = [("играет", ACCENT, "сейчас в эфире", "0:58 / 2:44"),
                ("загрузка 64%", WARN, "скачиваем через yt-dlp", "осталось ~8 с"),
                ("загружен", OK, "файл готов, ждёт старта", "2:44"),
                ("в очереди", MUTED, "позиция 4 из 10", "4:52"),
                ("prefetch", OK, "следующий трек уже скачан", "0:00")]
    for i, (status, colr, desc, time) in enumerate(statuses):
        x = 24 + i * 306
        row = doc.frame(st, "State/%d" % i, x, 56, 296, 96, fill=solid("#FFFFFF05"),
                        radius=12, stroke_color=BORDER2)
        doc.frame(row, "Art", 12, 12, 44, 44, fill=solid(SURF2), radius=10)
        icon(doc, row, "music", 26, 26, 16, MUTED)
        doc.text(row, "Title", 66, 12, 190, "ДИНАСТИЯ — Земляк", size=11.6, weight=600, color=TEXT)
        doc.text(row, "Desc", 66, 30, 190, desc, size=9.6, color=MUTED)
        chip(doc, kit, row, 12, 66, status, color=colr, bg=colr + "1F",
             border=colr + "52", size=20, fs=9.2)
        doc.text(row, "Time", 210, 70, 74, time, size=9.4, color=DIM, align="right")
    doc.text(st, "Rule", 24, 190, 1500,
             "Правило: prefetch запускается на предпоследнем треке, чтобы эфир не ждал загрузку. Ошибка загрузки — статус «ошибка» с кнопкой «Повторить».",
             size=11.4, color=MUTED)
    return p


def page_chat(doc, kit):
    p = doc.page("07 — Чат", "#0A0A0B")
    page_title(doc, p, MARGIN, 90, "07 · ЧАТ",
               "Чат",
               "Подключение, команды, лента сообщений и оверлей. Чат читает тот же вход Twitch.")

    chat_screen(doc, kit, p, MARGIN, 240, 1220, 840, view="setup")
    chat_screen(doc, kit, p, MARGIN + 1330, 240, 1220, 840, view="feed")
    chat_screen(doc, kit, p, MARGIN, 1160, 980, 680, view="setup")

    # states
    st = spec_frame(doc, p, MARGIN, 1960, 1600, 760, "Chat states",
                    "07.4 Состояния чата", "Подключено / переподключение / нет прав / read-only / ошибка токена.")
    panels = [("Подключено", OK, "chat:read + chat:edit · модератор",
               "Можно писать в чат, выполнять команды и таймауты."),
              ("Переподключение", WARN, "попытка 3 из 5 · 2 с",
               "Награды работают; сообщения в чат временно не уходят."),
              ("Нет прав", DANGER, "нет chat:edit",
               "Приложение подключилось анонимно — только чтение. Лента работает, отправка недоступна."),
              ("Токен истёк", DANGER, "401 · обновление не удалось",
               "Нужно переподключить Twitch в настройках. Награды и очередь продолжают работать.")]
    for i, (name, colr, sub, desc) in enumerate(panels):
        x = 24 + i * 392
        card = doc.frame(st, "Panel/%d" % i, x, 56, 372, 300, fill=solid(PANEL),
                         radius=16, stroke_color=colr + "4D" if i else BORDER2)
        dot(doc, card, 18, 20, colr, 8)
        doc.text(card, "Name", 34, 14, 320, name, size=14.4, weight=600, color=TEXT)
        doc.text(card, "Sub", 18, 44, 336, sub, size=10.6, color=MUTED)
        doc.text(card, "Desc", 18, 76, 336, desc, size=11.6, color=TEXT2)
        input_field(doc, card, 18, 150, 336, "Написать сообщение…",
                    state="disabled" if i >= 2 else "default")
        kit.button(card, 18, 204, "Переподключить" if i else "Проверить", "secondary", "sm", width=160)
        if i == 2:
            kit.button(card, 186, 204, "Войти заново", "primary", "sm", width=150)
    doc.text(st, "Rule", 24, 380, 1500,
             "Правило: read-only не блокирует награды и музыку — стрим продолжается, чат объясняет причину.",
             size=11.4, color=MUTED)
    return p


def page_settings(doc, kit):
    p = doc.page("08 — Настройки", "#0A0A0B")
    page_title(doc, p, MARGIN, 90, "08 · НАСТРОЙКИ",
               "Настройки",
               "Здоровье системы, Twitch, звук, аудиовыход, внешний вид, приложение, музыка и данные.")

    settings_screen(doc, kit, p, MARGIN, 240, 1220, 840)
    settings_screen(doc, kit, p, MARGIN + 1330, 240, 980, 680)

    # accent variants
    ac = spec_frame(doc, p, MARGIN, 1160, 1600, 620, "Accent variants",
                    "08.3 Акцент — три темы", "Акцент применяется мгновенно и не трогает статусы, опасные действия и цвета наград.")
    themes = [("#8B00FF", "#C9A7FF", "Фирменный фиолетовый", "По умолчанию · белый текст на кнопке"),
              ("#3B82F6", "#93BAFA", "Синий", "Тёмный текст на акцентной кнопке (5.38:1)"),
              ("#22C55E", "#85DFA6", "Зелёный", "Тёмный текст на акцентной кнопке (8.69:1)")]
    for i, (accent, acctext, name, note) in enumerate(themes):
        x = 24 + i * 524
        card = doc.frame(ac, "Theme/%d" % i, x, 56, 500, 480, fill=solid(PANEL),
                         radius=18, stroke_color=accent + "59")
        doc.text(card, "Name", 20, 18, 460, name, size=16, weight=600, color=TEXT)
        doc.text(card, "Note", 20, 42, 460, note, size=10.8, color=MUTED)
        doc.ellipse(card, "Swatch", 20, 76, 32, 32, solid(accent))
        doc.text(card, "Hex", 62, 86, 160, accent, size=12.4, color=TEXT)
        b = doc.frame(card, "Btn", 20, 124, 170, 40, fill=solid(accent), radius=20)
        doc.text(b, "T", 0, 11, 170, "Создать награду", size=13.2, weight=600,
                 color=ui.contrast_text(accent), align="center")
        b2 = doc.frame(card, "Btn2", 202, 124, 120, 40, fill=None, radius=20,
                       stroke_color=accent + "59")
        doc.text(b2, "T", 0, 11, 120, "Отмена", size=13.2, weight=600, color=acctext, align="center")
        # active nav sample
        nav = doc.frame(card, "Nav", 20, 184, 460, 40, fill=solid(accent + "24"), radius=10)
        icon(doc, nav, "grid", 12, 12, 16, TEXT)
        doc.text(nav, "T", 40, 12, 200, "Награды", size=13.4, weight=600, color=TEXT)
        doc.text(card, "Mini", 20, 244, 460, "Акцентная точка «играет», фокус-ринг 2 px, accent-text для мелких ссылок.",
                 size=10.6, color=DIM)
        dot(doc, card, 20, 280, accent, 10)
        doc.text(card, "Dot", 38, 274, 400, "точка «играет» и фокус", size=10.8, color=MUTED)
        sw = doc.frame(card, "Pill", 20, 306, 170, 28, fill=solid(accent + "24"), radius=14,
                       stroke_color=accent + "59")
        doc.text(sw, "T", 0, 7.5, 170, "Со звуком 9", size=10.6, weight=600, color=acctext, align="center")
        statuses = doc.frame(card, "Statuses", 20, 356, 460, 100, fill=None)
        for j, (nm, colr) in enumerate((("готово", OK), ("внимание", WARN), ("ошибка", DANGER),
                                        ("ИНФО", INFO))):
            dot(doc, statuses, 0 + j * 112, 10, colr, 7)
            doc.text(statuses, "S", 12 + j * 112, 6, 90, nm, size=9.6, color=MUTED)
        doc.text(card, "Status note", 20, 436, 460,
                 "Статусы и опасные действия не перекрашиваются.", size=10, color=DIM)

    # data + danger
    dt = spec_frame(doc, p, MARGIN, 1860, 760, 520, "Data card",
                    "08.4 Данные и опасная зона", "Всё хранится локально; очистка — с подтверждением и объяснением.")
    data = settings_card(doc, kit, dt, 20, 40, 720, 220, "Данные",
                         "Настройки, журнал и очередь хранятся в %APPDATA%\\RewardSounds")
    doc.text(data, "Path label", 16, 58, 100, "ПАПКА", size=9.2, color=DIM, tracking=1.2)
    doc.text(data, "Path value", 16, 74, 640, "%APPDATA%\\RewardSounds", size=11.6, color=TEXT2)
    kit.button(data, 16, 108, "Открыть папку", "secondary", "sm", width=140)
    kit.button(data, 168, 108, "Создать резервную копию", "secondary", "sm", width=210)
    kit.button(data, 16, 164, "Удалить все данные…", "danger-ghost", "sm", width=190)
    dz = doc.frame(dt, "Danger", 20, 280, 720, 200, fill=solid("#EF44440D"), radius=14,
                   stroke_color="#EF44444D")
    doc.text(dz, "Label", 16, 16, 300, "ОПАСНАЯ ЗОНА", size=9.6, weight=600, color="#FCA5A5", tracking=1.4)
    doc.text(dz, "Text", 16, 40, 680,
             "Отключить Twitch — награды и чат перестанут работать до повторного входа. Потребуется подтверждение.",
             size=11.6, color=MUTED)
    kit.button(dz, 16, 96, "Отключить Twitch", "danger", "sm", width=190)
    kit.button(dz, 218, 96, "Выйти из приложения", "secondary", "sm", width=200)
    doc.text(dz, "Client", 16, 148, 680, "Client ID: 9k94vobgen30nxa5h9x9cykowstzz", size=10.2, color=DIM)
    return p


def page_log(doc, kit):
    p = doc.page("09 — Журнал", "#0A0A0B")
    page_title(doc, p, MARGIN, 90, "09 · ЖУРНАЛ",
               "Журнал",
               "События, уровни, поиск, очистка с архивом. Диагностика: что произошло и что делать.")

    log_screen(doc, kit, p, MARGIN, 240, 1220, 840)
    log_screen(doc, kit, p, MARGIN + 1330, 240, 980, 680)

    st = spec_frame(doc, p, MARGIN, 1160, 1600, 820, "Log states",
                    "09.3 Пусто / фильтр / очистка", "Пустой журнал, фильтр без результатов и подтверждение очистки с архивом.")
    # empty
    e = doc.frame(st, "Empty log", 24, 56, 500, 360, fill=solid(PANEL), radius=16,
                  stroke_color=BORDER2)
    doc.frame(e, "Icon", 24, 28, 40, 40, fill=solid("#FFFFFF0A"), radius=12, stroke_color=BORDER2)
    icon(doc, e, "journal", 36, 40, 16, MUTED)
    doc.text(e, "Title", 24, 88, 440, "Записей пока нет", size=17, weight=600, color=TEXT)
    doc.text(e, "Text", 24, 118, 440,
             "Журнал начнёт заполняться сразу после запуска: подключение Twitch, награды, музыка, ошибки.",
             size=12, color=MUTED)
    kit.button(e, 24, 200, "Обновить", "secondary", "md", width=130)
    doc.text(e, "Hint", 24, 260, 440, "Файл: %APPDATA%\\RewardSounds\\logs\\app.log", size=10.2, color=DIM)
    # filter empty
    f2 = doc.frame(st, "Empty filter", 540, 56, 500, 360, fill=solid(PANEL), radius=16,
                   stroke_color=BORDER2)
    fs = doc.frame(f2, "Search", 24, 28, 300, 34, fill=solid(SURF2), radius=17, stroke_color=BORDER2)
    icon(doc, fs, "search", 11, 9.5, 15, DIM)
    doc.text(fs, "Ph", 33, 9.4, 240, "таймаут", size=13, color=DIM)
    doc.text(f2, "Title", 24, 88, 440, "Ничего не найдено", size=17, weight=600, color=TEXT)
    doc.text(f2, "Text", 24, 118, 440,
             "По запросу «таймаут» нет записей. Попробуйте уровень «Все» или очистите поиск.",
             size=12, color=MUTED)
    kit.button(f2, 24, 200, "Сбросить фильтр", "secondary", "md", width=160)
    # clear dialog
    d = doc.frame(st, "Clear dialog", 1060, 56, 520, 360, fill=solid(SURF), radius=20,
                  stroke_color=BORDER2, effects=[fc._shadow("#000000", 0.55, 30, 0, 80)])
    doc.text(d, "Title", 24, 20, 460, "Очистить журнал?", size=19, weight=600, color=TEXT)
    doc.text(d, "Text", 24, 54, 460,
             "Текущий файл перенесётся в архив рядом с журналом (logs/archive-*.log), после чего журнал начнётся заново.",
             size=12, color=MUTED)
    warn = doc.frame(d, "Warn", 24, 116, 460, 54, fill=solid("#F59E0B0F"), radius=10,
                     stroke_color="#F59E0B40")
    icon(doc, warn, "external", 12, 12, 14, WARN)
    doc.text(warn, "Text", 34, 10, 410, "Архив не удаляется автоматически — его можно удалить вручную в папке журнала.",
             size=10.6, color=MUTED)
    _mini_button(doc, d, 24, 300, 130, "Отмена", "secondary")
    _mini_button(doc, d, 164, 300, 140, "Очистить", "danger")
    doc.text(d, "Close", 470, 20, 24, "×", size=18, color=MUTED)
    doc.text(st, "Levels", 24, 440, 1500,
             "Уровни: ИНФО (#7DD3FC) · ПРЕДУПРЕЖДЕНИЕ (#F59E0B) · ОШИБКА (#EF4444). Уровень не перекрашивается акцентом.",
             size=11.4, color=MUTED)
    doc.text(st, "Order", 24, 468, 1500,
             "Новые записи сверху, автоскролл отключается при чтении. «Отладка» — только для диагностики, по умолчанию выключена.",
             size=11.4, color=MUTED)
    return p
