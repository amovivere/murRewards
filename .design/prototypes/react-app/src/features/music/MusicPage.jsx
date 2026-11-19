import { useEffect, useRef, useState } from 'react';
import Button from '../../components/ui/Button.jsx';
import ConfirmModal from '../../components/ui/ConfirmModal.jsx';
import Icon from '../../components/ui/Icon.jsx';
import Modal from '../../components/ui/Modal.jsx';
import { Panel, Pill } from '../../components/ui/Panel.jsx';
import { Select, SliderRow, ToggleRow } from '../../components/ui/Field.jsx';

const MOCK_CURRENT = {
  title: 'ДИНАСТИЯ — Земляк',
  user_login: 'nix',
  duration_sec: 164,
  state: 'playing',
};

const SKIP_REASONS = [
  { id: 'wrong', label: 'Не та песня', hint: 'зритель ошибся с выбором' },
  { id: 'nosound', label: 'Нет звука / не загрузилась', hint: 'битый файл или тишина' },
  { id: 'rules', label: 'Нарушение правил', hint: 'нецензурная лексика, спам' },
  { id: 'broken', label: 'Ссылка не работает', hint: 'видео удалено или закрыто' },
];

const SCENES_KEY = 'rs.music.scenes';
const DEFAULT_SCENES = [
  { id: 'stream', name: 'Стрим', patch: { enabled: true, maxQueue: 10, maxDurationSec: 480, requestCooldownSec: 0, autodj: false } },
  { id: 'requests', name: 'Только заявки', patch: { enabled: true, maxQueue: 8, maxDurationSec: 300, requestCooldownSec: 60, autodj: false } },
  { id: 'break', name: 'Перерыв', patch: { enabled: true, maxQueue: 10, maxDurationSec: 600, requestCooldownSec: 0, autodj: true } },
];

