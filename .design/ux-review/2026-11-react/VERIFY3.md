# Верификация №3 — остаточные P1/P2 после REAUDIT

- **Дата:** 2026-11-18, 23:19–23:35 (Asia/Vladivostok)
- **Сборка:** `reward-sounds-tauri/dist/Reward Sounds Tauri.exe` (23:17:35), коммит `00a9064` «fix: закрыть остаточные P1/P2 повторного UX-аудита», версия 1.7.0
- **Автотесты:** `RS_TEST_EXE=<dist exe> node tests-ui/run.mjs` → **34 passed, 0 failed** (`notes3/run-tests.log`).
- **Данные/настройки не менялись:** accent `#8B00FF`, volume 0.287, награды не создавались/не удалялись; правки оверлея в памяти отброшены reload'ом (backend settings сравнены до/после — идентичны); геометрия окна после drag восстановлена в `{x:473,y:136,width:1803,height:1063}`; приложение закрыто.
- **Артефакты:** `shots3/` — **29 PNG**, `notes3/` — **26 JSON + 10 логов**.
- **Границы:** только проверка заявленных 8 пунктов; полный регресс-аудит не повторялся. Не выполнялись создание/удаление наград, сохранение настроек, очистка журнала/очереди.

---

## 1. Итог по пунктам

| # | Пункт | Статус | Кратко |
|---|---|---|---|
| 1 | Меню карточки в «Списке» (нижняя/средняя), edit/delete | **fixed** | Меню 399×132, все 4 пункта в viewport и кликабельны; edit/delete открываются |
| 2 | Возврат фокуса после закрытия модалок | **partial** | Confirm (журнал) возвращает фокус на «Очистить»; create/edit/delete → `BODY` |
| 3 | Overlay: HEX, TagInput, preset-модалки, dirty-confirm, превью (лоадер/размер/без обрезки) | **partial** | 5 из 6 подпунктов fixed; превью по-прежнему обрезано на 1600×1000 и 1827×1107 |
| 4 | Accessible names switch/range/textbox/combobox на Overlay/Settings/Log | **fixed** | Overlay 36/36, Settings 7/7, Log 2/2 — без имён 0 |
| 5 | Double-click по шапке + одиночный drag | **fixed** | Реальный double-click max/restore (2560↔1827, title меняется), drag сдвигает окно |
| 6 | Fluid 1600×1000 / 1827×1107 / 2560×1392, тост внутри | **fixed** | Оболочка заполняет все размеры, полей/overflow нет; на 2560 page max-width 1760 по центру; тост внутри |
| 7 | Формы: create без неподдерживаемых полей; autoplay в patch | **fixed** | В Create modal только Название/Цена/Цвет/Текст; backend принимает `enabled` и применяет |
| 8 | P0/P1 из REAUDIT не воспроизводятся; 34/34 тестов | **fixed** (с оговоркой) | P1 (меню списка) и P0 не воспроизводятся; 34/34 pass; но тест возврата фокуса — ложноположительный |

**Новых P0/P1 не найдено.** Остались два P2: возврат фокуса для части модалок и обрезка превью оверлея на рабочих размерах окна.

---

## 2. Детали и evidence

### 1) Меню карточки в «Списке» — **fixed**

- Нижняя карточка (`Переименовать ченить`, y=941, h=60): меню `above=true`, rect **399×132**, все 4 пункта `inViewport=true`, `clickable=true` (`elementFromPoint` = `BUTTON`/`BUTTON.is-danger`). Клик по «Удалить награду» открыл confirm «Удалить «Переименовать ченить»?».
- Средняя карточка (`А где донаты`, y=190): меню 399×132, все пункты кликабельны; «Редактировать» открыл форму с реальными значениями `["А где донаты","100","#00f593"]`.
- Причина старой регрессии устранена (CSS-конфликт `top`/`bottom` для `.is-above` в list-режиме).
- Evidence: `notes3/01-list-bottom-menu.json`, `notes3/02-list-bottom-delete.json`, `notes3/04-list-middle-menu.json`, `notes3/05-list-middle-edit.json`; скриншоты `shots3/01-list-bottom-menu.png`, `shots3/02-list-bottom-delete.png`.

### 2) Возврат фокуса после модалок — **partial**

Проверка реальными кликами + Esc, а также после ожидания >1.6 с (поллинг):

