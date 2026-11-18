import Button from '../../components/ui/Button.jsx';
import { Panel } from '../../components/ui/Panel.jsx';

const STEPS = [
  { title: 'Войти в Twitch', hint: 'Награды и EventSub подключатся автоматически', done: true },
  { title: 'Выбрать аудиовыход', hint: 'Analog 1/2 (Audient iD4) — готов', done: true },
  { title: 'Проверить звук', hint: 'Короткий тестовый сигнал на выбранном устройстве', done: true },
  { title: 'Привязать первый звук', hint: 'Нажмите «Заменить звук» на любой награде', done: false },
];

export default function OnboardingPage() {
  return (
    <div className="page">
      <div className="page-head">
        <div>
          <div className="eyebrow">ПЕРВЫЙ ЗАПУСК</div>
          <h1 className="page-title">Добро пожаловать</h1>
          <p className="page-subtitle">Настройте звук и награды — приложение подскажет, что осталось.</p>
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
            <Button variant="primary" size="lg">
              Продолжить настройку
            </Button>
            <Button variant="ghost" size="lg">
              Пропустить
            </Button>
          </div>
        </div>

        <div className="onboarding-steps">
          {STEPS.map((step, index) => (
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
          <div className="local-row">
            <div className="local-row__letter">Т</div>
            <div className="local-row__title">Ты новичок?</div>
            <div className="local-row__meta">newbie.mp3 · 200%</div>
            <Button variant="secondary" size="sm">
              Проверить
            </Button>
          </div>
          <div className="local-row">
            <div className="local-row__letter">М</div>
            <div className="local-row__title">Мне нравится как он</div>
            <div className="local-row__meta">ilikehowhesm.mp3 · 168%</div>
            <Button variant="secondary" size="sm">
              Проверить
            </Button>
          </div>
          <div className="local-row">
            <div className="local-row__letter">Б</div>
            <div className="local-row__title">Беги</div>
            <div className="local-row__meta">run.mp3 · 133%</div>
            <Button variant="secondary" size="sm">
              Проверить
            </Button>
          </div>
        </div>
      </Panel>
    </div>
  );
}
