# Chat overlay port

Оверлей чата перенесён из `C:\Users\mur\Documents\deepseek-harness\default-workspace\twitch-chat-overlay` в Reward Sounds. Настройки теперь открываются отдельной вкладкой **«Оверлей»** в приложении.

## Что работает

- OBS URL: `http://127.0.0.1:8770/chat-overlay`
- Настройки: `http://127.0.0.1:8770/chat-overlay/config`
- Настройки по умолчанию: [chat-overlay-settings.js](../reward-sounds/assets/chat-overlay-settings.js)
- Сохранённые настройки: `%APPDATA%\RewardSounds\chat_overlay_settings.js`
- Оверлей перечитывает настройки каждые ~2 с — OBS подхватывает изменения без перезагрузки источника.
- Канал Twitch, пресеты, темы Neon/Minimal, шрифты, цвета, прозрачности, TTL, анимации, хайлайты, эмодзи Twitch/BTTV/7TV и бейджи работают как в reference-проекте.

## Что изменено относительно reference

- `overlay.html` скопирован в `reward-sounds/assets/chat-overlay.html`; путь к настройкам заменён на `/chat-overlay/settings.js`.
- `config.html` скопирован в `reward-sounds/assets/chat-overlay-config.html`:
  - превью открывает `/chat-overlay?preview=1&demo=1&bg=1`;
  - сохранение идёт POST-запросом `/chat-overlay/save` в AppData, а не через File System Access API;
  - убрана кнопка скачивания `settings.js` и подсказки про локальный файл.
- `overlay.rs`:
  - новые маршруты `/chat-overlay`, `/chat-overlay/settings.js`, `/chat-overlay/config`, POST `/chat-overlay/save`;
  - чтение/запись настроек в AppData;
  - POST-запрос разбирается с `Content-Length`, тело до 512 КБ.
- В UI приложения вкладка «Чат» заменена вкладкой **«Оверлей»**; настройки открываются в iframe внутри приложения. Это промежуточный шаг: следующая версия — React-страница настроек с живым превью.

## Проверено

- `GET /chat-overlay` — 200, 37 253 байта;
- `GET /chat-overlay/config` — 200, 34 464 байта;
- `GET /chat-overlay/settings.js` — 200, `application/javascript`;
- `POST /chat-overlay/save` — 200 `{"ok":true}`, настройки записаны и прочитаны обратно;
- демо-скриншот оверлея: [overlay-demo.png](overlay-demo.png);
- страница настроек: [config-demo2.png](config-demo2.png);
- вкладка «Оверлей» в приложении: [app-overlay-tab2.png](app-overlay-tab2.png);
- UI-тесты: 65 passed.

## Следующие шаги

1. Переписать страницу настроек на React с живым превью (сейчас временно iframe reference-страницы).
2. Удалить старый in-app чат: `chat.js`, `chat.rs`, `chat.json`, старые `/chat*` маршруты и health-строки чата; сохранить только фоновый `!трек` для музыки.
3. Собрать React-прототип приложения в структуре `components/ui` + `features/*`, без адаптива под 980.
4. Проверить сохранение настроек после перезапуска, OBS-источник и демо/реальный канал.
