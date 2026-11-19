import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

/* ------------------------------------------------------------------ data */

const TRACKS = [
  {
    id: 't1', title: 'ДИНАСТИЯ — Земляк', user: 'nix', duration: 164, cost: 50,
    colors: ['#8B00FF', '#3B82F6'], reward: 'МУЗЫКА ЮТУБ', source: 'YouTube',
    tags: ['заявка', '!трек'], state: 'playing',
  },
  {
    id: 't2', title: 'Kanye West — Runaway', user: 'druzhba', duration: 214, cost: 150,
    colors: ['#F59E0B', '#EF4444'], reward: 'МУЗЫКА ЮТУБ', source: 'YouTube',
    tags: ['заявка', 'prefetch'], state: 'loading', progress: 64,
  },
  {
    id: 't3', title: 'Sweet Dreams — Eurythmics', user: 'mod_anya', duration: 292, cost: 50,
    colors: ['#06B6D4', '#22C55E'], reward: 'МУЗЫКА ЮТУБ', source: 'YouTube',
    tags: ['заявка'], state: 'ready',
  },
  {
    id: 't4', title: 'Miyagi — Utopia', user: 'goshanmur', duration: 198, cost: 100,
    colors: ['#EC4899', '#8B00FF'], reward: 'МУЗЫКА ЮТУБ', source: 'YouTube',
    tags: ['заявка'], state: 'queued',
  },
  {
    id: 't5', title: 'RAM — Привет', user: 'женька', duration: 142, cost: 50,
    colors: ['#7DD3FC', '#4E7CFF'], reward: 'МУЗЫКА ЮТУБ', source: 'YouTube',
    tags: ['заявка'], state: 'queued',
  },
  {
    id: 't6', title: 'Ссылка недоступна', user: 'spamer123', duration: 0, cost: 50,
    colors: ['#EF4444', '#F59E0B'], reward: 'МУЗЫКА ЮТУБ', source: 'YouTube',
    tags: ['ошибка'], state: 'error', error: 'yt-dlp: Video unavailable',
  },
];

const SKIP_REASONS = [
  { id: 'wrong', label: 'Не та песня', refunds: true },
  { id: 'nosound', label: 'Нет звука', refunds: true },
  { id: 'rules', label: 'Нарушение правил', refunds: true },
  { id: 'broken', label: 'Ссылка не работает', refunds: true },
];

const INITIAL_LOG = [
  { kind: 'ok', text: 'Заявка @nix принята · 50 баллов', time: '20:41' },
  { kind: 'info', text: 'Трек загружен · yt-dlp 2026.10.26', time: '20:42' },
  { kind: 'accent', text: 'Началось воспроизведение: ДИНАСТИЯ — Земляк', time: '20:43' },
  { kind: 'ok', text: 'Предзагрузка: Kanye West — Runaway · 64%', time: '20:44' },
];

const HOTKEYS = [
  ['Space', 'пауза / продолжить'],
  ['→ / ←', '±5 секунд'],
  ['Shift + →', 'следующий трек'],
  ['S', 'пропустить заявку'],
  ['M', 'без звука'],
  ['↑ / ↓', 'громкость'],
];

/* ------------------------------------------------------------------ utils */

const fmt = (value) => {
  const total = Math.max(0, Math.round(Number(value) || 0));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
};

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

const nowTime = () => {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};

const makeTrack = (url, index) => {
  const host = (() => {
    try { return new URL(url.startsWith('http') ? url : `https://${url}`).hostname.replace('www.', ''); }
    catch { return 'youtube.com'; }
  })();
  const palettes = [['#8B00FF', '#22C55E'], ['#3B82F6', '#06B6D4'], ['#EC4899', '#F59E0B']];
  return {
    id: `added-${Date.now()}-${index}`,
    title: `Ручная заявка · ${host}`,
    user: 'streamer',
    duration: 180 + index * 12,
    cost: 0,
    colors: palettes[index % palettes.length],
    reward: 'Ручная очередь',
    source: host,
    tags: ['вручную'],
    state: 'loading',
    progress: 12,
  };
};

/* ------------------------------------------------------------------ icons */

