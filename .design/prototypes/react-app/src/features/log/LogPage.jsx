import { useEffect, useMemo, useState } from 'react';
import Button from '../../components/ui/Button.jsx';
import ConfirmModal from '../../components/ui/ConfirmModal.jsx';
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

const FILTERS = ['Все', 'INFO', 'WARN', 'ERROR', 'DEBUG'];

export default function LogPage({ backend }) {
  const real = Boolean(backend?.available);
  const [rows, setRows] = useState(real ? [] : MOCK_ROWS);
  const [filter, setFilter] = useState('Все');
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(real);
  const [error, setError] = useState('');
  const [clearOpen, setClearOpen] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [toast, setToast] = useState('');

  async function load() {
    if (!real) return;
    try {
      const scroller = document.querySelector('.content');
      const scrollTop = scroller?.scrollTop ?? 0;
      const entries = await invoke('get_logs', { limit: 200 });
      setRows(entries || []);
      setError('');
      if (scroller) {
        requestAnimationFrame(() => {
          scroller.scrollTop = scrollTop;
        });
      }
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
    setClearing(true);
    try {
      if (!real) {
        setRows([]);
      } else {
        await invoke('clear_log');
        await load();
      }
      setClearOpen(false);
      setToast('Журнал очищен');
      window.setTimeout(() => setToast(''), 2200);
    } catch (err) {
      setError(String(err));
    } finally {
      setClearing(false);
    }
  }

  async function copyLog() {
    try {
      const text = visible.map((row) => `${row.time} ${row.level} ${row.message}`).join('\n');
      await navigator.clipboard.writeText(text);
      setToast('Журнал скопирован');
      window.setTimeout(() => setToast(''), 2200);
    } catch {
      setToast('Не удалось скопировать журнал');
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
          <Button variant="secondary" icon={<Icon name="copy" />} onClick={copyLog}>Скопировать</Button>
          <Button variant="danger-ghost" onClick={() => setClearOpen(true)}>Очистить</Button>
        </div>
      </div>

      <div className="toolbar-row log-toolbar">
        <label className="search-field">
          <Icon name="search" />
          <input placeholder="Поиск по журналу" aria-label="Поиск по журналу" value={query} onChange={(event) => setQuery(event.target.value)} />
        </label>
        <div className="filter-row">
          {FILTERS.map((item) => (
            <button
              key={item}
              className={`filter-pill${filter === item ? ' is-active' : ''}`}
              onClick={() => setFilter(item)}
              aria-pressed={filter === item}
            >
              {item}
            </button>
          ))}
        </div>
        <span className="muted-line">{real ? `${visible.length} из ${rows.length} записей` : 'прототип'}</span>
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
      <ConfirmModal
        open={clearOpen}
        title="Очистить журнал?"
        text="Текущие записи будут сохранены в архив, а журнал начнётся заново. Это действие нельзя отменить из интерфейса."
        confirmLabel="Очистить журнал"
        danger
        busy={clearing}
        onClose={() => setClearOpen(false)}
        onConfirm={clearLog}
      />
      {toast ? <div className="ui-toast" role="status" aria-live="polite">{toast}</div> : null}
    </div>
  );
}
