import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

/* ================================================================ данные */

const PRESETS = [
  { id: 'cat', label: 'Кот-мем', emoji: '😼', c1: '#F59E0B', c2: '#EF4444' },
  { id: 'frog', label: 'Жаба', emoji: '🐸', c1: '#22C55E', c2: '#06B6D4' },
  { id: 'duck', label: 'Утка', emoji: '🦆', c1: '#F5C97B', c2: '#F59E0B' },
  { id: 'pizza', label: 'Пицца', emoji: '🍕', c1: '#EF4444', c2: '#F59E0B' },
  { id: 'boom', label: 'Бум', emoji: '💥', c1: '#EC4899', c2: '#8B00FF' },
  { id: 'skull', label: 'Череп', emoji: '💀', c1: '#7DD3FC', c2: '#4E7CFF' },
  { id: 'party', label: 'Пати', emoji: '🥳', c1: '#8B00FF', c2: '#EC4899' },
  { id: 'dog', label: 'Пёс', emoji: '🐶', c1: '#F59E0B', c2: '#22C55E' },
];
const PRESET_MAP = Object.fromEntries(PRESETS.map((p) => [p.id, p]));

const SOUNDS = {
  newbie: { id: 'newbie', file: 'newbie.mp3', label: 'Приветствие', duration: 0.9, wave: 'triangle', gain: 0.5, notes: [[523, 0.16], [659, 0.16], [784, 0.34]] },
  shot: { id: 'shot', file: 'shot.mp3', label: 'Выстрел', duration: 0.45, wave: 'square', gain: 0.32, notes: [[900, 0.06], [620, 0.07], [380, 0.14]] },
  donate: { id: 'donate', file: 'donate100webm.mp3', label: 'Донат', duration: 0.8, wave: 'sine', gain: 0.42, notes: [[659, 0.12], [880, 0.12], [1047, 0.12], [1319, 0.3]] },
};
const SOUND_LIST = Object.values(SOUNDS);

const DEFAULT_SETTINGS = {
  maxAngle: 40, sizePct: 32, duration: 4, opacity: 95, safeMargin: 6,
  mode: 'full', showOnRedeem: true,
};

const mkSound = (id, volume = 100) => {
  const s = SOUNDS[id] || SOUNDS.newbie;
  return { presetId: s.id, file: s.file, label: s.label, duration: s.duration, volume };
};

const INITIAL_REWARDS = [
  {
    id: 'both-main', mode: 'both', name: 'Мем + звук', cost: 600, active: true, color: '#8B00FF',
    sound: mkSound('newbie', 100), media: ['cat', 'frog', 'duck'], coverId: 'cat',
    settings: { ...DEFAULT_SETTINGS },
  },
  {
    id: 'image-main', mode: 'image', name: 'Картинка на экране', cost: 500, active: true, color: '#A970FF',
    sound: null, media: ['frog', 'duck', 'pizza'], coverId: 'frog',
    settings: { ...DEFAULT_SETTINGS },
  },
  {
    id: 'sound-main', mode: 'sound', name: 'Ты новичок?', cost: 200, active: true, color: '#FF5A5F',
    sound: mkSound('newbie', 100), media: [],
    settings: { ...DEFAULT_SETTINGS },
  },
  {
    id: 'image-meme', mode: 'image', name: 'Мем за баллы', cost: 300, active: true, color: '#EC4899',
    sound: null, media: ['boom', 'party'], coverId: 'boom',
    settings: { ...DEFAULT_SETTINGS, maxAngle: 24, sizePct: 28, duration: 3, opacity: 90, safeMargin: 8 },
  },
  {
    id: 'both-partial', mode: 'both', name: 'Звук с мемом', cost: 350, active: true, color: '#22C55E',
    sound: mkSound('donate', 110), media: [], coverId: null,
    settings: { ...DEFAULT_SETTINGS, maxAngle: 32, sizePct: 30, duration: 3.5 },
  },
  {
    id: 'image-empty', mode: 'image', name: 'Случайная картинка', cost: 250, active: true, color: '#22D3EE',
    sound: null, media: [], coverId: null,
    settings: { ...DEFAULT_SETTINGS },
  },
  {
    id: 'sound-shot', mode: 'sound', name: 'Выстрел', cost: 50, active: true, color: '#F59E0B',
    sound: mkSound('shot', 200), media: [],
    settings: { ...DEFAULT_SETTINGS },
  },
  {
    id: 'image-off', mode: 'image', name: 'Старая картинка', cost: 200, active: false, color: '#A3A3A3',
    sound: null, media: ['dog'], coverId: 'dog',
    settings: { ...DEFAULT_SETTINGS, maxAngle: 40, sizePct: 36 },
  },
];

const FILTERS = [
  { id: 'all', label: 'Все' },
  { id: 'both', label: 'Комбо' },
  { id: 'sound', label: 'Звук' },
  { id: 'image', label: 'Картинки' },
  { id: 'empty', label: 'Пустые' },
];

const MODE_LABEL = { sound: 'только звук', image: 'только картинки', both: 'звук + картинки' };

/* ================================================================ утилиты */

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const clone = (v) => JSON.parse(JSON.stringify(v));
const fmtDuration = (v) => `${String(v).replace('.', ',')} с`;
const pluralPics = (n) => {
  const m10 = n % 10;
  const m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return 'картинка';
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return 'картинки';
  return 'картинок';
};

const hasSound = (r) => (r.mode === 'image' ? false : Boolean(r.sound));
const hasImage = (r) => (r.mode === 'sound' ? false : Boolean(r.media && r.media.length));
const hasContent = (r) => hasSound(r) || hasImage(r);
const isPartial = (r) => r.mode === 'both' && !(hasSound(r) && hasImage(r));
const orderedMedia = (r) => {
  const media = r.media || [];
  if (!media.length) return [];
  if (r.coverId && media.includes(r.coverId)) return [r.coverId, ...media.filter((id) => id !== r.coverId)];
  return media;
};

function randomShot(media, settings) {
  if (!media.length) return null;
  const ordered = media;
  const presetId = ordered[Math.floor(Math.random() * ordered.length)];
  const maxAngle = Number(settings.maxAngle) || 0;
  const angle = maxAngle ? Math.round((Math.random() * 2 - 1) * maxAngle * 10) / 10 : 0;
  const size = (Number(settings.sizePct) || 32) / 100;
  const margin = (Number(settings.safeMargin) || 0) / 100;
  const halfW = (size / 2) * 1.08;
  const halfH = (size * 16 / 9 / 2) * 1.08;
  const minX = margin + halfW;
  const maxX = 1 - margin - halfW;
  const minY = margin + halfH;
  const maxY = 1 - margin - halfH;
  let cx;
  let cy;
  if (settings.mode === 'center') {
    cx = clamp(0.5 + (Math.random() - 0.5) * 0.34, minX, maxX);
    cy = clamp(0.5 + (Math.random() - 0.5) * 0.3, minY, maxY);
  } else {
    cx = minX + Math.random() * Math.max(0.001, maxX - minX);
    cy = minY + Math.random() * Math.max(0.001, maxY - minY);
  }
  return { presetId, angle: +angle.toFixed(1), x: +cx.toFixed(4), y: +cy.toFixed(4), duration: Number(settings.duration) || 4 };
}