function Icon({ name, size = 18 }) {
  const s = { width: size, height: size, display: 'block' };
  const p = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.7, strokeLinecap: 'round', strokeLinejoin: 'round' };
  switch (name) {
    case 'play':
      return <svg viewBox="0 0 24 24" style={s}><path d="M8 5.5v13l11-6.5z" fill="currentColor" /></svg>;
    case 'pause':
      return <svg viewBox="0 0 24 24" style={s}><rect x="7" y="5" width="3.6" height="14" rx="1.4" fill="currentColor"/><rect x="13.4" y="5" width="3.6" height="14" rx="1.4" fill="currentColor"/></svg>;
    case 'next':
      return <svg viewBox="0 0 24 24" style={s}><path d="M15 5.5v13l-8-6.5z" fill="currentColor"/><rect x="16.5" y="5.5" width="2.4" height="13" rx="1.2" fill="currentColor"/></svg>;
    case 'prev':
      return <svg viewBox="0 0 24 24" style={s}><path d="M9 5.5v13l8-6.5z" fill="currentColor"/><rect x="5.1" y="5.5" width="2.4" height="13" rx="1.2" fill="currentColor"/></svg>;
    case 'skip':
      return <svg viewBox="0 0 24 24" style={s}><circle cx="12" cy="12" r="8" {...p}/><path d="M9.5 9.5l5 5M14.5 9.5l-5 5" {...p}/></svg>;
    case 'back10':
      return <svg viewBox="0 0 24 24" style={s}><path d="M4.5 9.5A8 8 0 1 1 4 14" {...p}/><path d="M4.2 5.2v4.6h4.6" {...p}/><text x="9" y="16" fontSize="6.4" fill="currentColor" stroke="none" fontWeight="700">10</text></svg>;
    case 'volume':
      return <svg viewBox="0 0 24 24" style={s}><path d="M4 9.5h3.2L12 5.8v12.4L7.2 14.5H4z" fill="currentColor"/><path d="M15.2 9a4.2 4.2 0 0 1 0 6" {...p}/><path d="M17.8 6.6a7.6 7.6 0 0 1 0 10.8" {...p}/></svg>;
    case 'mute':
      return <svg viewBox="0 0 24 24" style={s}><path d="M4 9.5h3.2L12 5.8v12.4L7.2 14.5H4z" fill="currentColor"/><path d="M15.5 9.5l5 5M20.5 9.5l-5 5" {...p}/></svg>;
    case 'music':
      return <svg viewBox="0 0 24 24" style={s}><circle cx="8" cy="17" r="2.6" {...p}/><circle cx="16.5" cy="15" r="2.6" {...p}/><path d="M10.6 17V8.2l8.5-1.7V15" {...p}/></svg>;
    case 'link':
      return <svg viewBox="0 0 24 24" style={s}><path d="M10 13.5a3.5 3.5 0 0 0 5 0l2.6-2.6a3.5 3.5 0 0 0-5-5L11.5 7" {...p}/><path d="M14 10.5a3.5 3.5 0 0 0-5 0l-2.6 2.6a3.5 3.5 0 0 0 5 5L12.5 17" {...p}/></svg>;
    case 'plus':
      return <svg viewBox="0 0 24 24" style={s}><path d="M12 5v14M5 12h14" {...p}/></svg>;
    case 'up':
      return <svg viewBox="0 0 24 24" style={s}><path d="M12 19V5M6 11l6-6 6 6" {...p}/></svg>;
    case 'down':
      return <svg viewBox="0 0 24 24" style={s}><path d="M12 5v14M6 13l6 6 6-6" {...p}/></svg>;
    case 'trash':
      return <svg viewBox="0 0 24 24" style={s}><path d="M4.5 7h15M9 7V5.2h6V7M7 7l.8 12.2h8.4L17 7" {...p}/></svg>;
    case 'retry':
      return <svg viewBox="0 0 24 24" style={s}><path d="M20 12a8 8 0 1 1-2.6-5.9" {...p}/><path d="M20 4.5V10h-5.4" {...p}/></svg>;
    case 'overlay':
      return <svg viewBox="0 0 24 24" style={s}><rect x="3.5" y="5" width="17" height="12" rx="2.4" {...p}/><path d="M3.5 13.5h17" {...p}/><path d="M8 20h8" {...p}/></svg>;
    case 'keyboard':
      return <svg viewBox="0 0 24 24" style={s}><rect x="3" y="6.5" width="18" height="11" rx="2.4" {...p}/><path d="M6.5 10h1M9.8 10h1M13.1 10h1M16.4 10h1M8 13.6h8" {...p}/></svg>;
    case 'check':
      return <svg viewBox="0 0 24 24" style={s}><path d="M5 12.5l4.4 4.3L19 7" {...p}/></svg>;
    case 'warn':
      return <svg viewBox="0 0 24 24" style={s}><path d="M12 4.5l8.5 15h-17z" {...p}/><path d="M12 10v4.2M12 17.2v.1" {...p}/></svg>;
    case 'close':
      return <svg viewBox="0 0 24 24" style={s}><path d="M6 6l12 12M18 6L6 18" {...p}/></svg>;
    case 'dots':
      return <svg viewBox="0 0 24 24" style={s}><circle cx="6" cy="12" r="1.6" fill="currentColor"/><circle cx="12" cy="12" r="1.6" fill="currentColor"/><circle cx="18" cy="12" r="1.6" fill="currentColor"/></svg>;
    case 'chart':
      return <svg viewBox="0 0 24 24" style={s}><path d="M4 19V5" {...p}/><path d="M4 19h16" {...p}/><path d="M8 15v-4M12 15V8M16 15v-6" {...p}/></svg>;
    case 'undo':
      return <svg viewBox="0 0 24 24" style={s}><path d="M9 7L4.5 11.5 9 16" {...p}/><path d="M4.5 11.5H14a5.5 5.5 0 0 1 0 11h-2" {...p}/></svg>;
    default:
      return null;
  }
}

/* ------------------------------------------------------------------ atoms */

function Cover({ track, size = 64, playing = false, className = '' }) {
  const [a, b] = track?.colors || ['#2a2a2a', '#161616'];
  return (
    <div
      className={`cover ${className} ${playing ? 'is-spinning' : 'is-paused'}`}
      style={{ width: size, height: size, '--c1': a, '--c2': b }}
      aria-hidden="true"
    >
      <div className="cover__ring" />
      <div className="cover__label"><Icon name="music" size={Math.max(14, size * 0.3)} /></div>
      <div className="cover__hole" />
    </div>
  );
}

function Eq({ active }) {
  return (
    <span className={`eq ${active ? 'is-on' : ''}`} aria-hidden="true">
      {[0, 1, 2, 3, 4].map((i) => <i key={i} style={{ '--i': i }} />)}
    </span>
  );
}

function StatePill({ state, progress }) {
  const map = {
    playing: ['accent', 'играет'],
    loading: ['warn', `загрузка ${progress ?? 64}%`],
    ready: ['ok', 'готов к старту'],
    queued: ['neutral', 'в очереди'],
    error: ['danger', 'ошибка загрузки'],
    played: ['ok', 'отработан'],
    skipped: ['danger', 'пропущен'],
  };
  const [tone, label] = map[state] || ['neutral', state];
  return <span className={`pill pill--${tone}`}>{label}</span>;
}