function loadScenes() {
  try {
    const raw = localStorage.getItem(SCENES_KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    /* ignore */
  }
  return DEFAULT_SCENES;
}

function MusicSettingsModal({ open, music, onClose, onSave, backend }) {
  const [maxQueue, setMaxQueue] = useState(10);
  const [maxDuration, setMaxDuration] = useState(15);
  const [overlaySeconds, setOverlaySeconds] = useState(0);
  const [autoplay, setAutoplay] = useState(true);
  const [prefetch, setPrefetch] = useState(true);
  const [pauseYandex, setPauseYandex] = useState(true);
  const [restoreQueue, setRestoreQueue] = useState(true);
  const [cooldown, setCooldown] = useState(0);
  const [blocked, setBlocked] = useState('');
  const [autodj, setAutodj] = useState(false);
  const [autodjShuffle, setAutodjShuffle] = useState(false);
  const [autodjPlaylist, setAutodjPlaylist] = useState('');
  const [cookiesFile, setCookiesFile] = useState('');
  const [cookiesOk, setCookiesOk] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open || !music) return;
    setMaxQueue(music.max_queue || 10);
    setMaxDuration(Math.round((music.max_duration_sec || 900) / 60));
    setOverlaySeconds(music.overlay_seconds || 0);
    setAutoplay(music.enabled !== false);
    setPrefetch(music.prefetch !== false);
    setPauseYandex(music.pause_yandex !== false);
    setRestoreQueue(music.restore_queue !== false);
    setCooldown(music.request_cooldown_sec || 0);
    setBlocked((music.blocked_videos || []).join('\n'));
    setAutodj(Boolean(music.autodj));
    setAutodjShuffle(Boolean(music.autodj_shuffle));
    setAutodjPlaylist((music.autodj_playlist || []).join('\n'));
    setCookiesFile(music.cookies_file || '');
    setCookiesOk(null);
    if (music.cookies_file) {
      backend?.invoke('check_ytdlp_cookies', { path: music.cookies_file })
        .then((ok) => setCookiesOk(Boolean(ok)))
        .catch(() => setCookiesOk(false));
    }
    // Намеренно только при открытии: фоновый поллинг не должен перетирать форму.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  async function submit() {
    setSaving(true);
    try {
      await onSave({
        maxQueue,
        maxDurationSec: maxDuration * 60,
        overlaySeconds,
        prefetch,
        pauseYandex,
        restoreQueue,
        enabled: autoplay,
        requestCooldownSec: cooldown,
        blockedVideos: blocked.split(/[\n,]+/).map((id) => id.trim()).filter(Boolean),
        autodj,
        autodjShuffle,
        autodjPlaylist: autodjPlaylist.split(/[\n,]+/).map((url) => url.trim()).filter(Boolean),
        cookiesFile,
      });
      onClose();
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Настройки музыки"
      subtitle="Очередь, длительность и поведение треков по заявке."
      width={600}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Отмена</Button>
          <Button variant="primary" onClick={submit} disabled={saving}>{saving ? 'Сохраняем…' : 'Сохранить'}</Button>
        </>
      }
    >
      <div className="modal-form">
        <div className="slider-list">
          <SliderRow label="Треков в очереди" value={maxQueue} min={1} max={30} onChange={setMaxQueue} />
          <SliderRow label="Макс. длительность" value={maxDuration} min={1} max={60} unit=" мин" onChange={setMaxDuration} />
          <SliderRow label="Оверлей после старта" value={overlaySeconds} min={0} max={60} unit=" с" onChange={setOverlaySeconds} />
          <SliderRow label="Кулдаун заявок" value={cooldown} min={0} max={600} step={5} unit=" с" onChange={setCooldown} />
        </div>
        <div className="switch-list">
          <ToggleRow label="Играть сразу после активации" checked={autoplay} onChange={setAutoplay} trailing={autoplay ? 'вкл' : 'выкл'} />
          <ToggleRow label="Предзагрузка следующего трека" checked={prefetch} onChange={setPrefetch} trailing={prefetch ? 'вкл' : 'выкл'} />
          <ToggleRow label="Пауза Яндекс Музыки" checked={pauseYandex} onChange={setPauseYandex} trailing={pauseYandex ? 'вкл' : 'выкл'} />
          <ToggleRow label="Восстанавливать очередь" checked={restoreQueue} onChange={setRestoreQueue} trailing={restoreQueue ? 'вкл' : 'выкл'} />
          <ToggleRow label="AutoDJ при пустой очереди" checked={autodj} onChange={setAutodj} trailing={autodj ? 'вкл' : 'выкл'} />
          <ToggleRow label="Перемешивать плейлист AutoDJ" checked={autodjShuffle} onChange={setAutodjShuffle} trailing={autodjShuffle ? 'вкл' : 'выкл'} />
        </div>
        {autodj ? (
          <label className="modal-field">
            <span>ПЛЕЙЛИСТ AUTODJ</span>
            <textarea
              className="ui-input modal-textarea"
              value={autodjPlaylist}
              placeholder="Ссылки YouTube, по одной на строку"
              onChange={(event) => setAutodjPlaylist(event.target.value)}
            />
            <div className="modal-hint">Когда очередь пуста, приложение включит следующий трек из этого списка.</div>
          </label>
        ) : null}
        <div className="modal-hint">Оверлей показывается только когда играет трек.</div>
        <label className="modal-field">
          <span>БЛОК-ЛИСТ ВИДЕО</span>
          <textarea
            className="ui-input modal-textarea"
            value={blocked}
            placeholder="ID видео YouTube, по одному на строку (например dQw4w9WgXcQ)"
            onChange={(event) => setBlocked(event.target.value)}
          />
          <div className="modal-hint">Заблокированные видео не принимаются в очередь.</div>
        </label>
        <label className="modal-field">
          <span>COOKIES YOUTUBE</span>
          <div className="inline-row">
            <input
              className="ui-input is-mono"
              value={cookiesFile}
              placeholder="cookies.txt — нужен для видео 18+"
              onChange={(event) => {
                setCookiesFile(event.target.value);
                setCookiesOk(null);
              }}
            />
            <Button
              variant="secondary"
              onClick={async () => {
                try {
                  const path = await backend?.invoke('choose_ytdlp_cookies');
                  if (!path) return;
                  setCookiesFile(path);
                  const ok = await backend?.invoke('check_ytdlp_cookies', { path });
                  setCookiesOk(Boolean(ok));
                } catch (error) {
                  // отмена выбора — не ошибка
                }
              }}
            >
              Выбрать…
            </Button>
          </div>
          {cookiesOk === false ? (
            <div className="modal-hint is-warn">
              В этом файле нет входа в YouTube. Откройте youtube.com под аккаунтом,
              экспортируйте cookies заново и выберите файл. В нём должны быть cookie
              домена .youtube.com (SID, HSID и т.п.), а не только google.com.
            </div>
          ) : cookiesOk === true ? (
            <div className="modal-hint is-ok">В файле найден вход в YouTube.</div>
          ) : null}
          {cookiesOk === null ? (
            <div className="modal-hint">
              Для видео 18+ экспортируйте cookies.txt из браузера, где выполнен вход в YouTube
              (например, расширением «Get cookies.txt LOCALLY»), и выберите файл здесь.
            </div>
          ) : null}
        </label>
      </div>
    </Modal>
  );
}