/* ---------------------------------------------------------------- звук */

let audioCtx = null;
function ensureAudio() {
  try {
    if (!audioCtx) {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return null;
      audioCtx = new Ctx();
    }
    if (audioCtx.state === 'suspended') audioCtx.resume();
    return audioCtx;
  } catch {
    return null;
  }
}

function playPresetSound(presetId, volumePct, onEnd) {
  const ctx = ensureAudio();
  const spec = SOUNDS[presetId] || SOUNDS.newbie;
  const volume = clamp(Number(volumePct) || 100, 0, 200) / 100;
  if (!ctx) {
    onEnd?.();
    return spec.duration;
  }
  let t = ctx.currentTime + 0.02;
  spec.notes.forEach(([freq, dur]) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = spec.wave;
    osc.frequency.value = freq;
    const peak = Math.max(0.0002, spec.gain * volume * 0.35);
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(peak, t + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(gain).connect(ctx.destination);
    osc.start(t);
    osc.stop(t + dur + 0.02);
    t += dur;
  });
  const total = t - ctx.currentTime;
  window.setTimeout(() => onEnd?.(), Math.max(120, total * 1000 + 60));
  return total;
}

/* ================================================================ иконки */

function Icon({ name, size = 16 }) {
  const p = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.7, strokeLinecap: 'round', strokeLinejoin: 'round' };
  const s = { width: size, height: size, display: 'block' };
  switch (name) {
    case 'image': return <svg viewBox="0 0 24 24" style={s}><rect x="3.5" y="4.5" width="17" height="15" rx="2.6" {...p}/><circle cx="9" cy="10" r="1.7" {...p}/><path d="M4.5 17l4.6-4.4 3.2 2.9 3-2.6 3.7 3.4" {...p}/></svg>;
    case 'music': return <svg viewBox="0 0 24 24" style={s}><circle cx="8" cy="17" r="2.4" {...p}/><circle cx="16.5" cy="15" r="2.4" {...p}/><path d="M10.4 17V8.4l8.5-1.7V15" {...p}/></svg>;
    case 'plus': return <svg viewBox="0 0 24 24" style={s}><path d="M12 5v14M5 12h14" {...p}/></svg>;
    case 'close': return <svg viewBox="0 0 24 24" style={s}><path d="M6 6l12 12M18 6L6 18" {...p}/></svg>;
    case 'play': return <svg viewBox="0 0 24 24" style={s}><path d="M8 5.5v13l11-6.5z" fill="currentColor"/></svg>;
    case 'pause': return <svg viewBox="0 0 24 24" style={s}><rect x="7" y="5" width="3.6" height="14" rx="1.4" fill="currentColor"/><rect x="13.4" y="5" width="3.6" height="14" rx="1.4" fill="currentColor"/></svg>;
    case 'eye': return <svg viewBox="0 0 24 24" style={s}><path d="M2.7 12S6.3 5.8 12 5.8 21.3 12 21.3 12 17.7 18.2 12 18.2 2.7 12 2.7 12z" {...p}/><circle cx="12" cy="12" r="2.6" {...p}/></svg>;
    case 'dots': return <svg viewBox="0 0 24 24" style={s}><circle cx="6" cy="12" r="1.6" fill="currentColor"/><circle cx="12" cy="12" r="1.6" fill="currentColor"/><circle cx="18" cy="12" r="1.6" fill="currentColor"/></svg>;
    case 'spark': return <svg viewBox="0 0 24 24" style={s}><path d="M12 3l1.9 5.6L19.5 10l-5.6 1.9L12 17.5l-1.9-5.6L4.5 10l5.6-1.4z" {...p}/><path d="M18.5 16.5l.9 2.1 2.1.9-2.1.9-.9 2.1-.9-2.1-2.1-.9 2.1-.9z" {...p}/></svg>;
    case 'grid': return <svg viewBox="0 0 24 24" style={s}><rect x="4" y="4" width="6.6" height="6.6" rx="1.6" {...p}/><rect x="13.4" y="4" width="6.6" height="6.6" rx="1.6" {...p}/><rect x="4" y="13.4" width="6.6" height="6.6" rx="1.6" {...p}/><rect x="13.4" y="13.4" width="6.6" height="6.6" rx="1.6" {...p}/></svg>;
    case 'list': return <svg viewBox="0 0 24 24" style={s}><path d="M4 7h16M4 12h16M4 17h16" {...p}/></svg>;
    case 'wand': return <svg viewBox="0 0 24 24" style={s}><path d="M5 19L15.5 8.5" {...p}/><path d="M17 4l.9 2.1L20 7l-2.1.9L17 10l-.9-2.1L14 7l2.1-.9z" {...p}/><path d="M15.5 8.5l2 2" {...p}/></svg>;
    case 'warn': return <svg viewBox="0 0 24 24" style={s}><path d="M12 4.5l8.5 15h-17z" {...p}/><path d="M12 10v4.2M12 17.2v.1" {...p}/></svg>;
    case 'star': return <svg viewBox="0 0 24 24" style={s}><path d="M12 4l2.5 5.1 5.5.8-4 3.9 1 5.5-5-2.6-5 2.6 1-5.5-4-3.9 5.5-.8z" {...p}/></svg>;
    case 'home': return <svg viewBox="0 0 24 24" style={s}><path d="M4 11l8-6.5 8 6.5v8.5h-5.5V14h-5v6H4z" {...p}/></svg>;
    case 'volume': return <svg viewBox="0 0 24 24" style={s}><path d="M4 9.5h3.2L12 5.8v12.4L7.2 14.5H4z" fill="currentColor"/><path d="M15.2 9a4.2 4.2 0 0 1 0 6" {...p}/></svg>;
    default: return null;
  }
}

/* ================================================================ части */

function ImageTile({ preset, className = '', big = false }) {
  if (!preset) return null;
  return (
    <div className={`imgtile ${big ? 'imgtile--big' : ''} ${className}`} style={{ '--c1': preset.c1, '--c2': preset.c2 }} aria-hidden="true">
      <span className="imgtile__pattern" />
      <span className="imgtile__emoji">{preset.emoji}</span>
    </div>
  );
}

