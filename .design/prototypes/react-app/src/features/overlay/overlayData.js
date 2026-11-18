export const DEFAULT_COLORS = {
  text: '#ffffff',
  nickMode: 'twitch',
  nick: '#ffc857',
  bubble: '#141a2e',
  bubbleOpacity: 0.82,
  border: '#7aaaff',
  borderOpacity: 0.24,
  highlight: '#ffc857',
  shadow: '#000000',
  area: '#000000',
  areaOpacity: 0,
  time: '#9fb0d0',
};

export const DEFAULT_CFG = {
  channel: '',
  theme: 'neon',
  fontFamily: 'Segoe UI Variable Text',
  fontSize: 24,
  lineHeight: 1.38,
  paddingX: 28,
  paddingY: 24,
  gap: 10,
  radius: 14,
  emoteScale: 1.5,
  align: 'left',
  direction: 'up',
  max: 40,
  ttl: 15,
  badges: true,
  emotes: true,
  sevenTv: true,
  hideCommands: false,
  ignoreBots: [],
  ignoreWords: [],
  timestamps: false,
  maxTextLength: 600,
  animation: 'slide',
  readability: 'soft',
  highlight: ['arstotsky'],
  colors: { ...DEFAULT_COLORS },
};

export const DEFAULT_STATE = {
  activePreset: 'neon',
  presets: [
    {
      id: 'neon',
      name: 'Обычный',
      cfg: { ...DEFAULT_CFG, colors: { ...DEFAULT_COLORS } },
    },
    {
      id: 'minimal',
      name: 'Минимал',
      cfg: {
        ...DEFAULT_CFG,
        theme: 'minimal',
        fontSize: 26,
        lineHeight: 1.36,
        gap: 6,
        max: 30,
        animation: 'fade',
        readability: 'hard',
        colors: { ...DEFAULT_COLORS },
      },
    },
  ],
};

export function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

export function normalizeState(raw) {
  if (!raw || !Array.isArray(raw.presets) || raw.presets.length === 0) {
    return clone(DEFAULT_STATE);
  }
  return {
    activePreset: raw.presets.some((preset) => preset.id === raw.activePreset)
      ? raw.activePreset
      : raw.presets[0].id,
    presets: raw.presets.map((preset) => ({
      id: preset.id,
      name: preset.name || 'Пресет',
      cfg: {
        ...clone(DEFAULT_CFG),
        ...clone(preset.cfg || {}),
        colors: { ...DEFAULT_COLORS, ...clone(preset.cfg?.colors || {}) },
      },
    })),
  };
}
