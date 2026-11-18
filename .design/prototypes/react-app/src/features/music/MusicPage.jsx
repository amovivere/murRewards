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

function MusicSettingsModal({ open, music, onClose, onSave, backend }) {
  const [maxQueue, setMaxQueue] = useState(10);
  const [maxDuration, setMaxDuration] = useState(15);
  const [overlaySeconds, setOverlaySeconds] = useState(0);
  const [autoplay, setAutoplay] = useState(true);
  const [prefetch, setPrefetch] = useState(true);
  const [pauseYandex, setPauseYandex] = useState(true);
  const [restoreQueue, setRestoreQueue] = useState(true);
  const [cookiesFile, setCookiesFile] = useState('');
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
    setCookiesFile(music.cookies_file || '');
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
        </div>
        <div className="switch-list">
          <ToggleRow label="Играть сразу после активации" checked={autoplay} onChange={setAutoplay} trailing={autoplay ? 'вкл' : 'выкл'} />
          <ToggleRow label="Предзагрузка следующего трека" checked={prefetch} onChange={setPrefetch} trailing={prefetch ? 'вкл' : 'выкл'} />
          <ToggleRow label="Пауза Яндекс Музыки" checked={pauseYandex} onChange={setPauseYandex} trailing={pauseYandex ? 'вкл' : 'выкл'} />
          <ToggleRow label="Восстанавливать очередь" checked={restoreQueue} onChange={setRestoreQueue} trailing={restoreQueue ? 'вкл' : 'выкл'} />
        </div>
        <div className="modal-hint">Оверлей показывается только когда играет трек.</div>
        <label className="modal-field">
          <span>COOKIES YOUTUBE</span>
          <div className="inline-row">
            <input
              className="ui-input is-mono"
              value={cookiesFile}
              placeholder="cookies.txt — нужен для видео 18+"
              onChange={(event) => setCookiesFile(event.target.value)}
            />
            <Button
              variant="secondary"
              onClick={async () => {
                try {
                  const path = await backend?.invoke('choose_ytdlp_cookies');
                  if (path) setCookiesFile(path);
                } catch (error) {
                  // отмена выбора — не ошибка
                }
              }}
            >
              Выбрать…
            </Button>
          </div>
          <div className="modal-hint">
            Для видео 18+ экспортируйте cookies.txt из браузера, где выполнен вход в YouTube
            (например, расширением «Get cookies.txt LOCALLY»), и выберите файл здесь.
          </div>
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

export default function MusicPage({ backend }) {
  const [musicOpen, setMusicOpen] = useState(false);
  const [obsOpen, setObsOpen] = useState(false);
  const [clearOpen, setClearOpen] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [removeTarget, setRemoveTarget] = useState(null);
  const [toast, setToast] = useState('');
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
      if (command === 'music_toggle_pause') notify(player.paused ? 'Воспроизведение продолжено' : 'Пауза');
      if (command === 'music_skip') notify('Трек пропущен');
      if (command === 'music_show_overlay') notify('Оверлей показан');
    } catch (error) {
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

      <Panel
        title="Сейчас играет"
        description={current ? `${current.title} · заказал @${current.user_login} · YouTube` : 'Ничего не играет'}
        actions={<Pill tone={real && music?.ready ? 'ok' : 'neutral'}>{real && music?.ready ? 'готово' : 'ожидание'}</Pill>}
      >
        {current ? (
          <div className="player">
            <div className="player__cover"><Icon name="music" size={26} /></div>
            <div className="player__main">
              <div className="player__title-row">
                <div>
                  <div className="player__track">{current.title}</div>
                  <div className="player__meta">@{current.user_login} · YouTube · {formatTime(duration)}</div>
                </div>
                <div className="player__controls">
                  <Button
                    variant="secondary"
                    size="md"
                    icon={<Icon name={player.paused ? 'play' : 'pause'} size={18} />}
                    aria-label={player.paused ? 'Продолжить' : 'Пауза'}
                    title={player.paused ? 'Продолжить' : 'Пауза'}
                    onClick={() => action('music_toggle_pause')}
                  />
                  <Button variant="secondary" size="md" icon={<Icon name="next" size={18} />} aria-label="Следующий трек" title="Следующий трек" onClick={() => action('music_skip')} />
                  <Button variant="ghost" size="md" onClick={() => action('music_skip')}>Пропустить трек</Button>
                </div>
              </div>
              <div className="player__bottom">
                <div className="player__progress">
                  <span>{formatTime(player.position_sec)}</span>
                  <div className="progress-track" role="slider" aria-label="Перемотка трека" aria-valuemin={0} aria-valuemax={duration} aria-valuenow={player.position_sec} tabIndex={0} onClick={seek} onKeyDown={(event) => {
                    if (event.key === 'ArrowRight') action('music_seek', { sec: Math.min(duration, player.position_sec + 5) });
                    if (event.key === 'ArrowLeft') action('music_seek', { sec: Math.max(0, player.position_sec - 5) });
                  }}>
                    <div className="progress-fill" style={{ width: `${progress}%` }} />
                    <div className="progress-knob" style={{ left: `${progress}%` }} />
                  </div>
                  <span>{formatTime(duration)}</span>
                </div>
                <div className="player__volume">
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
            </div>
          </div>
        ) : (
          <div className="empty-state">
            <div className="empty-state__title">Ничего не играет</div>
            <div className="empty-state__hint">Активируй награду-музыку или добавь ссылку вручную.</div>
          </div>
        )}
      </Panel>

      <div className="two-col">
        <Panel
          title="Очередь"
          description={`${items.length} из ${music?.max_queue || 10}`}
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
                    <div className="queue-meta">@{item.user_login} · {formatTime(item.duration_sec)} · {item.state}</div>
                  </div>
                  <button className="icon-ghost" title="Выше" aria-label="Поднять трек выше" disabled={index === 0} onClick={() => action('music_move_up', { id: item.id })}>↑</button>
                  <button className="icon-ghost" title="Убрать" aria-label="Убрать трек из очереди" onClick={() => setRemoveTarget(item)}>×</button>
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
        text={removeTarget ? `«${removeTarget.title}» будет удалён из очереди.` : ''}
        confirmLabel="Убрать"
        danger
        onClose={() => setRemoveTarget(null)}
        onConfirm={removeItem}
      />
      {toast ? <div className="ui-toast" role="status" aria-live="polite">{toast}</div> : null}
    </div>
  );
}
