import { useState } from 'react';
import Button from '../../components/ui/Button.jsx';
import { Panel } from '../../components/ui/Panel.jsx';

const MOCK_BINDINGS = [
  { reward_id: '1', title: 'Ты новичок?', file: { name: 'newbie.mp3', volume: 2 } },
  { reward_id: '2', title: 'Мне нравится как он', file: { name: 'ilikehowhesm.mp3', volume: 1.68 } },
  { reward_id: '3', title: 'Беги', file: { name: 'run.mp3', volume: 1.33 } },
];

export default function OnboardingPage({ backend }) {
  const [busy, setBusy] = useState(false);
  const real = Boolean(backend?.available && backend.view);
  const view = backend?.view;
  const connected = real ? Boolean(view.connected) : true;
  const audioReady = real ? Boolean(view.audio_ready) : true;
  const bindings = real ? view.local_bindings || [] : MOCK_BINDINGS;
  const hasBindings = bindings.length > 0;

  const steps = [
    { title: 'Войти в Twitch', hint: `Награды и EventSub${connected ? ' подключены' : ' подключатся автоматически'}`, done: connected },
    { title: 'Выбрать аудиовыход', hint: real ? view.audio_device || 'Устройство не выбрано' : 'Analog 1/2 (Audient iD4)', done: audioReady },
    { title: 'Проверить звук', hint: 'Короткий тестовый сигнал на выбранном устройстве', done: audioReady },
    { title: 'Привязать первый звук', hint: 'Нажмите «Заменить звук» на любой награде', done: hasBindings },
  ];

  async function login() {
    if (!real) return;
    setBusy(true);
    try {
      await backend.invoke('twitch_start_login');
      await backend.refresh();
    } finally {
      setBusy(false);
    }
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
            <Button variant="primary" size="lg" onClick={login} disabled={busy || connected}>
              {connected ? 'Продолжить настройку' : busy ? 'Открываем Twitch…' : 'Войти в Twitch'}
            </Button>
            <Button variant="ghost" size="lg">Пропустить</Button>
          </div>
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
