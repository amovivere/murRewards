# Повторный UX/UI-аудит Reward Sounds — после фикса P0/P1

- **Дата:** 2026-11-18, 22:56–23:16 (Asia/Vladivostok)
- **Сборка:** `reward-sounds-tauri/dist/Reward Sounds Tauri.exe` (22:55:58), коммит `2204797` «fix: закрыть P0/P1 UX-аудита и убрать буквы с карточек», версия 1.7.0
- **Состояние данных:** Twitch подключён (@goshanmur), 20 наград, 5 health-строк, 9 локальных привязок, журнал 185 записей (INFO 181 / WARN 1 / DEBUG 3), музыка: трек доиграл → пустое состояние (0 из 10), accent `#8B00FF`, volume 0.287, close_to_tray=true.
- **Автотесты:** `node tests-ui/run.mjs` → **32 passed, 0 failed** (полный вывод: `notes2/run-tests.log`). Тесты запускают `src-tauri/target/release/reward-sounds-tauri.exe` и не покрывают часть найденных проблем (см. §6).
- **Границы работы:** только аудит. Код/Rust/стили не менялись. Пользовательские данные и настройки не изменены: акцент временно переключён на `#4E7CFF` и возвращён на `#8B00FF` (проверено `get_state` до/после), громкость не менялась, награды не создавались/не удалялись, настройки не сохранялись, журнал/очередь не очищались. В журнал добавились только записи от действий аудита (прослушивание, stop all, refresh Twitch). Геометрия окна возвращена в исходную (`window.json`: `{x:473,y:136,width:1803,height:1063}`); приложение закрыто.
- **Артефакты:** `shots2/` — **64 PNG**, `notes2/` — **71 JSON + 13 логов** (сырые измерения и логи прогонов).

---

## 1. Краткое резюме

### 1.1 Что реально исправлено

- **P0 закрыты:** «Редактировать» заполняет реальные значения (`Ты новичок? / 200 / #fb5959`, Save активна); меню карточки больше не обрезается (`.reward-card{overflow:visible}`, у нижних карточек `is-above`), все 4 пункта кликабельны, «Удалить награду» открывает confirm. Буквенные аватары убраны, добавлена тонкая цветная полоска `::before` 2 px сверху карточки.
- **Основные P1 закрыты:** поиск фильтрует (20 → 3 по «ставка»); «Плитка/Список» работает (`aria-pressed`, `.reward-grid.is-list`); «Остановить всё» вызывает `stop_all_sounds` + тост; демо-панель «Состояния» удалена; «Открыть YouTube» подключён (`open_url`); действия/ссылки настроек работают (health «Открыть» → нужная вкладка, диагностика копируется, «Открыть журнал», музыка, онбординг, опасная зона с confirm); журнал копируется и очищается через confirm; настройки музыки/OBS не перетираются поллингом (значения держатся >1.8 с); health/логин/устройство/громкость/акцент берутся из `view`; оболочка fluid (100vw/100vh) заполняет окно на 1600, 1803 и 2560 px; тосты внутри окна, `role=status aria-live=polite`.
- **A11y частично закрыта:** Esc и focus-trap в модалках, focus-visible для большинства контролов, `aria-current` на навигации, `aria-expanded/aria-controls` у health-чипа, `aria-label` у иконочных кнопок, контраст большей части подписей поднят (журнал — 0 нарушений, было 40+).
- **Окно:** кнопка maximize меняет title на «Восстановить»/aria; drag через `win_start_drag` реально перемещает окно; maximize заполняет экран (2560×1392); fluid-вёрстка без полей.
- **Онбординг:** доступен из «Настройки → Пройти знакомство заново»; CTA «Продолжить настройку» и «Пропустить» работают, показываются реальные 9 привязок.

### 1.2 Что осталось и что появилось нового

- **Регрессия (P1):** в новом списочном виде меню нижних карточек ломается. Из-за конфликта CSS `.reward-menu.is-above{top:auto;bottom:44px}` и `.reward-grid.is-list .reward-menu{top:46px}` у карточки высотой 60 px меню сжимается до **12 px**, пункты уезжают за экран (`topEl = FOOTER/null`), «Удалить награду» недоступно. Проверено на последней карточке списка (`notes2/15-list-menu.json`, `shots2/16-list-menu.png`).
- **P2 не исправлено:** форма создания награды по-прежнему **молча игнорирует «ОПИСАНИЕ» и чекбокс «Ссылка YouTube»** (`create_reward` не имеет параметра description, `needLink` никуда не передаётся) — `RewardsPage.jsx:280-295`, `core.rs:1188`.
- **P2 не исправлено:** настройка музыки «Играть сразу после активации» не сохраняется — `MusicSettingsModal.onSave` не передаёт `enabled`, а в `MusicSettingsPatch` такого поля нет вообще (`core.rs`), т.е. тумблер визуально работает, но после сохранения/перезапуска теряется.
- **P2 не исправлено:** hex-поля цветов невозможно набрать посимвольно (7 нажатий — значение `#FFFFFF` не меняется), TagInput «съедает» запятую («a», «,», «b» → `a`, `a`, `ab`), несохранённые правки оверлея теряются при уходе со вкладки.
- **P2 не исправлено:** возврат фокуса после закрытия модалки не работает — активным остаётся `BODY`. Причина: `Modal` пересоздаёт effect на каждом рендере (нестабильный `onClose`), cleanup/повторный effect перезаписывают `previousFocus` элементом внутри модалки, и при закрытии фокус пытаются вернуть на удалённый узел.
- **P2 a11y:** 31 контрол без accessible name (overlay 24: 5 switch, 9 range, 9 textbox, 1 combobox; settings 6: 5 switch + range; log 1: поиск), без видимого фокуса остались play-кнопки (9), switch-тумблеры (10) и health-«Открыть» (5); контраст всё ещё ниже AA у 18 DOM-нарушений + футер 3.47.
- **P2/P3 новые:** fluid-вёрстка на 2560 не перестраивает композицию (4 карточки по 558 px, поля оверлея растянуты на ~1600 px, слайдеры во всю ширину); «Открыть превью в браузере»/подсказка превью по-прежнему ниже фолда на 1600×1000; превью-iframe на старте показывает пустой чёрный блок (нет skeleton/placeholder) примерно 1–3 с; клик вне меню карточки не закрывает его (закрывает только Esc); меню имеет `role=menu`, но фокус в него не переводится и стрелки не работают.
- **«Очистить очередь» при пустой очереди** остаётся активной и открывает confirm для пустой очереди (P3).

