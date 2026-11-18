import Button from '../../components/ui/Button.jsx';
import Icon from '../../components/ui/Icon.jsx';
import { Panel, Pill } from '../../components/ui/Panel.jsx';

export default function MusicPage() {
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
                <Button variant="ghost" size="sm">
                  Пропустить трек
                </Button>
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
        <Panel title="Очередь" description="0 из 10" actions={<Button variant="danger-ghost" size="sm">Очистить</Button>}>
          <div className="empty-state">
            <div className="empty-state__title">Очередь пуста</div>
            <div className="empty-state__hint">Ссылка из активации награды появится здесь.</div>
          </div>
          <div className="queue-input">
            <Icon name="plus" />
            <input placeholder="Вставьте ссылку YouTube и нажмите Enter — трек встанет в очередь" />
            <Button variant="secondary" size="sm">
              В очередь
            </Button>
          </div>
        </Panel>

        <div className="stack">
          <Panel title="OBS — строка «Сейчас играет»" actions={<Button variant="ghost" size="sm">Настроить</Button>}>
            <div className="inline-row">
              <code className="url-code">http://127.0.0.1:8770/overlay</code>
              <Button variant="secondary" size="sm">
                Показать сейчас
              </Button>
            </div>
            <div className="muted-line">Ничего не играет</div>
          </Panel>

          <Panel title="Состояние">
            <ul className="check-list">
              <li>
                <span className="dot dot--ok" /> yt-dlp 2026.10.26 — готов
              </li>
              <li>
                <span className="dot dot--ok" /> !трек: команда включена
              </li>
              <li>
                <span className="dot dot--ok" /> Звук: Analog 1/2
              </li>
            </ul>
          </Panel>
        </div>
      </div>
    </div>
  );
}
