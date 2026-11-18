import { useEffect, useMemo, useState } from 'react';
import Button from '../../components/ui/Button.jsx';
import Icon from '../../components/ui/Icon.jsx';
import { invoke } from '../../lib/backend.js';

const MOCK_ROWS = [
  { time: '21:04:12', level: 'INFO', message: 'Оверлей чата: настройки сохранены · пресет «Обычный»' },
  { time: '21:02:55', level: 'INFO', message: 'Музыка: трек «ДИНАСТИЯ — Земляк» поставлен в очередь' },
  { time: '21:01:07', level: 'WARN', message: '7TV: эмодзи канала не загрузились, повторим позже' },
  { time: '20:58:40', level: 'INFO', message: 'Twitch: EventSub подключён, ожидаем активации наград' },
  { time: '20:57:19', level: 'ERROR', message: 'Аудио: устройство Analog 1/2 временно недоступно' },
  { time: '20:55:02', level: 'INFO', message: 'Награда «Ты новичок?»: newbie.mp3 воспроизведён' },
];

const FILTERS = ['Все', 'INFO', 'WARN', 'ERROR'];

export default function LogPage({ backend }) {
  const real = Boolean(backend?.available);
  const [rows, setRows] = useState(real ? [] : MOCK_ROWS);
  const [filter, setFilter] = useState('Все');
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(real);
  const [error, setError] = useState('');

  async function load() {
    if (!real) return;
    try {
      const entries = await invoke('get_logs', { limit: 200 });
      setRows(entries || []);
      setError('');
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!real) return undefined;
    load();
    const timer = window.setInterval(load, 2000);
    return () => window.clearInterval(timer);
  }, [real]);

  const visible = useMemo(
    () =>
      rows.filter((row) => {
        if (filter !== 'Все' && row.level !== filter) return false;
        if (query && !row.message.toLowerCase().includes(query.toLowerCase())) return false;
        return true;
      }),
    [rows, filter, query]
  );

  async function clearLog() {
    if (!real) {
      setRows([]);
      return;
    }
    try {
      await invoke('clear_log');
      await load();
    } catch (err) {
      setError(String(err));
    }
  }

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <div className="eyebrow">СИСТЕМА · ДИАГНОСТИКА</div>
          <h1 className="page-title">Журнал</h1>
          <p className="page-subtitle">Новые записи сверху · уровни, поиск и очистка</p>
        </div>
        <div className="page-actions">
          <Button variant="secondary" icon={<Icon name="copy" />}>Скопировать</Button>
          <Button variant="danger-ghost" onClick={clearLog}>Очистить</Button>
        </div>
      </div>

      <div className="toolbar-row">
        <label className="search-field">
          <Icon name="search" />
          <input placeholder="Поиск по журналу" value={query} onChange={(event) => setQuery(event.target.value)} />
        </label>
        <div className="filter-row">
          {FILTERS.map((item) => (
            <button
              key={item}
              className={`filter-pill${filter === item ? ' is-active' : ''}`}
              onClick={() => setFilter(item)}
            >
              {item}
            </button>
          ))}
        </div>
        <span className="muted-line">{real ? `${rows.length} записей · обновление каждые 2 с` : 'прототип'}</span>
      </div>

      {error ? <div className="log-error">{error}</div> : null}

      <div className="log-table">
        {loading ? (
          <div className="log-row"><span className="log-time">—</span><span className="log-text">Загружаем журнал…</span></div>
        ) : visible.length === 0 ? (
          <div className="log-row"><span className="log-time">—</span><span className="log-text">Записей нет</span></div>
        ) : (
          visible.map((row, index) => (
            <div className="log-row" key={`${row.time}-${index}`}>
              <span className="log-time">{row.time}</span>
              <span className={`log-level log-level--${String(row.level).toLowerCase()}`}>{row.level}</span>
              <span className="log-text">{row.message}</span>
            </div>
          ))
        )}
      </div>

      <div className="inline-row">
        <Button variant="ghost" icon={<Icon name="external" />} onClick={() => real && invoke('open_folder', { kind: 'logs' }).catch(() => {})}>
          Открыть папку журнала
        </Button>
      </div>
    </div>
  );
}
