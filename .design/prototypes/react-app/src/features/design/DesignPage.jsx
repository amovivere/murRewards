import Button from '../../components/ui/Button.jsx';
import Icon from '../../components/ui/Icon.jsx';
import { Panel } from '../../components/ui/Panel.jsx';

const VARIANTS = ['primary', 'secondary', 'ghost', 'danger', 'danger-ghost'];
const STATES = [
  { label: 'default', disabled: false },
  { label: 'disabled', disabled: true },
];

export default function DesignPage() {
  return (
    <div className="page">
      <div className="page-head">
        <div>
          <div className="eyebrow">ПРОТОТИП · ТОЛЬКО ДЛЯ РЕВЬЮ</div>
          <h1 className="page-title">Дизайн-система</h1>
          <p className="page-subtitle">Токены и компоненты, из которых собираются экраны. Никаких абсолютных координат.</p>
        </div>
      </div>

      <Panel title="Кнопки" description="5 вариантов × 2 размера × состояния">
        <div className="design-buttons">
          {VARIANTS.map((variant) => (
            <div className="design-row" key={variant}>
              <span className="design-row__label">{variant}</span>
              <Button variant={variant} size="lg">
                Создать награду
              </Button>
              <Button variant={variant}>Проверить звук</Button>
              <Button variant={variant} size="sm">
                Отмена
              </Button>
              <Button variant={variant} disabled>
                Недоступно
              </Button>
              <Button variant={variant} icon={<Icon name="play" size={12} />}>
                С иконкой
              </Button>
            </div>
          ))}
          <div className="design-row">
            <span className="design-row__label">icon-only</span>
            <Button variant="secondary" icon={<Icon name="dots" />} />
            <Button variant="ghost" icon={<Icon name="plus" />} />
            <Button variant="danger-ghost" icon={<Icon name="next" />} />
          </div>
        </div>
      </Panel>

      <div className="two-col">
        <Panel title="Цвета" description="Роли, а не оттенки">
          <div className="token-grid">
            {[
              ['canvas', '#0A0A0A'],
              ['sidebar', '#0E0E0E'],
              ['panel', '#111111'],
              ['surface', '#161616'],
              ['border', '#242428'],
              ['text', '#F5F5F7'],
              ['text-2', '#B9B9C1'],
              ['muted', '#8B8B93'],
              ['accent', '#8B00FF'],
              ['ok', '#22C55E'],
              ['warn', '#F59E0B'],
              ['danger', '#EF4444'],
            ].map(([name, color]) => (
              <div className="token" key={name}>
                <span className="token__swatch" style={{ background: color }} />
                <span className="token__name">--{name}</span>
                <code>{color}</code>
              </div>
            ))}
          </div>
        </Panel>

        <Panel title="Типографика" description="Inter, один масштаб">
          <div className="type-scale">
            <div className="type-display">Стрим звучит так, как он задуман.</div>
            <div className="type-h1">Заголовок экрана</div>
            <div className="type-h2">Заголовок карточки</div>
            <div className="type-body">Основной текст интерфейса · 14–15 px</div>
            <div className="type-hint">Подписи и подсказки · 12–13 px</div>
            <div className="type-code">--token: value</div>
          </div>
        </Panel>
      </div>

      <Panel title="Каркас" description="Один desktop-лэйаут, окно 1600×1000, без брейкпоинтов">
        <div className="shell-schema">
          <div className="schema-sidebar">Sidebar 240</div>
          <div className="schema-main">
            <div className="schema-top">Topbar 64</div>
            <div className="schema-page">Page scroll</div>
            <div className="schema-footer">Footer 34</div>
          </div>
        </div>
      </Panel>
    </div>
  );
}
