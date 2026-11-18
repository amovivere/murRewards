import { useState } from 'react';
import Button from '../../components/ui/Button.jsx';
import Icon from '../../components/ui/Icon.jsx';
import { Panel, Pill } from '../../components/ui/Panel.jsx';
import { SliderRow, ToggleRow } from '../../components/ui/Field.jsx';

const ACCENTS = ['#8B00FF', '#4E7CFF', '#2DD4BF', '#EC4899', '#F5C97B', '#F55A5F', '#22C55E', '#A3A3A3'];

export default function SettingsPage() {
  const [accent, setAccent] = useState('#8B00FF');
  const [autoUpdate, setAutoUpdate] = useState(true);
  const [closeToTray, setCloseToTray] = useState(true);

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
        actions={<Pill tone="ok">OK</Pill>}
      >
        <div className="health-grid">
          <span className="dot dot--ok" /> <b>Twitch</b> <span>Подключено · @goshanmurz</span> <a>Открыть</a>
          <span className="dot dot--ok" /> <b>EventSub</b> <span>Слушаем активации наград</span> <a>Открыть</a>
          <span className="dot dot--warn" /> <b>Оверлей</b> <span>Доступен · 127.0.0.1:8770/chat-overlay</span> <a>Открыть</a>
          <span className="dot dot--ok" /> <b>Звук</b> <span>Analog 1/2 (Audient iD4)</span> <a>Открыть</a>
        </div>
        <div className="inline-row">
          <Button variant="secondary" size="sm">
            Скопировать диагностику
          </Button>
          <Button variant="ghost" size="sm">
            Открыть журнал
          </Button>
        </div>
      </Panel>

      <div className="three-col">
        <Panel title="Twitch" description="Аккаунт канала, с которого читаются награды">
          <div className="strong-line">Подключено · @goshanmurz</div>
          <div className="muted-line">Активации наград слушаются</div>
          <Button variant="secondary" full>
            Обновить данные
          </Button>
          <Button variant="secondary" full>
            Переподключить события
          </Button>
          <div className="danger-zone">
            <div className="danger-zone__label">ОПАСНАЯ ЗОНА</div>
            <div className="muted-line">Отключить Twitch — награды и чат перестанут работать.</div>
            <Button variant="danger-ghost" size="sm">
              Сменить…
            </Button>
          </div>
        </Panel>

        <Panel title="Звук" description="Громкость приложения и воспроизведение">
          <SliderRow label="Громкость" value={29} min={0} max={100} unit="%" onChange={() => {}} />
          <ToggleRow label="Без звука" hint="Заглушить все звуки наград" checked={false} onChange={() => {}} />
          <ToggleRow
            label="Воспроизводить звуки наград"
            hint="Активации будут игнорироваться, пока выключено"
            checked
            onChange={() => {}}
          />
        </Panel>

        <Panel title="Аудиовыход" description="Куда играют звуки наград">
          <div className="ok-line">
            <span className="dot dot--ok" /> Analog 1/2 (Audient iD4)
          </div>
          <Button variant="secondary" full>
            Проверить звук
          </Button>
          <Button variant="secondary" full>
            Перезапустить аудио
          </Button>
          <Button variant="secondary" full>
            Остановить все звуки
          </Button>
          <Button variant="secondary" full>
            Выровнять громкость
          </Button>
        </Panel>
      </div>

      <div className="three-col">
        <Panel title="Внешний вид" description="Акцентный цвет интерфейса. Не меняет награды.">
          <div className="accent-buttons">
            <Button variant="primary" size="sm">
              Пример кнопки
            </Button>
            <span className="accent-chip" style={{ background: accent }} />
          </div>
          <div className="accent-palette">
            {ACCENTS.map((color) => (
              <button
                key={color}
                className={`accent-swatch${accent === color ? ' is-active' : ''}`}
                style={{ background: color }}
                onClick={() => setAccent(color)}
                title={color}
              />
            ))}
          </div>
          <div className="inline-row">
            <code className="url-code">{accent}</code>
            <Button variant="ghost" size="sm">
              Сбросить
            </Button>
          </div>
          <div className="muted-line">Меняется только акцент, статусы — нет.</div>
        </Panel>

        <Panel title="Приложение" description="Запуск и поведение окна">
          <ToggleRow label="Запускать с Windows" checked={false} onChange={() => {}} />
          <ToggleRow label="Закрывать в трей" hint="Крестик прячет окно" checked={closeToTray} onChange={setCloseToTray} />
          <ToggleRow label="Запускать свёрнутым" checked={false} onChange={() => {}} />
          <ToggleRow label="Автообновление" checked={autoUpdate} onChange={setAutoUpdate} />
        </Panel>

        <Panel title="Музыка" description="Треки по заявке из чата">
          <div className="ok-line">
            <span className="dot dot--ok" /> Готова к заявкам
          </div>
          <div className="muted-line">НАГРАДА</div>
          <div className="strong-line">МУЗЫКА JOTUB · 50 баллов</div>
          <Button variant="secondary" full>
            Настроить музыку
          </Button>
          <Button variant="ghost" full>
            Открыть вкладку «Музыка» →
          </Button>
        </Panel>
      </div>

      <div className="inline-row">
        <Button variant="ghost" icon={<Icon name="external" />}>
          Открыть папку данных
        </Button>
        <Button variant="danger-ghost">Сбросить настройки</Button>
      </div>
    </div>
  );
}
