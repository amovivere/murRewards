import { useState } from 'react';
import Button from '../../components/ui/Button.jsx';
import ColorPalette from '../../components/ui/ColorPalette.jsx';
import Icon from '../../components/ui/Icon.jsx';
import Modal from '../../components/ui/Modal.jsx';
import { Panel } from '../../components/ui/Panel.jsx';

const INITIAL_REWARDS = [
  { id: 1, name: 'Ты новичок?', cost: 200, color: '#F55A5F', file: 'newbie.mp3', volume: 200, active: true, letter: 'Т' },
  { id: 2, name: 'Мне нравится как он', cost: 150, color: '#4E7CFF', file: 'ilikehowhesm...', volume: 168, active: true, letter: 'М' },
  { id: 3, name: 'МУЗЫКА JOTUB', cost: 50, color: '#A970FF', file: '', volume: 0, active: true, letter: 'М', music: true },
  { id: 4, name: 'СКАЗАНУТЬ ЧЕТО', cost: 250, color: '#2DD4BF', file: '', volume: 0, active: true, letter: 'С' },
  { id: 5, name: 'А где донаты', cost: 100, color: '#F5C97B', file: 'wheredonat...', volume: 185, active: true, letter: 'А' },
  { id: 6, name: 'Смешок', cost: 200, color: '#EC4899', file: 'shitpost-lau...', volume: 109, active: true, letter: 'С' },
  { id: 7, name: 'Шиза', cost: 250, color: '#00C8FF', file: 'Kanye - Vult...', volume: 46, active: true, letter: 'Ш' },
  { id: 8, name: 'Беги', cost: 200, color: '#A3A3A3', file: 'run.mp3', volume: 133, active: true, letter: 'Б' },
];

const FILTERS = [
  { id: 'all', label: 'Все', count: 11 },
  { id: 'sound', label: 'Со звуком', count: 9 },
  { id: 'silent', label: 'Без звука', count: 2 },
  { id: 'playing', label: 'Играет', count: 0 },
  { id: 'off', label: 'Выключенные', count: 9 },
];

function CreateRewardModal({ open, onClose, onCreate }) {
  const [name, setName] = useState('');
  const [cost, setCost] = useState('100');
  const [description, setDescription] = useState('');
  const [color, setColor] = useState('#A970FF');
  const [needText, setNeedText] = useState(true);
  const [needLink, setNeedLink] = useState(false);

  function submit() {
    if (!name.trim()) return;
    onCreate({
      name: name.trim(),
      cost: Number(cost) || 0,
      color,
      description: description.trim(),
      needText,
      needLink,
    });
    setName('');
    setCost('100');
    setDescription('');
    setColor('#A970FF');
    setNeedText(true);
    setNeedLink(false);
    onClose();
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Новая награда"
      subtitle="Награда создастся в канале через Twitch API и сразу появится в списке."
      width={600}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Отмена
          </Button>
          <Button variant="primary" onClick={submit} disabled={!name.trim()}>
            Создать награду
          </Button>
        </>
      }
    >
      <div className="modal-form">
        <label className="modal-field">
          <span>НАЗВАНИЕ</span>
          <input
            className="ui-input"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Например, «Сказать слово»"
            autoFocus
          />
        </label>
        <label className="modal-field">
          <span>ЦЕНА, БАЛЛОВ</span>
          <input className="ui-input" value={cost} onChange={(event) => setCost(event.target.value.replace(/\D/g, ''))} inputMode="numeric" />
        </label>
        <label className="modal-field">
          <span>ОПИСАНИЕ</span>
          <textarea
            className="ui-input modal-textarea"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="Что получит зритель и как это работает"
          />
        </label>
        <div className="modal-field">
          <span>ЦВЕТ КАРТОЧКИ</span>
          <ColorPalette value={color} onChange={setColor} />
          <div className="modal-color-line">
            <span className="modal-color-preview" style={{ background: color }} />
            <code>{color.toUpperCase()}</code>
            <span className="muted-line">Цвет хранится в Twitch; на фон карточки влияет как 13 %-й тинт.</span>
          </div>
        </div>
        <div className="modal-checks">
          <div className="modal-field-label">ЧТО НУЖНО ОТ ЗРИТЕЛЯ</div>
          <label className="modal-check">
            <input type="checkbox" checked={needText} onChange={(event) => setNeedText(event.target.checked)} />
            <span>Текст сообщения (до 280 символов)</span>
          </label>
          <label className="modal-check">
            <input type="checkbox" checked={needLink} onChange={(event) => setNeedLink(event.target.checked)} />
            <span>Ссылка YouTube — для музыки</span>
          </label>
        </div>
        <div className="modal-hint">Награду можно создать и в Twitch — приложение подхватит её при обновлении.</div>
      </div>
    </Modal>
  );
}