function MediaStack({ reward, size = 44 }) {
  const media = orderedMedia(reward);
  const list = media.slice(0, 3).map((id) => PRESET_MAP[id]).filter(Boolean);
  const tilts = [-9, 4, 12];
  return (
    <div className="stack" style={{ '--stack-size': `${size}px` }}>
      {list.length === 0 ? (
        <div className="stack__empty"><Icon name="image" size={size * 0.4} /></div>
      ) : (
        list.map((preset, i) => (
          <div key={preset.id} className="stack__item" style={{ '--tilt': `${tilts[i]}deg`, '--i': i }}>
            <ImageTile preset={preset} />
            {i === 0 && reward.coverId && <span className="stack__cover"><Icon name="star" size={8} /></span>}
          </div>
        ))
      )}
      {media.length > 3 && <span className="stack__more">+{media.length - 3}</span>}
      {media.length > 0 && <span className="stack__count">{media.length}</span>}
    </div>
  );
}

function SoundChip({ reward, onPlay, compact = false }) {
  if (!hasSound(reward)) return null;
  return (
    <span className={`sound-chip ${compact ? 'sound-chip--compact' : ''}`} data-testid="sound-chip">
      <button
        type="button"
        className="sound-chip__play"
        aria-label={`Прослушать звук ${reward.sound.file}`}
        data-testid="card-play-sound"
        onClick={(e) => { e.stopPropagation(); onPlay?.(reward); }}
      >
        <Icon name="play" size={10} />
      </button>
      <Icon name="volume" size={12} />
      <span className="sound-chip__name" title={reward.sound.file}>{reward.sound.file}</span>
      <span className="sound-chip__vol">{reward.sound.volume}%</span>
    </span>
  );
}

function ModeBadge({ reward }) {
  const label = reward.mode === 'both'
    ? 'звук + картинки'
    : reward.mode === 'sound' ? 'звук' : 'картинки';
  if (!hasContent(reward)) {
    return <span className="chip chip--warn"><Icon name="warn" size={12} /> пустая карточка — не сработает</span>;
  }
  if (isPartial(reward)) {
    return <span className="chip chip--warn">{hasSound(reward) ? 'только звук — нет картинок' : 'только картинки — нет звука'}</span>;
  }
  return <span className={`chip mode-badge mode-badge--${reward.mode}`}>{label}</span>;
}

function Chips({ reward, onPlay }) {
  return (
    <div className="chips">
      <SoundChip reward={reward} onPlay={onPlay} compact />
      {hasImage(reward) && (
        <>
          <span className="chip chip--accent"><Icon name="image" size={12} /> {reward.media.length} {pluralPics(reward.media.length)}</span>
          <span className="chip">±{reward.settings.maxAngle}°</span>
          <span className="chip">{fmtDuration(reward.settings.duration)}</span>
        </>
      )}
    </div>
  );
}

function DotMenu({ reward, onEdit, onShow, onToggle, onClose }) {
  return (
    <>
      <div className="menu-backdrop" onClick={onClose} />
      <div className="menu" role="menu">
        <button role="menuitem" onClick={onEdit}>Настроить карточку</button>
        <button role="menuitem" disabled={!hasContent(reward)} onClick={onShow}>Показать в OBS</button>
        <button role="menuitem" onClick={onToggle}>{reward.active ? 'Выключить награду' : 'Включить награду'}</button>
      </div>
    </>
  );
}

function MediaCard({ reward, variant, onEdit, onShow, onToggle, onPlaySound, menuOpen, onMenu, onCloseMenu }) {
  const empty = !hasContent(reward);
  const imagePart = hasImage(reward);
  const cls = ['card', `card--${variant === 'A' ? 'media' : 'compact'}`, reward.active ? '' : 'is-off', empty ? 'is-empty' : ''].filter(Boolean).join(' ');
  return (
    <article className={cls} data-testid="card" data-reward={reward.id} onClick={() => onEdit(reward)}>
      <span className="card__accent" style={{ '--accent-color': reward.color }} />
      <header className="card__head">
        {variant === 'B' && (
          <div className="card__stack">
            {imagePart ? <MediaStack reward={reward} size={38} /> : (
              <div className={`card__sound${hasSound(reward) ? '' : ' card__sound--empty'}`}>
                <Icon name={hasSound(reward) ? 'volume' : 'warn'} size={18} />
              </div>
            )}
          </div>
        )}
        <div className="card__heading">
          <h3 className="card__title">{reward.name}</h3>
          <div className="card__meta">{reward.cost} баллов · {reward.active ? 'АКТИВНА' : 'ВЫКЛЮЧЕНА'}</div>
        </div>
        <div className="card__menu-wrap">
          <button className="icon-btn" data-testid="card-menu" aria-label="Действия с наградой" onClick={(e) => { e.stopPropagation(); onMenu(menuOpen ? null : reward.id); }}>
            <Icon name="dots" />
          </button>
          {menuOpen && (
            <DotMenu
              reward={reward}
              onClose={onCloseMenu}
              onEdit={() => { onCloseMenu(); onEdit(reward); }}
              onShow={() => { onCloseMenu(); onShow(reward); }}
              onToggle={() => { onCloseMenu(); onToggle(reward); }}
            />
          )}
        </div>
      </header>

      {variant === 'A' && (
        <div className="card__poster">
          {empty ? (
            <div className="card__empty">
              <Icon name="warn" size={20} />
              <span>Пустая карточка —<br />награда не сработает</span>
            </div>
          ) : imagePart ? (
            <div className="poster">
              {orderedMedia(reward).slice(0, 3).map((id, i) => (
                <div key={id} className="poster__photo" style={{ '--tilt': `${[-7, 3, 10][i]}deg`, '--i': i }}>
                  <ImageTile preset={PRESET_MAP[id]} big />
                  {i === 0 && reward.coverId && <span className="poster__cover"><Icon name="star" size={9} /></span>}
                </div>
              ))}
              <span className="poster__count">{reward.media.length} {pluralPics(reward.media.length)}</span>
              {hasSound(reward) && (
                <span className="poster__sound-badge"><Icon name="volume" size={11} /> звук</span>
              )}
            </div>
          ) : (
            <div className="poster poster--audio">
              <div className="poster__audio"><Icon name="volume" size={24} /></div>
              <span className="poster__audio-label">{reward.sound.file}</span>
            </div>
          )}
          {!empty && (
            <button className="btn btn--ghost btn--sm poster__show" data-testid="card-show" onClick={(e) => { e.stopPropagation(); onShow(reward); }}>
              <Icon name="play" size={13} /> Показать
            </button>
          )}
        </div>
      )}

      <div className="card__body">
        <ModeBadge reward={reward} />
        <Chips reward={reward} onPlay={onPlaySound} />
      </div>

      <footer className="card__foot">
        {variant === 'B' ? (
          <>
            <button className={`btn btn--sm ${empty ? 'btn--primary' : 'btn--secondary'}`} onClick={(e) => { e.stopPropagation(); onEdit(reward); }}>
              <Icon name={empty ? 'plus' : 'wand'} size={14} />
              {empty ? 'Добавить содержимое' : 'Редактор'}
            </button>
            <button className="btn btn--ghost btn--sm" disabled={!hasContent(reward)} onClick={(e) => { e.stopPropagation(); onShow(reward); }}>Показать</button>
          </>
        ) : (
          <>
            <span className="card__hint">
              {empty ? 'Нет звука и картинок — не сработает'
                : isPartial(reward) ? 'Покажется только одна часть'
                : hasSound(reward) && hasImage(reward) ? 'Звук и картинка одновременно'
                : hasSound(reward) ? 'Только звук' : 'Только картинка'}
            </span>
            <button className="btn btn--secondary btn--sm" onClick={(e) => { e.stopPropagation(); onEdit(reward); }}>Настроить</button>
          </>
        )}
      </footer>
    </article>
  );
}