### 1.3 Сводка статусов по ID из AUDIT.md

| Статус | Кол-во | ID |
|---|---|---|
| **fixed** | **37** | GLOB-01..07, NAV-01, NAV-03, REW-01..07, REW-09, REW-11, MUS-01..03, MUS-05, MUS-07, MUS-11, OVL-09, SET-01..04, SET-07, LOG-01, LOG-02, LOG-08, ONB-01..03, A11Y-06 |
| **partial** | **22** | GLOB-08, NAV-02, REW-08, REW-13, MUS-04, MUS-06, MUS-08, MUS-10, OVL-04, SET-08, SET-09, ONB-04, A11Y-01..05, A11Y-07, CONS-02, CONS-04..06 |
| **not fixed** | **20** | REW-10, REW-12, MUS-09, OVL-01, OVL-02, OVL-03, OVL-05..08, OVL-10, SET-05, SET-06, LOG-03..07, CONS-01, CONS-03 |
| **regression** | **1** | новый N-01 (список: меню нижней карточки), плюс N-02..N-10 (новые находки) |

> Итого проверено 79 старых ID: 37 fixed, 22 partial, 20 not fixed, 0 деградаций среди старых ID. Новых: 1 regression + 10 прочих (1×P1, 4×P2, 5×P3).

---

## 2. Метод и ограничения

- Приложение запущено с `REWARD_SOUNDS_DEVTOOLS_PORT=9333`; проверка фактического DOM/computed styles/ARIA/AX, клики реальными CDP mouse-событиями, ввод, Tab/Esc/стрелки, окно — Win32 API (SetWindowPos, SendInput).
- Скриншоты: `Page.captureScreenshot` в `shots2/`; состояния 1600×1000 (min), 1803×1063 (текущее), 2560×1392 (maximized).
- Проверены: все 5 экранов, меню и модалки наград, поиск/фильтры/список, меню нижних карточек, настройки музыки/OBS с ожиданием >1.5 с, health-поповер (Esc + реальный клик вне), громкость в шапке (wiring/aria/значение из state), акцент (смена+возврат), drag/double-click/maximize, журнал (копирование, confirm очистки, поиск, фильтры, скролл), онбординг из настроек, консольные ошибки (через `tests-ui`).
- **Не выполнялось намеренно:** создание/удаление наград, сохранение настроек музыки/OBS, изменение громкости/карточных громкостей, очистка журнала/очереди, отключение Twitch, «Показать сейчас», нативный выбор звука, открытие YouTube (внешний браузер). Для этих сценариев проверены обработчики/модалки/валидация и код бэкенда.
- **Не проверено:** реальный оффлайн/отключённый Twitch (нельзя отключать), реальная ошибка `get_state` (симуляция недоступна), меню трея, OBS-источник в реальном OBS, производительность при тысячах записей, онбординг с неподключённым Twitch (только код).
- «Пустое состояние музыки» проверено фактически: трек доиграл сам во время аудита → «Ничего не играет», «Очередь пуста», 0 из 10.
- Расхождение с заданием: в задании «32 проверки», в `tests-ui/README.md` устаревший текст «22 проверки» (сам `run.mjs` содержит 32 assert). В отчёте — по факту запуска: 32 passed.

---

## 3. Статусы по каждому ID (fixed / partial / not fixed / regression)

Формат: **ID · статус** — факт, evidence.

### 3.1 Каркас и окно

| ID | Статус | Факт / evidence |
|---|---|---|
| GLOB-01 | **fixed** | Оболочка fluid: 1803×1063 → shell 1803×1063, margins 0; max 2560×1392 → shell заполняет; min 1600×1000 → shell 1600×1000, margins 0 (`notes2/80-window.json`, `notes2/c0-min-metrics.json`; `shots2/81-window-maximized-rewards.png`). |
| GLOB-02 | **fixed** | Мок-fallback из Tauri убран: `real = Boolean(backend.available)`, при отсутствии view показывается пустое состояние (в т.ч. «Twitch не подключён»), добавлен `.app-error-banner` с «Повторить» (`App.jsx:264-270`). Мок-данные остались только в браузерной ветке. |
| GLOB-03 | **fixed** | Health/логин/устройство/URL из `view`: попап «Подключено · @goshanmur», `Analogue 1/2 (Audient iD4)`, реальный overlay-URL, 5/5 из health (`shots2/90-health-popover.png`, `notes2/90-health-popover.json`). |
| GLOB-04 | **fixed** | Esc закрывает (open=false, aria-expanded=false); реальный клик вне закрывает (open=false); порядок строк совпадает с настройками; данные реальные (`notes2/90-health-popover.json`, `notes2/91-health-close.json`, `notes2/a3-health-outside.json`). |
| GLOB-05 | **fixed** | В шапке настоящий `input[type=range]` 96×18, `aria-label="Общая громкость"`, value 29 из `view.volume`; клик/изменение не выполнялись, чтобы не менять настройку. |
| GLOB-06 | **fixed** | Тост `bottom:52px` внутри viewport (y=973, h=38 при 1063), `role=status aria-live=polite`; проверено на stop-all/play/копировании (`notes2/21-stop-toast.json`, `notes2/22-play-toast.json`, `notes2/61-log-copy.json`). |
| GLOB-07 | **fixed** | Дубль версии из сайдбара убран; футер живой: «Все системы работают · версия 1.7.0»; brand-sub «Channel Points · OBS». |
| GLOB-08 | **partial** | Кнопка maximize меняет title/aria на «Восстановить окно» (`notes2/80-window.json`); drag реально двигает окно (window.json x/y изменились при SendInput-drag). **Двойной клик по шапке (реальные SendInput-события) окно не максимизирует** — mousedown запускает `win_start_drag`, dblclick не доходит; `IsZoomed=false`, размер не изменился. |