function ObsModal({ open, music, onClose, onSave, onShow }) {
  const [seconds, setSeconds] = useState(0);
  const [font, setFont] = useState(17);
  const [position, setPosition] = useState('top');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!open || !music) return;
    setSeconds(music.overlay_seconds || 0);
    setFont(music.overlay_font || 17);
    setPosition(music.overlay_position || 'top');
    // Намеренно только при открытии: фоновый поллинг не должен перетирать форму.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  function copy() {
    navigator.clipboard?.writeText('http://127.0.0.1:8770/overlay').catch(() => {});
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="OBS — строка «Сейчас играет»"
      subtitle="Источник «Браузер» 1920×200–300. «Обновлять при активации» лучше выключить."
      width={620}
      footer={
        <>
          <Button variant="ghost" onClick={copy} icon={<Icon name="copy" />}>
            {copied ? 'Скопировано' : 'Скопировать URL'}
          </Button>
          <Button variant="secondary" onClick={onClose}>Закрыть</Button>
          <Button variant="primary" onClick={async () => { await onSave({ overlaySeconds: seconds, overlayFont: font, overlayPosition: position }); await onShow(); onClose(); }}>
            Показать сейчас
          </Button>
        </>
      }
    >
      <div className="modal-form">
        <div className="obs-url-box"><code>http://127.0.0.1:8770/overlay</code></div>
        <div className="control-grid">
          <label className="modal-field">
            <span>ПОЛОЖЕНИЕ</span>
            <Select value={position} onChange={setPosition}>
              <option value="top">Сверху</option>
              <option value="bottom">Снизу</option>
            </Select>
          </label>
          <label className="modal-field">
            <span>РАЗМЕР ШРИФТА</span>
            <input className="ui-input" type="number" value={font} onChange={(event) => setFont(Number(event.target.value) || 17)} />
          </label>
        </div>
        <div className="slider-list">
          <SliderRow label="Секунд после старта" value={seconds} min={0} max={60} unit=" с" onChange={setSeconds} />
        </div>
        <div className="modal-hint">0 — показывать всё время, пока играет трек.</div>
      </div>
    </Modal>
  );
}

function formatTime(total) {
  const value = Math.max(0, Number(total) || 0);
  return `${Math.floor(value / 60)}:${String(Math.floor(value % 60)).padStart(2, '0')}`;
}

function itemState(item) {
  if (item.state === 'playing') return { label: 'играет', tone: 'ok' };
  if (item.state === 'failed' || item.state === 'error') return { label: 'ошибка', tone: 'error' };
  if (item.state === 'skipped' || item.state === 'cancelled') return { label: 'пропущен', tone: 'muted' };
  if (item.prefetched) return { label: 'готов', tone: 'ok' };
  return { label: 'в очереди', tone: 'muted' };
}