function RewardRow({ reward, onEdit, onShow, onPlaySound, onMenu, menuOpen, onCloseMenu }) {
  const empty = !hasContent(reward);
  return (
    <div className="row" data-testid="card" data-reward={reward.id} onClick={() => onEdit(reward)}>
      <span className="row__accent" style={{ background: reward.color }} />
      {hasImage(reward) ? <MediaStack reward={reward} size={42} /> : (
        <div className={`row__sound${hasSound(reward) ? '' : ' row__sound--empty'}`}><Icon name={hasSound(reward) ? 'volume' : 'warn'} size={18} /></div>
      )}
      <div className="row__main">
        <div className="row__title">{reward.name}</div>
        <div className="row__meta">{reward.cost} баллов · {reward.active ? 'АКТИВНА' : 'ВЫКЛЮЧЕНА'} · {MODE_LABEL[reward.mode]}</div>
      </div>
      <ModeBadge reward={reward} />
      <Chips reward={reward} onPlay={onPlaySound} />
      <div className="row__actions">
        <button className="btn btn--ghost btn--sm" disabled={empty} onClick={(e) => { e.stopPropagation(); onShow(reward); }}>
          <Icon name="play" size={13} /> Показать
        </button>
        <button className="btn btn--secondary btn--sm" onClick={(e) => { e.stopPropagation(); onEdit(reward); }}>Настроить</button>
        <div className="card__menu-wrap">
          <button className="icon-btn" aria-label="Действия" onClick={(e) => { e.stopPropagation(); onMenu(menuOpen ? null : reward.id); }}><Icon name="dots" /></button>
          {menuOpen && <DotMenu reward={reward} onClose={onCloseMenu} onEdit={() => { onCloseMenu(); onEdit(reward); }} onShow={() => { onCloseMenu(); onShow(reward); }} onToggle={() => { onCloseMenu(); onEdit(reward); }} />}
        </div>
      </div>
    </div>
  );
}

/* ================================================================ превью */

function PreviewStage({ reward, auto = true, autoSound = false, onClose }) {
  const settings = reward.settings || DEFAULT_SETTINGS;
  const imageEnabled = hasImage(reward);
  const soundEnabled = hasSound(reward);
  const [shot, setShot] = useState(null);
  const [phase, setPhase] = useState('idle');
  const [runId, setRunId] = useState(0);
  const [soundPlaying, setSoundPlaying] = useState(false);
  const timers = useRef([]);
  const clearTimers = () => { timers.current.forEach((t) => clearTimeout(t)); timers.current = []; };

  const run = useCallback((withSound = true) => {
    clearTimers();
    setSoundPlaying(false);
    if (imageEnabled) {
      const next = randomShot(orderedMedia(reward), settings);
      setShot(next);
      setPhase('flash');
      setRunId((v) => v + 1);
      timers.current.push(setTimeout(() => setPhase('in'), 70));
      timers.current.push(setTimeout(() => setPhase('hold'), 280));
      timers.current.push(setTimeout(() => setPhase('out'), 280 + next.duration * 1000));
      timers.current.push(setTimeout(() => setPhase('idle'), 280 + next.duration * 1000 + 380));
    } else {
      setShot(null);
      setPhase('idle');
    }
    if (soundEnabled && withSound) {
      setSoundPlaying(true);
      playPresetSound(reward.sound.presetId, reward.sound.volume, () => setSoundPlaying(false));
    }
  }, [reward, settings, imageEnabled, soundEnabled]);

  useEffect(() => {
    if (!auto) return undefined;
    const t = setTimeout(() => run(autoSound), 420);
    timers.current.push(t);
    return () => clearTimers();
  }, [auto, autoSound, run]);

  useEffect(() => () => clearTimers(), []);

  const preset = shot ? PRESET_MAP[shot.presetId] : null;

  return (
    <div className="stage" data-testid="preview-stage">
      <div className="stage__top">
        <span className="stage__label">OBS · Browser Source 1920×1080</span>
        <span className="stage__live"><i /> PREVIEW</span>
      </div>
      <div className="stage__scene">
        <span className="stage__blob stage__blob--a" />
        <span className="stage__blob stage__blob--b" />
        <span className="stage__safe" aria-hidden="true" />
        <div key={runId} className={`stage__flash ${phase === 'flash' ? 'is-on' : ''}`} />
        {preset && shot && (
          <>
            <span className={`stage__burst ${phase === 'in' || phase === 'flash' ? 'is-on' : ''}`} style={{ left: `${shot.x * 100}%`, top: `${shot.y * 100}%` }} />
            <div
              className={`shot shot--${phase}`}
              data-testid="preview-image"
              style={{
                left: `${shot.x * 100}%`, top: `${shot.y * 100}%`,
                width: `${settings.sizePct}%`, opacity: settings.opacity / 100,
                '--rot': `${shot.angle}deg`, '--dur': `${shot.duration}s`,
              }}
            >
              <div className="shot__frame">
                <ImageTile preset={preset} big />
                <span className="shot__caption">{preset.label}</span>
              </div>
              <span className="shot__pin" />
            </div>
            <div className="stage__readout" data-testid="readout">
              x {Math.round(shot.x * 100)}% · y {Math.round(shot.y * 100)}% · угол {shot.angle > 0 ? '+' : ''}{shot.angle}°
            </div>
          </>
        )}
        {!preset && imageEnabled && (
          <div className="stage__placeholder"><Icon name="image" size={26} /><span>Добавьте картинки, чтобы увидеть появление</span></div>
        )}
        {!imageEnabled && soundEnabled && (
          <div className={`stage__audio ${soundPlaying ? 'is-playing' : ''}`} data-testid="sound-only">
            <div className="wave" aria-hidden="true">{[0, 1, 2, 3, 4, 5, 6].map((i) => <i key={i} style={{ '--i': i }} />)}</div>
            <div className="stage__audio-name">{soundPlaying ? 'ЗВУК ИГРАЕТ' : 'ТОЛЬКО ЗВУК'} · {reward.sound.file}</div>
            <div className="stage__audio-sub">громкость {reward.sound.volume}% · анимация появится при наличии картинок</div>
          </div>
        )}
        {!imageEnabled && !soundEnabled && (
          <div className="stage__placeholder"><Icon name="warn" size={26} /><span>Нечего показывать — в карточке нет звука и картинок</span></div>
        )}
        {soundEnabled && imageEnabled && (
          <div className={`stage__soundchip ${soundPlaying ? 'is-playing' : ''}`} data-testid="preview-sound">
            <Icon name="volume" size={13} />
            <span>{soundPlaying ? 'звук играет' : 'звук'} · {reward.sound.file} · {reward.sound.volume}%</span>
            <span className="wave wave--mini" aria-hidden="true">{[0, 1, 2, 3].map((i) => <i key={i} style={{ '--i': i }} />)}</span>
          </div>
        )}
        <span className="stage__fake-ui stage__fake-ui--left" />
        <span className="stage__fake-ui stage__fake-ui--right" />
      </div>
      <div className="stage__bottom">
        <button className="btn btn--primary btn--sm" onClick={() => run(true)} disabled={!hasContent(reward)} data-testid="preview-show">
          <Icon name="spark" size={14} /> {shot || soundPlaying ? 'Показать ещё раз' : 'Показать'}
        </button>
        <span className="stage__hint">
          {[
            imageEnabled ? `${settings.mode === 'center' ? 'центр' : 'случайное место'} · ±${settings.maxAngle}°` : null,
            imageEnabled ? fmtDuration(settings.duration) : null,
            soundEnabled ? `звук ${reward.sound.volume}%` : 'без звука',
          ].filter(Boolean).join(' · ')}
        </span>
        {onClose && <button className="btn btn--ghost btn--sm" onClick={onClose}>Закрыть</button>}
      </div>
      {shot && <div className="stage__progress"><i key={runId} style={{ animationDuration: `${shot.duration}s` }} /></div>}
    </div>
  );
}

