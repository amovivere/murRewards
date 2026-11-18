# FigCraft: рабочая среда

FigCraft подключён к агенту через MCP. Это исследовательский/дизайн-воркспейс проекта: исходники приложения не изменяются, все новые дизайны сохраняются в `.design/figcraft`.

## Статус

| Компонент | Значение |
|---|---|
| FigCraft | установлен, `F:\ARTCRAFT\FigCraft` |
| FigCraft CLI | `figcraft-cli 0.18.1` |
| MCP-сервер | `figcraft-cli mcp`, headless |
| MCP-бандл DSH | `@local/figcraft-mcp` 1.0.0, установлен и активен (`application: applied`) |
| Имя сервера | `figcraft` → инструменты `mcp__figcraft__*` |
| Чтение | весь проект `F:\WorkSpaces\Mur rewards` |
| Запись | только `F:\WorkSpaces\Mur rewards\.design\figcraft` |
| Рабочий файл | [designs/reward-sounds.figcraft](designs/reward-sounds.figcraft) |
| Тестовый рендер | [out/reward-sounds-workspace.png](out/reward-sounds-workspace.png) |

MCP-бандл: [mcp-bundle/](mcp-bundle/) — конфигурация, локали (en/ru), иконка и описание для Plugin Manager. После изменения корней или пути к CLI его нужно переустановить/обновить.

## Как пользоваться

Агенту доступны 19 MCP-инструментов FigCraft. Основные:

| Задача | Инструмент |
|---|---|
| Открыть/сохранить документ | `open_file`, `save_file` |
| Посмотреть структуру | `inspect_document`, `get_node`, `inspect_ui` |
| Создать слой | `create_node` |
| Изменить свойства | `set_properties` |
| Выполнить любую команду FigCraft | `list_commands`, `run_command`, `batch` |
| Рисовать как пользователь | `pointer`, `key`, `type_text` |
| Посмотреть результат | `screenshot`, `export` |
| Сгенерировать код | `run_command` с `inspect.code` |
| История | `undo`, `redo` |

Пример сохранения и рендера:

```
save_file(path="F:\WorkSpaces\Mur rewards\.design\figcraft\designs\screen.figcraft")
export(format="png", path="...\.design\figcraft\out\screen.png", scale=2)
screenshot(ids=[...], maxSize=1600)
```

## FigCraft → код

FigCraft умеет генерировать код из слоёв командой `inspect.code` (`.design/figcraft/tools/probe-mcp.js` проверяет только MCP; генерация проверена отдельно). Поддерживаются `css`, `html`, `react`, `leptos`, `vue`, `tailwind`, `swiftui`, `compose`, `arkui`, `flutter`.

Для миграции приложения важен режим **React + Tailwind CSS v4**: он выдаёт JSX с Tailwind-классами, включая auto layout, overrides инстансов и переменные темы. Пример, полученный из стартового файла:

```jsx
export function App1220840() {
  return (
    <div className="relative w-[1220px] h-[840px] bg-[#0A0A0B]">
      <p className="absolute left-16 top-16 text-[#F5F5F7] font-['Inter'] text-[56px] font-bold">Reward Sounds</p>
      ...
    </div>
  );
}
```

Это означает практический путь: **дизайн в FigCraft → экспорт React/Tailwind-кода и PNG/SVG-ассетов → перенос в React-приложение**. FigCraft-файл остаётся источником дизайна, а не рантаймом приложения.

## Проверено

- `figcraft-cli 0.18.1` запускается;
- MCP-сервер отвечает: `serverInfo {name: "figcraft", title: "FigCraft", version: "0.18.1"}`, 19 инструментов;
- ограничение файловых корней работает: чтение — проект, запись — `.design/figcraft`;
- созданы два артборда 1220×840 и 980×680, текст и акцентный прямоугольник;
- файл сохранён (5.5 КБ), PNG экспортирован (937 байт), `screenshot` отдаёт изображение;
- `inspect.code` для артборда вернул валидный React + Tailwind v4 JSX.

## Ограничения

- По умолчанию FigCraft работает **headless**: окна нет, агент работает через MCP.
- Чтобы смотреть изменения в живом окне: запустить `figcraft.exe --control 7979`, затем переконфигурировать MCP на `figcraft-cli mcp --attach 7979` (в текущем бандле этого нет; `--attach` несовместим с `--automation-*`).
- Запись разрешена только в `.design/figcraft`; сохранять в другие папки нельзя.
- MCP-инструменты появляются в новых сессиях после установки бандла; в текущей сессии уже доступны.
- FigCraft не является средой выполнения приложения: «перенести приложение туда» = перенести дизайн и использовать экспорт кода/ассетов, а не запускать Tauri-приложение внутри FigCraft.

## Следующий шаг миграции

1. Инвентаризовать экраны и состояния текущего приложения (награды, музыка, чат, настройки, журнал, онбординг, модалки).
2. Создать в FigCraft файл дизайн-системы: переменные (цвета, радиусы, отступы), текстовые стили, компоненты.
3. Собрать экраны как артборды 1220×840 и 980×680 (плюс состояния hover/empty/error/modal).
4. Экспортировать из ключевых фреймов React/Tailwind-код и PNG/SVG для визуальной проверки.
5. Перенести в React-приложение, сохранив текущий Rust-бэкенд и Tauri-обвязку; сверить экраны с FigCraft-рендерами.

## Служебные файлы

- [mcp-bundle/](mcp-bundle/) — конфигурационный бандл DSH (`@local/figcraft-mcp`).
- [tools/probe-mcp.js](tools/probe-mcp.js) — проверка MCP-хендшейка и списка инструментов.
- [designs/](designs/) — `.figcraft`-файлы.
- [out/](out/) — PNG/SVG-экспорты.