function Seek({ position, duration, buffered = 0, onSeek, disabled, big = false }) {
  const ref = useRef(null);
  const dragRef = useRef(false);
  const ratio = duration ? clamp(position / duration, 0, 1) : 0;
  const bufferedRatio = clamp((buffered || 0) / 100, 0, 1);

  const seekFromEvent = useCallback((clientX) => {
    if (!ref.current || !duration) return;
    const rect = ref.current.getBoundingClientRect();
    onSeek(clamp((clientX - rect.left) / rect.width, 0, 1) * duration);
  }, [duration, onSeek]);

  return (
    <div
      className={`seek ${big ? 'seek--big' : ''} ${disabled ? 'is-disabled' : ''}`}
      ref={ref}
      role="slider"
      tabIndex={disabled ? -1 : 0}
      aria-label="Перемотка трека"
      aria-valuemin={0}
      aria-valuemax={Math.round(duration)}
      aria-valuenow={Math.round(position)}
      aria-valuetext={`${fmt(position)} из ${fmt(duration)}`}
      onPointerDown={(e) => {
        if (disabled) return;
        dragRef.current = true;
        e.currentTarget.setPointerCapture?.(e.pointerId);
        seekFromEvent(e.clientX);
      }}
      onPointerMove={(e) => { if (dragRef.current && !disabled) seekFromEvent(e.clientX); }}
      onPointerUp={() => { dragRef.current = false; }}
      onPointerCancel={() => { dragRef.current = false; }}
      onKeyDown={(e) => {
        if (disabled) return;
        if (e.key === 'ArrowRight') { e.preventDefault(); onSeek(clamp(position + 5, 0, duration)); }
        if (e.key === 'ArrowLeft') { e.preventDefault(); onSeek(clamp(position - 5, 0, duration)); }
        if (e.key === 'Home') { e.preventDefault(); onSeek(0); }
        if (e.key === 'End') { e.preventDefault(); onSeek(duration); }
      }}
    >
      <div className="seek__buffered" style={{ width: `${bufferedRatio * 100}%` }} />
      <div className="seek__fill" style={{ width: `${ratio * 100}%` }}>
        <span className="seek__knob" />
      </div>
    </div>
  );
}

function Volume({ value, muted, onChange, onMute }) {
  return (
    <div className="volume">
      <button className="icon-btn" onClick={onMute} aria-label={muted ? 'Включить звук' : 'Выключить звук'} title={muted ? 'Включить звук (M)' : 'Выключить звук (M)'}>
        <Icon name={muted || value === 0 ? 'mute' : 'volume'} />
      </button>
      <input
        className="range"
        type="range" min={0} max={100} step={1}
        value={muted ? 0 : value}
        aria-label="Громкость музыки"
        onChange={(e) => onChange(Number(e.target.value))}
        style={{ '--p': `${muted ? 0 : value}%` }}
      />
      <span className="volume__value">{muted ? '0%' : `${value}%`}</span>
    </div>
  );
}

function Panel({ title, hint, action, className = '', children }) {
  return (
    <section className={`panel ${className}`}>
      {(title || action) && (
        <header className="panel__head">
          <div>
            {title && <h2 className="panel__title">{title}</h2>}
            {hint && <p className="panel__hint">{hint}</p>}
          </div>
          {action}
        </header>
      )}
      <div className="panel__body">{children}</div>
    </section>
  );
}

function StateBadge({ item, onRetry }) {
  if (item.state === 'loading') {
    return (
      <span className="state state--loading">
        <i className="spinner" /> {item.progress ?? 0}%
        <span className="state__bar"><i style={{ width: `${item.progress ?? 0}%` }} /></span>
      </span>
    );
  }
  if (item.state === 'error') {
    return (
      <span className="state state--error">
        <Icon name="warn" size={13} /> ошибка
        <button className="state__retry" onClick={() => onRetry?.(item)}>Повторить</button>
      </span>
    );
  }
  return <StatePill state={item.state} />;
}

function Activity({ log, className = '' }) {
  return (
    <ul className={`activity ${className}`}>
      {log.map((e, i) => (
        <li key={`${e.time}-${i}`} className={`activity__item activity__item--${e.kind}`}>
          <span className="activity__time">{e.time}</span>
          <span className="activity__dot" />
          <span className="activity__text">{e.text}</span>
        </li>
      ))}
    </ul>
  );
}

function OverlayCard({ current, onShow }) {
  return (
    <div className="overlay-card">
      <div className="overlay-card__row">
        <code className="overlay-card__url">http://127.0.0.1:8770/overlay</code>
        <button className="btn btn--secondary btn--sm" onClick={onShow}>Показать сейчас</button>
      </div>
      <p className="overlay-card__hint">
        <span className="dot dot--ok" /> источник «Браузер», 1920×200–300 · {current ? 'строка играет' : 'ожидание трека'}
      </p>
    </div>
  );
}

function HotkeysCard({ className = '' }) {
  return (
    <ul className={`hotkeys ${className}`}>
      {HOTKEYS.map(([key, label]) => (
        <li key={key}>
          <kbd>{key}</kbd>
          <span>{label}</span>
        </li>
      ))}
    </ul>
  );
}

/* ------------------------------------------------------------------ app */