### 3.2 Навигация

| ID | Статус | Факт / evidence |
|---|---|---|
| NAV-01 | **fixed** | `nav aria-label`, у активного пункта `aria-current="page"` (`notes2/01-shell.json`). |
| NAV-02 | **partial** | Награды: фильтр/поиск/вид сохраняются через sessionStorage при переходе вкладок (before/after одинаковы). Музыка: URL сохраняется. **Оверлей: несохранённые правки по-прежнему теряются** без предупреждения (`notes2/24-rewards-state.json`, `notes2/73-overlay-unsaved.json`). |
| NAV-03 | **fixed** | Онбординг доступен из «Настройки → Пройти знакомство заново», CTA и «Пропустить» работают; на экране 9 реальных привязок; при `connected=false` в коде добавляется nav «Подключение» (`notes2/93-onboarding.json`, `shots2/94-onboarding-from-settings.png`). |

### 3.3 Награды

| ID | Статус | Факт / evidence |
|---|---|---|
| REW-01 | **fixed** | «Редактировать»: `["Ты новичок?","200","#fb5959"]`, Save enabled (`notes2/19-edit-modal.json`, `shots2/19-edit-modal.png`). |
| REW-02 | **fixed** | `overflow:visible`, меню 353×132, все 4 пункта полностью видны и кликабельны; у нижней карточки `is-above`; клик по «Удалить награду» открывает confirm (`notes2/16-grid-menu.json`, `notes2/17-delete-click.json`, `notes2/30-grid-bottom-menu.json`, `shots2/17-grid-menu.png`). |
| REW-03 | **fixed** | Поиск «ставка» → 3 карточки «Ставка 2000/1000/500»; пустой результат → «Ничего не найдено» (`notes2/11-search.json`, `shots2/12-rewards-search.png`). |
| REW-04 | **fixed** | «Список» → `.reward-grid.is-list`, 1496×60 строки, `aria-pressed` корректны (`notes2/14-list-view.json`, `shots2/14-rewards-list.png`). |
| REW-05 | **fixed** | «Остановить всё» → тост «Все звуки остановлены»; кнопка «Все награды» удалена (`notes2/21-stop-toast.json`). |
| REW-06 | **fixed** | Панель «Состояния» отсутствует в DOM; наградная страница — карточки + пустое состояние (`shots2/11-rewards-grid.png`). |
| REW-07 | **fixed** | Вместо div-«слайдера» — `input[type=range]` 0–200, value из состояния, `aria-label="Громкость <награда>"`, handler `set_sound_volume`; значение не менялось, чтобы не изменить данные (`notes2/10-cards.json`). |
| REW-08 | **partial** | `aria-label="Прослушать …"` добавлен, но кнопка **19×19** (минимум цели 24×24) и **без видимого focus-ring** (computed `outline:auto 1px rgb(16,16,16)`; `notes2/a1-a11y-report.json` → rewards noRing: `BUTTON.play-button`). |
| REW-09 | **fixed** | Поиск: `aria-label="Поиск награды"`; фокус-ринг у поиска/фильтров/переключателя вида; AX unnamed на «Наградах» = 0. |
| REW-10 | **not fixed** | Форма создания по-прежнему не передаёт `description`/`needLink` в `create_reward`: команда бэкенда не имеет параметра описания (`RewardsPage.jsx:280-295`, `core.rs:1188`). |
| REW-11 | **fixed** | Esc закрывает модалки; focus-trap: 14 Tab не выходят за `.ui-modal`, Shift+Tab с первого и Tab с последнего заворачиваются (`notes2/32-modal-trap.json`, `notes2/35-keyboard-menu-modals.json`). |
| REW-12 | **not fixed** | Текст пустого состояния для «Играет» не изменён; метка «играет» по-прежнему появляется только после поллинга (код не менялся). |
| REW-13 | **partial** | Демо-кнопки/дубли удалены; «Пример кнопки» стал статичным span; осталась непонятная метка `♪ ★` и «МУЗЫКА ЮТУБ» без звука (не блокирует). |

### 3.4 Музыка

