import Button from '../../components/ui/Button.jsx';
import Icon from '../../components/ui/Icon.jsx';
import { Panel } from '../../components/ui/Panel.jsx';

const REWARDS = [
  { id: 1, name: 'Ты новичок?', cost: 200, color: '#F55A5F', file: 'newbie.mp3', volume: 200, active: true, letter: 'Т' },
  { id: 2, name: 'Мне нравится как он', cost: 150, color: '#4E7CFF', file: 'ilikehowhesm...', volume: 168, active: true, letter: 'М' },
  { id: 3, name: 'МУЗЫКА JOTUB', cost: 50, color: '#A970FF', file: '', volume: 0, active: true, letter: 'М', music: true },
  { id: 4, name: 'СКАЗАНУТЬ ЧЕТО', cost: 250, color: '#2DD4BF', file: '', volume: 0, active: true, letter: 'С' },
  { id: 5, name: 'А где донаты', cost: 100, color: '#F5C97B', file: 'wheredonat...', volume: 185, active: true, letter: 'А' },
  { id: 6, name: 'Смешок', cost: 200, color: '#EC4899', file: 'shitpost-lau...', volume: 109, active: true, letter: 'С' },
  { id: 7, name: 'Шиза', cost: 250, color: '#00C8FF', file: 'Kanye - Vult...', volume: 46, active: true, letter: 'Ш' },
  { id: 8, name: 'Беги', cost: 200, color: '#A3A3A3', file: 'run.mp3', volume: 133, active: true, letter: 'Б' },
];

export default function RewardsPage() {
  return (
    <div className="page">
      <div className="page-head">
        <div>
          <div className="eyebrow">TWITCH · CHANNEL POINTS</div>
          <h1 className="page-title">Награды</h1>
          <p className="page-subtitle">@goshanmurz · 11 наград · 9 со звуком · 2 без звука</p>
        </div>
        <div className="page-actions">
          <Button variant="ghost" icon={<Icon name="dots" />} />
          <Button variant="primary" icon={<Icon name="plus" />}>
            Создать награду
          </Button>
        </div>
      </div>

      <div className="toolbar-row">
        <label className="search-field">
          <Icon name="search" />
          <input placeholder="Поиск награды" />
        </label>
        <div className="view-switch">
          <button className="is-active">
            <Icon name="grid" /> Плитка
          </button>
          <button>
            <Icon name="list" /> Список
          </button>
        </div>
        <Button variant="secondary">Все награды</Button>
        <Button variant="ghost">Остановить всё</Button>
      </div>

      <div className="reward-filters">
        <button className="filter-pill is-active">
          Все <span>11</span>
        </button>
        <button className="filter-pill">
          Со звуком <span>9</span>
        </button>
        <button className="filter-pill">
          Без звука <span>2</span>
        </button>
        <button className="filter-pill">
          Играет <span>0</span>
        </button>
        <button className="filter-pill">
          Выключенные <span>9</span>
        </button>
      </div>

      <div className="reward-grid">
        {REWARDS.map((reward) => (
          <article
            className={`reward-card${reward.music ? ' is-music' : ''}`}
            key={reward.id}
            style={{ '--reward-color': reward.color, '--reward-tint': `${reward.color}22` }}
          >
            <div className="reward-card__top">
              <div className="reward-letter">{reward.letter}</div>
              <div className="reward-name-wrap">
                <h3>{reward.name}</h3>
                <div className="reward-meta">
                  {reward.cost} баллов · АКТИВНА
                </div>
              </div>
              <button className="icon-ghost" title="Действия">
                <Icon name="dots" />
              </button>
            </div>

            {reward.music ? (
              <div className="music-flag">♪ ★</div>
            ) : null}

            <div className="sound-row">
              {reward.file ? (
                <>
                  <button className="play-button">
                    <Icon name="play" size={12} />
                  </button>
                  <span className="sound-name">{reward.file}</span>
                  <span className="sound-format">MP3</span>
                </>
              ) : (
                <span className="sound-empty">Звук не выбран</span>
              )}
            </div>

            {reward.file ? (
              <div className="volume-row">
                <div className="volume-track">
                  <div className="volume-fill" style={{ width: `${Math.min(reward.volume / 2, 100)}%` }} />
                  <div className="volume-knob" style={{ left: `${Math.min(reward.volume / 2, 100)}%` }} />
                </div>
                <span>{reward.volume}%</span>
              </div>
            ) : (
              <Button variant="secondary" size="sm" full>
                Выбрать звук
              </Button>
            )}
          </article>
        ))}
      </div>

      <Panel title="Состояния" description="Прототип показывает только рабочую плитку; ниже — проверка компонентов.">
        <div className="inline-demo">
          <Button variant="primary">Создать награду</Button>
          <Button variant="secondary">Отмена</Button>
          <Button variant="ghost">Проверить звук</Button>
          <Button variant="danger">Удалить</Button>
          <Button variant="danger-ghost">Убрать звук</Button>
          <Button variant="secondary" disabled>
            Недоступно
          </Button>
        </div>
      </Panel>
    </div>
  );
}