export default function App() {
  const params = new URLSearchParams(window.location.search);
  const [variant, setVariant] = useState(params.get('v') === 'B' ? 'B' : 'A');
  const [current, setCurrent] = useState({ ...TRACKS[0] });
  const [queue, setQueue] = useState(TRACKS.slice(1).map((t) => ({ ...t })));
  const [position, setPosition] = useState(58);
  const [playing, setPlaying] = useState(true);
  const [buffering, setBuffering] = useState(0);
  const [volume, setVolume] = useState(46);
  const [muted, setMuted] = useState(false);
  const [log, setLog] = useState(INITIAL_LOG);
  const [toast, setToast] = useState(null);
  const [skipOpen, setSkipOpen] = useState(false);
  const [skipReason, setSkipReason] = useState('wrong');
  const [refund, setRefund] = useState(true);
  const [block, setBlock] = useState(false);
  const [blocklist, setBlocklist] = useState([
    { id: 'b1', label: 'youtu.be/dQw4… · не та песня' },
  ]);
  const [link, setLink] = useState('');
  const [linkError, setLinkError] = useState('');
  const [clearOpen, setClearOpen] = useState(false);
  const [stats, setStats] = useState({ played: 12, skipped: 2, refunded: 0, waited: 80 });
  const undoRef = useRef(null);
  const toastTimer = useRef(null);

  const notify = useCallback((message, options = {}) => {
    setToast({ id: Date.now(), message, ...options });
    window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), options.undo ? 6000 : 2600);
  }, []);

  const addLog = useCallback((kind, text) => {
    setLog((items) => [{ kind, text, time: nowTime() }, ...items].slice(0, 9));
  }, []);

  useEffect(() => () => window.clearTimeout(toastTimer.current), []);

  /* URL variant sync */
  useEffect(() => {
    const url = new URL(window.location.href);
    url.searchParams.set('v', variant);
    window.history.replaceState(null, '', url);
  }, [variant]);

  /* buffering simulation */
  useEffect(() => {
    if (!current || !buffering) return;
    const timer = window.setInterval(() => {
      setBuffering((pct) => {
        const next = Math.min(100, pct + 9);
        if (next >= 100) {
          window.clearInterval(timer);
          setPlaying(true);
          addLog('ok', `Трек загружен: ${current.title}`);
          return 0;
        }
        return next;
      });
    }, 130);
    return () => window.clearInterval(timer);
  }, [current?.id, Boolean(buffering), addLog]);

  /* playback tick */
  useEffect(() => {
    if (!playing || !current || buffering) return;
    const timer = window.setInterval(() => {
      setPosition((p) => {
        const next = p + 0.5;
        if (next >= current.duration) {
          completeCurrent('auto');
          return 0;
        }
        return next;
      });
    }, 500);
    return () => window.clearInterval(timer);
  }, [playing, current?.id, current?.duration, buffering]); // eslint-disable-line react-hooks/exhaustive-deps

  const startNext = useCallback((reason = 'next') => {
    setQueue((items) => {
      const [next, ...rest] = items;
      if (!next) {
        setCurrent(null);
        setPlaying(false);
        addLog('info', 'Очередь пуста — воспроизведение остановлено');
        return [];
      }
      setCurrent({ ...next });
      setPosition(0);
      setPlaying(false);
      if (next.state === 'loading') {
        setBuffering(next.progress || 18);
      } else {
        setBuffering(0);
        setPlaying(true);
      }
      setStats((s) => ({ ...s, played: s.played + (reason === 'auto' ? 1 : 0) }));
      addLog('accent', `Включён трек: ${next.title}`);
      return rest;
    });
  }, [addLog]);

  const completeCurrent = useCallback((reason) => {
    if (!current) return;
    addLog('ok', reason === 'auto' ? `Трек доигран: ${current.title}` : `Завершён досрочно: ${current.title} · баллы не возвращаются`);
    setStats((s) => ({ ...s, played: s.played + 1 }));
    startNext(reason);
  }, [current, addLog, startNext]);

  const skipTrack = useCallback(() => {
    if (!current) return;
    const reason = SKIP_REASONS.find((r) => r.id === skipReason) || SKIP_REASONS[0];
    const skipped = { ...current, state: 'skipped' };
    const removedNext = queue[0] || null;
    const refundAmount = refund ? current.cost : 0;
    addLog('danger', `Пропуск: ${current.title} · причина «${reason.label}»`);
    if (refundAmount > 0) {
      addLog('ok', `Возврат ${refundAmount} баллов @${current.user}`);
      setStats((s) => ({ ...s, refunded: s.refunded + refundAmount, skipped: s.skipped + 1 }));
    } else {
      setStats((s) => ({ ...s, skipped: s.skipped + 1 }));
    }
    if (block) {
      const label = `${current.source.toLowerCase()}/${current.title.slice(0, 18)}…`;
      setBlocklist((items) => [{ id: `b-${Date.now()}`, label }, ...items]);
      addLog('info', 'Ссылка добавлена в блок-лист');
    }
    setSkipOpen(false);
    startNext('skip');

    undoRef.current = { skipped, position, removedNext };
    notify(
      refund ? `Пропущен · ${refundAmount} баллов возвращены @${current.user}` : 'Пропущен · баллы списаны',
      { undo: true, actionLabel: 'Вернуть', onAction: () => undoSKip() },
    );
  }, [current, queue, skipReason, refund, block, addLog, startNext, notify]); // eslint-disable-line react-hooks/exhaustive-deps

  const undoSKip = useCallback(() => {
    const saved = undoRef.current;
    if (!saved) return;
    undoRef.current = null;
    setCurrent({ ...saved.skipped, state: 'playing' });
    setPosition(saved.position);
    setBuffering(0);
    setPlaying(true);
    setQueue((items) => (saved.removedNext ? [saved.removedNext, ...items] : items));
    addLog('accent', `Пропуск отменён: ${saved.skipped.title}`);
    notify('Пропуск отменён — трек вернулся');
  }, [addLog, notify]);

  const togglePlay = useCallback(() => {
    if (!current) return;
    if (buffering) {
      notify('Трек ещё загружается — подождите');
      return;
    }
    setPlaying((p) => {
      addLog('info', p ? 'Пауза' : 'Продолжили воспроизведение');
      return !p;
    });
  }, [current, buffering, addLog, notify]);

  const seekTo = useCallback((sec) => {
    if (!current) return;
    setPosition(clamp(sec, 0, current.duration));
  }, [current]);

  const back10 = useCallback(() => {
    if (!current) return;
    if (position > 4) seekTo(position - 10);
    else notify('Уже начало трека');
  }, [current, position, seekTo, notify]);

  const changeVolume = useCallback((value) => {
    setVolume(clamp(value, 0, 100));
    if (muted) setMuted(false);
  }, [muted]);

  const addLink = useCallback(() => {
    const value = link.trim();
    if (!value) return;
    if (!/^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)\//i.test(value)) {
      setLinkError('Это не ссылка YouTube — проверьте адрес');
      return;
    }
    const track = makeTrack(value, queue.length);
    setQueue((items) => [...items, track]);
    setLink('');
    setLinkError('');
    addLog('info', `Ручная заявка добавлена · ${track.title}`);
    notify('Ссылка принята — трек встанет в очередь после проверки');
  }, [link, queue.length, addLog, notify]);

  const playQueueItem = useCallback((id) => {
    setQueue((items) => {
      const index = items.findIndex((i) => i.id === id);
      if (index < 0) return items;
      const item = items[index];
      const rest = items.filter((_, i) => i !== index);
      if (current) {
        addLog('info', `Переход по очереди: ${item.title}`);
        setStats((s) => ({ ...s, played: s.played + 1 }));
      }
      setCurrent({ ...item });
      setPosition(0);
      if (item.state === 'error') {
        setPlaying(false);
        setBuffering(0);
        notify('Трек с ошибкой — сначала нажмите «Повторить»');
      } else if (item.state === 'loading' || item.state === 'queued') {
        setBuffering(item.progress || 18);
        setPlaying(false);
      } else {
        setBuffering(0);
        setPlaying(true);
      }
      return rest;
    });
  }, [current, addLog, notify]);

  const moveItem = useCallback((id, dir) => {
    setQueue((items) => {
      const index = items.findIndex((i) => i.id === id);
      const target = index + dir;
      if (index < 0 || target < 0 || target >= items.length) return items;
      const copy = [...items];
      [copy[index], copy[target]] = [copy[target], copy[index]];
      return copy;
    });
  }, []);

  const removeItem = useCallback((id) => {
    const item = queue.find((i) => i.id === id);
    setQueue((items) => items.filter((i) => i.id !== id));
    if (item) {
      addLog('info', `Убран из очереди: ${item.title} · баллы возвращены`);
      setStats((s) => ({ ...s, refunded: s.refunded + item.cost }));
      notify(`«${item.title}» убран · ${item.cost} баллов возвращены`);
    }
  }, [queue, addLog, notify]);

  const retryItem = useCallback((item) => {
    setQueue((items) => items.map((i) => (i.id === item.id ? { ...i, state: 'loading', progress: 8 } : i)));
    notify('Повторная загрузка ссылки…');
    window.setTimeout(() => {
      setQueue((items) => items.map((i) => (i.id === item.id ? { ...i, state: 'ready', progress: 100 } : i)));
    }, 2400);
  }, [notify]);

  const showOverlay = useCallback(() => {
    notify('Оверлей «Сейчас играет» показан в OBS');
    addLog('accent', 'Оверлей показан вручную');
  }, [notify, addLog]);

  /* keyboard */
  useEffect(() => {
    const onKey = (e) => {
      const tag = (e.target?.tagName || '').toLowerCase();
      if (tag === 'input' || tag === 'textarea' || tag === 'select') return;
      if (e.code === 'Space') { e.preventDefault(); togglePlay(); }
      if (e.key === 'ArrowRight' && e.shiftKey) { e.preventDefault(); completeCurrent('next'); }
      if (e.key === 'ArrowRight' && !e.shiftKey) { e.preventDefault(); seekTo(position + 5); }
      if (e.key === 'ArrowLeft') { e.preventDefault(); seekTo(position - 5); }
      if (e.key.toLowerCase() === 's') { e.preventDefault(); setSkipOpen(true); }
      if (e.key.toLowerCase() === 'm') { setMuted((m) => !m); }
      if (e.key === 'ArrowUp') { e.preventDefault(); changeVolume(volume + 5); }
      if (e.key === 'ArrowDown') { e.preventDefault(); changeVolume(volume - 5); }
      if (e.key.toLowerCase() === 'v') { setVariant((v) => (v === 'A' ? 'B' : 'A')); }
      if (e.key === 'Escape') { setSkipOpen(false); setClearOpen(false); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [togglePlay, completeCurrent, seekTo, position, changeVolume, volume]);

  const loaded = !buffering;
  const progressPct = current?.duration ? (position / current.duration) * 100 : 0;
  const prefetched = queue.filter((i) => i.state === 'ready').length;
  const nextItem = queue[0];

  const transport = (
    <div className={`transport ${variant === 'B' ? 'transport--compact' : ''}`}>
      <button className="icon-btn icon-btn--lg" onClick={back10} title="Назад 10 секунд" aria-label="Назад 10 секунд">
        <Icon name="back10" size={22} />
      </button>
      <button className="play-btn" onClick={togglePlay} aria-label={playing ? 'Пауза' : 'Продолжить'} title={playing ? 'Пауза (Space)' : 'Продолжить (Space)'}>
        {buffering ? <span className="spinner spinner--lg" /> : <Icon name={playing ? 'pause' : 'play'} size={26} />}
      </button>
      <button
        className={`btn btn--secondary transport__next ${variant === 'B' ? 'btn--label' : ''}`}
        onClick={() => completeCurrent('next')}
        disabled={!current && !queue.length}
        title="Следующий трек: завершить текущий и включить следующий. Баллы зрителя не возвращаются"
        aria-label="Следующий трек"
      >
        <Icon name="next" size={18} />
        <span className="btn__text">Следующий трек</span>
      </button>
      <button
        className="btn btn--danger-ghost transport__skip"
        onClick={() => setSkipOpen(true)}
        disabled={!current}
        title="Пропустить: снять заявку, вернуть баллы и (по желанию) заблокировать ссылку"
        aria-label="Пропустить трек"
      >
        <Icon name="skip" size={18} />
        <span className="btn__text">Пропустить…</span>
      </button>
      <button className="icon-btn" title="Ещё" aria-label="Ещё" onClick={() => notify('Меню: блок-лист, оверлей, настройки музыки')}>
        <Icon name="dots" />
      </button>
    </div>
  );

  const playerBlock = current ? (
    <>
      <div className="now">
        <Cover track={current} size={variant === 'A' ? 232 : 80} playing={playing && loaded} />
        <div className="now__meta">
          <div className="now__eyebrow">
            <Eq active={playing && loaded} />
            <span>{buffering ? 'ЗАГРУЗКА' : playing ? 'СЕЙЧАС ИГРАЕТ' : 'ПАУЗА'}</span>
            {buffering ? <span className="pill pill--warn">буферизация {buffering}%</span> : <StatePill state={playing ? 'playing' : 'ready'} />}
          </div>
          <h1 className="now__title">{current.title}</h1>
          <p className="now__sub">
            заказал <b>@{current.user}</b> · {current.source} · {fmt(current.duration)} ·{' '}
            <span className="now__reward">{current.reward} · {current.cost} баллов</span>
          </p>
          <div className="now__tags">
            {current.tags.map((t) => <span className="tag" key={t}>{t}</span>)}
            {nextItem && <span className="tag tag--next">далее: {nextItem.title}</span>}
          </div>
          {variant === 'A' && (
            <div className="seek-block">
              <Seek position={position} duration={current.duration} buffered={buffering ? 100 - buffering / 2 : 100} onSeek={seekTo} disabled={Boolean(buffering)} big />
              <div className="seek-block__times">
                <span>{fmt(position)}</span>
                <span className="seek-block__hint">{buffering ? `буферизация ${buffering}%` : 'перемотка · ← →'}</span>
                <span>{fmt(current.duration)}</span>
              </div>
            </div>
          )}
        </div>
      </div>
      {variant === 'B' && (
        <div className="seek-block seek-block--inline">
          <Seek position={position} duration={current.duration} buffered={buffering ? 100 - buffering / 2 : 100} onSeek={seekTo} disabled={Boolean(buffering)} />
          <div className="seek-block__times">
            <span>{fmt(position)}</span>
            <span>{fmt(current.duration)}</span>
          </div>
        </div>
      )}
    </>
  ) : (
    <div className="empty">
      <div className="empty__icon"><Icon name="music" size={26} /></div>
      <div>
        <h3>Ничего не играет</h3>
        <p>Очередь пуста. Активируйте награду-музыку или добавьте ссылку вручную.</p>
      </div>
    </div>
  );

  const queueList = (compact = false) => (
    <ul className={`queue ${compact ? 'queue--compact' : ''}`}>
      {queue.map((item, index) => (
        <li key={item.id} className={`queue__row queue__row--${item.state}`}>
          <span className="queue__index">{index + 1}</span>
          <span className="queue__cover"><Cover track={item} size={compact ? 34 : 40} /></span>
          <div className="queue__info">
            <span className="queue__title" title={item.title}>{item.title}</span>
            <span className="queue__meta">
              @{item.user} · {item.cost} б. · {fmt(item.duration)}
              {item.state === 'error' && <em className="queue__error"> · {item.error}</em>}
            </span>
          </div>
          <span className="queue__state"><StateBadge item={item} onRetry={retryItem} /></span>
          <div className="queue__actions">
            {!compact && (
              <button className="icon-btn icon-btn--sm" title="Играть сейчас" aria-label="Играть сейчас" onClick={() => playQueueItem(item.id)}>
                <Icon name="play" size={15} />
              </button>
            )}
            <button className="icon-btn icon-btn--sm" title="Выше" aria-label="Поднять трек выше" disabled={index === 0} onClick={() => moveItem(item.id, -1)}>
              <Icon name="up" size={14} />
            </button>
            <button className="icon-btn icon-btn--sm" title="Ниже" aria-label="Опустить трек ниже" disabled={index === queue.length - 1 || compact} onClick={() => moveItem(item.id, 1)}>
              <Icon name="down" size={14} />
            </button>
            <button className="icon-btn icon-btn--sm icon-btn--danger" title="Убрать и вернуть баллы" aria-label="Убрать из очереди" onClick={() => removeItem(item.id)}>
              <Icon name="trash" size={14} />
            </button>
          </div>
        </li>
      ))}
      {queue.length === 0 && <li className="queue__empty">Очередь пуста — добавьте ссылку ниже</li>}
    </ul>
  );

  const addRow = (
    <div className="add-row">
      <div className="add-row__field">
        <Icon name="link" size={16} />
        <input
          value={link}
          onChange={(e) => { setLink(e.target.value); setLinkError(''); }}
          onKeyDown={(e) => e.key === 'Enter' && addLink()}
          placeholder="Вставьте ссылку YouTube и нажмите Enter — трек встанет в очередь"
          aria-label="Ссылка YouTube для очереди"
        />
        <button className="btn btn--secondary btn--sm" onClick={addLink}>В очередь</button>
      </div>
      {linkError && <p className="add-row__error">{linkError}</p>}
      <p className="add-row__hint">
        Ссылка проверяется через yt-dlp: длительность, доступность, возраст. Невалидные и заблокированные ссылки не попадут в очередь.
      </p>
    </div>
  );

  const activityCard = (limit) => <Activity log={log.slice(0, limit)} />;

  return (
    <div className={`app app--${variant}`} data-playing={playing ? 'true' : 'false'}>
      <header className="top">
        <div className="top__brand">
          <div className="top__mark"><Icon name="music" size={20} /></div>
          <div>
            <div className="top__title">Reward Sounds <span>· Player Lab</span></div>
            <div className="top__sub">Музыка по заявкам: плеер, очередь и правила. Демо-данные, без Tauri.</div>
          </div>
        </div>
        <div className="top__right">
          <div className="segmented" role="tablist" aria-label="Вариант компоновки">
            <button role="tab" aria-selected={variant === 'A'} className={variant === 'A' ? 'is-active' : ''} onClick={() => setVariant('A')}>A · Stage</button>
            <button role="tab" aria-selected={variant === 'B'} className={variant === 'B' ? 'is-active' : ''} onClick={() => setVariant('B')}>B · Console</button>
          </div>
          <span className="pill pill--neutral">V = переключить</span>
          <button className="icon-btn" title="Горячие клавиши" aria-label="Горячие клавиши" onClick={() => notify('Space — пауза · Shift+→ — следующий · S — пропуск')}>
            <Icon name="keyboard" />
          </button>
        </div>
      </header>

      {variant === 'A' ? (
        <main className="layout layout--a">
          <section className="panel stage">
            <div className="stage__body">{playerBlock}</div>
            <div className="stage__controls">
              {transport}
              <div className="stage__volume">
                <Volume value={volume} muted={muted} onChange={changeVolume} onMute={() => setMuted((m) => !m)} />
                <div className="stage__hints">
                  <span><Icon name="next" size={13} /> Следующий — очередь идёт дальше</span>
                  <span className="danger"><Icon name="skip" size={13} /> Пропустить — отменить заявку и вернуть баллы</span>
                </div>
              </div>
            </div>
            <footer className="stage__footer">
              <span className="stage__stat"><b>{queue.length}</b> в очереди</span>
              <span className="stage__stat"><b>{prefetched}</b> предзагружено</span>
              <span className="stage__stat"><b>{stats.played}</b> сыграно за эфир</span>
              <button className="btn btn--secondary btn--sm" onClick={showOverlay}><Icon name="overlay" size={15} /> Оверлей OBS</button>
            </footer>
          </section>

          <Panel
            className="queue-panel"
            title="Очередь"
            hint={`${queue.length} из 10 · префетч: ${nextItem ? nextItem.title : '—'}`}
            action={<button className="btn btn--danger-ghost btn--sm" disabled={!queue.length} onClick={() => setClearOpen(true)}>Очистить</button>}
          >
            {queueList()}
            {addRow}
          </Panel>

          <div className="a-bottom">
            <Panel title="Журнал эфира" hint="что произошло с заявками" className="log-panel">
              {activityCard(7)}
            </Panel>
            <div className="a-bottom__side">
              <Panel title="OBS-оверлей" hint="источник «Браузер»">
                <OverlayCard current={current} onShow={showOverlay} />
              </Panel>
              <Panel title="Статистика" hint="за текущий эфир">
                <div className="stats">
                  <div><b>{stats.played}</b><span>треков сыграно</span></div>
                  <div><b>{stats.skipped}</b><span>пропущено</span></div>
                  <div><b>{stats.refunded}</b><span>баллов возвращено</span></div>
                  <div><b>1:20</b><span>среднее ожидание</span></div>
                </div>
              </Panel>
            </div>
          </div>
        </main>
      ) : (
        <main className="layout layout--b">
          <section className="panel b-player">
            <div className="b-player__now">{playerBlock}</div>
            <div className="b-player__controls">
              {transport}
              <Volume value={volume} muted={muted} onChange={changeVolume} onMute={() => setMuted((m) => !m)} />
            </div>
            <div className="b-player__strip">
              <span className="strip"><i className="dot dot--ok" /> yt-dlp 2026.10.26</span>
              <span className="strip"><i className="dot dot--ok" /> !трек включён</span>
              <span className="strip"><i className="dot dot--warn" /> {nextItem ? `далее ${nextItem.title.slice(0, 22)}…` : 'очередь пуста'}</span>
              <span className="strip"><i className="dot dot--ok" /> оверлей готов</span>
              <span className="strip strip--right">{stats.played} сыграно · {stats.skipped} пропущено</span>
            </div>
          </section>

          <section className="b-grid">
            <Panel
              className="b-queue"
              title="Очередь заявок"
              hint="Play — включить сейчас, ↑↓ — порядок, × — вернуть баллы"
              action={<button className="btn btn--danger-ghost btn--sm" disabled={!queue.length} onClick={() => setClearOpen(true)}>Очистить</button>}
            >
              {queueList()}
              {addRow}
            </Panel>

            <aside className="b-side">
              <Panel title="Правила и модерация" hint="семантика действий и блок-лист">
                <div className="rules">
                  <div className="rule rule--next">
                    <Icon name="next" size={16} />
                    <div><b>Следующий трек</b><span>Досрочно завершить текущий: он считается отработанным, баллы не возвращаются, играет следующий по очереди. Шорткат Shift+→.</span></div>
                  </div>
                  <div className="rule rule--skip">
                    <Icon name="skip" size={16} />
                    <div><b>Пропустить</b><span>Снять заявку: текущий получает статус «пропущен», зрителю возвращаются баллы, причина пишется в журнал, ссылку при желании добавляем в блок-лист. Шорткат S.</span></div>
                  </div>
                </div>
                <div className="blocklist">
                  <div className="blocklist__head">Блок-лист ссылок <span>{blocklist.length}</span></div>
                  {blocklist.map((b) => (
                    <div className="blocklist__row" key={b.id}>
                      <code>{b.label}</code>
                      <button className="icon-btn icon-btn--sm" aria-label="Убрать из блок-листа" onClick={() => setBlocklist((items) => items.filter((i) => i.id !== b.id))}>
                        <Icon name="close" size={13} />
                      </button>
                    </div>
                  ))}
                </div>
              </Panel>

              <Panel title="Журнал" hint="действия модератора">
                {activityCard(4)}
              </Panel>

            </aside>
          </section>

          <div className="b-bottom">
            <Panel title="OBS-оверлей" hint="источник «Браузер» в OBS">
              <OverlayCard current={current} onShow={showOverlay} />
            </Panel>
            <Panel title="Горячие клавиши" hint="работают на этой странице">
              <HotkeysCard className="hotkeys--wide" />
            </Panel>
          </div>
        </main>
      )}

      <footer className="foot">
        <span>Reward Sounds · player-lab · концепт {variant === 'A' ? 'A «Stage»' : 'B «Console»'}</span>
        <span>Демо-данные · без Tauri · <kbd>V</kbd> сменить вариант</span>
      </footer>

      {skipOpen && (
        <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="skip-title" onMouseDown={(e) => e.target === e.currentTarget && setSkipOpen(false)}>
          <div className="modal">
            <header className="modal__head">
              <div>
                <h3 id="skip-title">Пропустить трек?</h3>
                <p>Пропуск — это отмена заявки. «Следующий трек» только переключает очередь, баллы остаются списанными.</p>
              </div>
              <button className="icon-btn" onClick={() => setSkipOpen(false)} aria-label="Закрыть"><Icon name="close" /></button>
            </header>
            <div className="modal__track">
              <Cover track={current} size={44} />
              <div>
                <b>{current?.title}</b>
                <span>@{current?.user} · {current?.cost} баллов · {fmt(current?.duration)}</span>
              </div>
            </div>
            <div className="modal__label">ПРИЧИНА ПРОПУСКА</div>
            <div className="reasons">
              {SKIP_REASONS.map((r) => (
                <button key={r.id} className={`reason ${skipReason === r.id ? 'is-active' : ''}`} onClick={() => setSkipReason(r.id)}>
                  {r.label}
                </button>
              ))}
            </div>
            <label className="check">
              <input type="checkbox" checked={refund} onChange={(e) => setRefund(e.target.checked)} />
              <span>Вернуть {current?.cost} баллов зрителю</span>
            </label>
            <label className="check">
              <input type="checkbox" checked={block} onChange={(e) => setBlock(e.target.checked)} />
              <span>Добавить ссылку в блок-лист, чтобы её нельзя было заказать повторно</span>
            </label>
            <footer className="modal__foot">
              <button className="btn btn--secondary" onClick={() => setSkipOpen(false)}>Отмена</button>
              <button className="btn btn--danger" onClick={skipTrack}>Пропустить и вернуть баллы</button>
            </footer>
          </div>
        </div>
      )}

      {clearOpen && (
        <div className="modal-backdrop" role="dialog" aria-modal="true" onMouseDown={(e) => e.target === e.currentTarget && setClearOpen(false)}>
          <div className="modal modal--small">
            <header className="modal__head">
              <div>
                <h3>Очистить очередь?</h3>
                <p>Все заявки будут сняты, баллы вернутся зрителям. Текущий трек продолжит играть.</p>
              </div>
              <button className="icon-btn" onClick={() => setClearOpen(false)} aria-label="Закрыть"><Icon name="close" /></button>
            </header>
            <footer className="modal__foot">
              <button className="btn btn--secondary" onClick={() => setClearOpen(false)}>Отмена</button>
              <button className="btn btn--danger" onClick={() => {
                const refundedSum = queue.reduce((sum, i) => sum + i.cost, 0);
                setStats((s) => ({ ...s, refunded: s.refunded + refundedSum }));
                addLog('info', `Очередь очищена · возвращено ${refundedSum} баллов`);
                setQueue([]);
                setClearOpen(false);
                notify('Очередь очищена, баллы возвращены');
              }}>Очистить очередь</button>
            </footer>
          </div>
        </div>
      )}

      {toast && (
        <div className="toast" role="status" aria-live="polite">
          <span>{toast.message}</span>
          {toast.undo && <button onClick={() => { toast.onAction?.(); setToast(null); }}>{toast.actionLabel || 'Отменить'}</button>}
          <button className="toast__close" aria-label="Закрыть" onClick={() => setToast(null)}><Icon name="close" size={14} /></button>
        </div>
      )}
    </div>
  );
}