function EditRewardModal({ reward, onClose, onSave }) {
  const [name, setName] = useState(reward?.name || '');
  const [cost, setCost] = useState(String(reward?.cost || 100));
  const [color, setColor] = useState(reward?.color || '#A970FF');

  if (!reward) return null;

  return (
    <Modal
      open={!!reward}
      onClose={onClose}
      title="Редактировать награду"
      subtitle="Изменения уйдут в Twitch и сразу появятся в списке."
      width={560}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Отмена
          </Button>
          <Button
            variant="primary"
            disabled={!name.trim()}
            onClick={() => {
              onSave({ ...reward, name: name.trim(), cost: Number(cost) || 0, color });
              onClose();
            }}
          >
            Сохранить
          </Button>
        </>
      }
    >
      <div className="modal-form">
        <label className="modal-field">
          <span>НАЗВАНИЕ</span>
          <input className="ui-input" value={name} onChange={(event) => setName(event.target.value)} />
        </label>
        <label className="modal-field">
          <span>ЦЕНА, БАЛЛОВ</span>
          <input className="ui-input" value={cost} onChange={(event) => setCost(event.target.value.replace(/\D/g, ''))} inputMode="numeric" />
        </label>
        <div className="modal-field">
          <span>ЦВЕТ КАРТОЧКИ</span>
          <ColorPalette value={color} onChange={setColor} />
        </div>
      </div>
    </Modal>
  );
}

function DeleteRewardModal({ reward, onClose, onConfirm }) {
  return (
    <Modal
      open={!!reward}
      onClose={onClose}
      title={`Удалить «${reward?.name || ''}»?`}
      subtitle="Награда будет удалена в Twitch. Привязка звука и настройки громкости тоже исчезнут."
      width={460}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Отмена
          </Button>
          <Button variant="danger" onClick={onConfirm}>
            Удалить награду
          </Button>
        </>
      }
    >
      <div className="modal-danger-note">
        Это действие нельзя отменить. Баллы, потраченные зрителями, не возвращаются.
      </div>
    </Modal>
  );
}

