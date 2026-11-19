import { useEffect, useRef, useState } from 'react';
import Button from '../../components/ui/Button.jsx';
import ColorPalette from '../../components/ui/ColorPalette.jsx';
import Icon from '../../components/ui/Icon.jsx';
import Modal from '../../components/ui/Modal.jsx';
import { SliderRow } from '../../components/ui/Field.jsx';

const INITIAL_REWARDS = [
  { id: 1, name: 'Ты новичок?', cost: 200, color: '#F55A5F', file: 'newbie.mp3', volume: 200, active: true },
  { id: 2, name: 'Мне нравится как он', cost: 150, color: '#4E7CFF', file: 'ilikehowhesm...', volume: 168, active: true },
  { id: 3, name: 'МУЗЫКА JOTUB', cost: 50, color: '#A970FF', file: '', volume: 0, active: true, music: true },
  { id: 4, name: 'СКАЗАНУТЬ ЧЕТО', cost: 250, color: '#2DD4BF', file: '', volume: 0, active: true },
  { id: 5, name: 'А где донаты', cost: 100, color: '#F5C97B', file: 'wheredonat...', volume: 185, active: true },
  { id: 6, name: 'Смешок', cost: 200, color: '#EC4899', file: 'shitpost-lau...', volume: 109, active: true },
  { id: 7, name: 'Шиза', cost: 250, color: '#00C8FF', file: 'Kanye - Vult...', volume: 46, active: true },
  { id: 8, name: 'Беги', cost: 200, color: '#A3A3A3', file: 'run.mp3', volume: 133, active: true },
];

const FILTERS = [
  { id: 'all', label: 'Все' },
  { id: 'sound', label: 'Со звуком' },
  { id: 'silent', label: 'Без звука' },
  { id: 'playing', label: 'Играет' },
  { id: 'off', label: 'Выключенные' },
];

function mapReward(reward) {
  return {
    id: reward.id,
    name: reward.title,
    cost: reward.cost,
    color: /^#[0-9a-f]{6}$/i.test(reward.color || '') ? reward.color : '#A3A3A3',
    file: reward.file?.name || '',
    path: reward.file?.path || '',
    meta: reward.file?.meta || '',
    volume: reward.file ? Math.round((reward.file.volume ?? 1) * 100) : 0,
    active: reward.available !== false,
    playing: Boolean(reward.playing),
    requiresInput: Boolean(reward.requires_input),
    hasSound: Boolean(reward.has_sound),
    images: reward.images || [],
    imageSettings: reward.image || {
      max_angle_deg: 40,
      size_pct: 32,
      opacity: 0.95,
      duration_ms: 4000,
      safe_margin_pct: 6,
    },
  };
}

function CreateRewardModal({ open, onClose, onCreate, returnFocus }) {
  const [name, setName] = useState('');
  const [cost, setCost] = useState('100');
  const [color, setColor] = useState('#A970FF');
  const [needText, setNeedText] = useState(true);

  useEffect(() => {
    if (!open) return;
    setName('');
    setCost('100');
    setColor('#A970FF');
    setNeedText(true);
  }, [open]);

  function submit() {
    if (!name.trim()) return;
    onCreate({
      name: name.trim(),
      cost: Number(cost) || 0,
      color,
      needText,
    });
    onClose();
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Новая награда"
      subtitle="Награда создастся в канале через Twitch API и сразу появится в списке."
      width={600}
      returnFocus={returnFocus}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Отмена
          </Button>
          <Button variant="primary" onClick={submit} disabled={!name.trim() || Number(cost) < 1}>
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
        </div>
        <div className="modal-hint">Награду можно создать и в Twitch — приложение подхватит её при обновлении.</div>
      </div>
    </Modal>
  );
}