| Модалка / триггер | После Esc |
|---|---|
| Confirm «Очистить журнал?» (кнопка «Очистить») | **fixed**: фокус на `BUTTON.ui-button--danger-ghost` с текстом «Очистить» |
| Create «Новая награда» (кнопка «Создать награду») | **not fixed**: `document.activeElement === BODY` (и сразу, и после 1.8 с) |
| Edit из меню карточки | **not fixed**: `BODY` |
| Delete из меню карточки | **not fixed**: `BODY` |

Причина: `Modal` фиксирует `previousFocus` в `useEffect` уже **после** монтирования/`autoFocus` — для create это `INPUT` внутри модалки (инструментация `focus()` зафиксировала autoFocus-вызов на INPUT; при закрытии cleanup не сделал ни одного `focus()`-вызова, т.к. target уже отключён), для edit/delete триггер (пункт меню) к этому моменту удалён из DOM, `previousFocus = BODY`. Confirm-модалка без autoFocus и с живым триггером — единственная, где возврат работает. Фикс стабильности effect (убрали зависимость от `onClose`) устранил перезапись `previousFocus` поллингом, но не порядок захвата.

**Важно:** автотест «фокус возвращается на кнопку после Esc» — ложноположительный: assertion `document.activeElement?.textContent?.includes('Создать награду')` проходит и на `BODY`, потому что `body.textContent` содержит эту строку (`tests-ui/run.mjs:272`). Фактически активен `BODY` (проверено `tag/insideModal`).
- Evidence: `notes3/07-focus-return.json`, `notes3/29-focus-discrepancy.json`, `notes3/30-focus-instrument.json`; скриншоты `shots3/07-create-focus-return.png`, `shots3/08-confirm-focus-return.png`.

### 3) Overlay — **partial** (5 fixed, 1 not fixed)

| Подпункт | Статус | Факт |
|---|---|---|
| HEX посимвольно | **fixed** | Значение меняется на каждом символе: `#` → `#1` → `#12` → `#12a` → `#12ab` → `#12abc` → `#12ABC0`; swatch обновился (`rgb(18,171,192)`), `aria-label="Текст: HEX"` |
| TagInput: запятые/несколько логинов | **fixed** | Пошагово `a` → `a,` → `a,b` → `a,b,` → `a,b,c`; после blur — `a, b, c`; status «Есть несохранённые изменения» |
| Rename/Delete пресетов через модалки | **fixed** | Rename: modal `role=dialog`, title «Переименовать пресет», поле autofocus, Отмена/Сохранить; после сохранения активный пресет «Аудит3-пресет». Delete: modal «Удалить пресет?»; после подтверждения пресетов 1, активный «Минимал». Нативных prompt/confirm нет. После reload — исходные пресеты, backend settings не изменён |
| Dirty-leave confirm | **fixed** | После правки канала уход на «Награды» → модалка «Выйти без сохранения?» с «Отмена»/«Выйти без сохранения»; «Отмена» остаётся на оверлее с правкой, подтверждение уводит на «Награды»; backend settings до/после идентичны |
| Превью: индикатор загрузки + реальный размер | **fixed** | Сразу после монтирования виден `.overlay-preview__loading` «Загружаем превью…»; после onLoad он исчезает, подпись `388 × 834` совпадает с `iframe.clientWidth/clientHeight` |
| Превью не обрезано | **not fixed** | 1600×1000: preview top 280, **bottom 1320** при content bottom **966** → обрезано; 1827×1107: bottom 1320 при content bottom **1073** → обрезано; на 2560×1392: bottom 1320 при content bottom **1358** → помещается. При скролле вниз preview top уходит в `-38`, т.е. верхняя часть тоже клипается. Кнопка «Открыть превью в браузере» при скролле доступна, но панель целиком не помещается на рабочих размерах |

- Evidence: `notes3/20-overlay-preview.json`, `notes3/22-overlay-hex.json`, `notes3/23-overlay-tags.json`, `notes3/24-overlay-preset-modals.json`, `notes3/27-overlay-preset-exec.json`, `notes3/25-overlay-dirty-leave.json`, `notes3/26-overlay-backend.json`; скриншоты `shots3/20-overlay-loading.png`, `21-overlay-loaded.png`, `22-overlay-hex.png`, `23-overlay-tags.png`, `24-overlay-rename-modal.png`, `25-overlay-delete-modal.png`, `26-overlay-leave-confirm.png`, `28-overlay-scrolled-bottom.png`, `32-1600x1000-overlay.png`, `32-1827x1107-overlay.png`, `41-max-overlay.png`.

