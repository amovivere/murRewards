import { useEffect, useMemo, useRef, useState } from 'react';
import Button from '../../components/ui/Button.jsx';
import Icon from '../../components/ui/Icon.jsx';
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

export default function OverlayPage() {
  const [state, setState] = useState(loadState);
  const [savedState, setSavedState] = useState(() => loadState());
  const [toast, setToast] = useState('');
  const [previewMode, setPreviewMode] = useState('static');
  const [showOssUrl, setShowOssUrl] = useState(false);
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
    const name = window.prompt('Новое название пресета:', active.name);
    if (!name?.trim()) return;
    setState((current) => ({
      ...current,
      presets: current.presets.map((preset) =>
        preset.id === current.activePreset ? { ...preset, name: name.trim() } : preset
      ),
    }));
  }

  function deletePreset() {
    if (state.presets.length < 2) {
      notify('Нельзя удалить единственный пресет');
      return;
    }
    if (!window.confirm(`Удалить пресет «${active.name}»?`)) return;
    setState((current) => {
      const presets = current.presets.filter((preset) => preset.id !== current.activePreset);
      return { ...current, activePreset: presets[0].id, presets };
    });
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
          <h1 className="page-title">Оверлей чата</h1>
          <p className="page-subtitle">
            Настройки оверлея, который добавляется в OBS как «Браузер». Чат в приложении не показывается —
            только красивый оверлей и его настройки.
          </p>
        </div>
        <div className="page-actions">
          <Button variant="ghost" icon={<Icon name="external" />} onClick={() => setShowOssUrl((v) => !v)}>
            URL для OBS
          </Button>
          <Button variant="primary" onClick={save} disabled={!dirty}>
            Применить
          </Button>
        </div>
      </div>

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
          <select value={state.activePreset} onChange={(event) => selectPreset(event.target.value)}>
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
            <span className="overlay-preview__size">420 × 900</span>
          </div>

          <div className="overlay-preview__frame-wrap">
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
              onClick={() => setMode('static')}
            >
              Стационарный
            </Button>
            <Button
              variant={previewMode === 'live' ? 'primary' : 'secondary'}
              size="sm"
              full
              onClick={() => setMode('live')}
            >
              Активный чат
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => frameRef.current?.contentWindow?.postMessage({ tco: 'batch' }, '*')}
            >
              +3
            </Button>
          </div>

          <div className="overlay-preview__hint">
            Это настоящий оверлей, а не картинка. Настройки применяются к превью сразу, в OBS — через ~2 секунды.
          </div>

          <Button variant="secondary" full icon={<Icon name="external" />} onClick={() => window.open(PREVIEW_URL, '_blank')}>
            Открыть превью в браузере
          </Button>
        </aside>
      </div>

      {toast ? <div className="ui-toast" role="status" aria-live="polite">{toast}</div> : null}
    </div>
  );
}