| ID | Статус | Факт / evidence |
|---|---|---|
| MUS-01 | **fixed** | Тумблер: false сразу и **false через 1.8 с** (раньше возвращался true); слайдер/поля держатся (`notes2/44-music-settings.json`). |
| MUS-02 | **fixed** | Шрифт OBS 18 → 25 → **25 через 1.8 с** (`notes2/45-obs.json`). |
| MUS-03 | **fixed** | Валидация ссылки: «not a youtube link» → тост «Это не ссылка YouTube — проверьте адрес», `role=status`, внутри окна (`notes2/43-invalid-link.json`, `shots2/43-music-invalid-link.png`). Осталась эвристика «добавилось ли в очередь»: при пустой очереди успешный старт трека не увеличит `items.length` и может показать ложную ошибку (код, не проверялось, чтобы не менять очередь). |
| MUS-04 | **partial** | Добавлены `aria-label/title` («Продолжить/Пауза/Следующий трек»), но **обе кнопки по-прежнему вызывают один и тот же `music_toggle_pause`**; состояние паузы не отражается. Runtime-проверка не удалась: трек доиграл до пустого состояния (код не менялся). |
| MUS-05 | **fixed** | Прогресс стал `role=slider`, `tabIndex=0`, клик по треку + ArrowLeft/Right → `music_seek`; runtime не проверен, т.к. текущий трек закончился (DOM плеера отсутствует). |
| MUS-06 | **partial** | Тост теперь есть у add/stop/clear/Diag; успешные pause/skip/show overlay по-прежнему без обратной связи (код). |
| MUS-07 | **fixed** | «Открыть YouTube» имеет onClick → `open_url('https://www.youtube.com/')`; dead-scan по музыке = 0. Не кликали, чтобы не открывать браузер. |
| MUS-08 | **partial** | «Очистить» очередь → ConfirmModal (открыта/отменена, очередь не изменилась); **«×» по-прежнему удаляет трек сразу без подтверждения**. |
| MUS-09 | **not fixed** | «↑» на первом элементе остаётся активной и ничего не делает (код не менялся; очередь сейчас пуста, runtime не проверить). |
| MUS-10 | **partial** | Остались две кнопки play/pause, плейсхолдер-инструкция вместо примера; добавлены aria/title, «Показать сейчас» без подтверждения результата. |
| MUS-11 | **fixed** | Пустое состояние реально показано: «Сейчас играет → Ничего не играет», «Очередь пуста», «0 из 10», OBS «Ничего не играет» (`shots2/40-music.png`). |

### 3.5 Оверлей

| ID | Статус | Факт / evidence |
|---|---|---|
| OVL-01 | **not fixed** | Канал `audit-unsaved` + статус «Есть несохранённые изменения» → уход на «Музыку» → возврат: значение пустое, статус «Сохранено» (`notes2/73-overlay-unsaved.json`). |
| OVL-02 | **not fixed** | 7 посимвольных нажатий в hex-поле → значение остаётся `#FFFFFF` (`notes2/72-overlay-inputs.json`). |
| OVL-03 | **not fixed** | TagInput: шаги `["a","a","ab"]` — запятая исчезает (`notes2/72-overlay-inputs.json`). |
| OVL-04 | **partial** | На 2560×1392 превью (814 px) влезает; на 1803×1063 и 1600×1000 превью по-прежнему выходит ниже фолда (y=280, bottom=1094 при видимой области 965/902), подпись «420 × 900» не соответствует iframe 388×608; при открытии вкладки iframe несколько секунд показывает пустой блок без skeleton (`shots2/c2-min-overlay.png`, `notes2/70-overlay.json`). |
| OVL-05 | **not fixed** | `select` пресета всё так же `opacity:0;position:absolute` поверх текста; AX-комбобокс без имени (`notes2/a1-a11y-report.json`). |
| OVL-06 | **not fixed** | Переименование/удаление — нативные `prompt/confirm` (код не менялся). |
| OVL-07 | **not fixed** | Логика активного пресета/stale-тоста не менялась (код не менялся). |
| OVL-08 | **not fixed** | Overlay: 24 контрола без accessible name (5 switch, 9 range, 9 textbox, 1 combobox), 5 switch без focus-ring (`notes2/a1-a11y-report.json`). |
| OVL-09 | **fixed** | «Применить» disabled при отсутствии правок, статус «Сохранено»; URL-бар/копирование работает, тост `role=status` (`notes2/70-overlay.json`, `notes2/74-overlay-url.json`). |
| OVL-10 | **not fixed** | Кнопки режимов превью без `aria-pressed`; `+3` без пояснения (код не менялся). |

### 3.6 Настройки

| ID | Статус | Факт / evidence |
|---|---|---|
| SET-01 | **fixed** | Акцент из state применяется через inline `--accent`/`--accent-text` на `.app-shell`: смена на `#4E7CFF` изменила CSS-переменную, свотч, toggle (синий) и фон nav; «Сбросить» вернул `#8B00FF`, `get_state.accent` после теста = исходный (`notes2/54-accent.json`, `shots2/54-settings-accent-changed.png`). |
| SET-02 | **fixed** | Dead-scan по настройкам = 0; health «Открыть» ведёт в нужную вкладку (Оверлей/Музыка), «Скопировать диагностику» → тост, «Открыть журнал» → Журнал, «Настроить музыку» → Музыка, «Пройти знакомство заново» → Онбординг, «Отключить Twitch…» → confirm (`notes2/50-settings.json`, `notes2/52-nav-actions.json`). |
| SET-03 | **fixed** | Действия дают тосты: diagnostic/refresh/restart/disconnect (`SettingsPage.jsx`); проверен тост диагностики (`notes2/51-diagnostics.json`). |
| SET-04 | **fixed** | «Автообновление» заменено на рабочую кнопку «Пройти знакомство заново». |
| SET-05 | **not fixed** | В коде error по-прежнему отображается жёлтым (`item.state === 'error' ? 'warn'`), Pill только «ВНИМАНИЕ»; все 5 строк сейчас ok, но красного статуса нет. |
| SET-06 | **not fixed** | AX: 5 `switch` + 1 `slider` без имени в настройках; размеры 40×22 / 18 px, health «Открыть» 54×20 (`notes2/a1-a11y-report.json`). |
| SET-07 | **fixed** | «Пример кнопки» — статичный `SPAN`, не кнопка (`notes2/50-settings.json`). |
| SET-08 | **partial** | Ширина fluid (3 колонки на всю ширину), но высоты панелей по-прежнему рваные, контент скроллится (1103 при 902), правые панели обрываются ниже фолда. |
| SET-09 | **partial** | Устройство теперь «Analogue» везде, «Сменить…» → «Отключить Twitch…»; остались «Оверлей»/«Оверлей чата», «Без звука» (mute vs фильтр), дубль health в шапке и футере. |