### 4) Accessible names — **fixed**

AX-дерево (`Accessibility.getFullAXTree`, роли `switch/slider/textbox/combobox`, не ignored):

| Экран | Всего | С именем | Без имени |
|---|---|---|---|
| Overlay | 36 | **36** | **0** |
| Settings | 7 | **7** | **0** |
| Journal | 2 | **2** | **0** |

Примеры: «Пресет оверлея» (combobox), «Текст: HEX», «Фон плашки: прозрачность», «Без звука», «Громкость», «Игнор-боты» (textbox), «Поиск по журналу». Ранее было 24/6/1 безымянных.
- Evidence: `notes3/08-ax-names.json`.

### 5) Double-click и drag — **fixed**

- Реальный системный double-click по шапке: окно развернулось — `innerWidth/innerHeight 2560×1392`, кнопка title/aria «Восстановить», `IsZoomed=true`.
- Повторный double-click: окно восстановилось — **1827×1107**, title «Развернуть», `IsZoomed=false`.
- Одиночный drag шапки реальной мышью: окно переместилось с `(200,100)` на `(270,135)` (размер сохранён), `window.json` обновился.
- Evidence: `notes3/32-window-actions.json`; скриншоты `shots3/40-max-rewards.png`, `43-restored.png`; геометрия восстановлена.

### 6) Fluid и тост — **fixed**

| Размер | Shell | Margins | Сетка | Тост |
|---|---|---|---|---|
| 1600×1000 | 1600×1000 | 0/0/0/0 | 4×314.25 px | «Все звуки остановлены», rect y=910, h=38 — **внутри** |
| 1827×1107 | 1827×1107 | 0/0/0/0 | 4×374.75 px | y=1017, h=38 — **внутри** |
| 2560×1392 (max) | 2560×1392 | 0/0/0/0 | 5×342.4 px; `.page` max-width 1760 px по центру | fixed bottom (проверено ранее в этом же билде; внутри) |

Чёрных letterbox-полей нет (`shell == viewport`, `docScrollWidth == innerWidth`, `body{overflow:hidden}`). На maximized появились симметричные поля 280 px внутри контентной области из-за `max-width:1760px` — это осознанное ограничение композиции, а не чёрные поля оболочки. Тост проверялся на 1600×1000 и 1827×1107; на max отдельно не снимался (позиция `fixed; bottom:52px` внутри viewport). Обрезка превью оверлея на 1600/1827 относится к п.3.
- Evidence: `notes3/30-fluid-1600x1000.json`, `notes3/30-fluid-1827x1107.json`, `notes3/44-max-layout.json`; скриншоты `shots3/30-1600x1000-rewards.png`, `30-1827x1107-rewards.png`, `31-*-toast.png`, `40-max-rewards.png`, `44-max-layout-rewards.png`, `45-max-layout-overlay.png`.

### 7) Формы — **fixed**

- «Создать награду»: поля — только «НАЗВАНИЕ», «ЦЕНА, БАЛЛОВ», «ЦВЕТ КАРТОЧКИ», «ЧТО НУЖНО ОТ ЗРИТЕЛЯ» + «Текст сообщения (до 280 символов)»; `textarea = 0`, чекбоксов = 1, «Ссылка YouTube» отсутствует, неподдерживаемые поля убраны.
- Музыка/autoplay: UI отправляет `enabled: autoplay`; в `MusicSettingsPatch` появилось `enabled: Option<bool>`, `apply_music_patch` применяет `music.enabled`. Вызов `set_music_settings {patch:{enabled:<текущее>}}` вернул полный `CoreView`, `music.enabled` до/после = `true`, состояние не изменилось (idempotent, настройки не тронуты).
- Evidence: `notes3/09-create-form.json`, `notes3/10-music-autoplay.json`; скриншот `shots3/09-create-form.png`; код `MusicPage.jsx:46-49`, `core.rs` (`MusicSettingsPatch.enabled`, `apply_music_patch`).

### 8) P0/P1 из REAUDIT и автотесты

- P0 (редактирование/удаление, меню карточки) не воспроизводятся: edit заполняется реальными значениями, delete открывает confirm, меню в плитке/списке полностью видимо (п.1).
- Единственный P1 из REAUDIT (N-01, меню списка) — **fixed**.
- `RS_TEST_EXE=<dist exe> node tests-ui/run.mjs` → **34 passed, 0 failed** (`notes3/run-tests.log`).
- **Оговорка:** тест возврата фокуса ложноположительный (см. п.2): проверяет `activeElement.textContent`, а `BODY.textContent` содержит «Создать награду». Фактический фокус после create/edit/delete = `BODY`.

