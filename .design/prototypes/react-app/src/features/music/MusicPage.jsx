import { useState } from 'react';
import Button from '../../components/ui/Button.jsx';
import Icon from '../../components/ui/Icon.jsx';
import Modal from '../../components/ui/Modal.jsx';
import { Panel, Pill } from '../../components/ui/Panel.jsx';
import { Select, SliderRow, ToggleRow } from '../../components/ui/Field.jsx';

function MusicSettingsModal({ open, onClose, notify }) {
  const [maxQueue, setMaxQueue] = useState(10);
  const [maxDuration, setMaxDuration] = useState(15);
  const [volume, setVolume] = useState(5);
  const [autoplay, setAutoplay] = useState(true);
  const [prefetch, setPrefetch] = useState(true);

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
          <Button variant="primary" onClick={() => { onClose(); notify('Настройки музыки сохранены'); }}>Сохранить</Button>
        </>
      }
    >
      <div className="modal-form">
        <div className="slider-list">
          <SliderRow label="Треков в очереди" value={maxQueue} min={1} max={30} onChange={setMaxQueue} />
          <SliderRow label="Макс. длительность" value={maxDuration} min={1} max={60} unit=" мин" onChange={setMaxDuration} />
          <SliderRow label="Громкость музыки" value={volume} min={0} max={100} unit="%" onChange={setVolume} />
        </div>
        <div className="switch-list">
          <ToggleRow label="Играть сразу после активации" checked={autoplay} onChange={setAutoplay} trailing={autoplay ? 'вкл' : 'выкл'} />
          <ToggleRow label="Предзагрузка следующего трека" checked={prefetch} onChange={setPrefetch} trailing={prefetch ? 'вкл' : 'выкл'} />
        </div>
        <div className="modal-hint">Громкость музыки не меняет общую громкость Windows — только очередь заявок.</div>
      </div>
    </Modal>
  );
}

function ObsModal({ open, onClose, notify }) {
  const [seconds, setSeconds] = useState(0);
  const [font, setFont] = useState(17);
  const [position, setPosition] = useState('top');
  const [copied, setCopied] = useState(false);

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
          <Button variant="primary" onClick={() => { onClose(); notify('Оверлей показан'); }}>Показать сейчас</Button>
        </>
      }
    >
      <div className="modal-form">
        <div className="obs-url-box">
          <code>http://127.0.0.1:8770/overlay</code>
        </div>
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

export default function MusicPage() {
  const [musicOpen, setMusicOpen] = useState(false);
  const [obsOpen, setObsOpen] = useState(false);
  const [toast, setToast] = useState('');

  function notify(message) {
    setToast(message);
    window.setTimeout(() => setToast(''), 2200);
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
          <Button variant="ghost" icon={<Icon name="dots" />} />
          <Button variant="secondary" icon={<Icon name="external" />}>
            Открыть YouTube
          </Button>
          <Button variant="secondary" onClick={() => setMusicOpen(true)}>
            Настроить музыку
          </Button>
        </div>
      </div>

      <Panel
        title="Сейчас играет"
        description="ДИНАСТИЯ — Земляк · заказал @nix · YouTube"
        actions={<Pill tone="ok">готово</Pill>}
      >
        <div className="player">
          <div className="player__cover">
            <Icon name="music" size={26} />
          </div>
          <div className="player__main">
            <div className="player__title-row">
              <div>
                <div className="player__track">ДИНАСТИЯ — Земляк</div>
                <div className="player__meta">@nix · YouTube · 2:44</div>
              </div>
              <div className="player__controls">
                <Button variant="secondary" size="sm" icon={<Icon name="play" size={12} />} />
                <Button variant="secondary" size="sm" icon={<Icon name="pause" size={12} />} />
                <Button variant="secondary" size="sm" icon={<Icon name="next" size={12} />} />
                <Button variant="ghost" size="sm">Пропустить трек</Button>
              </div>
            </div>
            <div className="player__progress">
              <span>0:58</span>
              <div className="progress-track">
                <div className="progress-fill" style={{ width: '42%' }} />
                <div className="progress-knob" style={{ left: '42%' }} />
              </div>
              <span>2:44</span>
            </div>
          </div>
        </div>
      </Panel>

      <div className="two-col">
        <Panel title="Очередь" description="0 из 10" actions={<Button variant="danger-ghost" size="sm" onClick={() => notify('Очередь очищена')}>Очистить</Button>}>
          <div className="empty-state">
            <div className="empty-state__title">Очередь пуста</div>
            <div className="empty-state__hint">Ссылка из активации награды появится здесь.</div>
          </div>
          <div className="queue-input">
            <Icon name="plus" />
            <input placeholder="Вставьте ссылку YouTube и нажмите Enter — трек встанет в очередь" />
            <Button variant="secondary" size="sm">В очередь</Button>
          </div>
        </Panel>

        <div className="stack">
          <Panel title="OBS — строка «Сейчас играет»" actions={<Button variant="ghost" size="sm" onClick={() => setObsOpen(true)}>Настроить</Button>}>
            <div className="inline-row">
              <code className="url-code">http://127.0.0.1:8770/overlay</code>
              <Button variant="secondary" size="sm" onClick={() => notify('Оверлей показан')}>Показать сейчас</Button>
            </div>
            <div className="muted-line">Ничего не играет</div>
          </Panel>

          <Panel title="Состояние">
            <ul className="check-list">
              <li><span className="dot dot--ok" /> yt-dlp 2026.10.26 — готов</li>
              <li><span className="dot dot--ok" /> !трек: команда включена</li>
              <li><span className="dot dot--ok" /> Звук: Analog 1/2</li>
            </ul>
          </Panel>
        </div>
      </div>

      <MusicSettingsModal open={musicOpen} onClose={() => setMusicOpen(false)} notify={notify} />
      <ObsModal open={obsOpen} onClose={() => setObsOpen(false)} notify={notify} />
      {toast ? <div className="ui-toast">{toast}</div> : null}
    </div>
  );
}