### 3.7 Журнал

| ID | Статус | Факт / evidence |
|---|---|---|
| LOG-01 | **fixed** | «Очистить» открывает ConfirmModal «Очистить журнал?» с пояснением и danger-кнопкой; закрыто Esc, записи не тронуты (`notes2/62-log-clear.json`, `shots2/62-log-clear-confirm.png`). |
| LOG-02 | **fixed** | «Скопировать» → тост «Журнал скопирован», handler есть (`notes2/61-log-copy.json`). |
| LOG-03 | **not fixed** | При `scrollTop=1500` появление новой записи не сохраняет «якорь»: первая видимая строка сменилась на новую (top остался 1500) — чтение сдвигается (`notes2/64-log-scroll.json`). |
| LOG-04 | **not fixed** | Тулбар при скролле уходит: `toolbarY=-1307`, поиск/фильтры недоступны (`notes2/64-log-scroll.json`). |
| LOG-05 | **not fixed** | В данных 3 записи DEBUG, фильтра DEBUG нет (`notes2/60-log.json`, `notes2/63-log-search.json`). |
| LOG-06 | **not fixed** | При поиске 14 строк подпись остаётся «185 записей» (`notes2/63-log-search.json`). |
| LOG-07 | **not fixed** | «ERROR → Записей нет» не отличается от загрузки/пустоты (код не менялся). |
| LOG-08 | **fixed** | Контраст: скан `content` дал 0 нарушений (было 40+); время `#9c9ca7`/11 px на `#111` ≈ 6:1, но размер 11 px остался мелким (`notes2/a1-a11y-report.json`). |

### 3.8 Онбординг

| ID | Статус | Факт / evidence |
|---|---|---|
| ONB-01 | **fixed** | Доступен из настроек, а при `connected=false` добавляется nav «Подключение»; возврат работает (`notes2/93-onboarding.json`, `notes2/52-nav-actions.json`). |
| ONB-02 | **fixed** | CTA «Продолжить настройку» enabled → «Награды»; «Пропустить» → «Награды»; при реальном подключении недоступных действий нет (`notes2/93-onboarding.json`, `notes2/94-onboarding-cta.json`). |
| ONB-03 | **fixed** | Показаны 9 реальных привязок из `view.local_bindings` (`notes2/93-onboarding.json`). |
| ONB-04 | **partial** | Ветка «Twitch не подключён» по-прежнему не проверена живьём; в коде login без индикации ошибки (только busy). |

### 3.9 A11y / сквозное

| ID | Статус | Факт / evidence |
|---|---|---|
| A11Y-01 | **partial** | Focus-visible добавлен для `.ui-button/.ui-range/.nav-item/.filter-pill/.view-switch/.icon-ghost/.health-chip/.health-popover/.window-controls/.ui-color-swatch/.accent-swatch/input*`; **не покрыты**: `.play-button` (9 на «Наградах»), `.ui-switch` (оверлей 5, настройки 5), `.link-button` (5). Нет ринга — 24 контрола (`notes2/a1-a11y-report.json`, кропы `shots2/25-focus-filter.png`, `26-focus-carddots.png`, `27-focus-play.png`). |
| A11Y-02 | **partial** | Esc и focus-trap работают; **возврат фокуса — нет**: после закрытия edit/create/delete/confirm активен `BODY`, а не триггер (`notes2/33-modal-esc-return.json`, `notes2/35-keyboard-menu-modals.json`). Причина — нестабильные deps `[open, onClose]` в `Modal`, effect перезапускается каждые ~900 мс поллинга и перезатирает `previousFocus`. |
| A11Y-03 | **partial** | Rewards/Music: 0 unnamed; но overlay 24 unnamed (5 switch/9 range/9 textbox/1 combobox), settings 6 (5 switch+range), log 1 (textbox поиска). Всего **31**; было 25 только по кнопкам. |
| A11Y-04 | **partial** | Цели <24 px: play 19×19, accent swatch 22×22, switch 40×22, range 18 px, link-button 20 px; мелкий текст 9–11.5 px сохраняется. |
| A11Y-05 | **partial** | Исправлено большинство: log 0 нарушений, sidebar/brand/nav-label/volume 5.28–9.9, health-popover 5.77–15.18. Остались: overlay 12 (hints 3.88–3.91, preview size 4.11, toggle state 4.45), settings 3 (hints 3.91), music 2 (empty hint 4.14), rewards 1 (filter count 4.22), footer 3.47 (`notes2/a1-a11y-report.json`, `notes2/b4-contrast-outside.json`). |
| A11Y-06 | **fixed** | `aria-current`, `aria-expanded/aria-controls`, `aria-label` модалок; тосты `role=status aria-live=polite` (`notes2/01-shell.json`, `notes2/90-health-popover.json`). |
| A11Y-07 | **partial** | Тосты озвучиваются; «Есть несохранённые изменения» и результаты сохранения OBS/настроек — без live-региона; счётчики/фильтры без live. |