function EditRewardModal({
  reward,
  onClose,
  onSave,
  returnFocus,
  onChooseSound,
  onRemoveSound,
  onPreviewSound,
  onVolumeChange,
  onAddImages,
  onRemoveImage,
  onImageSettings,
  onPreviewImage,
}) {
  const [name, setName] = useState('');
  const [cost, setCost] = useState('100');
  const [color, setColor] = useState('#A970FF');
  const [volume, setVolume] = useState(100);

  useEffect(() => {
    if (!reward) return;
    setName(reward.name || '');
    setCost(String(reward.cost ?? 100));
    setColor(reward.color || '#A970FF');
    setVolume(reward.volume ?? 100);
  }, [reward]);

  if (!reward) return null;

  return (
    <Modal
      open={!!reward}
      onClose={onClose}
      title="Настройки карточки"
      subtitle="Основные поля уйдут в Twitch, звук применяется сразу."
      width={620}
      returnFocus={returnFocus}
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
        <div className="control-grid">
          <label className="modal-field">
            <span>НАЗВАНИЕ</span>
            <input className="ui-input" value={name} onChange={(event) => setName(event.target.value)} />
          </label>
          <label className="modal-field">
            <span>ЦЕНА, БАЛЛОВ</span>
            <input className="ui-input" value={cost} onChange={(event) => setCost(event.target.value.replace(/\D/g, ''))} inputMode="numeric" />
          </label>
        </div>
        <div className="modal-field">
          <span>ЦВЕТ КАРТОЧКИ</span>
          <ColorPalette value={color} onChange={setColor} />
        </div>

        <div className="modal-divider" />
        <div className="modal-field">
          <span>ЗВУК</span>
          {reward.file ? (
            <div className="modal-sound-card">
              <div className="modal-sound-head">
                <div className="modal-sound-icon"><Icon name="play" size={14} /></div>
                <div className="modal-sound-info">
                  <div className="modal-sound-name">{reward.file}</div>
                  <div className="modal-sound-path" title={reward.path}>{reward.path || 'Файл привязан к награде'}</div>
                  <div className="modal-sound-meta">{reward.meta || 'аудиофайл'}</div>
                </div>
              </div>
              <div className="modal-sound-actions">
                <Button variant="secondary" size="sm" icon={<Icon name="play" size={12} />} onClick={() => onPreviewSound?.(reward)}>
                  Прослушать
                </Button>
                <Button variant="secondary" size="sm" onClick={() => onChooseSound?.(reward)}>
                  Заменить
                </Button>
                <Button variant="danger-ghost" size="sm" onClick={() => onRemoveSound?.(reward)}>
                  Убрать
                </Button>
              </div>
              <div className="modal-volume">
                <SliderRow
                  label="Громкость"
                  value={volume}
                  min={0}
                  max={200}
                  unit="%"
                  onChange={(next) => {
                    setVolume(next);
                    onVolumeChange?.(reward, next);
                  }}
                />
              </div>
            </div>
          ) : (
            <div className="modal-sound-empty">
              <span>Звук не выбран — награда будет беззвучной.</span>
              <Button variant="secondary" size="sm" onClick={() => onChooseSound?.(reward)}>
                Выбрать звук
              </Button>
            </div>
          )}
          <div className="modal-hint">Файл и громкость сохраняются отдельно, сразу после изменения.</div>
        </div>

        <div className="modal-divider" />
        <div className="modal-field">
          <span>КАРТИНКИ НА ЭКРАНЕ</span>
          <div className="image-gallery">
            {reward.images.map((image, index) => (
              <div className="image-chip" key={image.path || index}>
                <div className={`image-chip__preview image-chip__preview--${index % 4}`} aria-hidden="true" />
                <div className="image-chip__name" title={image.path}>{image.name}</div>
                <button type="button" className="image-chip__remove" aria-label={`Убрать ${image.name}`} onClick={() => onRemoveImage?.(reward, image)}>×</button>
              </div>
            ))}
            {reward.images.length < 8 ? (
              <button type="button" className="image-add" onClick={() => onAddImages?.(reward)}>
                + Добавить
              </button>
            ) : null}
          </div>
          <div className="modal-hint">При активации выбирается случайная картинка и появляется в случайном месте OBS.</div>
        </div>

        {reward.images.length > 0 ? (
          <>
            <div className="image-settings-grid">
              <SliderRow label="Угол" value={Math.round(reward.imageSettings.max_angle_deg)} min={0} max={40} unit="°" onChange={(value) => onImageSettings?.(reward, { maxAngleDeg: value })} />
              <SliderRow label="Размер" value={Math.round(reward.imageSettings.size_pct)} min={12} max={60} unit="%" onChange={(value) => onImageSettings?.(reward, { sizePct: value })} />
              <SliderRow label="Длительность" value={(reward.imageSettings.duration_ms / 1000).toFixed(1)} min={1} max={10} step={0.5} unit=" с" onChange={(value) => onImageSettings?.(reward, { durationMs: Math.round(value * 1000) })} />
              <SliderRow label="Прозрачность" value={Math.round(reward.imageSettings.opacity * 100)} min={50} max={100} unit="%" onChange={(value) => onImageSettings?.(reward, { opacity: value / 100 })} />
              <SliderRow label="Safe area" value={Math.round(reward.imageSettings.safe_margin_pct)} min={0} max={15} unit="%" onChange={(value) => onImageSettings?.(reward, { safeMarginPct: value })} />
            </div>
            <div className="image-preview">
              <div className="image-preview__head">
                <span>ПРЕВЬЮ OBS</span>
                <Button variant="secondary" size="sm" onClick={() => onPreviewImage?.(reward)}>Показать картинку</Button>
              </div>
              <iframe title="Превью картинки награды" src="http://127.0.0.1:8770/image-reward" />
            </div>
          </>
        ) : null}
      </div>
    </Modal>
  );
}

