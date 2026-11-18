const { connect, evalJs, sleep, saveNote } = require('./cdp');

(async () => {
  const { send, ws } = await connect();
  const state = await evalJs(send, `window.__TAURI_INTERNALS__.invoke('get_state')`, true);
  const slim = {
    keys: Object.keys(state || {}),
    connected: state?.connected,
    login: state?.login,
    version: state?.version,
    accent: state?.accent,
    volume: state?.volume,
    close_to_tray: state?.close_to_tray,
    autostart: state?.autostart,
    start_minimized: state?.start_minimized,
    muted: state?.muted,
    playback_enabled: state?.playback_enabled,
    audio_device: state?.audio_device,
    audio_ready: state?.audio_ready,
    rewardsCount: state?.rewards?.length,
    rewardNames: (state?.rewards || []).map((r) => r.title),
    rewardSample: (state?.rewards || [])[0],
    health: state?.health,
    logCount: state?.log_count ?? state?.logs?.length,
    localBindings: (state?.local_bindings || []).map((b) => ({ id: b.reward_id, title: b.title, file: b.file?.name })),
    music: state?.music && {
      ready: state.music.ready,
      ytdlp_version: state.music.ytdlp_version,
      chat_online: state.music.chat_online,
      overlay_ready: state.music.overlay_ready,
      max_queue: state.music.max_queue,
      itemsCount: state.music.items?.length,
      current: state.music.current,
      player: state.music.player,
    },
  };
  saveNote('20-get-state', state);
  console.log(JSON.stringify(slim, null, 1));
  ws.close();
})().catch((e) => { console.error('FATAL', e); process.exit(1); });
