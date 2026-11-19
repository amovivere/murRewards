import { useEffect, useMemo, useRef, useState } from 'react';
import Button from '../../components/ui/Button.jsx';
import Icon from '../../components/ui/Icon.jsx';
import Modal from '../../components/ui/Modal.jsx';
import { Panel, Pill } from '../../components/ui/Panel.jsx';
import {
  ColorField,
  Field,
  Select,
  SliderRow,
  TagInput,
  TextInput,
  ToggleRow,
} from '../../components/ui/Field.jsx';
import { clone, DEFAULT_STATE, normalizeState } from './overlayData.js';
import { inTauri, invoke } from '../../lib/backend.js';

const STORAGE_KEY = 'rs-react-overlay-settings';
const PREVIEW_URL = inTauri
  ? 'http://127.0.0.1:8770/chat-overlay?preview=1&bg=1&demo=1'
  : './overlay.html?preview=1&bg=1&demo=1';

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return normalizeState(JSON.parse(raw));
  } catch {
    /* ignore */
  }
  return clone(DEFAULT_STATE);
}

function uid() {
  return `preset-${Date.now().toString(36)}`;
}

function MusicOverlaySection({ backend, notify }) {
  const real = Boolean(backend?.available && backend?.view);
  const music = backend?.view?.music;
  const current = music?.current;
  const [seconds, setSeconds] = useState(music?.overlay_seconds ?? 10);
  const [font, setFont] = useState(music?.overlay_font ?? 17);
  const [position, setPosition] = useState(music?.overlay_position || 'top');
  const [saving, setSaving] = useState(false);
  const url = 'http://127.0.0.1:8770/overlay';

  useEffect(() => {
    setSeconds(music?.overlay_seconds ?? 10);
    setFont(music?.overlay_font ?? 17);
    setPosition(music?.overlay_position || 'top');
  }, [music?.overlay_seconds, music?.overlay_font, music?.overlay_position]);

  async function save() {
    if (!real) {
      notify('Настройки сохранены (прототип)');
      return;
    }
    setSaving(true);
    try {
      await backend.call('set_music_settings', {
        patch: { overlaySeconds: seconds, overlayFont: font, overlayPosition: position },
      });
      notify('Настройки оверлея музыки сохранены');
    } catch (error) {
      notify(String(error));
    } finally {
      setSaving(false);
    }
  }

  async function show() {
    if (!real) {
      notify('Оверлей показан (прототип)');
      return;
    }
    try {
      await backend.call('music_show_overlay');
      notify('Строка «Сейчас играет» показана в OBS');
    } catch (error) {
      notify(String(error));
    }
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      notify('URL для OBS скопирован');
    } catch {
      notify(url);
    }
  }

  return (
    <div className="overlay-music-tab">
      <div className="overlay-layout">
        <div className="overlay-controls">
          <Panel
            title="Строка «Сейчас играет»"
            description="Второй оверлей для OBS: что играет и кто заказал."
            actions={<Pill tone={real && music?.ready ? 'ok' : 'neutral'}>{real && music?.ready ? 'готово' : 'ожидание'}</Pill>}
          >
            <div className="overlay-music-track">
              <div className="overlay-music-track__art"><Icon name="music" size={24} /></div>
              <div className="overlay-music-track__text">
                <div className="overlay-music-track__title">{current?.title || 'Сейчас ничего не играет'}</div>
                <div className="overlay-music-track__meta">
                  {current ? `@${current.user_login} · YouTube` : 'Строка появится, когда заиграет трек'}
                </div>
              </div>
              <Button variant="secondary" size="sm" onClick={show}>Показать сейчас</Button>
            </div>

            <div className="slider-list">
              <SliderRow label="Показывать после старта" value={seconds} min={0} max={60} unit=" с" onChange={setSeconds} />
            </div>
            <div className="control-grid">
              <Field label="Позиция на экране">
                <Select value={position} onChange={setPosition}>
                  <option value="top">Сверху</option>
                  <option value="bottom">Снизу</option>
                </Select>
              </Field>
              <Field label="Размер шрифта">
                <TextInput type="number" value={String(font)} onChange={(value) => setFont(Math.max(12, Math.min(48, Number(value) || 17)))} />
              </Field>
            </div>
            <div className="inline-row overlay-music-url">
              <code className="url-code">{url}</code>
              <Button variant="secondary" size="sm" icon={<Icon name="copy" />} onClick={copy}>Скопировать</Button>
            </div>
            <div className="modal-hint">0 секунд — показывать всё время, пока играет трек.</div>
            <div className="overlay-music-actions">
              <Button variant="primary" full onClick={save} disabled={saving}>{saving ? 'Сохраняем…' : 'Применить'}</Button>
            </div>
          </Panel>
        </div>

        <aside className="overlay-preview overlay-preview--music">
          <div className="overlay-preview__head">
            <div>
              <div className="eyebrow">ПРЕВЬЮ В OBS</div>
              <div className="overlay-preview__title">Строка «Сейчас играет»</div>
            </div>
            <span className="overlay-preview__size">127.0.0.1:8770/overlay</span>
          </div>
          <div className="overlay-preview__frame-wrap overlay-preview__frame-wrap--music">
            <iframe
              className="overlay-preview__frame"
              title="Превью строки «Сейчас играет»"
              src={`${url}?preview=1`}
            />
          </div>
          <div className="overlay-preview__hint">
            Это отдельный Browser Source в OBS. Он не зависит от оверлея чата и может стоять на другой сцене.
          </div>
        </aside>
      </div>
    </div>
  );
}

