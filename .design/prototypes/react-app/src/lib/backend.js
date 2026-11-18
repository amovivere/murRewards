import { useEffect, useState } from 'react';

export const inTauri = typeof window !== 'undefined' && Boolean(window.__TAURI_INTERNALS__);

export async function invoke(command, args = {}) {
  if (!inTauri) throw new Error('Tauri недоступен');
  return window.__TAURI_INTERNALS__.invoke(command, args);
}

/**
 * Состояние бэкенда Reward Sounds.
 *
 * В Tauri опрашивает `get_state`; в браузере возвращает `null`, и экраны
 * используют мок-данные прототипа.
 */
export function useBackend() {
  const [view, setView] = useState(null);
  const [error, setError] = useState(null);

  async function refresh() {
    if (!inTauri) return null;
    try {
      const next = await invoke('get_state');
      setView(next);
      setError(null);
      return next;
    } catch (err) {
      setError(String(err));
      return null;
    }
  }

  useEffect(() => {
    if (!inTauri) return undefined;
    let alive = true;
    let timer = null;
    const tick = async () => {
      if (!alive) return;
      await refresh();
      if (alive) timer = window.setTimeout(tick, 900);
    };
    tick();
    return () => {
      alive = false;
      window.clearTimeout(timer);
    };
  }, []);

  async function call(command, args = {}) {
    const next = await invoke(command, args);
    if (next && typeof next === 'object' && next.rewards) setView(next);
    return next;
  }

  return {
    available: inTauri,
    view,
    error,
    refresh,
    invoke,
    call,
  };
}