function DeleteRewardModal({ reward, onClose, onConfirm, returnFocus }) {
  return (
    <Modal
      open={!!reward}
      onClose={onClose}
      title={`Удалить «${reward?.name || ''}»?`}
      subtitle="Награда будет удалена в Twitch. Привязка звука и настройки громкости тоже исчезнут."
      width={460}
      returnFocus={returnFocus}
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
  const [filter, setFilter] = useState(() => sessionStorage.getItem('rs.rewards.filter') || 'all');
  const [query, setQuery] = useState(() => sessionStorage.getItem('rs.rewards.query') || '');
  const [listView, setListView] = useState(() => sessionStorage.getItem('rs.rewards.list') === '1');
  const [createOpen, setCreateOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [editTarget, setEditTarget] = useState(null);
  const [menuFor, setMenuFor] = useState(null);
  const [menuAbove, setMenuAbove] = useState(false);
  const createTriggerRef = useRef(null);
  const menuTriggerRef = useRef(null);
  const [toast, setToast] = useState('');

  const realView = backend?.view;
  const real = Boolean(backend?.available);
  const connected = Boolean(realView?.connected);

  useEffect(() => {
    sessionStorage.setItem('rs.rewards.filter', filter);
    sessionStorage.setItem('rs.rewards.query', query);
    sessionStorage.setItem('rs.rewards.list', listView ? '1' : '0');
  }, [filter, query, listView]);

  useEffect(() => {
    if (!menuFor) return undefined;
    const menu = document.querySelector('.reward-menu');
    const items = menu ? Array.from(menu.querySelectorAll('button')) : [];
    requestAnimationFrame(() => items[0]?.focus());

    function closeAndReturnFocus() {
      setMenuFor(null);
      menuTriggerRef.current?.focus();
    }
    function onKeyDown(event) {
      if (event.key === 'Escape') {
        event.preventDefault();
        closeAndReturnFocus();
        return;
      }
      if (!['ArrowDown', 'ArrowUp', 'Home', 'End', 'Tab'].includes(event.key)) return;
      if (!items.length) return;
      if (event.key === 'Tab') {
        setMenuFor(null);
        return;
      }
      event.preventDefault();
      const index = items.indexOf(document.activeElement);
      let next = index;
      if (event.key === 'Home') next = 0;
      else if (event.key === 'End') next = items.length - 1;
      else if (event.key === 'ArrowDown') next = (index + 1) % items.length;
      else if (event.key === 'ArrowUp') next = (index - 1 + items.length) % items.length;
      items[next]?.focus();
    }
    function onPointerDown(event) {
      if (!event.target.closest('.reward-menu, .icon-ghost')) setMenuFor(null);
    }
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('mousedown', onPointerDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('mousedown', onPointerDown);
    };
  }, [menuFor]);
  const displayRewards = real ? (realView?.rewards || []).map(mapReward) : rewards;

  const counts = {
    all: displayRewards.length,
    sound: displayRewards.filter((reward) => reward.file).length,
    silent: displayRewards.filter((reward) => !reward.file).length,
    playing: displayRewards.filter((reward) => reward.playing).length,
    off: displayRewards.filter((reward) => !reward.active).length,
  };

  const visible = displayRewards.filter((reward) => {
    if (query.trim()) {
      const needle = query.trim().toLowerCase();
      const haystack = `${reward.name} ${reward.file}`.toLowerCase();
      if (!haystack.includes(needle)) return false;
    }
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
        const next = await backend.call('choose_sound', { rewardId: reward.id, title: reward.name });
        const updated = next?.rewards?.find((item) => item.id === reward.id);
        if (updated && editTarget?.id === reward.id) setEditTarget(mapReward(updated));
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
        const next = await backend.call('clear_sound', { rewardId: reward.id });
        const updated = next?.rewards?.find((item) => item.id === reward.id);
        if (updated && editTarget?.id === reward.id) setEditTarget(mapReward(updated));
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

  async function changeVolume(reward, percent) {
    if (!real) return;
    try {
      const next = await backend.call('set_sound_volume', { rewardId: reward.id, volume: percent / 100 });
      const updated = next?.rewards?.find((item) => item.id === reward.id);
      if (updated && editTarget?.id === reward.id) setEditTarget(mapReward(updated));
    } catch (error) {
      notify(String(error));
    }
  }

  async function addImages(reward) {
    if (!real) {
      notify('Добавление картинок доступно в приложении');
      return;
    }
    try {
      const next = await backend.call('add_reward_images', { rewardId: reward.id });
      const updated = next?.rewards?.find((item) => item.id === reward.id);
      if (updated) setEditTarget(mapReward(updated));
      notify('Картинки добавлены');
    } catch (error) {
      notify(`Не удалось добавить картинки: ${error}`);
    }
  }

  async function removeImage(reward, image) {
    if (!real) return;
    try {
      const next = await backend.call('remove_reward_image', { rewardId: reward.id, path: image.path });
      const updated = next?.rewards?.find((item) => item.id === reward.id);
      if (updated) setEditTarget(mapReward(updated));
      notify('Картинка убрана');
    } catch (error) {
      notify(String(error));
    }
  }

  async function setImageSettings(reward, patch) {
    if (!real) return;
    try {
      const next = await backend.call('set_reward_image_settings', { rewardId: reward.id, patch });
      const updated = next?.rewards?.find((item) => item.id === reward.id);
      if (updated) setEditTarget(mapReward(updated));
    } catch (error) {
      notify(String(error));
    }
  }

  async function previewRewardImage(reward) {
    if (!real) {
      notify('Превью доступно в приложении');
      return;
    }
    try {
      const shown = await backend.call('preview_reward_image', { rewardId: reward.id });
      notify(shown ? 'Картинка показана в OBS-превью' : 'Сначала добавьте картинки');
    } catch (error) {
      notify(String(error));
    }
  }

  async function stopAll() {
    if (!real) {
      notify('Звуки остановлены');
      return;
    }
    try {
      await backend.invoke('stop_all_sounds');
      notify('Все звуки остановлены');
    } catch (error) {
      notify(String(error));
    }
  }

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <div className="eyebrow">TWITCH · CHANNEL POINTS</div>
          <h1 className="page-title">Награды</h1>
          <p className="page-subtitle">@{realView?.login || 'goshanmur'} · {counts.all} наград · {counts.sound} со звуком · {counts.silent} без звука</p>
        </div>
        <div className="page-actions">
          <Button id="create-reward-btn" variant="primary" icon={<Icon name="plus" />} onClick={(event) => { createTriggerRef.current = event.currentTarget; setCreateOpen(true); }}>
            Создать награду
          </Button>
        </div>
      </div>

      <div className="toolbar-row">
        <label className="search-field">
          <Icon name="search" />
          <input
            placeholder="Поиск награды"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            aria-label="Поиск награды"
          />
        </label>
        <div className="view-switch" role="group" aria-label="Вид наград">
          <button className={!listView ? 'is-active' : ''} onClick={() => setListView(false)} aria-pressed={!listView}>
            <Icon name="grid" /> Плитка
          </button>
          <button className={listView ? 'is-active' : ''} onClick={() => setListView(true)} aria-pressed={listView}>
            <Icon name="list" /> Список
          </button>
        </div>
        <Button variant="ghost" onClick={stopAll}>Остановить всё</Button>
      </div>

      <div className="reward-filters">
        {FILTERS.map((item) => (
          <button
            key={item.id}
            className={`filter-pill${filter === item.id ? ' is-active' : ''}`}
            onClick={() => setFilter(item.id)}
            aria-pressed={filter === item.id}
          >
            {item.label} <span>{counts[item.id] ?? 0}</span>
          </button>
        ))}
      </div>

      <div className={`reward-grid${listView ? ' is-list' : ''}`}>
        {visible.map((reward) => (
          <article
            className={`reward-card${reward.music ? ' is-music' : ''}${menuFor === reward.id ? ' is-menu-open' : ''}`}
            key={reward.id}
            style={{ '--reward-color': reward.color, '--reward-tint': `${reward.color}22` }}
          >
            <div className="reward-card__top">
              <div className="reward-meta">
                {reward.cost} баллов{reward.requiresInput ? ' · нужен текст' : ''}
              </div>
              <div className="reward-card__right">
                <span className={`reward-status${reward.playing ? ' is-playing' : reward.active ? ' is-active' : ' is-off'}`}>
                  {reward.playing ? 'играет' : reward.active ? 'активна' : 'выключена'}
                </span>
                <button
                  className="icon-ghost"
                  title="Настройки карточки"
                  aria-label={`Настройки карточки ${reward.name}`}
                  onClick={(event) => {
                    if (menuFor === reward.id) {
                      setMenuFor(null);
                      return;
                    }
                    menuTriggerRef.current = event.currentTarget;
                    const card = event.currentTarget.closest('.reward-card');
                    const rect = card?.getBoundingClientRect();
                    setMenuAbove(Boolean(rect && rect.bottom + 150 > window.innerHeight));
                    setMenuFor(reward.id);
                  }}
                >
                  <Icon name="dots" />
                </button>
              </div>
            </div>

            {menuFor === reward.id ? (
              <div className={`reward-menu${menuAbove ? ' is-above' : ''}`} role="menu">
                <button role="menuitem" tabIndex={-1} onClick={() => { setMenuFor(null); setEditTarget(reward); }}>Настройки карточки</button>
                {reward.file ? (
                  <button role="menuitem" tabIndex={-1} onClick={() => { setMenuFor(null); previewSound(reward); }}>Прослушать</button>
                ) : null}
                <button role="menuitem" tabIndex={-1} className="is-danger" onClick={() => { setMenuFor(null); setDeleteTarget(reward); }}>
                  Удалить награду
                </button>
              </div>
            ) : null}

            <div className={`card-sound${reward.file ? '' : ' is-empty'}`}>
              <div className="card-sound-main">
                {reward.file ? (
                  <button
                    className="play-large"
                    onClick={() => previewSound(reward)}
                    aria-label={`Прослушать ${reward.name}`}
                    title="Прослушать"
                  >
                    <Icon name="play" size={20} />
                  </button>
                ) : (
                  <div className="play-large is-empty" aria-hidden="true">
                    <Icon name="volume" size={20} />
                  </div>
                )}
                <div className="card-sound-info">
                  <h3 className="card-sound-title">{reward.name}</h3>
                  <div className="card-sound-meta">
                    {reward.file
                      ? `${reward.meta || 'аудиофайл'} · нажмите, чтобы прослушать`
                      : 'Звук не выбран · награда будет беззвучной'}
                  </div>
                </div>
                {reward.music ? <span className="card-flag">♪</span> : null}
              </div>
              <div className="card-sound-controls">
                {reward.file ? (
                  <>
                    <input
                      className="ui-range card-volume"
                      type="range"
                      min={0}
                      max={200}
                      step={1}
                      value={reward.volume}
                      aria-label={`Громкость ${reward.name}`}
                      onChange={(event) => changeVolume(reward, Number(event.target.value))}
                    />
                    <span className="card-volume-value">{reward.volume}%</span>
                  </>
                ) : (
                  <Button variant="secondary" size="sm" full onClick={() => chooseSound(reward)}>
                    Выбрать звук
                  </Button>
                )}
              </div>
            </div>

            {reward.images.length > 0 ? (
              <div className="card-images">
                <div className="card-images__stack" aria-hidden="true">
                  <span /><span /><span />
                </div>
                <div className="card-images__text">
                  <strong>{reward.images.length} картинок · случайная</strong>
                  <span>появится в OBS под углом ±{Math.round(reward.imageSettings.max_angle_deg)}°</span>
                </div>
                <Button variant="secondary" size="sm" onClick={() => setEditTarget(reward)}>Настроить</Button>
              </div>
            ) : null}
          </article>
        ))}
      </div>

      {visible.length === 0 ? (
        <div className="reward-empty">
          <div className="empty-state__title">{real && !connected ? 'Twitch не подключён' : 'Ничего не найдено'}</div>
          <div className="empty-state__hint">
            {real && !connected
              ? 'Подключите Twitch в настройках, чтобы загрузить награды.'
              : 'Сбросьте фильтр или создайте новую награду.'}
          </div>
        </div>
      ) : null}

      <CreateRewardModal open={createOpen} onClose={() => setCreateOpen(false)} onCreate={createReward} returnFocus={createTriggerRef.current} />
      <EditRewardModal
        reward={editTarget}
        onClose={() => setEditTarget(null)}
        onSave={saveReward}
        returnFocus={menuTriggerRef.current}
        onChooseSound={chooseSound}
        onRemoveSound={removeSound}
        onPreviewSound={previewSound}
        onVolumeChange={changeVolume}
        onAddImages={addImages}
        onRemoveImage={removeImage}
        onImageSettings={setImageSettings}
        onPreviewImage={previewRewardImage}
      />
      <DeleteRewardModal reward={deleteTarget} onClose={() => setDeleteTarget(null)} onConfirm={confirmDelete} returnFocus={menuTriggerRef.current} />
      {toast ? <div className="ui-toast" role="status" aria-live="polite">{toast}</div> : null}
    </div>
  );
}
