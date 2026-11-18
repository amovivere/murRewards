import { useEffect, useState } from 'react';
import Button from '../../components/ui/Button.jsx';
import ConfirmModal from '../../components/ui/ConfirmModal.jsx';
import Icon from '../../components/ui/Icon.jsx';
import { Panel, Pill } from '../../components/ui/Panel.jsx';
import { SliderRow, ToggleRow } from '../../components/ui/Field.jsx';

const ACCENTS = ['#8B00FF', '#4E7CFF', '#2DD4BF', '#EC4899', '#F5C97B', '#F55A5F', '#22C55E', '#A3A3A3'];

export default function SettingsPage({ backend, onNavigate }) {
  const real = Boolean(backend?.available && backend.view);
  const view = backend?.view;
  const [accent, setAccent] = useState(view?.accent || '#8B00FF');
  const [closeToTray, setCloseToTray] = useState(view?.close_to_tray ?? true);
  const [volume, setVolume] = useState(Math.round((view?.volume ?? 0.29) * 100));
  const [confirmDisconnect, setConfirmDisconnect] = useState(false);
  const [toast, setToast] = useState('');

  useEffect(() => {
    if (!view) return;
    if (view.accent) setAccent(view.accent);
    setCloseToTray(Boolean(view.close_to_tray));
    setVolume(Math.round((view.volume ?? 0.29) * 100));
  }, [view]);

  async function setting(key, value) {
    if (!real) return;
    try {
      await backend.call('set_app_setting', { key, value: String(value) });
    } catch {
      // состояние покажет следующий poll
    }
  }

  async function changeAccent(next) {
    setAccent(next);
    await setting('accent', next);
  }

  async function changeVolume(next) {
    setVolume(next);
    if (!real) return;
    try {
      await backend.call('set_volume', { volume: next / 100 });
    } catch {
      // ignore
    }
  }

  const health = real ? view.health || [] : [];
  const healthOverall = health.some((item) => item.state === 'error')
    ? 'error'
    : health.some((item) => item.state === 'warn')
      ? 'warn'
      : 'ok';
  const audioDevice = real ? view.audio_device || 'не выбрано' : 'Analog 1/2 (Audient iD4)';
  const login = real ? view.login : 'goshanmurz';
  const music = real ? view.music : null;

  function notify(message) {
    setToast(message);
    window.setTimeout(() => setToast(''), 2400);
  }

  function goto(tab) {
    onNavigate?.(tab);
  }

  async function copyDiagnostics() {
    const lines = [
      `Reward Sounds ${view?.version || ''}`,
      `Twitch: ${view?.login || '—'} (${view?.connected ? 'подключён' : 'нет'})`,
      `Звук: ${view?.audio_device || '—'}`,
      ...(view?.health || []).map((item) => `${item.title}: ${item.state} — ${item.detail}`),
    ];
    try {
      await navigator.clipboard.writeText(lines.join('\n'));
      notify('Диагностика скопирована');
    } catch {
      notify('Не удалось скопировать диагностику');
    }
  }

  async function refreshTwitch() {
    if (!real) return;
    try {
      await backend.invoke('refresh_twitch_now');
      await backend.refresh();
      notify('Данные Twitch обновлены');
    } catch (error) {
      notify(String(error));
    }
  }

  async function reattachEvents() {
    if (!real) return;
    try {
      await backend.invoke('restart_eventsub');
      await backend.refresh();
      notify('EventSub переподключён');
    } catch (error) {
      notify(String(error));
    }
  }

  async function disconnectTwitch() {
    if (!real) return;
    try {
      await backend.invoke('twitch_disconnect');
      await backend.refresh();
      notify('Twitch отключён');
      setConfirmDisconnect(false);
    } catch (error) {
      notify(String(error));
    }
  }

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <div className="eyebrow">СИСТЕМА · TWITCH</div>
          <h1 className="page-title">Настройки</h1>
          <p className="page-subtitle">Twitch, звук и поведение приложения</p>
        </div>
        <span className="muted-line">Изменения сохраняются автоматически</span>
      </div>

      <Panel
        title="Здоровье системы"
        actions={<Pill tone={healthOverall === 'ok' ? 'ok' : 'warning'}>{healthOverall === 'ok' ? 'OK' : 'ВНИМАНИЕ'}</Pill>}
      >
        <div className="health-grid">
          {(real && health.length
            ? health
            : [
                { key: 'twitch', title: 'Twitch', state: 'ok', detail: 'Подключено · @goshanmurz' },
                { key: 'eventsub', title: 'EventSub', state: 'ok', detail: 'Слушаем активации наград' },
                { key: 'overlay', title: 'Оверлей', state: 'ok', detail: '127.0.0.1:8770/chat-overlay' },
                { key: 'audio', title: 'Звук', state: 'ok', detail: 'Analog 1/2 (Audient iD4)' },
              ]
          ).map((item) => (
            <div className="health-row" key={item.key || item.title}>
              <span className={`dot dot--${item.state === 'error' ? 'warn' : item.state === 'warn' ? 'warn' : 'ok'}`} />
              <b>{item.title}</b>
              <span>{item.detail}</span>
              <button className="link-button" onClick={() => goto(item.key === 'overlay' ? 'overlay' : item.key === 'audio' || item.key === 'ytdlp' ? 'music' : 'settings')}>
                Открыть
              </button>
            </div>
          ))}
        </div>
        <div className="inline-row">
          <Button variant="secondary" size="sm" onClick={copyDiagnostics}>
            Скопировать диагностику
          </Button>
          <Button variant="ghost" size="sm" onClick={() => goto('log')}>
            Открыть журнал
          </Button>
        </div>
      </Panel>

      <div className="three-col">
        <Panel title="Twitch" description="Аккаунт канала, с которого читаются награды">
          <div className="strong-line">{real && view.connected ? `Подключено · @${login}` : real ? 'Не подключено' : 'Подключено · @goshanmurz'}</div>
          <div className="muted-line">Активации наград слушаются</div>
          <Button variant="secondary" full onClick={refreshTwitch}>
            Обновить данные
          </Button>
          <Button variant="secondary" full onClick={reattachEvents}>
            Переподключить события
          </Button>
          <div className="danger-zone">
            <div className="danger-zone__label">ОПАСНАЯ ЗОНА</div>
            <div className="muted-line">Отключить Twitch — награды и музыка перестанут работать.</div>
            <Button variant="danger-ghost" size="sm" onClick={() => setConfirmDisconnect(true)}>
              Отключить Twitch…
            </Button>
          </div>
        </Panel>

        <Panel title="Звук" description="Громкость приложения и воспроизведение">
          <SliderRow label="Громкость" value={volume} min={0} max={100} unit="%" onChange={changeVolume} />
          <ToggleRow
            label="Без звука"
            hint="Заглушить все звуки наград"
            checked={real ? Boolean(view.muted) : false}
            onChange={(muted) => real && setting('muted', muted ? '1' : '0')}
          />
          <ToggleRow
            label="Воспроизводить звуки наград"
            hint="Активации будут игнорироваться, пока выключено"
            checked={real ? view.playback_enabled !== false : true}
            onChange={(enabled) => real && setting('playback_enabled', enabled ? '1' : '0')}
          />
        </Panel>

        <Panel title="Аудиовыход" description="Куда играют звуки наград">
          <div className="ok-line">
            <span className={`dot ${real && view.audio_error ? 'dot--warn' : 'dot--ok'}`} /> {audioDevice}
          </div>
          <Button variant="secondary" full onClick={() => real && backend.invoke('restart_audio').then(() => backend.refresh()).catch(() => {})}>
            Перезапустить аудио
          </Button>
          <Button variant="secondary" full onClick={() => real && backend.invoke('stop_all_sounds').catch(() => {})}>
            Остановить все звуки
          </Button>
          <Button variant="secondary" full onClick={() => real && backend.invoke('normalize_volumes').then(() => backend.refresh()).catch(() => {})}>
            Выровнять громкость
          </Button>
        </Panel>
      </div>

      <div className="three-col">
        <Panel title="Внешний вид" description="Акцентный цвет интерфейса. Не меняет награды.">
          <div className="accent-buttons">
            <span className="ui-button ui-button--primary ui-button--sm">Пример кнопки</span>
            <span className="accent-chip" style={{ background: accent }} />
          </div>
          <div className="accent-palette">
            {ACCENTS.map((color) => (
              <button
                key={color}
                className={`accent-swatch${accent === color ? ' is-active' : ''}`}
                style={{ background: color }}
                onClick={() => changeAccent(color)}
                title={color}
              />
            ))}
          </div>
          <div className="inline-row">
            <code className="url-code">{accent}</code>
            <Button variant="ghost" size="sm" onClick={() => changeAccent('#8B00FF')}>
              Сбросить
            </Button>
          </div>
          <div className="muted-line">Меняется только акцент, статусы — нет.</div>
        </Panel>

        <Panel title="Приложение" description="Запуск и поведение окна">
          <ToggleRow
            label="Запускать с Windows"
            checked={real ? Boolean(view.autostart) : false}
            onChange={(enabled) => real && setting('autostart', enabled ? '1' : '0')}
          />
          <ToggleRow
            label="Закрывать в трей"
            hint="Крестик прячет окно"
            checked={closeToTray}
            onChange={(value) => {
              setCloseToTray(value);
              setting('close_to_tray', value ? '1' : '0');
            }}
          />
          <ToggleRow
            label="Запускать свёрнутым"
            checked={real ? Boolean(view.start_minimized) : false}
            onChange={(enabled) => real && setting('start_minimized', enabled ? '1' : '0')}
          />
          <Button variant="ghost" size="sm" onClick={() => goto('onboarding')}>
            Пройти знакомство заново
          </Button>
        </Panel>

        <Panel title="Музыка" description="Треки по заявке из чата">
          <div className="ok-line">
            <span className={`dot ${real && !music?.ready ? 'dot--warn' : 'dot--ok'}`} /> {real && !music?.ready ? 'Не готова' : 'Готова к заявкам'}
          </div>
          <div className="muted-line">НАГРАДА</div>
          <div className="strong-line">{music?.reward_title || 'МУЗЫКА JOTUB'} · {music?.reward_cost || 50} баллов</div>
          <Button variant="secondary" full onClick={() => goto('music')}>
            Настроить музыку
          </Button>
          <Button variant="ghost" full onClick={() => goto('music')}>
            Открыть вкладку «Музыка» →
          </Button>
        </Panel>
      </div>

      <div className="inline-row">
        <Button variant="ghost" icon={<Icon name="external" />} onClick={() => real && backend.invoke('open_folder', { kind: 'config' }).catch(() => {})}>
          Открыть папку данных
        </Button>
      </div>
      <ConfirmModal
        open={confirmDisconnect}
        title="Отключить Twitch?"
        text="Награды, EventSub и музыка перестанут работать до повторного входа. Локальные привязки звуков сохранятся."
        confirmLabel="Отключить"
        danger
        onClose={() => setConfirmDisconnect(false)}
        onConfirm={disconnectTwitch}
      />
      {toast ? <div className="ui-toast" role="status" aria-live="polite">{toast}</div> : null}
    </div>
  );
}