function PreviewModal({ reward, onClose }) {
  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal modal--preview" role="dialog" aria-modal="true" aria-label="Предпросмотр в OBS">
        <header className="modal__head">
          <div>
            <h2 className="modal__title">Предпросмотр в OBS</h2>
            <p className="modal__sub">
              «{reward.name}» · {hasSound(reward) ? 'звук играет из приложения' : 'без звука'}
              {hasImage(reward) ? ` · картинка из ${reward.media.length}` : ' · без картинки'} · как увидит зритель
            </p>
          </div>
          <button className="icon-btn" onClick={onClose} aria-label="Закрыть"><Icon name="close" /></button>
        </header>
        <PreviewStage reward={reward} auto autoSound onClose={onClose} />
      </div>
    </div>
  );
}

/* ================================================================ настройки */

function Range({ label, value, min, max, step = 1, unit = '', onChange, disabled, hint, testid }) {
  return (
    <label className={`range-row ${disabled ? 'is-disabled' : ''}`}>
      <span className="range-row__top">
        <span className="range-row__label">{label}</span>
        <span className="range-row__value">{value}{unit}</span>
      </span>
      <input
        className="range" type="range" min={min} max={max} step={step} value={value}
        disabled={disabled} data-testid={testid}
        onChange={(e) => onChange(Number(e.target.value))}
        style={{ '--p': `${clamp(((value - min) / (max - min)) * 100, 0, 100)}%` }}
      />
      {hint && <span className="range-row__hint">{hint}</span>}
    </label>
  );
}

function Toggle({ label, hint, checked, onChange, disabled, testid }) {
  return (
    <label className={`toggle-row ${disabled ? 'is-disabled' : ''}`}>
      <span>
        <span className="toggle-row__label">{label}</span>
        {hint && <span className="toggle-row__hint">{hint}</span>}
      </span>
      <input type="checkbox" className="toggle" checked={checked} disabled={disabled} data-testid={testid} onChange={(e) => onChange(e.target.checked)} />
    </label>
  );
}

