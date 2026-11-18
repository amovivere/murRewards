import { useState } from 'react';
import Button from '../components/ui/Button.jsx';
import Icon from '../components/ui/Icon.jsx';
import DesignPage from '../features/design/DesignPage.jsx';
import LogPage from '../features/log/LogPage.jsx';
import MusicPage from '../features/music/MusicPage.jsx';
import OnboardingPage from '../features/onboarding/OnboardingPage.jsx';
import OverlayPage from '../features/overlay/OverlayPage.jsx';
import RewardsPage from '../features/rewards/RewardsPage.jsx';
import SettingsPage from '../features/settings/SettingsPage.jsx';

const NAV = [
  { id: 'rewards', label: 'Награды', icon: 'rewards' },
  { id: 'music', label: 'Музыка', icon: 'music' },
  { id: 'overlay', label: 'Оверлей', icon: 'overlay' },
];

const SYSTEM_NAV = [
  { id: 'settings', label: 'Настройки', icon: 'settings' },
  { id: 'log', label: 'Журнал', icon: 'log' },
  { id: 'onboarding', label: 'Онбординг', icon: 'play', prototype: true },
  { id: 'design', label: 'Дизайн-система', icon: 'design', prototype: true },
];

const PAGES = {
  rewards: RewardsPage,
  music: MusicPage,
  overlay: OverlayPage,
  settings: SettingsPage,
  log: LogPage,
  onboarding: OnboardingPage,
  design: DesignPage,
};

export default function App() {
  const [tab, setTab] = useState('overlay');
  const [healthOpen, setHealthOpen] = useState(false);
  const Page = PAGES[tab] || RewardsPage;

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="sidebar__brand">
          <div className="brand-mark">
            <Icon name="music" size={17} />
          </div>
          <div>
            <div className="brand-name">Reward Sounds</div>
            <div className="brand-sub">Studio · 2K</div>
          </div>
        </div>

        <div className="sidebar__scroll">
          <div className="nav-label">ОСНОВНОЕ</div>
          <nav>
            {NAV.map((item) => (
              <button
                key={item.id}
                className={`nav-item${tab === item.id ? ' is-active' : ''}`}
                onClick={() => setTab(item.id)}
              >
                <Icon name={item.icon} />
                <span>{item.label}</span>
              </button>
            ))}
          </nav>
        </div>

        <div className="sidebar__footer">
          <div className="nav-label">СИСТЕМА</div>
          <nav>
            {SYSTEM_NAV.map((item) => (
              <button
                key={item.id}
                className={`nav-item${tab === item.id ? ' is-active' : ''}`}
                onClick={() => setTab(item.id)}
              >
                <Icon name={item.icon} />
                <span>{item.label}</span>
                {item.prototype ? <em className="nav-prototype">proto</em> : null}
              </button>
            ))}
          </nav>
          <div className="sidebar__version">версия 1.7.0 · React prototype</div>
        </div>
      </aside>

      <div className="main">
        <header className="topbar">
          <div className="health-wrap">
            <button className={`health-chip${healthOpen ? ' is-open' : ''}`} onClick={() => setHealthOpen((value) => !value)}>
              <span className="dot dot--ok" />
              Все системы работают
              <span className="health-chip__chevron">›</span>
            </button>

            {healthOpen ? (
              <div className="health-popover">
                <div className="health-popover__head">
                  <div>
                    <div className="eyebrow">СОСТОЯНИЕ СИСТЕМ</div>
                    <div className="health-popover__title">Всё готово к эфиру</div>
                  </div>
                  <span className="ui-pill ui-pill--ok">5/5</span>
                </div>
                <div className="health-popover__rows">
                  <button onClick={() => { setTab('settings'); setHealthOpen(false); }}>
                    <span className="dot dot--ok" />
                    <b>Twitch</b>
                    <span>Подключено · @goshanmurz</span>
                    <em>Открыть</em>
                  </button>
                  <button onClick={() => { setTab('settings'); setHealthOpen(false); }}>
                    <span className="dot dot--ok" />
                    <b>EventSub</b>
                    <span>Слушаем активации наград</span>
                    <em>Открыть</em>
                  </button>
                  <button onClick={() => { setTab('overlay'); setHealthOpen(false); }}>
                    <span className="dot dot--ok" />
                    <b>Оверлей</b>
                    <span>127.0.0.1:8770/chat-overlay</span>
                    <em>Открыть</em>
                  </button>
                  <button onClick={() => { setTab('music'); setHealthOpen(false); }}>
                    <span className="dot dot--ok" />
                    <b>Звук</b>
                    <span>Analog 1/2 (Audient iD4)</span>
                    <em>Открыть</em>
                  </button>
                  <button onClick={() => { setTab('music'); setHealthOpen(false); }}>
                    <span className="dot dot--ok" />
                    <b>yt-dlp</b>
                    <span>2026.10.26 — готов</span>
                    <em>Открыть</em>
                  </button>
                </div>
                <button className="health-popover__footer" onClick={() => { setTab('settings'); setHealthOpen(false); }}>
                  Открыть «Здоровье системы» →
                </button>
              </div>
            ) : null}
          </div>

          <div className="topbar__right">
            <div className="volume-control">
              <Icon name="volume" size={15} />
              <span className="volume-control__label">ЗВУК</span>
              <div className="volume-track volume-track--top">
                <div className="volume-fill" style={{ width: '29%' }} />
                <div className="volume-knob" style={{ left: '29%' }} />
              </div>
              <span className="volume-control__value">29%</span>
            </div>
            <div className="window-controls">
              <button title="Свернуть">—</button>
              <button title="Развернуть">▢</button>
              <button className="window-close" title="Закрыть">×</button>
            </div>
          </div>
        </header>

        <main className="content">
          <Page />
        </main>

        <footer className="footer">
          <span>Готово</span>
          <span>версия 1.7.0</span>
        </footer>
      </div>
    </div>
  );
}