function ImagesOverlaySection({ backend, notify }) {
  const real = Boolean(backend?.available && backend?.view);
  const rewards = (backend?.view?.rewards || []).filter((reward) => (reward.images || []).length > 0);
  const url = 'http://127.0.0.1:8770/image-reward';

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      notify('URL оверлея картинок скопирован');
    } catch {
      notify(url);
    }
  }

  async function preview(reward) {
    if (!real) {
      notify('Превью доступно в приложении');
      return;
    }
    try {
      const shown = await backend.call('preview_reward_image', { rewardId: reward.id });
      notify(shown ? `«${reward.title}» показана в превью` : 'В карточке нет картинок');
    } catch (error) {
      notify(String(error));
    }
  }

  return (
    <div className="overlay-images-tab">
      <div className="overlay-layout">
        <div className="overlay-controls">
          <Panel
            title="Картинки наград"
            description="Картинка появляется в случайной точке OBS под случайным углом до ±40°."
            actions={<Pill tone={real ? 'ok' : 'neutral'}>{real ? 'готово' : 'прототип'}</Pill>}
          >
            <div className="overlay-url-bar overlay-url-bar--inline">
              <div>
                <div className="overlay-url-bar__label">Browser Source</div>
                <code>{url}</code>
              </div>
              <div className="overlay-url-bar__actions">
                <Button variant="secondary" size="sm" icon={<Icon name="copy" />} onClick={copy}>Скопировать</Button>
                <Button variant="ghost" size="sm" icon={<Icon name="external" />} onClick={() => invoke('open_url', { url }).catch((error) => notify(String(error)))}>
                  Открыть
                </Button>
              </div>
            </div>
            <div className="modal-hint">
              Добавь Browser Source 1920×1080, прозрачный фон. Картинки и их размер/угол настраиваются в карточке награды → «Редактор».
            </div>
          </Panel>

          <Panel title="Карточки с картинками" description="Нажми «Показать», чтобы проверить появление в превью.">
            {rewards.length ? (
              <div className="overlay-image-cards">
                {rewards.map((reward) => (
                  <div className="overlay-image-card" key={reward.id}>
                    <div className="overlay-image-card__cover">
                      <img src={`http://127.0.0.1:8770/image-reward/thumb/${encodeURIComponent(reward.id)}/0`} alt="" loading="lazy" />
                      <span>{reward.images.length}</span>
                    </div>
                    <div className="overlay-image-card__body">
                      <strong>{reward.title}</strong>
                      <span>±{Math.round(reward.image?.max_angle_deg ?? 40)}° · {(reward.image?.duration_ms ?? 4000) / 1000} с</span>
                    </div>
                    <Button variant="secondary" size="sm" onClick={() => preview(reward)}>Показать</Button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="empty-state">
                <div className="empty-state__title">Пока нет картинок</div>
                <div className="empty-state__hint">Открой карточку награды → «Редактор» → «Картинки».</div>
              </div>
            )}
          </Panel>
        </div>

        <aside className="overlay-preview">
          <div className="overlay-preview__head">
            <div>
              <div className="overlay-preview__title">Превью OBS</div>
              <div className="overlay-preview__hint">1920 × 1080 · прозрачный фон</div>
            </div>
            <Pill tone="neutral">Browser Source</Pill>
          </div>
          <div className="overlay-preview__frame-wrap overlay-preview__frame-wrap--image">
            <iframe title="Превью картинок наград" src={`${url}?preview=1`} />
          </div>
        </aside>
      </div>
    </div>
  );
}

export default function OverlayPage({ backend }) {
  const [overlayTab, setOverlayTab] = useState('chat');
  const [state, setState] = useState(loadState);
  const [savedState, setSavedState] = useState(() => loadState());
  const [toast, setToast] = useState('');
  const [previewMode, setPreviewMode] = useState('static');
  const [showOssUrl, setShowOssUrl] = useState(false);
  const [previewLoaded, setPreviewLoaded] = useState(false);
  const [previewSize, setPreviewSize] = useState('');
  const [presetDialog, setPresetDialog] = useState(null);
  const frameRef = useRef(null);
  const toastTimer = useRef(null);

  const active = state.presets.find((preset) => preset.id === state.activePreset) || state.presets[0];
  const cfg = active.cfg;
  const dirty = JSON.stringify(state) !== JSON.stringify(savedState);

  useEffect(() => {
    if (!inTauri) return undefined;
    let alive = true;
    invoke('get_chat_overlay_settings')
      .then((payload) => {
        if (!alive || !payload) return;
        const next = normalizeState(JSON.parse(payload));
        setState(next);
        setSavedState(clone(next));
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    window.dispatchEvent(new CustomEvent('rs-overlay-dirty', { detail: dirty }));
  }, [dirty]);

  useEffect(() => {
    return () => {
      window.dispatchEvent(new CustomEvent('rs-overlay-dirty', { detail: false }));
    };
  }, []);

  useEffect(() => {
    return () => window.clearTimeout(toastTimer.current);
  }, []);

  function notify(message) {
    setToast(message);
    window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(''), 2600);
  }

  function updateCfg(patch) {
    setState((current) => ({
      ...current,
      presets: current.presets.map((preset) =>
        preset.id === current.activePreset
          ? { ...preset, cfg: { ...preset.cfg, ...patch } }
          : preset
      ),
    }));
  }

  function updateColors(patch) {
    setState((current) => ({
      ...current,
      presets: current.presets.map((preset) =>
        preset.id === current.activePreset
          ? { ...preset, cfg: { ...preset.cfg, colors: { ...preset.cfg.colors, ...patch } } }
          : preset
      ),
    }));
  }

  function postCfg() {
    const frame = frameRef.current;
    if (!frame?.contentWindow) return;
    frame.contentWindow.postMessage({ tco: 'config', cfg }, '*');
  }

  useEffect(() => {
    postCfg();
  }, [cfg]);

  function onFrameLoad() {
    postCfg();
    frameRef.current?.contentWindow?.postMessage({ tco: 'mode', mode: previewMode }, '*');
    setPreviewLoaded(true);
    const frame = frameRef.current;
    if (frame) setPreviewSize(`${frame.clientWidth} × ${frame.clientHeight}`);
  }

  function setMode(mode) {
    setPreviewMode(mode);
    frameRef.current?.contentWindow?.postMessage({ tco: 'mode', mode }, '*');
  }

  function selectPreset(id) {
    setState((current) => ({ ...current, activePreset: id }));
  }

  function addPreset() {
    const next = clone(active.cfg);
    const preset = { id: uid(), name: 'Новый пресет', cfg: next };
    setState((current) => ({
      ...current,
      activePreset: preset.id,
      presets: [...current.presets, preset],
    }));
    notify('Пресет создан');
  }

  function duplicatePreset() {
    const preset = {
      id: uid(),
      name: `${active.name} копия`,
      cfg: clone(active.cfg),
    };
    setState((current) => ({
      ...current,
      activePreset: preset.id,
      presets: [...current.presets, preset],
    }));
    notify('Пресет продублирован');
  }

  function renamePreset() {
    setPresetDialog({ type: 'rename', value: active.name });
  }

  function confirmRename() {
    const name = presetDialog?.value?.trim();
    if (!name) return;
    setState((current) => ({
      ...current,
      presets: current.presets.map((preset) =>
        preset.id === current.activePreset ? { ...preset, name } : preset
      ),
    }));
    setPresetDialog(null);
  }

  function deletePreset() {
    if (state.presets.length < 2) {
      notify('Нельзя удалить единственный пресет');
      return;
    }
    setPresetDialog({ type: 'delete' });
  }

  function confirmDelete() {
    setState((current) => {
      const presets = current.presets.filter((preset) => preset.id !== current.activePreset);
      return { ...current, activePreset: presets[0].id, presets };
    });
    setPresetDialog(null);
  }

  async function save() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    if (inTauri) {
      try {
        await invoke('save_chat_overlay_settings', { payload: JSON.stringify(state) });
        setSavedState(clone(state));
        notify('Сохранено · OBS подхватит через ~2 секунды');
      } catch (error) {
        notify(`Не удалось сохранить: ${error}`);
      }
      return;
    }
    setSavedState(clone(state));
    notify('Сохранено · OBS подхватит через ~2 секунды');
  }

  function copyOssUrl() {
    navigator.clipboard?.writeText('http://127.0.0.1:8770/chat-overlay').catch(() => {});
    notify('URL для OBS скопирован');
  }

  const presets = useMemo(
    () =>
      state.presets.map((preset) => (
        <option key={preset.id} value={preset.id}>
          {preset.name}
        </option>
      )),
    [state.presets]
  );

  return (
    <div className="overlay-page">
      <div className="page-head">
        <div>
          <div className="eyebrow">ИНСТРУМЕНТЫ · OBS</div>
          <h1 className="page-title">Оверлеи</h1>
          <p className="page-subtitle">
            Отдельные оверлеи для OBS: чат, строка «Сейчас играет» и картинки наград. У каждого свои настройки и Browser Source.
          </p>
        </div>
        <div className="page-actions">
          {overlayTab === 'chat' ? (
            <>
              <Button variant="ghost" icon={<Icon name="external" />} onClick={() => setShowOssUrl((v) => !v)}>
                URL для OBS
              </Button>
              <Button variant="primary" onClick={save} disabled={!dirty}>
                Применить
              </Button>
            </>
          ) : null}
        </div>
      </div>

      <div className="overlay-tabs" role="tablist" aria-label="Тип оверлея">
        <button
          role="tab"
          aria-selected={overlayTab === 'chat'}
          className={overlayTab === 'chat' ? 'is-active' : ''}
          onClick={() => setOverlayTab('chat')}
        >
          <Icon name="chat" size={16} />
          Чат
          <span className="overlay-tabs__hint">сообщения</span>
        </button>
        <button
          role="tab"
          aria-selected={overlayTab === 'music'}
          className={overlayTab === 'music' ? 'is-active' : ''}
          onClick={() => setOverlayTab('music')}
        >
          <Icon name="music" size={16} />
          Музыка
          <span className="overlay-tabs__hint">сейчас играет</span>
        </button>
        <button
          role="tab"
          aria-selected={overlayTab === 'images'}
          className={overlayTab === 'images' ? 'is-active' : ''}
          onClick={() => setOverlayTab('images')}
        >
          <Icon name="image" size={16} />
          Картинки
          <span className="overlay-tabs__hint">награды</span>
        </button>
        <span className="overlay-tabs__note">Все оверлеи работают на 127.0.0.1:8770</span>
      </div>

      {overlayTab === 'chat' ? (
        <>
      {showOssUrl ? (
        <div className="overlay-url-bar">
          <div>
            <div className="overlay-url-bar__label">Источник «Браузер» в OBS</div>
            <code>http://127.0.0.1:8770/chat-overlay</code>
          </div>
          <div className="overlay-url-bar__actions">
            <Button variant="secondary" size="sm" icon={<Icon name="copy" />} onClick={copyOssUrl}>
              Скопировать
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setShowOssUrl(false)}>
              Скрыть
            </Button>
          </div>
        </div>
      ) : null}

      <div className="preset-bar">
        <div className="preset-bar__select">
          <span>{active.name}</span>
          <select value={state.activePreset} aria-label="Пресет оверлея" onChange={(event) => selectPreset(event.target.value)}>
            {presets}
          </select>
          <Icon name="dots" size={16} />
        </div>
        <div className="preset-bar__actions">
          <Button variant="secondary" size="sm" icon={<Icon name="plus" />} onClick={addPreset}>
            Пресет
          </Button>
          <Button variant="secondary" size="sm" onClick={duplicatePreset}>
            Дублировать
          </Button>
          <Button variant="secondary" size="sm" onClick={renamePreset}>
            Переименовать
          </Button>
          <Button variant="danger-ghost" size="sm" onClick={deletePreset}>
            Удалить
          </Button>
        </div>
        <div className="preset-bar__status">
          {dirty ? <Pill tone="warning">Есть несохранённые изменения</Pill> : <Pill tone="ok">Сохранено</Pill>}
        </div>
      </div>

      <div className="overlay-layout">
        <div className="overlay-controls">
          <Panel title="Канал и данные" description="Откуда брать сообщения и что показывать.">
            <div className="control-grid">
              <Field label="Канал Twitch" wide>
                <TextInput
                  value={cfg.channel}
                  placeholder="например, arstotsky"
                  onChange={(channel) => updateCfg({ channel })}
                />
              </Field>
            </div>
            <div className="switch-list">
              <ToggleRow
                label="Бейджи"
                hint="Модератор, подписчик, VIP"
                checked={cfg.badges}
                onChange={(badges) => updateCfg({ badges })}
                trailing={cfg.badges ? 'вкл' : 'выкл'}
              />
              <ToggleRow
                label="Эмодзи Twitch / BTTV"
                hint="Стандартные и BetterTTV"
                checked={cfg.emotes}
                onChange={(emotes) => updateCfg({ emotes })}
                trailing={cfg.emotes ? 'вкл' : 'выкл'}
              />
              <ToggleRow
                label="Эмодзи 7TV"
                hint="Эмодзи канала из 7TV"
                checked={cfg.sevenTv}
                onChange={(sevenTv) => updateCfg({ sevenTv })}
                trailing={cfg.sevenTv ? 'вкл' : 'выкл'}
              />
              <ToggleRow
                label="Скрывать команды"
                hint="Сообщения, начинающиеся с «!»"
                checked={cfg.hideCommands}
                onChange={(hideCommands) => updateCfg({ hideCommands })}
                trailing={cfg.hideCommands ? 'вкл' : 'выкл'}
              />
            </div>
            <div className="control-grid">
              <Field label="Игнор-боты" hint="Логины через запятую" wide>
                <TagInput
                  value={cfg.ignoreBots}
                  placeholder="nightbot, streamelements"
                  onChange={(ignoreBots) => updateCfg({ ignoreBots })}
                />
              </Field>
              <Field label="Игнор-слова" hint="Сообщения с этими словами скрываются" wide>
                <TagInput
                  value={cfg.ignoreWords}
                  placeholder="спам, реклама"
                  onChange={(ignoreWords) => updateCfg({ ignoreWords })}
                />
              </Field>
            </div>
          </Panel>

          <Panel title="Вид" description="Размеры, отступы и геометрия плашек.">
            <div className="control-grid">
              <Field label="Тема">
                <Select value={cfg.theme} onChange={(theme) => updateCfg({ theme })}>
                  <option value="neon">Neon</option>
                  <option value="minimal">Minimal</option>
                </Select>
              </Field>
              <Field label="Шрифт">
                <Select value={cfg.fontFamily} onChange={(fontFamily) => updateCfg({ fontFamily })}>
                  <option>Segoe UI Variable Text</option>
                  <option>Segoe UI</option>
                  <option>Inter</option>
                  <option>Bahnschrift</option>
                  <option>Cascadia Mono</option>
                </Select>
              </Field>
              <Field label="Выравнивание">
                <Select value={cfg.align} onChange={(align) => updateCfg({ align })}>
                  <option value="left">Слева</option>
                  <option value="right">Справа</option>
                </Select>
              </Field>
              <Field label="Рост">
                <Select value={cfg.direction} onChange={(direction) => updateCfg({ direction })}>
                  <option value="up">Снизу вверх</option>
                  <option value="down">Сверху вниз</option>
                </Select>
              </Field>
            </div>
            <div className="slider-list">
              <SliderRow label="Размер шрифта" value={cfg.fontSize} min={10} max={48} unit=" px" onChange={(fontSize) => updateCfg({ fontSize })} />
              <SliderRow
                label="Межстрочный"
                value={cfg.lineHeight}
                min={1}
                max={2}
                step={0.01}
                format={(value) => value.toFixed(2)}
                onChange={(lineHeight) => updateCfg({ lineHeight })}
              />
              <SliderRow label="Отступ по X" value={cfg.paddingX} min={0} max={80} unit=" px" onChange={(paddingX) => updateCfg({ paddingX })} />
              <SliderRow label="Отступ по Y" value={cfg.paddingY} min={0} max={80} unit=" px" onChange={(paddingY) => updateCfg({ paddingY })} />
              <SliderRow label="Промежуток" value={cfg.gap} min={0} max={40} unit=" px" onChange={(gap) => updateCfg({ gap })} />
              <SliderRow label="Скругление" value={cfg.radius} min={0} max={32} unit=" px" onChange={(radius) => updateCfg({ radius })} />
              <SliderRow
                label="Размер эмодзи"
                value={cfg.emoteScale}
                min={0.7}
                max={3}
                step={0.05}
                format={(value) => value.toFixed(2)}
                onChange={(emoteScale) => updateCfg({ emoteScale })}
              />
            </div>
          </Panel>

          <Panel title="Поведение" description="Сколько живут сообщения и как они появляются.">
            <div className="control-grid">
              <Field label="Максимум сообщений">
                <TextInput
                  type="number"
                  value={cfg.max}
                  onChange={(value) => updateCfg({ max: Number(value) || 40 })}
                />
              </Field>
              <Field label="Время жизни, сек" hint="0 — не исчезает">
                <TextInput
                  type="number"
                  value={cfg.ttl}
                  onChange={(value) => updateCfg({ ttl: Number(value) || 0 })}
                />
              </Field>
              <Field label="Анимация">
                <Select value={cfg.animation} onChange={(animation) => updateCfg({ animation })}>
                  <option value="slide">Slide</option>
                  <option value="fade">Fade</option>
                  <option value="none">Нет</option>
                </Select>
              </Field>
              <Field label="Читаемость">
                <Select value={cfg.readability} onChange={(readability) => updateCfg({ readability })}>
                  <option value="none">Нет</option>
                  <option value="soft">Мягкая тень</option>
                  <option value="hard">Жёсткая тень</option>
                  <option value="outline">Обводка</option>
                </Select>
              </Field>
            </div>
            <div className="switch-list">
              <ToggleRow
                label="Показывать время"
                hint="Время сообщения перед ником"
                checked={cfg.timestamps}
                onChange={(timestamps) => updateCfg({ timestamps })}
                trailing={cfg.timestamps ? 'вкл' : 'выкл'}
              />
            </div>
            <Field label="Хайлайты" hint="Логины через запятую — сообщения подсвечиваются" wide>
              <TagInput
                value={cfg.highlight}
                placeholder="arstotsky, mira"
                onChange={(highlight) => updateCfg({ highlight })}
              />
            </Field>
          </Panel>

          <Panel title="Цвета" description="Цвета плашки, текста и подсветки.">
            <div className="color-grid">
              <ColorField label="Текст" value={cfg.colors.text} onChange={(text) => updateColors({ text })} />
              <Field label="Цвет ника">
                <Select value={cfg.colors.nickMode} onChange={(nickMode) => updateColors({ nickMode })}>
                  <option value="twitch">Как в Twitch</option>
                  <option value="fixed">Свой цвет</option>
                  <option value="white">Белый</option>
                </Select>
              </Field>
              <ColorField label="Свой цвет ника" value={cfg.colors.nick} onChange={(nick) => updateColors({ nick })} />
              <ColorField
                label="Фон плашки"
                value={cfg.colors.bubble}
                onChange={(bubble) => updateColors({ bubble })}
                opacity={cfg.colors.bubbleOpacity}
                onOpacity={(bubbleOpacity) => updateColors({ bubbleOpacity })}
              />
              <ColorField
                label="Рамка плашки"
                value={cfg.colors.border}
                onChange={(border) => updateColors({ border })}
                opacity={cfg.colors.borderOpacity}
                onOpacity={(borderOpacity) => updateColors({ borderOpacity })}
              />
              <ColorField label="Подсветка" value={cfg.colors.highlight} onChange={(highlight) => updateColors({ highlight })} />
              <ColorField label="Тень / обводка" value={cfg.colors.shadow} onChange={(shadow) => updateColors({ shadow })} />
              <ColorField
                label="Фон области"
                value={cfg.colors.area}
                onChange={(area) => updateColors({ area })}
                opacity={cfg.colors.areaOpacity}
                onOpacity={(areaOpacity) => updateColors({ areaOpacity })}
              />
              <ColorField label="Время" value={cfg.colors.time} onChange={(time) => updateColors({ time })} />
            </div>
          </Panel>
        </div>

        <aside className="overlay-preview">
          <div className="overlay-preview__head">
            <div>
              <div className="eyebrow">ПРЕВЬЮ</div>
              <div className="overlay-preview__title">Демо-сообщения</div>
            </div>
            <span className="overlay-preview__size">{previewSize || 'превью'}</span>
          </div>

          <div className="overlay-preview__frame-wrap">
            {!previewLoaded ? <div className="overlay-preview__loading">Загружаем превью…</div> : null}
            <iframe
              ref={frameRef}
              className="overlay-preview__frame"
              title="Превью оверлея чата"
              src={PREVIEW_URL}
              onLoad={onFrameLoad}
            />
          </div>

          <div className="overlay-preview__modes">
            <Button
              variant={previewMode === 'static' ? 'primary' : 'secondary'}
              size="sm"
              full
              aria-pressed={previewMode === 'static'}
              onClick={() => setMode('static')}
            >
              Стационарный
            </Button>
            <Button
              variant={previewMode === 'live' ? 'primary' : 'secondary'}
              size="sm"
              full
              aria-pressed={previewMode === 'live'}
              onClick={() => setMode('live')}
            >
              Активный чат
            </Button>
            <Button
              variant="secondary"
              size="sm"
              title="Добавить три демо-сообщения"
              aria-label="Добавить три демо-сообщения"
              onClick={() => frameRef.current?.contentWindow?.postMessage({ tco: 'batch' }, '*')}
            >
              +3
            </Button>
          </div>

          <div className="overlay-preview__hint">
            Это настоящий оверлей, а не картинка. Настройки применяются к превью сразу, в OBS — через ~2 секунды.
          </div>

          <Button
            variant="secondary"
            full
            icon={<Icon name="external" />}
            onClick={() => {
              if (inTauri) {
                invoke('open_url', { url: PREVIEW_URL }).catch((error) => notify(String(error)));
                return;
              }
              window.open(PREVIEW_URL, '_blank', 'noopener');
            }}
          >
            Открыть превью в браузере
          </Button>
        </aside>
      </div>
        </>
      ) : overlayTab === 'music' ? (
        <MusicOverlaySection backend={backend} notify={notify} />
      ) : (
        <ImagesOverlaySection backend={backend} notify={notify} />
      )}

      <Modal
        open={Boolean(presetDialog)}
        onClose={() => setPresetDialog(null)}
        title={presetDialog?.type === 'delete' ? 'Удалить пресет?' : 'Переименовать пресет'}
        subtitle={presetDialog?.type === 'delete' ? `Пресет «${active.name}» будет удалён.` : 'Название видно только в приложении.'}
        width={440}
        footer={
          presetDialog?.type === 'delete' ? (
            <>
              <Button variant="secondary" onClick={() => setPresetDialog(null)}>Отмена</Button>
              <Button variant="danger" onClick={confirmDelete}>Удалить</Button>
            </>
          ) : (
            <>
              <Button variant="secondary" onClick={() => setPresetDialog(null)}>Отмена</Button>
              <Button variant="primary" onClick={confirmRename}>Сохранить</Button>
            </>
          )
        }
      >
        {presetDialog?.type === 'delete' ? (
          <div className="modal-danger-note">Это действие нельзя отменить.</div>
        ) : (
          <label className="modal-field">
            <span>НАЗВАНИЕ ПРЕСЕТА</span>
            <input
              className="ui-input"
              autoFocus
              value={presetDialog?.value || ''}
              onChange={(event) => setPresetDialog((current) => ({ ...current, value: event.target.value }))}
              onKeyDown={(event) => event.key === 'Enter' && confirmRename()}
            />
          </label>
        )}
      </Modal>
      {toast ? <div className="ui-toast" role="status" aria-live="polite">{toast}</div> : null}
    </div>
  );
}
