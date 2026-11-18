# FigCraft design workspace

This bundle connects the locally installed **FigCraft** (version 0.18.1,
`F:\ARTCRAFT\FigCraft`) to the agent through the `figcraft-cli mcp` server.
No FigCraft window is opened: the CLI runs its headless in-process engine.

## Access boundaries

- Read: the whole project `F:\WorkSpaces\Mur rewards`.
- Write: `F:\WorkSpaces\Mur rewards\.design\figcraft` only.

The agent can open existing project files and design assets for reference, but it
can save new designs only under `.design/figcraft`.

## What the tools can do

The server exposes 19 MCP tools, including:

- `inspect_document`, `get_node`, `select`, `inspect_ui` — inspect the active document and UI.
- `create_node`, `set_properties` — create and edit layers and their properties.
- `run_command`, `batch`, `list_commands` — run any FigCraft menu command (auto layout, constraints, styles, boolean operations, etc.).
- `pointer`, `key`, `type_text` — drive the canvas like a user.
- `export` — PNG, JPG, SVG, WebP, PDF, Android XML.
- `screenshot` — render the current page or selected layers as an image.
- `open_file`, `save_file`, `undo`, `redo`.

## Usage

1. Ask the agent to open or create a `.figcraft` document under `.design/figcraft`.
2. Build screens with commands and layers.
3. Save the `.figcraft` file and export PNG/SVG previews next to it.
4. The agent can call `screenshot` to look at the result before showing it to you.

## Limitations

- The headless session has no visible FigCraft window. To watch changes live,
  start FigCraft with `figcraft --control 7979` and connect the CLI with
  `--attach 7979` (the bundle then has to be reconfigured).
- The write root is intentionally limited to `.design/figcraft`; saving elsewhere
  is rejected by the CLI.
- MCP tools are not available in sessions started before the bundle was installed;
  open a new session after installation.
