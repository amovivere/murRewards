import pathlib
p=pathlib.Path(r"C:\Users\mur\Documents\deepseek-harness\default-workspace\reward-sounds-tauri\README.md")
s=p.read_text(encoding="utf-8")
s=s.replace("""- **«Музыка»** — пока демо-состояние из макета: плеер, очередь,
  play/pause, перемотка, ручная ссылка, OBS-модалка (интерактивно).""","""- **«Музыка» — реальный MusicService**:
  - очередь заявок с восстановлением после перезапуска;
  - плеер: play/pause, перемотка, «Сначала», «Пропустить трек»,
    прогресс и время в реальном времени;
  - громкость музыки сохраняется в конфиг;
  - ручная ссылка добавляет трек через yt-dlp;
  - убирание/поднятие заявок и очистка очереди;
  - строка «Сейчас играет» в OBS-оверлее (локальный сервер на 8770);
  - статус yt-dlp, платежная награда, счётчики очереди.
  Для работы рядом с EXE должен лежать `yt-dlp.exe` (в `dist/` и
  `D:\\reward-sounds\\tauri-proto\\` он уже есть).""")
s=s.replace("""1. «Музыка»: подключить `MusicService` — очередь, yt-dlp, чат `!трек`,
   OBS-оверлей, состояния загрузки/предзагрузки.
2. «Настройки»: реальные секции (Twitch, звук, автозапуск, трей) и
   авторизация Twitch из нового UI.
3. «Журнал»: реальные записи `Logger`.
4. Создание/редактирование/удаление наград, EventSub для активаций.
5. Трей, автозапуск, single-instance, close-to-tray.
6. Установщик (NSIS/MSI), замена рабочей сборки после паритета.""","""1. «Настройки»: реальные секции (Twitch, звук, автозапуск, трей) и
   авторизация Twitch из нового UI.
2. «Журнал»: реальные записи `Logger`.
3. Создание/редактирование/удаление наград, EventSub для активаций
   (сейчас активации в Tauri-версии ещё не слушаются).
4. Связать чат `!трек` и предзагрузку следующего трека с UI.
5. Трей, автозапуск, single-instance, close-to-tray.
6. Установщик (NSIS/MSI), замена рабочей сборки после паритета.""")
s=s.replace("""`screens/` — макеты и реальные снимки Tauri-окна:
`tauri-rewards.png`, `tauri-music.png`, `tauri-obs.png`,
`tauri-rewards-real.png`, `onboarding.png`, `obs.png`.""","""`screens/` — макеты и реальные снимки Tauri-окна:
`tauri-rewards-real.png`, `tauri-music-real.png`, `tauri-obs.png`,
`onboarding.png`, `obs.png`.""")
p.write_text(s,encoding="utf-8")
print("readme updated")