### 3.10 Консистентность

| ID | Статус | Факт / evidence |
|---|---|---|
| CONS-01 | **not fixed** | Хардкоды (цвета/радиусы/11 размеров шрифта) остались; токены всё ещё не основной источник. |
| CONS-02 | **partial** | Акцент теперь реально красит nav/toggles/фокус; primary-кнопки остаются белыми, «Пример кнопки» — статичный span. |
| CONS-03 | **not fixed** | Error-health по-прежнему жёлтый; статусы/pill разнокалиберные (SET-05). |
| CONS-04 | **partial** | Play-кнопки 19×19, switch 40×22, link-button 20 px остались; иконочные кнопки получили aria, но размеры не унифицированы. |
| CONS-05 | **partial** | «Channel Points · OBS» вместо «Studio · 2K», «Отключить Twitch…» вместо «Сменить…»; остались «Оверлей»/«Оверлей чата», омоним «Без звука». |
| CONS-06 | **partial** | Fluid и список улучшили раскладку; на 2560 4 колонки по 558 px, поля/слайдеры оверлея растянуты на полторы тысячи px, низ настроек всё ещё скроллится. |

---

## 4. Новые находки

**N-01 · P1 · Регрессия: меню нижней карточки в списке сломано.**
- Факт: последняя(ие) карточки списка (h=60) открывают меню с `is-above`, но `.reward-grid.is-list .reward-menu{top:46px}` перебивает `.reward-menu.is-above{top:auto;bottom:44px}` → одновременно top:46 и bottom:44, высота меню схлопывается до **12 px** (`menuRect 399×12`). Пункты выходят за экран (`topEl` = `FOOTER`/`null`), «Редактировать/Удалить» не попадаются мышью. Для средней карточки меню нормальное (399×132, все пункты кликабельны).
- Воспроизведение: «Награды» → «Список» → скролл вниз → «⋮» на последней строке.
- Ожидание: меню полностью видно и кликабельно для любой строки (портал/пересчёт позиции без CSS-конфликта).
- Evidence: `notes2/15-list-menu.json`, `notes2/31-list-middle-menu.json`, `shots2/16-list-menu.png`, `shots2/31-list-middle-menu.png`.
- Рекомендация: убрать `top` при `is-above` в list-режиме: `.reward-grid.is-list .reward-menu.is-above{top:auto;bottom:calc(100% + 6px)}` или вынести меню в портал.

**N-02 · P2 · «Играть сразу после активации» в настройках музыки не сохраняется.**
- Факт: `MusicSettingsModal` при сохранении отправляет `{maxQueue,maxDurationSec,overlaySeconds,prefetch,pauseYandex,restoreQueue}` — поля `enabled`/autoplay нет; в `MusicSettingsPatch` (Rust) такого поля тоже нет. Тумблер меняется визуально, но на бэкенд не уходит.
- Evidence: `MusicPage.jsx:39-54`, `core.rs` (`struct MusicSettingsPatch`); UI `shots2/44-music-settings.png`.
- Рекомендация: добавить `enabled` в patch/бэкенд или убрать тумблер.

**N-03 · P2 · Fluid-вёрстка на 2560 не перестраивает композицию.**
- Факт: при 2560×1392 оболочка заполнена, но «Награды» остаются 4 колонками по **558 px**, карточки растянуты, контент занимает верхнюю треть; в «Оверлее» поля/слайдеры растянуты на ~1600 px, тумблеры на всю ширину; в «Настройках» строки здоровья разнесены на 1250+ px.
- Ожидание: адаптивные колонки (5–6 карточек на 2560), `max-width`/контейнеры для форм, сетка настроек 3→4 или max-width контента.
- Evidence: `shots2/81-window-maximized-rewards.png`, `shots2/82-window-maximized-overlay.png`, `notes2/80-window.json`.

**N-04 · P2 · Модалки: возврат фокуса не работает (детализация A11Y-02).**
- Факт: после Esc из edit/create/delete/confirm `document.activeElement === BODY`. `Modal` использует `useEffect(..., [open,onClose])`, где `onClose` — новая функция на каждый рендер; из-за поллинга (~900 мс) cleanup/повторный effect перезаписывают `previousFocus` элементом внутри модалки; при закрытии фокус пытаются вернуть на удалённый DOM-узел.
- Evidence: `notes2/33-modal-esc-return.json`, `notes2/35-keyboard-menu-modals.json`; код `Modal.jsx:10-45`.
- Рекомендация: `onCloseRef`/стабильные deps, захват `previousFocus` только при `open:false→true`, тест «фокус вернулся на триггер».

**N-05 · P2 · Меню карточки не закрывается кликом вне (осталось с прошлого аудита).**
- Факт: после открытия меню реальный клик вне (в контент) меню не закрывает (`menu:true`); закрывают только повторный клик по «⋮» и Esc. Роль `menu`/`menuitem` добавлена, но фокус в меню не переводится и Arrow-навигации нет.
- Evidence: `notes2/b2-menu-real-mouse.json`, `notes2/b3-menu-keyboard-reach.json`, `notes2/a2-menu-a11y.json`.
- Рекомендация: `mousedown`-обработчик вне меню, roving tabindex/ArrowUp-Down, фокус на первый пункт при открытии.

