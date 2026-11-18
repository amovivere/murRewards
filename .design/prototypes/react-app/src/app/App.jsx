import { useEffect, useRef, useState } from 'react';
import Icon from '../components/ui/Icon.jsx';
import DesignPage from '../features/design/DesignPage.jsx';
import LogPage from '../features/log/LogPage.jsx';
import MusicPage from '../features/music/MusicPage.jsx';
import OnboardingPage from '../features/onboarding/OnboardingPage.jsx';
import OverlayPage from '../features/overlay/OverlayPage.jsx';
import RewardsPage from '../features/rewards/RewardsPage.jsx';
import SettingsPage from '../features/settings/SettingsPage.jsx';
import { inTauri, invoke, useBackend } from '../lib/backend.js';

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

const HEALTH_LABELS = {
  twitch: 'Twitch',
  eventsub: 'EventSub',
  audio: 'Звук',
  ytdlp: 'yt-dlp',
  overlay: 'Оверлей',
};

export default function App() {
  const [tab, setTab] = useState('rewards');
  const [healthOpen, setHealthOpen] = useState(false);
  const backend = useBackend();
  const [started, setStarted] = useState(false);
  const [maximized, setMaximized] = useState(false);
  const healthWrap = useRef(null);
  const view = backend.view;
  const health = view?.health || [];
  const problems = health.filter((item) => item.state === 'error' || item.state === 'warn');
  const healthOverall = health.some((item) => item.state === 'error')
    ? 'error'
    : health.some((item) => item.state === 'warn')
      ? 'warn'
      : 'ok';
  const healthText =
    health.length === 0
      ? 'Проверяем системы…'
      : problems.length === 0
        ? 'Все системы работают'
        : problems.length === 1
          ? 'Есть замечание'
          : `Замечаний: ${problems.length}`;
  const showPrototypeNav = !inTauri;
  const systemNav = SYSTEM_NAV.filter((item) => showPrototypeNav || !item.prototype);
  if (inTauri && view && !view.connected && !systemNav.some((item) => item.id === 'onboarding')) {
    systemNav.unshift({ id: 'onboarding', label: 'Подключение', icon: 'play' });
  }
  const Page = PAGES[tab] || RewardsPage;
  const volumePercent = Math.round((view?.volume ?? 0.29) * 100);

  useEffect(() => {
    if (started || !view) return;
    setStarted(true);
    if (!view.connected) setTab('onboarding');
  }, [view, started]);

  useEffect(() => {
    if (!healthOpen) return undefined;
    function onKeyDown(event) {
      if (event.key === 'Escape') setHealthOpen(false);
    }
    function onPointerDown(event) {
      if (healthWrap.current && !healthWrap.current.contains(event.target)) setHealthOpen(false);
    }
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('mousedown', onPointerDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('mousedown', onPointerDown);
    };
  }, [healthOpen]);

  function windowAction(command) {
    if (!inTauri) return;
    invoke(command).catch(() => {});
  }

  function toggleMaximize() {
    windowAction('win_toggle_maximize');
    setMaximized((value) => !value);
  }

  function startDrag(event) {
    if (!inTauri || event.button !== 0) return;
    if (event.target.closest('button, input, label, .health-wrap')) return;
    windowAction('win_start_drag');
  }

  async function changeVolume(percent) {
    if (!inTauri) return;
    try {
      await backend.call('set_volume', { volume: percent / 100 });
    } catch {
      // состояние обновится следующим поллингом
    }
  }

  function navigate(next) {
    setTab(next);
  }

  function healthRowTarget(item) {
    if (item.action === 'settings' || item.action === 'log') return item.action;
    if (item.key === 'overlay') return 'overlay';
    if (item.key === 'audio' || item.key === 'ytdlp') return 'music';
    return 'settings';
  }

  return (
    <div className="app-shell" style={{ '--accent': view?.accent || '#8B00FF', '--accent-text': 'color-mix(in srgb, var(--accent) 48%, white)' }}>
      <aside className="sidebar">
        <div className="sidebar__brand">
          <div className="brand-mark">
            <Icon name="music" size={17} />
          </div>
          <div>
            <div className="brand-name">Reward Sounds</div>
            <div className="brand-sub">Channel Points · OBS</div>
          </div>
        </div>

        <div className="sidebar__scroll">
          <div className="nav-label">ОСНОВНОЕ</div>
          <nav aria-label="Основные разделы">
            {NAV.map((item) => (
              <button
                key={item.id}
                className={`nav-item${tab === item.id ? ' is-active' : ''}`}
                onClick={() => setTab(item.id)}
                aria-current={tab === item.id ? 'page' : undefined}
              >
                <Icon name={item.icon} />
                <span>{item.label}</span>
              </button>
            ))}
          </nav>
        </div>

        <div className="sidebar__footer">
          <div className="nav-label">СИСТЕМА</div>
          <nav aria-label="Системные разделы">
            {systemNav.map((item) => (
              <button
                key={item.id}
                className={`nav-item${tab === item.id ? ' is-active' : ''}`}
                onClick={() => setTab(item.id)}
                aria-current={tab === item.id ? 'page' : undefined}
              >
                <Icon name={item.icon} />
                <span>{item.label}</span>
                {item.prototype ? <em className="nav-prototype">proto</em> : null}
              </button>
            ))}
          </nav>
        </div>
      </aside>

      <div className="main">
        <header className="topbar" onMouseDown={startDrag} onDoubleClick={toggleMaximize}>
          <div className="health-wrap" ref={healthWrap}>
            <button
              className={`health-chip${healthOpen ? ' is-open' : ''}`}
              onClick={() => setHealthOpen((value) => !value)}
              aria-expanded={healthOpen}
              aria-controls="health-popover"
            >
              <span className={`dot dot--${healthOverall === 'error' ? 'warn' : healthOverall === 'warn' ? 'warn' : 'ok'}`} />
              {healthText}
              <span className="health-chip__chevron">›</span>
            </button>

            {healthOpen ? (
              <div className="health-popover" id="health-popover" role="dialog" aria-label="Состояние систем">
                <div className="health-popover__head">
                  <div>
                    <div className="eyebrow">СОСТОЯНИЕ СИСТЕМ</div>
                    <div className="health-popover__title">
                      {healthOverall === 'ok' ? 'Всё готово к эфиру' : 'Есть замечания'}
                    </div>
                  </div>
                  <span className={`ui-pill ui-pill--${healthOverall === 'ok' ? 'ok' : 'warning'}`}>
                    {health.filter((item) => item.state === 'ok').length}/{health.length || 5}
                  </span>
                </div>
                <div className="health-popover__rows">
                  {(health.length
                    ? health
                    : [
                        { key: 'twitch', state: 'ok', detail: 'Подключено' },
                        { key: 'eventsub', state: 'ok', detail: 'Слушаем активации наград' },
                        { key: 'audio', state: 'ok', detail: 'Устройство выбрано' },
                        { key: 'ytdlp', state: 'ok', detail: 'Готов' },
                        { key: 'overlay', state: 'ok', detail: 'Оверлеи работают' },
                      ]
                  ).map((item) => (
                    <button
                      key={item.key}
                      onClick={() => {
                        setTab(healthRowTarget(item));
                        setHealthOpen(false);
                      }}
                    >
                      <span className={`dot dot--${item.state === 'error' ? 'warn' : item.state === 'warn' ? 'warn' : 'ok'}`} />
                      <b>{HEALTH_LABELS[item.key] || item.title}</b>
                      <span>{item.detail}</span>
                      <em>Открыть</em>
                    </button>
                  ))}
                </div>
                <button className="health-popover__footer" onClick={() => { setTab('settings'); setHealthOpen(false); }}>
                  Открыть «Здоровье системы» →
                </button>
              </div>
            ) : null}
          </div>

          <div className="topbar__right">
            <label className="volume-control">
              <Icon name="volume" size={15} />
              <span className="volume-control__label">ЗВУК</span>
              <input
                className="ui-range volume-range"
                type="range"
                min={0}
                max={100}
                step={1}
                value={volumePercent}
                onChange={(event) => changeVolume(Number(event.target.value))}
                aria-label="Общая громкость"
              />
              <span className="volume-control__value">{volumePercent}%</span>
            </label>
            <div className="window-controls">
              <button title="Свернуть" aria-label="Свернуть окно" onClick={() => windowAction('win_minimize')}>—</button>
              <button title={maximized ? 'Восстановить' : 'Развернуть'} aria-label={maximized ? 'Восстановить окно' : 'Развернуть окно'} onClick={toggleMaximize}>▢</button>
              <button className="window-close" title="Закрыть" aria-label="Закрыть окно" onClick={() => windowAction('win_close')}>×</button>
            </div>
          </div>
        </header>

        <main className="content">
          {backend.error ? (
            <div className="app-error-banner" role="alert">
              <span>Нет связи с бэкендом приложения: {backend.error}</span>
              <button className="app-error-retry" onClick={() => backend.refresh()}>Повторить</button>
            </div>
          ) : null}
          <Page backend={backend} onNavigate={navigate} />
        </main>

        <footer className="footer">
          <span>{healthText}</span>
          <span>версия {view?.version || '1.7.0'}</span>
        </footer>
      </div>
    </div>
  );
}
