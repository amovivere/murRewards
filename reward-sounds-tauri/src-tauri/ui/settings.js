// Twitch Chat Overlay — настройки.
// Этот файл редактирует config.html, руками тоже можно.
// Оверлей перечитывает его каждые ~2 секунды и применяет изменения на лету.
window.OVERLAY_SETTINGS = {
  "version": 1,
  "activePreset": "neon",
  "presets": [
    {
      "id": "neon",
      "name": "Обычный",
      "cfg": {
        "channel": "",
        "theme": "neon",
        "fontFamily": "Segoe UI Variable Text",
        "fontSize": 24,
        "lineHeight": 1.38,
        "paddingX": 28,
        "paddingY": 24,
        "gap": 10,
        "radius": 14,
        "emoteScale": 1.5,
        "align": "left",
        "direction": "up",
        "max": 40,
        "ttl": 15,
        "badges": true,
        "emotes": true,
        "sevenTv": true,
        "hideCommands": false,
        "ignoreBots": [],
        "ignoreWords": [],
        "timestamps": false,
        "maxTextLength": 600,
        "animation": "slide",
        "readability": "soft",
        "highlight": ["arstotsky"],
        "colors": {
          "text": "#ffffff",
          "nickMode": "twitch",
          "nick": "#ffc857",
          "bubble": "#141a2e",
          "bubbleOpacity": 0.82,
          "border": "#7aaaff",
          "borderOpacity": 0.24,
          "highlight": "#ffc857",
          "shadow": "#000000",
          "area": "#000000",
          "areaOpacity": 0,
          "time": "#9fb0d0"
        }
      }
    },
    {
      "id": "minimal",
      "name": "Минимал",
      "cfg": {
        "channel": "",
        "theme": "minimal",
        "fontFamily": "Segoe UI Variable Text",
        "fontSize": 26,
        "lineHeight": 1.36,
        "paddingX": 28,
        "paddingY": 24,
        "gap": 6,
        "radius": 14,
        "emoteScale": 1.5,
        "align": "left",
        "direction": "up",
        "max": 30,
        "ttl": 15,
        "badges": true,
        "emotes": true,
        "sevenTv": true,
        "hideCommands": false,
        "ignoreBots": [],
        "ignoreWords": [],
        "timestamps": false,
        "maxTextLength": 600,
        "animation": "fade",
        "readability": "hard",
        "highlight": ["arstotsky"],
        "colors": {
          "text": "#ffffff",
          "nickMode": "twitch",
          "nick": "#ffc857",
          "bubble": "#141a2e",
          "bubbleOpacity": 0.82,
          "border": "#7aaaff",
          "borderOpacity": 0.24,
          "highlight": "#ffc857",
          "shadow": "#000000",
          "area": "#000000",
          "areaOpacity": 0,
          "time": "#9fb0d0"
        }
      }
    }
  ]
};