**N-06 · P2 · Overlay: пустой iframe без skeleton + обрезка превью на рабочих размерах.**
- Факт: при открытии вкладки/возврате на неё превью ~1–3 с показывает пустой чёрный прямоугольник (нет лоадера/подсказки); при 1600/1803 превью 814 px выходит за низ контента (bottom 1094 при 965/902), нижние кнопки/подсказка скрыты; подпись «420 × 900» при фактическом iframe 388×608.
- Evidence: `shots2/c2-min-overlay.png` (пусто), `shots2/c5-overlay-preview-4s.png` (загрузилось), `notes2/70-overlay.json`, `notes2/c3-overlay-preview.json`.
- Рекомендация: placeholder/skeleton в `overlay-preview__frame-wrap`, `aspect-ratio`/scroll внутри превью, подпись фактического размера.

**N-07 · P3 · Очередь: «Очистить» активна при 0 из 10.**
- Факт: при пустой очереди кнопка danger-ghost «Очистить» активна и открывает confirm «Очистить очередь?» (очередь 0).
- Evidence: `notes2/46-clear-confirm.json`, `shots2/46-music-clear-confirm.png`.

**N-08 · P3 · Журнал: фильтры без aria-pressed, поиск без label.**
- Факт: `filter-row button` без `aria-pressed`; поиск в журнале без `aria-label` (AX unnamed textbox = 1). При этом «Награды» уже сделаны правильно.
- Evidence: `notes2/60-log.json`, `notes2/a1-a11y-report.json`.

**N-09 · P3 · Онбординг вне навигации: нет активного пункта.**
- Факт: экран доступен только из настроек; в nav он не появляется (при подключённом Twitch `activeNav=null`), хлебной крошки/назад нет.
- Evidence: `notes2/93-onboarding.json` (`activeNav:null`), `shots2/94-onboarding-from-settings.png`.

**N-10 · P3 · Дубли статуса и версии в футере.**
- Факт: футер повторяет health-текст шапки («Все системы работают») и версию; информационный шум.
- Evidence: `notes2/01-shell.json`, `shots2/00-initial.png`.

---

## 5. Повторная проверка A11y — числа

- **AX:** rewards 0 unnamed, music 0, overlay **24**, settings **6**, log **1** → всего 31 (overlay: 5 switch, 9 range, 9 textbox, 1 combobox; settings: 5 switch + 1 range; log: поиск).
- **Focus sweep (Tab):** rewards 69 stops / 9 без ринга (только play-button); music 17/0; overlay 64/5 (switches); settings 42/10 (5 link-button + 5 switches); log 18/0. У play-button `matches(':focus-visible') === true`, но outline `auto 1px rgb(16,16,16)` — визуально невидим.
- **Esc/trap:** модалки закрываются Esc; Tab/Shift+Tab заворачиваются внутри; health-поповер закрывается Esc и реальным кликом вне.
- **Focus return:** всегда `BODY` (N-04).
- **Контраст:** осталось 18 DOM-нарушений (overlay 12, settings 3, music 2, rewards 1) + футер 3.47 + health/menu — в норме. Лучшие исправления: журнал 0, sidebar/brand/nav 5.28–9.9, health-popover 5.77–15.18.
- **Размеры целей <24:** play 19×19, accent swatch 22×22, switch 40×22, range 18 px, link-button 20 px, search input 19 px (обёртка 36).
- **Кнопки/иконки:** rewards/music icon-only теперь с `aria-label`; у play есть имя, у queue ↑/× — title+aria.

---

## 6. Автотесты

`node tests-ui/run.mjs` → **32 passed, 0 failed**, exit 0 (`notes2/run-tests.log`). Покрытие соответствует заявленному, но **не проверяет**: меню нижней карточки в списке, возврат фокуса после модалок, доступные имена overlay/settings контролов, контраст, композицию при 1600×1000/maximized, drag/double-click, hex/TagInput, unsaved-changes оверлея. README тестов всё ещё сообщает «22 проверки» — расхождение с фактическими 32.

---

## 7. Top-5 оставшихся проблем (что критично доделать)

1. **P1 · Регрессия списка:** меню нижних карточек схлопывается до 12 px, пункты («Удалить награду») недоступны — блокирует управление наградами в режиме «Список». N-01.
2. **P2 · Модалки: возврат фокуса не работает** — после любого закрытия фокус уходит на `BODY`; причина в нестабильном effect `Modal` и поллинге. Также не хватает focus-ring у play/switch/link-button. N-04, A11Y-01/02.
3. **P2 · 31 контрол без accessible name** (overlay: switch/range/color/number/select; settings: switch/range; log поиск) — пользователь клавиатуры/скринридера не понимает, что настраивает; log-фильтры без `aria-pressed`. A11Y-03, N-08.
4. **P2 · Overlay-форма:** посимвольный ввод hex и тегов не работает, несохранённые изменения теряются, превью обрезано на 1600/1803 и пустое при загрузке; нативные prompt/confirm. OVL-01/02/03/04/05/06.
5. **P2 · Форма создания награды игнорирует «Описание» и «Ссылка YouTube»**, а музыкальный тумблер autoplay не сохраняется — пользователь заполняет поля, которые никуда не уходят. REW-10, N-02.

Дополнительно (P2/P3): fluid-композиция на 2560 (N-03), футер 3.47 контраст, журнал без sticky/DEBUG-фильтра/счётчика, «Очистить» пустой очереди, дубли health в шапке/футере, `Открыть YouTube` не проверен кликом, отсутствие live-объявлений у dirty-статусов.

---

## 8. Индекс скриншотов (`shots2/`, 64 PNG)

