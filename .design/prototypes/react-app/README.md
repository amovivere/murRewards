# React prototype — Reward Sounds

Интерактивный React-прототип нового UI. Это дизайн-источник и каркас для переноса в Tauri, а не финальная сборка.

## Как открыть

```powershell
cd "F:\WorkSpaces\Mur rewards\.design\prototypes\react-app"
pnpm dev
```

Проще: собранная версия лежит в `dist/` и раздаётся локально:

```
http://127.0.0.1:8782/
```

Скриншоты: [shots/](shots/).

## Что уже есть

- **Фиксированный desktop-лэйаут 1600×1000**, без адаптива и брейкпоинтов под маленькие экраны (по требованию: 2K/100%).
- Каркас: sidebar 240, topbar 64, scroll-контент, footer 34.
- Экраны: **Награды, Музыка, Оверлей, Настройки, Журнал, Онбординг** и служебная **Дизайн-система**.
- Модалки: **создание/редактирование/удаление награды**, **настройки музыки**, **OBS-оверлей**, меню карточки.
- **Поповер здоровья** в шапке: 5 подсистем и переходы в нужный экран.
- Компоненты в `src/components/ui/`: `Button`, `Field`, `ToggleRow`, `SliderRow`, `ColorField`, `TagInput`, `Panel`, `Pill`, `Icon`.
- Токены в `src/styles/tokens.css`: цвета, радиусы, тени, типографика.
- Фичи в `src/features/*` — экран + его данные/логика.
- **Оверлей**: полноценная React-страница настроек, живой iframe с настоящим оверлеем, пресеты, канал, вид, цвета, поведение, хайлайты, сохранение в `localStorage`; в приложении это заменит временную встроенную config-страницу.
- **Кнопки**: на странице «Дизайн-система» — матрица вариантов/размеров/состояний, чтобы каждая кнопка была видна и кликабельна.

## Режим предпросмотра в Tauri

Собранный прототип лежит в `reward-sounds-tauri/src-tauri/ui/next/` и открывается
из рабочего приложения: **Настройки → Приложение → «Открыть React-прототип»**.
Окно увеличивается до 1600×1000; кнопка **«← Вернуться к приложению»** возвращает
vanilla-UI и прежний размер окна. В режиме Tauri уже работают на реальных данных:
**награды** (список, создание/редактирование/удаление, выбор и прослушивание
звука), **музыка** (трек, очередь, пауза/пропуск, добавление ссылки, настройки),
**настройки** (health, Twitch, звук, аудио, акцент, поведение окна),
**настройки чат-оверлея** (чтение/запись в AppData + живой iframe реального
`/chat-overlay`), **журнал** (реальные записи, уровни, поиск, очистка) и
**онбординг** (реальные шаги и локальные привязки).

Пересобрать и встроить после правок:

```powershell
cd ".design\prototypes\react-app"
pnpm build
# скопировать dist/* в reward-sounds-tauri/src-tauri/ui/next/
```

## Чего нет

- Реального бэкенда: данные моковые; сохранение настроек оверлея — `localStorage`.
- Остальных модалок (редактирование награды уже есть; подтверждения очистки
  очереди/журнала, отключение Twitch) и OBS-оверлеев музыки — следующие итерации.
- Брейкпоинтов и мобильной версии — намеренно.

## Проверка

`tests/smoke.mjs` проверяет переключение всех вкладок, наличие живого превью, изменение слайдера и отсутствие ошибок в консоли. `tests/shots.mjs` делает PNG всех экранов.

```powershell
# из папки проекта, при запущенном сервере на 8782
node tests/smoke.mjs
node tests/shots.mjs
```

## Снимки

- [rewards-1600.png](shots/rewards-1600.png)
- [music-1600.png](shots/music-1600.png)
- [overlay-1600.png](shots/overlay-1600.png)
- [settings-1600.png](shots/settings-1600.png)
- [log-1600.png](shots/log-1600.png)
- [onboarding-1600.png](shots/onboarding-1600.png)
- [design-1600.png](shots/design-1600.png)
- [rewards-create-modal.png](shots/rewards-create-modal.png)
- [health-popover.png](shots/health-popover.png)
- [music-settings-modal.png](shots/music-settings-modal.png)
- [obs-modal.png](shots/obs-modal.png)
- [react-inside-tauri.png](../../overlay-port/react-inside-tauri-2.png) — прототип внутри Tauri
- [react-rewards-real.png](../../overlay-port/react-rewards-real.png) — реальные награды в Tauri
- [react-overlay-real.png](../../overlay-port/react-overlay-real.png) — реальные настройки оверлея
- [react-music-real.png](../../overlay-port/react-music-real.png) — реальные данные музыки
- [react-settings-real.png](../../overlay-port/react-settings-real.png) — реальные настройки
- [react-log-real.png](../../overlay-port/react-log-real.png) — реальный журнал
- [react-onboarding-real.png](../../overlay-port/react-onboarding-real.png) — реальный онбординг