function ModeSwitch({ draft, setDraft }) {
  const options = [
    { id: 'sound', label: 'Звук', icon: 'volume' },
    { id: 'image', label: 'Картинки', icon: 'image' },
    { id: 'both', label: 'Звук + картинки', icon: 'spark' },
  ];
  const hints = {
    sound: 'Играет звук награды. Картинок в этой карточке нет.',
    image: 'В OBS появится случайная картинка под углом. Звук не играет.',
    both: 'Одновременно: звук из приложения и случайная картинка в OBS.',
  };
  return (
    <div className="mode-switch" data-testid="mode-switch">
      <div className="mode-switch__head">
        <span className="mode-switch__label">Что делает награда</span>
        <span className="mode-switch__hint">{hints[draft.mode]}</span>
      </div>
      <div className="segmented" role="tablist" aria-label="Тип награды">
        {options.map((opt) => (
          <button
            key={opt.id}
            role="tab"
            aria-selected={draft.mode === opt.id}
            className={draft.mode === opt.id ? 'is-active' : ''}
            data-testid={`mode-${opt.id}`}
            onClick={() => setDraft((d) => ({ ...d, mode: opt.id }))}
          >
            <Icon name={opt.icon} size={13} /> {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function SoundSection({ draft, setDraft, notify }) {
  const [playing, setPlaying] = useState(false);
  const play = () => {
    if (!draft.sound) return;
    ensureAudio();
    setPlaying(true);
    playPresetSound(draft.sound.presetId, draft.sound.volume, () => setPlaying(false));
    notify(`Звук: ${draft.sound.file}`);
  };
  const cycle = () => {
    const current = draft.sound?.presetId;
    const idx = SOUND_LIST.findIndex((s) => s.id === current);
    const next = SOUND_LIST[(idx + 1) % SOUND_LIST.length];
    setDraft((d) => ({ ...d, sound: mkSound(next.id, d.sound?.volume ?? 100) }));
    notify(`Звук заменён: ${next.file}`);
  };
  return (
    <section className="sound-section" data-testid="sound-section">
      <div className="section-head">
        <h4 className="control-section__title">Звук</h4>
        <span className="section-head__hint">один на карточку</span>
      </div>
      {draft.sound ? (
        <div className={`sound-file ${playing ? 'is-playing' : ''}`}>
          <div className="sound-file__icon"><Icon name={playing ? 'pause' : 'volume'} size={18} /></div>
          <div className="sound-file__info">
            <div className="sound-file__name" data-testid="sound-file-name">{draft.sound.file}</div>
            <div className="sound-file__meta">MP3 · {draft.sound.duration.toFixed(1)} с · {playing ? 'играет…' : 'готов'}</div>
          </div>
          <div className="sound-file__actions">
            <button className="btn btn--ghost btn--sm" onClick={play} data-testid="sound-play">
              <Icon name="play" size={12} /> Прослушать
            </button>
            <button className="btn btn--ghost btn--sm" onClick={cycle} data-testid="sound-replace">Заменить</button>
            <button className="btn btn--ghost btn--sm" onClick={() => setDraft((d) => ({ ...d, sound: null }))} data-testid="sound-remove">Убрать</button>
          </div>
        </div>
      ) : (
        <div className="sound-empty" data-testid="sound-empty">
          <Icon name="music" size={18} />
          <div>
            <div className="sound-empty__title">Звук не выбран</div>
            <div className="sound-empty__hint">Карточка сработает без звука — только картинки</div>
          </div>
          <button className="btn btn--secondary btn--sm" data-testid="sound-add" onClick={() => setDraft((d) => ({ ...d, sound: mkSound('newbie', 100) }))}>Выбрать звук</button>
        </div>
      )}
      {draft.sound && (
        <Range
          label="Громкость звука" value={draft.sound.volume} min={0} max={200} step={5} unit="%"
          testid="sound-volume"
          hint="0–200%, как у звуковых наград; не влияет на громкость Windows"
          onChange={(v) => setDraft((d) => ({ ...d, sound: { ...d.sound, volume: v } }))}
        />
      )}
      <p className="control-hint">Звук воспроизводит приложение (как сейчас), картинка показывается в OBS-оверлее.</p>
    </section>
  );
}

function MediaGallery({ draft, setDraft, notify }) {
  const [picker, setPicker] = useState(false);
  const added = new Set(draft.media);
  const add = (id) => {
    if (added.has(id)) return;
    if (draft.media.length >= 8) { notify('Максимум 8 картинок на награду'); return; }
    setDraft((d) => ({ ...d, media: [...d.media, id], coverId: d.coverId || id }));
    notify(`Добавлено: ${PRESET_MAP[id].label}`);
  };
  const remove = (id) => {
    setDraft((d) => {
      const media = d.media.filter((x) => x !== id);
      return { ...d, media, coverId: d.coverId === id ? (media[0] || null) : d.coverId };
    });
  };
  const setCover = (id) => setDraft((d) => ({ ...d, coverId: id }));
  return (
    <div className="gallery">
      <div className="gallery__head">
        <div>
          <div className="gallery__title">Картинки</div>
          <div className="gallery__hint">При активации покажется <b>одна случайная</b> из {draft.media.length || 0}</div>
        </div>
        <span className="counter" data-testid="gallery-counter">{draft.media.length} / 8</span>
      </div>
      <div className="gallery__grid" data-testid="media-grid">
        {draft.media.map((id, index) => {
          const preset = PRESET_MAP[id];
          return (
            <div className={`thumb ${draft.coverId === id ? 'is-cover' : ''}`} key={id} style={{ '--tilt': `${[-5, 3, -2, 4][index % 4]}deg` }} data-testid="media-thumb">
              <ImageTile preset={preset} />
              <span className="thumb__label">{preset.label}</span>
              {draft.coverId === id && <span className="thumb__cover"><Icon name="star" size={9} /> обложка</span>}
              <button className="thumb__remove" aria-label={`Удалить ${preset.label}`} data-testid="media-remove" onClick={() => remove(id)}><Icon name="close" size={11} /></button>
              {draft.coverId !== id && (
                <button className="thumb__setcover" title="Сделать обложкой" aria-label={`Сделать ${preset.label} обложкой`} data-testid="media-cover" onClick={() => setCover(id)}>
                  <Icon name="star" size={10} />
                </button>
              )}
            </div>
          );
        })}
        <button className="thumb thumb--add" data-testid="add-media" onClick={() => setPicker((v) => !v)}>
          <Icon name="plus" size={20} /><span>Добавить</span>
        </button>
      </div>
      {picker && (
        <div className="picker">
          <div className="picker__head"><span>Из примеров</span><strong>до 8 на награду</strong></div>
          <div className="picker__grid">
            {PRESETS.map((preset) => {
              const used = added.has(preset.id);
              return (
                <button key={preset.id} className={`picker__item ${used ? 'is-used' : ''}`} data-testid={`preset-${preset.id}`} disabled={used} onClick={() => add(preset.id)} title={used ? 'Уже добавлена' : `Добавить «${preset.label}»`}>
                  <ImageTile preset={preset} /><span>{used ? 'добавлена' : preset.label}</span>
                </button>
              );
            })}
          </div>
          <p className="picker__hint">В MVP — готовые примеры; в реальной версии — файловый диалог, превью и лимиты.</p>
        </div>
      )}
      {!draft.media.length && (
        <div className="gallery__empty" data-testid="gallery-empty">
          <Icon name="warn" size={16} />
          {draft.mode === 'both' ? 'Картинок нет — при активации сработает только звук.' : 'Пока нет картинок — награда не сработает.'}
        </div>
      )}
    </div>
  );
}

function Controls({ draft, update, advanced }) {
  const s = draft.settings;
  return (
    <div className="controls">
      <section className="control-section">
        <h4 className="control-section__title">Случайность и появление</h4>
        <div className="control-note" data-testid="selection-note">
          <Icon name="spark" size={14} />
          При активации выбирается <b>одна случайная</b> из {draft.media.length || 'N'} · место и угол — тоже случайные
        </div>
        <Range label="Максимальный угол" value={s.maxAngle} min={0} max={40} unit="°" testid="angle-range" hint="0 — без наклона; 40° — заметно «нарочно»" onChange={(v) => update('maxAngle', v)} />
        <div className="position-modes">
          <span className="position-modes__label">Позиция</span>
          <div className="segmented segmented--sm">
            <button className={s.mode === 'full' ? 'is-active' : ''} onClick={() => update('mode', 'full')}>Случайно по экрану</button>
            <button className={s.mode === 'center' ? 'is-active' : ''} onClick={() => update('mode', 'center')}>Центр</button>
          </div>
        </div>
        <Range label="Размер" value={s.sizePct} min={12} max={60} unit="%" testid="size-range" hint="Доля ширины экрана OBS" onChange={(v) => update('sizePct', v)} />
        <Range label="Длительность" value={s.duration} min={1} max={10} step={0.5} unit=" с" testid="duration-range" hint="Через сколько секунд картинка плавно исчезнет" onChange={(v) => update('duration', v)} />
        <Range label="Прозрачность" value={s.opacity} min={50} max={100} unit="%" testid="opacity-range" onChange={(v) => update('opacity', v)} />
        <Range label="Безопасные отступы (safe area)" value={s.safeMargin} min={0} max={15} unit="%" testid="safe-range" hint="Не прижимается к краям и к UI стрима" onChange={(v) => update('safeMargin', v)} />
      </section>
      <section className="control-section">
        <h4 className="control-section__title">Триггер</h4>
        <Toggle label="Показывать при активации награды" hint="MVP: сразу, без задержки; вручную — кнопкой «Показать»" checked={s.showOnRedeem} disabled testid="trigger-toggle" onChange={() => {}} />
        <p className="control-hint">Если в карточке нет ни звука, ни картинок — активация игнорируется, баллы возвращаются.</p>
      </section>
      {advanced && (
        <details className="advanced" data-testid="advanced">
          <summary>Дополнительно · задержка, зоны <span className="advanced__badge">v1.1</span></summary>
          <div className="advanced__body">
            <Range label="Задержка после активации" value={0} min={0} max={10} unit=" с" disabled onChange={() => {}} />
            <Range label="Размер зоны (углы/края)" value={0} min={0} max={100} unit="%" disabled onChange={() => {}} />
            <Toggle label="Без повторов подряд" hint="Не показывать одну и ту же картинку два раза" checked disabled onChange={() => {}} />
            <p className="control-hint">Эти поля спроектированы, но в MVP скрыты и выключены.</p>
          </div>
        </details>
      )}
    </div>
  );
}

/* ================================================================ приложение */

export default function App() {
  const params = new URLSearchParams(window.location.search);
  const [variant, setVariant] = useState(params.get('v') === 'B' ? 'B' : 'A');
  const [view, setView] = useState('grid');
  const [rewards, setRewards] = useState(INITIAL_REWARDS);
  const [filter, setFilter] = useState('all');
  const [query, setQuery] = useState('');
  const [draft, setDraft] = useState(null);
  const [previewReward, setPreviewReward] = useState(null);
  const [menuFor, setMenuFor] = useState(null);
  const [toast, setToast] = useState('');

  const notify = useCallback((message) => {
    setToast(message);
    window.clearTimeout(notify.timer);
    notify.timer = window.setTimeout(() => setToast(''), 2400);
  }, []);

  useEffect(() => {
    const url = new URL(window.location.href);
    url.searchParams.set('v', variant);
    window.history.replaceState(null, '', url);
  }, [variant]);

  useEffect(() => {
    const onKey = (e) => {
      const tag = (e.target?.tagName || '').toLowerCase();
      if (['input', 'textarea', 'select'].includes(tag)) return;
      if (e.key.toLowerCase() === 'v') setVariant((v) => (v === 'A' ? 'B' : 'A'));
      if (e.key === 'Escape') { setDraft(null); setPreviewReward(null); setMenuFor(null); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    if (!menuFor) return undefined;
    const close = () => setMenuFor(null);
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [menuFor]);

  const counts = useMemo(() => ({
    all: rewards.length,
    both: rewards.filter((r) => r.mode === 'both').length,
    sound: rewards.filter((r) => r.mode === 'sound').length,
    image: rewards.filter((r) => r.mode === 'image').length,
    empty: rewards.filter((r) => !hasContent(r)).length,
  }), [rewards]);

  const visible = rewards.filter((r) => {
    if (query.trim() && !r.name.toLowerCase().includes(query.trim().toLowerCase())) return false;
    if (filter === 'empty') return !hasContent(r);
    return r.mode === filter || filter === 'all';
  });

  const openEditor = (reward) => { setMenuFor(null); setDraft(clone(reward)); };
  const updateDraftSetting = (key, value) => setDraft((d) => ({ ...d, settings: { ...d.settings, [key]: value } }));
  const openPreview = (reward) => { ensureAudio(); setPreviewReward(reward); };
  const playCardSound = (reward) => {
    if (!hasSound(reward)) return;
    ensureAudio();
    playPresetSound(reward.sound.presetId, reward.sound.volume);
    notify(`Звук: ${reward.sound.file} · ${reward.sound.volume}%`);
  };
  const toggleActive = (reward) => {
    setRewards((list) => list.map((r) => (r.id === reward.id ? { ...r, active: !r.active } : r)));
    notify(reward.active ? `«${reward.name}» выключена` : `«${reward.name}» включена`);
  };
  const saveDraft = () => {
    setRewards((list) => list.map((r) => (r.id === draft.id ? draft : r)));
    setDraft(null);
    notify('Настройки карточки сохранены');
  };

  const isB = variant === 'B';
  const previewEmpty = draft ? !hasContent(draft) : false;

  return (
    <div className={`app app--${variant}`} data-testid="app">
      <aside className="sidebar">
        <div className="sidebar__brand">
          <div className="sidebar__mark"><Icon name="image" size={18} /></div>
          <div>
            <div className="sidebar__name">Reward Sounds</div>
            <div className="sidebar__sub">Channel Points · OBS</div>
          </div>
        </div>
        <nav className="sidebar__nav">
          <span className="sidebar__label">ОСНОВНОЕ</span>
          <button className="nav-item is-active" data-testid="nav-rewards"><Icon name="grid" size={15} /> Награды</button>
          <button className="nav-item"><Icon name="music" size={15} /> Музыка</button>
          <button className="nav-item"><Icon name="eye" size={15} /> Оверлей</button>
        </nav>
        <nav className="sidebar__nav sidebar__nav--bottom">
          <span className="sidebar__label">СИСТЕМА</span>
          <button className="nav-item"><Icon name="home" size={15} /> Настройки</button>
          <button className="nav-item"><Icon name="list" size={15} /> Журнал</button>
        </nav>
      </aside>

      <div className="main">
        <header className="topbar">
          <div className="health"><i className="dot dot--ok" /> Все системы работают</div>
          <div className="topbar__right">
            <span className="topbar__volume">ЗВУК</span>
            <div className="topbar__slider"><i /></div>
            <span className="topbar__value">29%</span>
          </div>
        </header>

        <div className="content">
          <div className="page-head">
            <div>
              <div className="eyebrow">TWITCH · CHANNEL POINTS</div>
              <h1 className="page-title">Награды</h1>
              <p className="page-sub">
                @goshanmur · {rewards.length} наград · {counts.both} комбо · {counts.sound} только звук · {counts.image} только картинки
              </p>
            </div>
            <div className="page-actions">
              <div className="segmented" role="tablist" aria-label="Вариант интерфейса">
                <button role="tab" aria-selected={variant === 'A'} className={variant === 'A' ? 'is-active' : ''} data-testid="variant-a" onClick={() => setVariant('A')}>A · Media-first</button>
                <button role="tab" aria-selected={variant === 'B'} className={variant === 'B' ? 'is-active' : ''} data-testid="variant-b" onClick={() => setVariant('B')}>B · Compact</button>
              </div>
              <span className="variant-hint">V — переключить · ?v=A|B</span>
              <button className="btn btn--primary" onClick={() => notify('Демо: в реальном приложении открылась бы модалка создания')}>+ Создать награду</button>
            </div>
          </div>

          <div className="toolbar">
            <div className="search">
              <Icon name="eye" size={14} />
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Поиск награды" aria-label="Поиск награды" />
            </div>
            <div className="segmented segmented--view">
              <button className={view === 'grid' ? 'is-active' : ''} data-testid="view-grid" onClick={() => setView('grid')}><Icon name="grid" size={13} /> Плитка</button>
              <button className={view === 'list' ? 'is-active' : ''} data-testid="view-list" onClick={() => setView('list')}><Icon name="list" size={13} /> Список</button>
            </div>
            <div className="filters">
              {FILTERS.map((f) => (
                <button key={f.id} className={`filter ${filter === f.id ? 'is-active' : ''}`} data-testid={`filter-${f.id}`} onClick={() => setFilter(f.id)}>
                  {f.label} <span>{counts[f.id]}</span>
                </button>
              ))}
            </div>
            <button className="btn btn--ghost btn--sm toolbar__demo" data-testid="demo-show" onClick={() => {
              const withContent = rewards.find((r) => hasContent(r));
              if (withContent) openPreview(withContent);
            }}>
              <Icon name="play" size={13} /> Показать в OBS
            </button>
          </div>

          {view === 'grid' ? (
            <div className={`grid grid--${isB ? 'compact' : 'media'}`}>
              {visible.map((reward) => (
                <MediaCard
                  key={reward.id}
                  reward={reward}
                  variant={variant}
                  onEdit={openEditor}
                  onShow={openPreview}
                  onToggle={toggleActive}
                  onPlaySound={playCardSound}
                  menuOpen={menuFor === reward.id}
                  onMenu={setMenuFor}
                  onCloseMenu={() => setMenuFor(null)}
                />
              ))}
              {!visible.length && <div className="empty">Нет наград по этому фильтру</div>}
            </div>
          ) : (
            <div className="list">
              {visible.map((reward) => (
                <RewardRow
                  key={reward.id}
                  reward={reward}
                  onEdit={openEditor}
                  onShow={openPreview}
                  onPlaySound={playCardSound}
                  menuOpen={menuFor === reward.id}
                  onMenu={setMenuFor}
                  onCloseMenu={() => setMenuFor(null)}
                />
              ))}
            </div>
          )}

          <footer className="foot">
            <span>Прототип «Комбинированные карточки» · демо-данные, без Tauri · {variant === 'A' ? 'A · Media-first' : 'B · Compact + редактор'}</span>
            <span>Звук в прототипе синтезируется в браузере; картинки — готовые примеры</span>
          </footer>
        </div>
      </div>

      {draft && (
        <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && setDraft(null)}>
          <div className={`modal modal--settings modal--${isB ? 'b' : 'a'} modal--${draft.mode}`} role="dialog" aria-modal="true" aria-labelledby="settings-title">
            <header className="modal__head">
              <div>
                <div className="eyebrow">НАСТРОЙКИ КАРТОЧКИ · {draft.cost} БАЛЛОВ · {MODE_LABEL[draft.mode].toUpperCase()}</div>
                <h2 className="modal__title" id="settings-title">{draft.name}</h2>
                <p className="modal__sub">Одна награда может играть звук, показывать картинки — или и то, и другое одновременно.</p>
              </div>
              <button className="icon-btn" onClick={() => setDraft(null)} aria-label="Закрыть"><Icon name="close" /></button>
            </header>

            <div className="mode-switch-wrap">
              <ModeSwitch draft={draft} setDraft={setDraft} />
            </div>

            <div className="settings-layout">
              {draft.mode !== 'sound' && <MediaGallery draft={draft} setDraft={setDraft} notify={notify} />}
              <div className="settings-preview">
                <div className="settings-preview__head">
                  <span>Предпросмотр</span>
                  <span className="settings-preview__hint">
                    {hasImage(draft) && hasSound(draft) ? 'звук + появление картинки'
                      : hasSound(draft) ? 'только звук' : hasImage(draft) ? 'только картинка' : 'нечего показывать'}
                  </span>
                </div>
                <PreviewStage reward={draft} auto autoSound={false} />
              </div>
              <div className="settings-side">
                {draft.mode !== 'image' && <SoundSection draft={draft} setDraft={setDraft} notify={notify} />}
                {draft.mode !== 'sound' && <Controls draft={draft} update={updateDraftSetting} advanced />}
              </div>
            </div>

            <footer className="modal__foot">
              <span className="modal__note">
                {draft.mode === 'sound'
                  ? `${draft.sound ? draft.sound.file : 'звук не выбран'} · громкость ${draft.sound?.volume ?? 0}%`
                  : `${draft.media.length} ${pluralPics(draft.media.length)} · ${draft.sound ? `звук ${draft.sound.file}` : 'без звука'} · ${MODE_LABEL[draft.mode]}`}
              </span>
              <button className="btn btn--ghost" onClick={() => setDraft(clone(rewards.find((r) => r.id === draft.id)))}>Сбросить</button>
              <button className="btn btn--secondary" onClick={() => setDraft(null)}>Отмена</button>
              <button className="btn btn--primary" data-testid="save-settings" onClick={saveDraft}>Сохранить</button>
            </footer>
          </div>
        </div>
      )}

      {previewReward && <PreviewModal reward={previewReward} onClose={() => setPreviewReward(null)} />}
      {toast && <div className="toast" role="status">{toast}</div>}
    </div>
  );
}