| Файл | Что показывает |
|---|---|
| `00-initial.png`, `10-tab-rewards.png` | fluid-оболочка 1803×1063, награды без букв, полоска сверху |
| `10-tab-music.png` | музыка в состоянии с треком (до конца воспроизведения) |
| `10-tab-overlay.png`, `10-tab-settings.png`, `10-tab-log.png` | остальные вкладки после фиксов |
| `11-rewards-grid.png` | чистая сетка наград 20 шт. |
| `12-rewards-search.png` | поиск «ставка» → 3 награды |
| `13-rewards-empty-search.png` | «Ничего не найдено» |
| `14-rewards-list.png`, `15-rewards-list-bottom.png` | режим «Список», строки 1496×60 |
| `16-list-menu.png` | **регрессия:** меню нижней строки списка (12 px, обрезано) |
| `17-grid-menu.png`, `18-grid-menu-crop.png` | меню плитки полностью видно |
| `18-delete-modal.png` | confirm удаления открывается из меню |
| `19-edit-modal.png` | редактирование с реальными значениями |
| `21-stop-all-toast.png`, `22-play-toast.png` | тосты внутри окна, `role=status` |
| `25-focus-filter.png`, `26-focus-carddots.png`, `27-focus-play.png` | focus-visible: фильтр/⋮ есть, play — нет |
| `30-grid-bottom-menu.png` | меню нижней карточки плитки (is-above) |
| `31-list-middle-menu.png` | меню средней строки списка — корректно |
| `40-music.png` | пустое состояние музыки после окончания трека |
| `43-music-invalid-link.png` | ошибка валидации ссылки |
| `44-music-settings.png`, `45-music-obs.png` | настройки музыки/OBS после ожидания >1.8 с |
| `46-music-clear-confirm.png` | confirm очистки очереди |
| `50-settings.png`, `51-settings-diag-toast.png` | настройки, тост диагностики |
| `52-settings-onboarding.png`, `53-settings-disconnect-confirm.png` | переход в онбординг, confirm отключения Twitch |
| `54-settings-accent-changed.png` | акцент применён (nav/toggles синие), позже возвращён |
| `60-log.png`, `61-log-copy-toast.png`, `62-log-clear-confirm.png` | журнал, копирование, confirm очистки |
| `64-log-scrolled.png` | журнал при скролле (тулбар уехал) |
| `70-overlay.png`, `72-overlay-inputs.png`, `74-overlay-url-bar.png` | оверлей: состояние, баги ввода, URL-бар |
| `80-window-before.png`, `81-window-maximized-rewards.png` | окно до максимизации и maximized 2560×1392 |
| `82-window-maximized-overlay.png`, `83-window-maximized-settings.png` | композиция на 2560 |
| `90-health-popover.png` | health-поповер с реальными данными |
| `92-load-250ms.png`, `93-load-850ms.png` | ранняя загрузка (данные уже пришли, ошибок нет) |
| `94-onboarding-from-settings.png`, `95-onboarding-bottom.png` | онбординг из настроек, 9 привязок |
| `a0-focus-*.png` | фокус-прогон по 5 экранам |
| `b0-list-silent-card.png`, `b1-list-view.png` | список: карточка без звука, вёрстка |
| `b5-menu-real-open.png` | меню открыто реальным кликом |
| `c0-min-rewards.png`, `c1-min-rewards-list.png` | 1600×1000: награды и список |
| `c2-min-overlay.png` | 1600×1000: превью обрезано/пустое при загрузке |
| `c3-min-settings.png` | 1600×1000: настройки |
| `c4-overlay-preview-1s.png`, `c5-overlay-preview-4s.png`, `c6-overlay-preview-return.png` | загрузка превью: пусто → демо-сообщения |

Сырые JSON/логи: `notes2/` — 71 JSON (включая `01-shell`, `03-dead-controls`, `10-cards`, `14-list-view`, `15-list-menu`, `19-edit-modal`, `32-modal-trap`, `33-modal-esc-return`, `44-music-settings`, `45-obs`, `54-accent`, `60-log`, `70-overlay`, `73-overlay-unsaved`, `a1-a11y-report`, `b2-menu-real-mouse`, `b4-contrast-outside`, `c3-overlay-preview`) и 13 логов прогонов (`run-baseline.log`, `run-rewards.log`, `run-pages.log`, `run-a11y.log`, `run-window.log`, `run-tests.log` и др.).

---

## 9. Приложение: ключевые измерения

- **Окно/оболочка:** 1803×1063 → shell 1803×1063 (margins 0); min 1600×1000 → shell 1600×1000; maximized 2560×1392 → shell 2560×1392; карточки: 365×136 (1803), 324×? (1600), 558×? (2560); grid gap 12.
- **Меню:** плитка 353×132 (все пункты видимы), низ плитки `is-above` (y=824, bottom 956), список середина 399×132 — ок, список низ — **399×12** (bug N-01).
- **Модалки:** create 600×~620, edit 560×355, delete 460×254; Esc/trap ok; focus return BODY.
- **Health:** @goshanmur, Analogue 1/2, overlay URL реальный, 5/5; Esc/outside close; aria-expanded меняется.
- **Музыка:** настройки после 1.8 с — switch false (сохраняется), OBS font 25 (сохраняется); пустое состояние 0/10 после окончания трека; invalid URL → error toast.
- **Акцент:** `#8B00FF → #4E7CFF → #8B00FF`; CSS var менялся, `get_state.accent` восстановлен; свотч/toggle/nav перекрашивались.
- **A11y:** unnamed 31 (0/0/24/6/1); noRing 24 (9/0/5/10/0); contrast violations 18 + footer 3.47; AX rewards 69 interactive.
- **Тесты:** 32/32 passed; консоль чистая.