---

## 3. Новые P0/P1

**Нет.** Новых блокирующих проблем в проверенных сценариях не найдено; критичных регрессий относительно REAUDIT нет.

## 4. Что осталось из P2, критичное для production

1. **Возврат фокуса после create/edit/delete-модалок (a11y, P2).** Работает только для confirm-модалки (журнал). В create `previousFocus` = autoFocus-инпут внутри модалки; в edit/delete — удалённый пункт меню → фокус уходит на `BODY`. Для клавиатурных пользователей после закрытия теряется место. Нужно фиксировать `previousFocus` до открытия (по клику на триггер/layout-effect) или явно передавать `returnFocusRef`. Тест следует проверять по `activeElement === trigger`, а не по `textContent`.
2. **Обрезка превью оверлея на рабочих размерах (P2).** Превью 1040 px (iframe 834) не помещается в content 965/1009 на 1600×1000 и 1827×1107: при scrollTop=0 обрезан низ, при прокрутке вниз обрезан верх (`top=-38`); целиком помещается только на 2560×1392. Нужен `max-height`/`aspect-ratio` с внутренним скроллом или scale-to-fit, иначе на типовом окне индикатор размера/нижние кнопки недоступны.
3. **Ложноположительный тест фокуса (P3, качество тестов).** `tests-ui/run.mjs:272` проверяет `textContent` вместо `document.activeElement === trigger`; из-за этого 34/34 pass скрывает реальный дефект п.1.

Проверенные в этом проходе прочие P2 из REAUDIT закрыты: hex/TagInput, пресетные модалки, dirty-confirm, AX-имена, focus-ring для switch/play/link (по коммиту и AX/фокус-прогону), журнал — DEBUG-фильтр/счётчик «182 из 182»/sticky-тулбар (см. `notes3/31-log-verify.json`).

---

## 5. Индекс артефактов

**Скриншоты (`shots3/`, 29):**
`01-list-bottom-menu.png` (меню нижней строки списка), `02-list-bottom-delete.png` (confirm удаления из него), `07-create-focus-return.png`, `08-confirm-focus-return.png`, `09-create-form.png`, `20-overlay-loading.png` («Загружаем превью…»), `21-overlay-loaded.png`, `22-overlay-hex.png`, `23-overlay-tags.png`, `24-overlay-rename-modal.png`, `25-overlay-delete-modal.png`, `26-overlay-leave-confirm.png`, `27-overlay-preset-executed.png`, `28-overlay-scrolled-bottom.png`, `30-1600x1000-rewards.png`, `30-1827x1107-rewards.png`, `31-1600x1000-toast.png`, `31-1827x1107-toast.png`, `32-1600x1000-overlay.png` (обрезано), `32-1827x1107-overlay.png` (обрезано), `33-1600x1000-settings.png`, `33-1827x1107-settings.png`, `40-max-rewards.png`, `41-max-overlay.png` (помещается), `42-max-settings.png`, `43-restored.png`, `44-max-layout-rewards.png`, `45-max-layout-overlay.png`, `50-log-verify.png`.

**JSON/логи (`notes3/`, 26 JSON + 10 логов):** `01-list-bottom-menu`, `02-list-bottom-delete`, `04-list-middle-menu`, `05-list-middle-edit`, `06-edit-esc-focus`, `07-focus-return`, `08-ax-names`, `09-create-form`, `10-music-autoplay`, `20-overlay-preview`, `22-overlay-hex`, `23-overlay-tags`, `24-overlay-preset-modals`, `25-overlay-dirty-leave`, `26-overlay-backend`, `27-overlay-preset-exec`, `28-search-smoke`, `29-focus-discrepancy`, `30-focus-instrument`, `30-fluid-1600x1000`, `30-fluid-1827x1107`, `31-log-verify`, `32-window-actions`, `40-max`, `44-max-layout`; логи прогонов: `run-claims.log`, `run-overlay.log`, `run-fluid.log`, `run-max.log`, `run-maxlayout.log`, `run-focus2.log`, `run-focus3.log`, `run-extra2.log`, `run-log.log`, `run-tests.log`.
