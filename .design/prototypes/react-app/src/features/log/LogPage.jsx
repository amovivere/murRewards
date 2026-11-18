import Button from '../../components/ui/Button.jsx';
import Icon from '../../components/ui/Icon.jsx';

const ROWS = [
  { time: '21:04:12', level: 'INFO', text: 'Оверлей чата: настройки сохранены · пресет «Обычный»' },
  { time: '21:02:55', level: 'INFO', text: 'Музыка: трек «ДИНАСТИЯ — Земляк» поставлен в очередь' },
  { time: '21:01:07', level: 'WARN', text: '7TV: эмодзи канала не загрузились, повторим позже' },
  { time: '20:58:40', level: 'INFO', text: 'Twitch: EventSub подключён, ожидаем активации наград' },
  { time: '20:57:19', level: 'ERROR', text: 'Аудио: устройство Analog 1/2 временно недоступно' },
  { time: '20:55:02', level: 'INFO', text: 'Награда «Ты новичок?»: newbie.mp3 воспроизведён' },
];

export default function LogPage() {
  return (
    <div className="page">
      <div className="page-head">
        <div>
          <div className="eyebrow">СИСТЕМА · ДИАГНОСТИКА</div>
          <h1 className="page-title">Журнал</h1>
          <p className="page-subtitle">Новые записи сверху · уровни, поиск и очистка</p>
        </div>
        <div className="page-actions">
          <Button variant="secondary" icon={<Icon name="copy" />}>
            Скопировать
          </Button>
          <Button variant="danger-ghost">Очистить</Button>
        </div>
      </div>

      <div className="toolbar-row">
        <label className="search-field">
          <Icon name="search" />
          <input placeholder="Поиск по журналу" />
        </label>
        <div className="filter-row">
          <button className="filter-pill is-active">Все</button>
          <button className="filter-pill">INFO</button>
          <button className="filter-pill">WARN</button>
          <button className="filter-pill">ERROR</button>
        </div>
      </div>

      <div className="log-table">
        {ROWS.map((row) => (
          <div className="log-row" key={row.time + row.text}>
            <span className="log-time">{row.time}</span>
            <span className={`log-level log-level--${row.level.toLowerCase()}`}>{row.level}</span>
            <span className="log-text">{row.text}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