export default function MusicPage({ backend }) {
  const [musicOpen, setMusicOpen] = useState(false);
  const [obsOpen, setObsOpen] = useState(false);
  const [clearOpen, setClearOpen] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [removeTarget, setRemoveTarget] = useState(null);
  const [skipOpen, setSkipOpen] = useState(false);
  const [skipReason, setSkipReason] = useState('wrong');
  const [blockCurrent, setBlockCurrent] = useState(false);
  const [optimisticPaused, setOptimisticPaused] = useState(null);
  const [undoVisible, setUndoVisible] = useState(false);
  const [scenes, setScenes] = useState(loadScenes);
  const [sceneName, setSceneName] = useState('');
  const [toast, setToast] = useState('');
  const undoTimer = useRef(null);
  const [url, setUrl] = useState(() => sessionStorage.getItem('rs.music.url') || '');

  useEffect(() => {
    sessionStorage.setItem('rs.music.url', url);
  }, [url]);

  const real = Boolean(backend?.available && backend.view);
  const music = backend?.view?.music;
  const current = real ? music?.current : MOCK_CURRENT;
  const player = real
    ? music?.player || { position_sec: 0, duration_sec: 0, paused: false, loaded: false }
    : { position_sec: 58, duration_sec: 164, paused: false, loaded: true };
  const items = real ? music?.items || [] : [];
  const duration = player.duration_sec || current?.duration_sec || 0;
  const progress = duration ? Math.min(100, (player.position_sec / duration) * 100) : 0;
  const nextItem = items.find((item) => item.id !== current?.id && item.state === 'queued')
    || items.find((item) => item.id !== current?.id);
  const queuedCount = items.filter((item) => item.state === 'queued').length;
  const playedCount = items.filter((item) => item.state === 'done').length;
  const skippedCount = items.filter((item) => item.state === 'skipped').length;
  const failedCount = items.filter((item) => item.state === 'failed').length;
  const paused = optimisticPaused ?? player.paused;
  const autoDjReady = Boolean(music?.autodj && (music.autodj_playlist || []).length > 0);

  useEffect(() => {
    if (optimisticPaused === null) return undefined;
    if (player.paused === optimisticPaused) {
      setOptimisticPaused(null);
      return undefined;
    }
    const timer = window.setTimeout(() => setOptimisticPaused(null), 2500);
    return () => window.clearTimeout(timer);
  }, [player.paused, optimisticPaused]);
  const [volume, setVolume] = useState(() => Math.round((music?.volume ?? 0.7) * 100));
  const volumeTouched = useRef(0);
  const volumeTimer = useRef(null);

  useEffect(() => {
    if (Date.now() - volumeTouched.current < 1200) return;
    setVolume(Math.round((music?.volume ?? 0.7) * 100));
  }, [music?.volume]);

  useEffect(() => {
    return () => window.clearTimeout(volumeTimer.current);
  }, []);

  function changeMusicVolume(next) {
    const value = Math.max(0, Math.min(100, Number(next) || 0));
    volumeTouched.current = Date.now();
    setVolume(value);
    window.clearTimeout(volumeTimer.current);
    volumeTimer.current = window.setTimeout(() => {
      if (real) backend.call('music_set_volume', { volume: value / 100 }).catch((error) => notify(String(error)));
    }, 100);
  }

  function notify(message) {
    setToast(message);
    window.setTimeout(() => setToast(''), 2200);
  }

  async function action(command, args = {}) {
    if (!real) {
      notify('Действие доступно в приложении');
      return;
    }
    try {
      await backend.call(command, args);
      if (command === 'music_skip') notify('Трек пропущен');
      if (command === 'music_show_overlay') notify('Оверлей показан');
    } catch (error) {
      notify(String(error));
    }
  }

  async function retryItem(item) {
    await action('music_retry_item', { redemptionId: item.id });
    notify('Заявка возвращена в очередь');
  }

  async function startAutoDj() {    if (!music?.autodj) {
      notify('AutoDJ выключен — включите его в настройках музыки');
      return;
    }
    const playlist = (music.autodj_playlist || []).filter(Boolean);
    if (!playlist.length) {
      notify('Добавьте ссылки в плейлист AutoDJ');
      return;
    }
    if (!real) {
      notify('AutoDJ запущен (прототип)');
      return;
    }
    try {
      await backend.call('music_start_autodj');
      notify('AutoDJ запущен — очередь пуста, играет плейлист');
    } catch (error) {
      notify(String(error));
    }
  }

  async function stopAutoDj() {
    if (!real) {
      notify('AutoDJ остановлен (прототип)');
      return;
    }
    try {
      await backend.call('music_stop_autodj');
      notify('AutoDJ остановлен');
    } catch (error) {
      notify(String(error));
    }
  }

  async function togglePause() {
    if (!current) {
      await startAutoDj();
      return;
    }
    const next = !paused;
    setOptimisticPaused(next);
    if (!real) {
      notify(next ? 'Пауза' : 'Воспроизведение продолжено');
      return;
    }
    try {
      await backend.call('music_toggle_pause');
    } catch (error) {
      setOptimisticPaused(null);
      notify(String(error));
    }
  }

  async function addManual() {
    const link = url.trim();
    if (!link) return;
    if (!/^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)\//i.test(link)) {
      notify('Это не ссылка YouTube — проверьте адрес');
      return;
    }
    if (!real) {
      notify('Ссылка добавлена в очередь (прототип)');
      setUrl('');
      return;
    }
    try {
      await backend.call('music_add_manual', { url: link });
      setUrl('');
      notify('Ссылка принята — трек появится в очереди после проверки');
    } catch (error) {
      notify(String(error));
    }
  }

  async function clearQueue() {
    setClearing(true);
    try {
      await action('music_clear_queue');
      notify('Очередь очищена');
      setClearOpen(false);
    } finally {
      setClearing(false);
    }
  }

  async function removeItem() {
    if (!removeTarget) return;
    await action('music_remove_item', { id: removeTarget.id });
    setRemoveTarget(null);
  }

  function openYouTube() {
    if (!real) {
      notify('Открыть YouTube можно в приложении');
      return;
    }
    backend.invoke('open_url', { url: 'https://www.youtube.com/' }).catch((error) => notify(String(error)));
  }

  async function seek(event) {
    if (!real || !duration) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width));
    await action('music_seek', { sec: Math.round(ratio * duration) });
  }

  useEffect(() => {
    localStorage.setItem(SCENES_KEY, JSON.stringify(scenes));
  }, [scenes]);

  async function applyScene(scene) {
    if (!real) {
      notify(`Сцена «${scene.name}» (прототип)`);
      return;
    }
    try {
      await backend.call('set_music_settings', { patch: scene.patch });
      notify(`Сцена «${scene.name}» применена`);
    } catch (error) {
      notify(String(error));
    }
  }

  async function saveCurrentScene() {
    const name = sceneName.trim();
    if (!name) {
      notify('Введите название сцены');
      return;
    }
    const patch = {
      enabled: music?.enabled !== false,
      maxQueue: music?.max_queue || 10,
      maxDurationSec: music?.max_duration_sec || 480,
      requestCooldownSec: music?.request_cooldown_sec || 0,
      autodj: Boolean(music?.autodj),
      autodjShuffle: Boolean(music?.autodj_shuffle),
      autodjPlaylist: music?.autodj_playlist || [],
      blockedVideos: music?.blocked_videos || [],
    };
    setScenes((current) => [...current, { id: `scene-${Date.now()}`, name, patch }]);
    setSceneName('');
    notify(`Сцена «${name}» сохранена`);
  }


  async function nextTrack() {
    if (!nextItem) {
      notify('В очереди больше нет треков');
      return;
    }
    if (!real) {
      notify('Следующий трек (прототип)');
      return;
    }
    try {
      await backend.call('music_next');
      notify('Трек засчитан — включаю следующий');
    } catch (error) {
      notify(String(error));
    }
  }

  function openSkip() {
    setSkipReason('wrong');
    setBlockCurrent(false);
    setSkipOpen(true);
  }

  async function confirmSkip() {
    const reason = SKIP_REASONS.find((item) => item.id === skipReason) || SKIP_REASONS[0];
    const videoId = current?.video_id;
    await action('music_skip', { reason: reason.label });
    if (blockCurrent && real && videoId) {
      const blocked = Array.from(new Set([...(music?.blocked_videos || []), videoId]));
      await backend.call('set_music_settings', { patch: { blockedVideos: blocked } });
    }
    setSkipOpen(false);
    setUndoVisible(true);
    window.clearTimeout(undoTimer.current);
    undoTimer.current = window.setTimeout(() => setUndoVisible(false), 8000);
    notify(`Пропущено: ${reason.label.toLowerCase()} · баллы вернутся зрителю`);
  }

  async function undoSkip() {
    setUndoVisible(false);
    window.clearTimeout(undoTimer.current);
    if (!real) {
      notify('Пропуск отменён (прототип)');
      return;
    }
    try {
      await backend.call('music_undo_skip');
      notify('Пропуск отменён — трек вернулся в начало очереди');
    } catch (error) {
      notify(String(error));
    }
  }

  useEffect(() => {
    return () => window.clearTimeout(undoTimer.current);
  }, []);

  useEffect(() => {
    function onKeyDown(event) {
      const tag = (event.target?.tagName || '').toLowerCase();
      if (['input', 'textarea', 'select'].includes(tag) || document.querySelector('.ui-modal')) return;
      if (event.code === 'Space') {
        event.preventDefault();
        togglePause();
      } else if (event.shiftKey && event.key === 'ArrowRight') {
        event.preventDefault();
        nextTrack();
      } else if (event.key === 'ArrowRight') {
        event.preventDefault();
        if (duration) action('music_seek', { sec: Math.min(duration, player.position_sec + 5) });
      } else if (event.key === 'ArrowLeft') {
        event.preventDefault();
        if (duration) action('music_seek', { sec: Math.max(0, player.position_sec - 5) });
      } else if (event.key === 'ArrowUp') {
        event.preventDefault();
        changeMusicVolume(Math.min(100, volume + 5));
      } else if (event.key === 'ArrowDown') {
        event.preventDefault();
        changeMusicVolume(Math.max(0, volume - 5));
      } else if (event.key.toLowerCase() === 's') {
        event.preventDefault();
        openSkip();
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  });

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <div className="eyebrow">МУЗЫКА · YOUTUBE</div>
          <h1 className="page-title">Музыка</h1>
          <p className="page-subtitle">Треки по заявке из чата · команда !трек</p>
        </div>
        <div className="page-actions">
          <Button variant="secondary" icon={<Icon name="external" />} onClick={openYouTube}>Открыть YouTube</Button>
          <Button variant="secondary" onClick={() => setMusicOpen(true)}>Настроить музыку</Button>
        </div>
      </div>

      <div className="music-layout">
      <section className="music-stage">
        <div className={`music-stage__cover${paused || !current ? ' is-paused' : ''}`}>
          <div className="music-stage__vinyl"><Icon name="music" size={34} /></div>
          <div className="music-stage__eq" aria-hidden="true">
            <i /><i /><i /><i /><i />
          </div>
        </div>

        <div className="music-stage__body">
          <div className="eyebrow">СЕЙЧАС ИГРАЕТ</div>
          <h2 className="music-stage__title">{current?.title || 'Ничего не играет'}</h2>
          <div className="music-stage__meta">
            {current ? `@${current.user_login} · YouTube · ${formatTime(duration)}` : 'Активируй награду-музыку или добавь ссылку вручную'}
          </div>

          <div className="music-stage__progress">
            <span>{formatTime(player.position_sec)}</span>
            <div
              className="progress-track"
              role="slider"
              aria-label="Перемотка трека"
              aria-valuemin={0}
              aria-valuemax={duration}
              aria-valuenow={player.position_sec}
              tabIndex={0}
              onClick={seek}
              onKeyDown={(event) => {
                if (event.key === 'ArrowRight') action('music_seek', { sec: Math.min(duration, player.position_sec + 5) });
                if (event.key === 'ArrowLeft') action('music_seek', { sec: Math.max(0, player.position_sec - 5) });
              }}
            >
              <div className="progress-fill" style={{ width: `${progress}%` }} />
              <div className="progress-knob" style={{ left: `${progress}%` }} />
            </div>
            <span>{formatTime(duration)}</span>
          </div>

          <div className="music-transport">
            <Button
              variant="primary"
              size="lg"
              icon={<Icon name={!current || paused ? 'play' : 'pause'} size={20} />}
              onClick={togglePause}
              disabled={!current && !(autoDjReady && queuedCount === 0)}
              title={!current ? 'Запустить AutoDJ' : undefined}
            >
              {!current ? 'Play' : paused ? 'Продолжить' : 'Пауза'}
            </Button>
            <Button variant="secondary" size="lg" icon={<Icon name="next" size={18} />} onClick={nextTrack} disabled={!current || !nextItem}>
              Следующий трек
            </Button>
            <Button variant="danger-ghost" size="lg" onClick={openSkip} disabled={!current}>
              Пропустить…
            </Button>
            {music?.autodj_active ? (
              <Button variant="danger-ghost" size="lg" onClick={stopAutoDj}>Остановить AutoDJ</Button>
            ) : null}
            <div className="music-transport__volume">
              <Icon name="volume" size={16} />
              <input
                className="ui-range"
                type="range"
                min={0}
                max={100}
                step={1}
                value={volume}
                aria-label="Громкость музыки"
                onChange={(event) => changeMusicVolume(event.target.value)}
              />
              <span>{volume}%</span>
            </div>
          </div>

          <div className="music-stage__hints">
            <span><kbd>Space</kbd> пауза</span>
            <span><kbd>Shift</kbd> + <kbd>→</kbd> следующий</span>
            <span><kbd>S</kbd> пропустить с причиной</span>
          </div>
        </div>
      </section>

      <div className="two-col">
        <Panel
          title="Очередь"
          description={`${queuedCount} в очереди · ${items.length} всего`}
          actions={<Button variant="danger-ghost" size="sm" disabled={items.length === 0} onClick={() => setClearOpen(true)}>Очистить</Button>}
        >
          {items.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state__title">Очередь пуста</div>
              <div className="empty-state__hint">Ссылка из активации награды появится здесь.</div>
            </div>
          ) : (
            <div className="queue-list">
              {items.map((item, index) => (
                <div className="queue-row" key={item.id}>
                  <span className="queue-index">{index + 1}</span>
                  <div className="queue-info">
                    <div className="queue-title">{item.title}</div>
                    <div className="queue-meta">@{item.user_login} · {formatTime(item.duration_sec)}</div>
                  </div>
                  <span className={`queue-state queue-state--${itemState(item).tone}`}>{itemState(item).label}</span>
                  {item.state === 'failed' ? (
                    <button className="icon-ghost" title="Повторить заявку" aria-label="Повторить заявку" onClick={() => retryItem(item)}>↻</button>
                  ) : null}
                  <button className="icon-ghost" title="Выше" aria-label="Поднять трек выше" disabled={index === 0} onClick={() => action('music_move_up', { id: item.id })}>↑</button>
                  <button className="icon-ghost" title="Убрать с возвратом баллов" aria-label="Убрать трек из очереди, вернуть баллы" onClick={() => setRemoveTarget(item)}>×</button>
                </div>
              ))}
            </div>
          )}
          <div className="queue-input">
            <Icon name="plus" />
            <input
              aria-label="Ссылка YouTube для очереди"
              placeholder="Вставьте ссылку YouTube и нажмите Enter — трек встанет в очередь"
              value={url}
              onChange={(event) => setUrl(event.target.value)}
              onKeyDown={(event) => event.key === 'Enter' && addManual()}
            />
            <Button variant="secondary" size="sm" onClick={addManual}>В очередь</Button>
          </div>
        </Panel>

        <div className="stack">
          <Panel title="Правила и модерация">
            <div className="rules-row">
              <span className="rules-row__icon">→</span>
              <div>
                <div className="rules-row__title">Следующий трек</div>
                <div className="rules-row__hint">Трек засчитывается, баллы не возвращаются. Просто переход по эфиру.</div>
              </div>
            </div>
            <div className="rules-row">
              <span className="rules-row__icon is-danger">⏭</span>
              <div>
                <div className="rules-row__title">Пропустить с причиной</div>
                <div className="rules-row__hint">Заявка отменяется, баллы возвращаются зрителю, причина попадает в журнал.</div>
              </div>
            </div>
            <div className="rules-hotkeys">
              <span><kbd>Space</kbd> пауза</span>
              <span><kbd>Shift</kbd>+<kbd>→</kbd> следующий</span>
              <span><kbd>S</kbd> пропуск</span>
              <span><kbd>↑</kbd>/<kbd>↓</kbd> громкость</span>
            </div>
          </Panel>

          <Panel title="Статистика эфира">
            <div className="music-stats">
              <div className="music-stat">
                <strong>{playedCount}</strong>
                <span>сыграно</span>
              </div>
              <div className="music-stat">
                <strong>{skippedCount}</strong>
                <span>пропущено</span>
              </div>
              <div className="music-stat">
                <strong>{failedCount}</strong>
                <span>ошибок</span>
              </div>
            </div>
            <div className="muted-line">
              Блок-лист: {music?.blocked_videos?.length || 0} · кулдаун: {music?.request_cooldown_sec || 0} с
            </div>
          </Panel>

          <Panel title="Сцены">
            <div className="scene-list">
              {scenes.map((scene) => (
                <button key={scene.id} type="button" className="scene-chip" onClick={() => applyScene(scene)}>
                  {scene.name}
                </button>
              ))}
            </div>
            <div className="inline-row scene-save">
              <input
                className="ui-input"
                value={sceneName}
                placeholder="Название сцены"
                onChange={(event) => setSceneName(event.target.value)}
                onKeyDown={(event) => event.key === 'Enter' && saveCurrentScene()}
              />
              <Button variant="secondary" size="sm" onClick={saveCurrentScene}>Сохранить</Button>
            </div>
            <div className="modal-hint">Сцена применяет лимиты, кулдаун, блок-лист и AutoDJ.</div>
          </Panel>

          <Panel title="OBS — строка «Сейчас играет»" actions={<Button variant="ghost" size="sm" onClick={() => setObsOpen(true)}>Настроить</Button>}>
            <div className="inline-row">
              <code className="url-code">http://127.0.0.1:8770/overlay</code>
              <Button variant="secondary" size="sm" onClick={() => action('music_show_overlay')}>Показать сейчас</Button>
            </div>
            <div className="muted-line">{current ? 'Строка играет' : 'Ничего не играет'}</div>
          </Panel>

          <Panel title="Состояние">
            <ul className="check-list">
              <li><span className="dot dot--ok" /> yt-dlp {real ? music?.ytdlp_version || '—' : '2026.10.26'} — готов</li>
              <li><span className={`dot ${real ? (music?.chat_online ? 'dot--ok' : 'dot--warn') : 'dot--ok'}`} /> !трек: команда {real ? (music?.chat_online ? 'включена' : 'ожидает канал') : 'включена'}</li>
              <li><span className="dot dot--ok" /> Оверлей: {real ? (music?.overlay_ready ? 'готов' : 'не поднят') : 'готов'}</li>
            </ul>
          </Panel>
        </div>
      </div>
      </div>

      <Modal
        open={skipOpen}
        onClose={() => setSkipOpen(false)}
        title="Пропустить заявку?"
        subtitle={current ? `«${current.title}» будет снят с эфира.` : 'Текущая заявка будет снята.'}
        width={520}
        footer={
          <>
            <Button variant="secondary" onClick={() => setSkipOpen(false)}>Отмена</Button>
            <Button variant="danger" onClick={confirmSkip}>Пропустить и вернуть баллы</Button>
          </>
        }
      >
        <div className="skip-reasons">
          {SKIP_REASONS.map((reason) => (
            <label key={reason.id} className={`skip-reason${skipReason === reason.id ? ' is-active' : ''}`}>
              <input type="radio" name="skip-reason" checked={skipReason === reason.id} onChange={() => setSkipReason(reason.id)} />
              <span>
                <strong>{reason.label}</strong>
                <small>{reason.hint}</small>
              </span>
            </label>
          ))}
        </div>
        <label className="modal-check">
          <input type="checkbox" checked={blockCurrent} onChange={(event) => setBlockCurrent(event.target.checked)} />
          <span>Добавить видео в блок-лист, чтобы его больше не заказывали</span>
        </label>
        <div className="modal-hint">Баллы вернутся зрителю, событие попадёт в журнал.</div>
      </Modal>

      <MusicSettingsModal
        open={musicOpen}
        music={music}
        backend={backend}
        onClose={() => setMusicOpen(false)}
        onSave={async (patch) => {
          if (!real) {
            notify('Настройки сохранены (прототип)');
            return;
          }
          await backend.call('set_music_settings', { patch });
          notify('Настройки музыки сохранены');
        }}
      />
      <ObsModal
        open={obsOpen}
        music={music}
        onClose={() => setObsOpen(false)}
        onSave={async (patch) => {
          if (!real) return;
          await backend.call('set_music_settings', { patch });
        }}
        onShow={() => action('music_show_overlay')}
      />
      <ConfirmModal
        open={clearOpen}
        title="Очистить очередь?"
        text="Все заявки будут сняты, а баллы зрителей вернутся. Текущий трек продолжит играть."
        confirmLabel="Очистить очередь"
        danger
        busy={clearing}
        onClose={() => setClearOpen(false)}
        onConfirm={clearQueue}
      />
      <ConfirmModal
        open={Boolean(removeTarget)}
        title="Убрать трек из очереди?"
        text={removeTarget ? `«${removeTarget.title}» будет удалён из очереди, баллы вернутся зрителю.` : ''}
        confirmLabel="Убрать и вернуть баллы"
        danger
        onClose={() => setRemoveTarget(null)}
        onConfirm={removeItem}
      />
      {undoVisible ? (
        <div className="ui-toast ui-toast--action" role="status" aria-live="polite">
          <span>Трек пропущен, баллы вернутся</span>
          <button type="button" onClick={undoSkip}>Отменить</button>
        </div>
      ) : toast ? <div className="ui-toast" role="status" aria-live="polite">{toast}</div> : null}
    </div>
  );
}
