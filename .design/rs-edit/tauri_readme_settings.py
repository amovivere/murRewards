import pathlib
p=pathlib.Path(r"C:\Users\mur\Documents\deepseek-harness\default-workspace\reward-sounds-tauri\README.md")
s=p.read_text(encoding="utf-8")
s=s.replace("""- **Настройки** и **Журнал** — заглушки с описанием следующего этапа.""","""- **«Настройки»** — реальные данные:
  - Twitch: Client ID, подключение/переподключение, отключение, экран
    ожидания кода активации (`twitch.tv/activate`);
  - звук: общая громкость, «Без звука», воспроизведение звуков наград;
  - приложение: автозапуск, закрытие в трей, запуск свёрнутым, версия;
  - музыка: статус готовности, выбранная награда и переход на вкладку.
- **«Журнал»** — пока заглушка (следующий этап).""")
s=s.replace("""1. «Настройки»: реальные секции (Twitch, звук, автозапуск, трей) и
   авторизация Twitch из нового UI.
2. «Журнал»: реальные записи `Logger`.
3. Создание/редактирование/удаление наград, EventSub для активаций
   (сейчас активации в Tauri-версии ещё не слушаются).
4. Связать чат `!трек` и предзагрузку следующего трека с UI.
5. Трей, автозапуск, single-instance, close-to-tray.
6. Установщик (NSIS/MSI), замена рабочей сборки после паритета.""","""1. «Журнал»: реальные записи `Logger`.
2. EventSub и активации наград в Tauri-версии.
3. Создание/редактирование/удаление наград.
4. Связать чат `!трек` и предзагрузку следующего трека с UI.
5. Трей, single-instance, фактическое close-to-tray и автозапуск окна.
6. Установщик (NSIS/MSI), замена рабочей сборки после паритета.""")
s=s.replace("""`screens/` — макеты и реальные снимки Tauri-окна:
`tauri-rewards-real.png`, `tauri-music-real.png`, `tauri-obs.png`,
`onboarding.png`, `obs.png`.""","""`screens/` — макеты и реальные снимки Tauri-окна:
`tauri-rewards-real.png`, `tauri-music-real.png`, `tauri-settings-real.png`,
`tauri-obs.png`, `onboarding.png`, `obs.png`.""")
p.write_text(s,encoding="utf-8")
print("readme settings")