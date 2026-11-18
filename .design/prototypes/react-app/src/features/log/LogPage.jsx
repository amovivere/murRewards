import { useEffect, useMemo, useState } from 'react';
import Button from '../../components/ui/Button.jsx';
import Icon from '../../components/ui/Icon.jsx';
import { invoke } from '../../lib/backend.js';

const MOCK_ROWS = [
  { time: '21:04:12', level: 'INFO', message: 'РћРІРµСЂР»РµР№ С‡Р°С‚Р°: РЅР°СЃС‚СЂРѕР№РєРё СЃРѕС…СЂР°РЅРµРЅС‹ В· РїСЂРµСЃРµС‚ В«РћР±С‹С‡РЅС‹Р№В»' },
  { time: '21:02:55', level: 'INFO', message: 'РњСѓР·С‹РєР°: С‚СЂРµРє В«Р”РРќРђРЎРўРРЇ вЂ” Р—РµРјР»СЏРєВ» РїРѕСЃС‚Р°РІР»РµРЅ РІ РѕС‡РµСЂРµРґСЊ' },
  { time: '21:01:07', level: 'WARN', message: '7TV: СЌРјРѕРґР·Рё РєР°РЅР°Р»Р° РЅРµ Р·Р°РіСЂСѓР·РёР»РёСЃСЊ, РїРѕРІС‚РѕСЂРёРј РїРѕР·Р¶Рµ' },
  { time: '20:58:40', level: 'INFO', message: 'Twitch: EventSub РїРѕРґРєР»СЋС‡С‘РЅ, РѕР¶РёРґР°РµРј Р°РєС‚РёРІР°С†РёРё РЅР°РіСЂР°Рґ' },
  { time: '20:57:19', level: 'ERROR', message: 'РђСѓРґРёРѕ: СѓСЃС‚СЂРѕР№СЃС‚РІРѕ Analog 1/2 РІСЂРµРјРµРЅРЅРѕ РЅРµРґРѕСЃС‚СѓРїРЅРѕ' },
  { time: '20:55:02', level: 'INFO', message: 'РќР°РіСЂР°РґР° В«РўС‹ РЅРѕРІРёС‡РѕРє?В»: newbie.mp3 РІРѕСЃРїСЂРѕРёР·РІРµРґС‘РЅ' },
];

const FILTERS = ['Р’СЃРµ', 'INFO', 'WARN', 'ERROR'];

export default function LogPage({ backend }) {
  const real = Boolean(backend?.available);
  const [rows, setRows] = useState(real ? [] : MOCK_ROWS);
  const [filter, setFilter] = useState('Р’СЃРµ');
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
        if (filter !== 'Р’СЃРµ' && row.level !== filter) return false;
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
          <div className="eyebrow">РЎРРЎРўР•РњРђ В· Р”РРђР“РќРћРЎРўРРљРђ</div>
          <h1 className="page-title">Р–СѓСЂРЅР°Р»</h1>
          <p className="page-subtitle">РќРѕРІС‹Рµ Р·Р°РїРёСЃРё СЃРІРµСЂС…Сѓ В· СѓСЂРѕРІРЅРё, РїРѕРёСЃРє Рё РѕС‡РёСЃС‚РєР°</p>
        </div>
        <div className="page-actions">
          <Button variant="secondary" icon={<Icon name="copy" />}>РЎРєРѕРїРёСЂРѕРІР°С‚СЊ</Button>
          <Button variant="danger-ghost" onClick={clearLog}>РћС‡РёСЃС‚РёС‚СЊ</Button>
        </div>
      </div>

      <div className="toolbar-row">
        <label className="search-field">
          <Icon name="search" />
          <input placeholder="РџРѕРёСЃРє РїРѕ Р¶СѓСЂРЅР°Р»Сѓ" value={query} onChange={(event) => setQuery(event.target.value)} />
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
        <span className="muted-line">{real ? `${rows.length} Р·Р°РїРёСЃРµР№ В· РѕР±РЅРѕРІР»РµРЅРёРµ РєР°Р¶РґС‹Рµ 2 СЃ` : 'РїСЂРѕС‚РѕС‚РёРї'}</span>
      </div>

      {error ? <div className="log-error">{error}</div> : null}

      <div className="log-table">
        {loading ? (
          <div className="log-row"><span className="log-time">вЂ”</span><span className="log-text">Р—Р°РіСЂСѓР¶Р°РµРј Р¶СѓСЂРЅР°Р»вЂ¦</span></div>
        ) : visible.length === 0 ? (
          <div className="log-row"><span className="log-time">вЂ”</span><span className="log-text">Р—Р°РїРёСЃРµР№ РЅРµС‚</span></div>
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
          РћС‚РєСЂС‹С‚СЊ РїР°РїРєСѓ Р¶СѓСЂРЅР°Р»Р°
        </Button>
      </div>
    </div>
  );
}