export default function RewardsPage({ backend }) {
  const [rewards, setRewards] = useState(INITIAL_REWARDS);
  const [filter, setFilter] = useState('all');
  const [createOpen, setCreateOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [editTarget, setEditTarget] = useState(null);
  const [menuFor, setMenuFor] = useState(null);
  const [toast, setToast] = useState('');

  const realView = backend?.view;
  const real = Boolean(backend?.available && realView?.connected);
  const displayRewards = real
    ? (realView.rewards || []).map((reward) => ({
        id: reward.id,
        name: reward.title,
        cost: reward.cost,
        color: /^#[0-9a-f]{6}$/i.test(reward.color || '') ? reward.color : '#A3A3A3',
        letter: (reward.title || '?').trim().charAt(0).toUpperCase(),
        file: reward.file?.name || '',
        meta: reward.file?.meta || '',
        volume: reward.file ? Math.round((reward.file.volume ?? 1) * 100) : 0,
        active: reward.available !== false,
        playing: Boolean(reward.playing),
        requiresInput: Boolean(reward.requires_input),
        hasSound: Boolean(reward.has_sound),
      }))
    : rewards;

  const counts = {
    all: displayRewards.length,
    sound: displayRewards.filter((reward) => reward.file).length,
    silent: displayRewards.filter((reward) => !reward.file).length,
    playing: displayRewards.filter((reward) => reward.playing).length,
    off: displayRewards.filter((reward) => !reward.active).length,
  };

  const visible = displayRewards.filter((reward) => {
    if (filter === 'sound') return Boolean(reward.file);
    if (filter === 'silent') return !reward.file;
    if (filter === 'off') return !reward.active;
    if (filter === 'playing') return Boolean(reward.playing);
    return true;
  });

  function notify(message) {
    setToast(message);
    window.setTimeout(() => setToast(''), 2200);
  }

  async function createReward(data) {
    if (real) {
      try {
        await backend.call('create_reward', {
          title: data.name,
          cost: data.cost,
          color: data.color,
          requiresInput: data.needText,
          soundPath: null,
        });
        notify(`Награда «${data.name}» создана в Twitch`);
        return;
      } catch (error) {
        notify(`Не удалось создать: ${error}`);
        return;
      }
    }
    const letter = data.name.trim().charAt(0).toUpperCase() || 'Н';
    setRewards((current) => [
      ...current,
      {
        id: Date.now(),
        name: data.name,
        cost: data.cost,
        color: data.color,
        file: '',
        volume: 0,
        active: true,
        letter,
      },
    ]);
    notify(`Награда «${data.name}» создана`);
  }

  async function saveReward(updated) {
    if (real) {
      try {
        await backend.call('update_reward', {
          rewardId: updated.id,
          title: updated.name,
          cost: updated.cost,
          color: updated.color,
          requiresInput: Boolean(updated.requiresInput),
          soundPath: null,
          clearSound: false,
        });
        notify(`Награда «${updated.name}» обновлена`);
        return;
      } catch (error) {
        notify(`Не удалось обновить: ${error}`);
        return;
      }
    }
    setRewards((current) => current.map((reward) => (reward.id === updated.id ? updated : reward)));
    notify(`Награда «${updated.name}» обновлена`);
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    if (real) {
      try {
        await backend.call('delete_reward', { rewardId: deleteTarget.id, title: deleteTarget.name });
        notify(`Награда «${deleteTarget.name}» удалена`);
      } catch (error) {
        notify(`Не удалось удалить: ${error}`);
      }
      setDeleteTarget(null);
      return;
    }
    setRewards((current) => current.filter((reward) => reward.id !== deleteTarget.id));
    notify(`Награда «${deleteTarget.name}» удалена`);
    setDeleteTarget(null);
  }

  async function chooseSound(reward) {
    if (real) {
      try {
        await backend.call('choose_sound', { rewardId: reward.id, title: reward.name });
        notify('Звук выбран');
      } catch (error) {
        notify(`Не удалось выбрать звук: ${error}`);
      }
      return;
    }
    notify('Открыт выбор звука');
  }

  async function removeSound(reward) {
    if (real) {
      try {
        await backend.call('clear_sound', { rewardId: reward.id });
        notify('Звук убран');
      } catch (error) {
        notify(`Не удалось убрать звук: ${error}`);
      }
      return;
    }
    setRewards((current) =>
      current.map((item) => (item.id === reward.id ? { ...item, file: '', volume: 0 } : item))
    );
    notify('Звук убран');
  }

  async function previewSound(reward) {
    if (real) {
      try {
        await backend.invoke('preview_sound', { rewardId: reward.id });
        notify(`Звук: ${reward.file || reward.name}`);
      } catch (error) {
        notify(`Не удалось проиграть: ${error}`);
      }
      return;
    }
    notify(`Тест: ${reward.file}`);
  }

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <div className="eyebrow">TWITCH · CHANNEL POINTS</div>
          <h1 className="page-title">Награды</h1>
          <p className="page-subtitle">@goshanmurz · {counts.all} наград · {counts.sound} со звуком · {counts.silent} без звука</p>
        </div>
        <div className="page-actions">
          <Button variant="ghost" icon={<Icon name="dots" />} />
          <Button variant="primary" icon={<Icon name="plus" />} onClick={() => setCreateOpen(true)}>
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
        {FILTERS.map((item) => (
          <button
            key={item.id}
            className={`filter-pill${filter === item.id ? ' is-active' : ''}`}
            onClick={() => setFilter(item.id)}
          >
            {item.label} <span>{counts[item.id] ?? 0}</span>
          </button>
        ))}
      </div>

      <div className="reward-grid">
        {visible.map((reward) => (
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
                  {reward.cost} баллов · {reward.active ? 'АКТИВНА' : 'ВЫКЛЮЧЕНА'}
                  {reward.playing ? ' · играет' : ''}
                </div>
              </div>
              <button className="icon-ghost" title="Действия" onClick={() => setMenuFor(menuFor === reward.id ? null : reward.id)}>
                <Icon name="dots" />
              </button>
            </div>

            {reward.music ? <div className="music-flag">♪ ★</div> : null}

            {menuFor === reward.id ? (
              <div className="reward-menu">
                <button onClick={() => { setMenuFor(null); setEditTarget(reward); }}>Редактировать</button>
                <button onClick={() => { setMenuFor(null); chooseSound(reward); }}>Заменить звук</button>
                <button onClick={() => { setMenuFor(null); removeSound(reward); }}>Убрать звук</button>
                <button className="is-danger" onClick={() => { setMenuFor(null); setDeleteTarget(reward); }}>
                  Удалить награду
                </button>
              </div>
            ) : null}

            <div className="sound-row">
              {reward.file ? (
                <>
                  <button className="play-button" onClick={() => previewSound(reward)}>
                    <Icon name="play" size={12} />
                  </button>
                  <span className="sound-name">{reward.file}</span>
                  <span className="sound-format">{reward.meta?.split('·')[0]?.trim() || 'MP3'}</span>
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
              <Button variant="secondary" size="sm" full onClick={() => chooseSound(reward)}>
                Выбрать звук
              </Button>
            )}
          </article>
        ))}
      </div>

      {visible.length === 0 ? (
        <div className="reward-empty">
          <div className="empty-state__title">Ничего не найдено</div>
          <div className="empty-state__hint">Сбросьте фильтр или создайте новую награду.</div>
        </div>
      ) : null}

      <Panel title="Состояния" description="Прототип показывает рабочую плитку; кнопки ниже проверяют варианты.">
        <div className="inline-demo">
          <Button variant="primary" onClick={() => setCreateOpen(true)}>
            Создать награду
          </Button>
          <Button variant="secondary">Отмена</Button>
          <Button variant="ghost">Проверить звук</Button>
          <Button variant="danger">Удалить</Button>
          <Button variant="danger-ghost">Убрать звук</Button>
          <Button variant="secondary" disabled>
            Недоступно
          </Button>
        </div>
      </Panel>

      <CreateRewardModal open={createOpen} onClose={() => setCreateOpen(false)} onCreate={createReward} />
      <EditRewardModal
        reward={editTarget}
        onClose={() => setEditTarget(null)}
        onSave={saveReward}
      />
      <DeleteRewardModal reward={deleteTarget} onClose={() => setDeleteTarget(null)} onConfirm={confirmDelete} />
      {toast ? <div className="ui-toast">{toast}</div> : null}
    </div>
  );
}
