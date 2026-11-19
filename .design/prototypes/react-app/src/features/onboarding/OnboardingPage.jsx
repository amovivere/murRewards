import { useEffect, useState } from 'react';
import Button from '../../components/ui/Button.jsx';
import { Panel } from '../../components/ui/Panel.jsx';

const MOCK_BINDINGS = [
  { reward_id: '1', title: 'Ты новичок?', file: { name: 'newbie.mp3', volume: 2 } },
  { reward_id: '2', title: 'Мне нравится как он', file: { name: 'ilikehowhesm.mp3', volume: 1.68 } },
  { reward_id: '3', title: 'Беги', file: { name: 'run.mp3', volume: 1.33 } },
];

export default function OnboardingPage({ backend, onNavigate }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [clientId, setClientId] = useState('');
  const real = Boolean(backend?.available && backend.view);
  const view = backend?.view;
  const connected = real ? Boolean(view.connected) : true;
  const auth = view?.auth;
  const audioReady = real ? Boolean(view.audio_ready) : true;
  const bindings = real ? view.local_bindings || [] : MOCK_BINDINGS;
  const hasBindings = bindings.length > 0;

  useEffect(() => {
    if (view?.client_id) setClientId(view.client_id);
  }, [view?.client_id]);

  useEffect(() => {
    if (!auth?.verification_uri) return;
    backend?.invoke('open_url', { url: auth.verification_uri }).catch(() => {});
  }, [auth?.verification_uri]);

  const steps = [
    { title: 'Войти в Twitch', hint: `Награды и EventSub${connected ? ' подключены' : ' подключатся автоматически'}`, done: connected },
    { title: 'Выбрать аудиовыход', hint: real ? view.audio_device || 'Устройство не выбрано' : 'Analog 1/2 (Audient iD4)', done: audioReady },
    { title: 'Проверить звук', hint: 'Короткий тестовый сигнал на выбранном устройстве', done: audioReady },
    { title: 'Привязать первый звук', hint: 'Нажмите «Заменить звук» на любой награде', done: hasBindings },
  ];

  async function login() {
    if (!real) return;
    if (!clientId.trim()) {
      setError('Укажите Client ID приложения Twitch.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      await backend.invoke('twitch_start_login', { clientId: clientId.trim() });
      await backend.refresh();
    } catch (err) {
      setError(String(err));
    } finally {
      setBusy(false);
    }
  }

  async function primary() {
    if (connected) {
      onNavigate?.('rewards');
      return;
    }
    await login();
  }

  async function preview(binding) {
    if (!real) return;
    try {
      await backend.invoke('preview_sound', { rewardId: binding.reward_id });
    } catch {
      // ignore
    }
  }

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <div className="eyebrow">ПЕРВЫЙ ЗАПУСК</div>
          <h1 className="page-title">{connected ? 'Добро пожаловать' : 'Подключим Twitch'}</h1>
          <p className="page-subtitle">
            {connected
              ? 'Настройте звук и награды — приложение подскажет, что осталось.'
              : 'Войдите в аккаунт стримера, чтобы подтянуть награды, EventSub и музыку.'}
          </p>
        </div>
      </div>

      <div className="onboarding">
        <div className="onboarding-hero">
          <div className="eyebrow">REWARD SOUNDS</div>
          <h2>Стрим звучит так, как он задуман.</h2>
          <p>
            Локальные звуки наград, музыка по заявке и OBS-оверлей. Всё работает поверх Twitch
            Channel Points, а звуки играют с вашего компьютера.
          </p>
          <div className="onboarding-actions">
            <Button variant="primary" size="lg" onClick={primary} disabled={busy}>
              {connected ? 'Продолжить настройку' : busy ? 'Открываем Twitch…' : 'Войти в Twitch'}
            </Button>
            <Button variant="ghost" size="lg" onClick={() => onNavigate?.('rewards')}>Пропустить</Button>
          </div>
          {!connected && !view?.client_id ? (
            <label className="onboarding-client">
              <span>CLIENT ID ПРИЛОЖЕНИЯ TWITCH</span>
              <input className="ui-input" value={clientId} onChange={(event) => setClientId(event.target.value)} placeholder="30 букв/цифр из dev.twitch.tv" />
            </label>
          ) : null}
          {error ? <div className="onboarding-error">{error}</div> : null}
          {auth?.state === 'waiting' && auth.user_code ? (
            <div className="onboarding-code">
              <div className="onboarding-code__label">КОД ДЛЯ ВХОДА</div>
              <button
                type="button"
                className="onboarding-code__value"
                onClick={() => navigator.clipboard?.writeText(auth.user_code).catch(() => {})}
                title="Скопировать код"
              >
                {auth.user_code}
              </button>
              <div className="onboarding-code__hint">
                Введите код на <a href={auth.verification_uri} target="_blank" rel="noreferrer">twitch.tv/activate</a>. Окно браузера откроется автоматически.
              </div>
              <Button variant="ghost" size="sm" onClick={() => backend.invoke('twitch_cancel_login').then(() => backend.refresh())}>Отменить вход</Button>
            </div>
          ) : null}
          {auth?.state === 'error' && auth.error ? <div className="onboarding-error">{auth.error}</div> : null}
        </div>

        <div className="onboarding-steps">
          {steps.map((step, index) => (
            <div className={`onboarding-step${step.done ? ' is-done' : ''}`} key={step.title}>
              <div className="onboarding-step__index">{step.done ? '✓' : index + 1}</div>
              <div>
                <div className="onboarding-step__title">{step.title}</div>
                <div className="onboarding-step__hint">{step.hint}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <Panel title="Локальные привязки" description="Их можно слушать и настраивать даже без Twitch.">
        <div className="onboarding-local">
          {bindings.length === 0 ? (
            <div className="muted-line">Пока нет локальных привязок.</div>
          ) : (
            bindings.map((binding) => (
              <div className="local-row" key={binding.reward_id}>
                <div className="local-row__letter">{(binding.title || '?').trim().charAt(0).toUpperCase()}</div>
                <div className="local-row__title">{binding.title}</div>
                <div className="local-row__meta">
                  {binding.file?.name || 'звук не выбран'}
                  {binding.file ? ` · ${Math.round((binding.file.volume ?? 1) * 100)}%` : ''}
                </div>
                <Button variant="secondary" size="sm" onClick={() => preview(binding)}>
                  Проверить
                </Button>
              </div>
            ))
          )}
        </div>
      </Panel>
    </div>
  );
}
