# Mur rewards — Reward Sounds

Проект перенесён сюда из `C:\Users\mur\Documents\deepseek-harness\default-workspace`.

## Структура

- `reward-sounds/` — рабочий Rust/Rust egui-бэкенд и старая версия интерфейса.
- `reward-sounds-tauri/` — новый интерфейс на Tauri 2 + HTML/CSS, использующий
  тот же Rust-бэкенд через путь `../reward-sounds`.
- `reward-sounds-tauri/dist/Reward Sounds Tauri.exe` — собранный прототип;
  рядом должен лежать `yt-dlp.exe` (уже лежит).
- `.design/` — макеты и скрипты сравнения из этапа проектирования.

## Запуск

```powershell
cd "F:\WorkSpaces\Mur rewards\reward-sounds-tauri\src-tauri"
cargo build --release
# обычный запуск, не от администратора:
.\target\release\reward-sounds-tauri.exe
```

Или готовый файл:
`F:\WorkSpaces\Mur rewards\reward-sounds-tauri\dist\Reward Sounds Tauri.exe`

Настройки и токены Twitch хранятся в `%APPDATA%\RewardSounds`, поэтому после
переноса папки вход и привязки звуков сохраняются.