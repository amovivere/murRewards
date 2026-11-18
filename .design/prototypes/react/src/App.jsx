import React, { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, LayoutGroup, motion } from "motion/react";
import * as Tooltip from "@radix-ui/react-tooltip";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import * as Dialog from "@radix-ui/react-dialog";
import * as Slider from "@radix-ui/react-slider";
import {
  ArrowUp,
  Check,
  ChevronDown,
  CircleDot,
  Copy,
  Grid2x2,
  ListMusic,
  MessageCircle,
  MoreHorizontal,
  Music2,
  Pause,
  Play,
  Radio,
  RotateCcw,
  Settings,
  SkipForward,
  Trash2,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";
import "./styles.css";

const SNAPSHOT = new URLSearchParams(location.search).has("snapshot");

const INITIAL_QUEUE = [
  { id: 1, title: "ДИНАСТИЯ — Земляк", user: "nix", duration: 164, status: "playing", thumb: "" },
  { id: 2, title: "Vulvas — Kanye West", user: "goshanmur", duration: 213, status: "loading", thumb: "t2" },
  { id: 3, title: "run.mp3", user: "viewer1", duration: 6, status: "prefetched", thumb: "t3" },
  { id: 4, title: "Ночной дрифт — длинный трек для проверки обрезки", user: "viewer2", duration: 245, status: "queued", thumb: "t4" },
];

const STATUS = {
  playing: ["играет", "text-accent-soft border-accent/35 bg-accent/12"],
  loading: ["загрузка", "text-warn border-warn/30 bg-warn/10"],
  prefetched: ["загружен", "text-cyan border-cyan/30 bg-cyan/10"],
  queued: ["в очереди", "text-ink-3 border-line"],
};

const fmt = (seconds) => {
  const value = Math.max(0, Math.floor(Number(seconds) || 0));
  return `${Math.floor(value / 60)}:${String(value % 60).padStart(2, "0")}`;
};

function Tip({ label, side = "top", children }) {
  return (
    <Tooltip.Root>
      <Tooltip.Trigger asChild>{children}</Tooltip.Trigger>
      <Tooltip.Portal>
        <Tooltip.Content className="radix-tooltip" side={side} sideOffset={8}>
          {label}
        </Tooltip.Content>
      </Tooltip.Portal>
    </Tooltip.Root>
  );
}

function IconButton({ label, children, onClick, className = "" }) {
  return (
    <Tip label={label}>
      <button type="button" aria-label={label} onClick={onClick} className={`icon-btn ${className}`}>
        {children}
      </button>
    </Tip>
  );
}

function Sidebar() {
  const items = [
    { icon: Grid2x2, label: "Награды" },
    { icon: Music2, label: "Музыка", active: true, count: 4 },
  ];
  return (
    <aside className="sidebar-panel">
      <div className="flex items-center gap-2.5 px-2 pb-[18px] pt-0.5">
        <span className="brand-mark">
          <Music2 size={17} strokeWidth={1.8} />
        </span>
        <span className="rail-hide text-[13.6px] font-semibold tracking-[0.1px]">Reward Sounds</span>
      </div>

      <nav className="flex flex-col gap-0.5">
        <div className="nav-label rail-hide">ОСНОВНОЕ</div>
        {items.map((item) => (
          <button key={item.label} type="button" className={`nav-item${item.active ? " active" : ""}`}>
            <item.icon size={16} strokeWidth={1.6} className="shrink-0" />
            <span className="rail-hide">{item.label}</span>
            {item.count ? <span className="nav-count rail-hide">{item.count}</span> : null}
          </button>
        ))}
        <div className="nav-label rail-hide">ЧАТ</div>
        <button type="button" className="nav-item">
          <MessageCircle size={16} strokeWidth={1.6} className="shrink-0" />
          <span className="rail-hide">Чат</span>
        </button>
      </nav>

      <div className="mt-auto border-t border-line pt-2.5">
        <div className="nav-label rail-hide">СИСТЕМА</div>
        <button type="button" className="nav-item">
          <Settings size={16} strokeWidth={1.6} className="shrink-0" />
          <span className="rail-hide">Настройки</span>
        </button>
        <button type="button" className="nav-item">
          <ListMusic size={16} strokeWidth={1.6} className="shrink-0" />
          <span className="rail-hide">Журнал</span>
        </button>
        <div className="rail-hide px-2.5 pt-3 text-[10px] text-ink-3">версия 1.8.0</div>
      </div>
    </aside>
  );
}

function TopBar({ topVolume, setTopVolume }) {
  return (
    <header className="flex h-[58px] flex-[0_0_58px] items-center gap-3 px-6">
      <button
        type="button"
        className="inline-flex h-[30px] items-center gap-2 rounded-full border border-line bg-white/[0.035] px-2.5 text-[11.8px] text-ink-2 hover:border-line-strong hover:bg-white/[0.06] hover:text-ink"
      >
        <span className="h-1.5 w-1.5 rounded-full bg-ok shadow-[0_0_8px_rgba(53,208,127,.7)]" />
        <span>Все системы работают</span>
        <ChevronDown size={11} className="text-ink-3" />
      </button>

      <span className="inline-flex h-[26px] items-center gap-1.5 rounded-full border border-accent/30 bg-accent/10 px-2.5 text-[11px] text-accent-soft">
        <span className="eq-mini">
          <i />
          <i />
          <i />
        </span>
        2 звучит
      </span>

      <div className="flex-1" />
      <button type="button" className="grid h-[30px] w-[30px] place-items-center rounded-[9px] text-ink-2 hover:bg-white/[0.06] hover:text-ink">
        <Volume2 size={16} strokeWidth={1.7} />
      </button>
      <span className="text-[9.6px] tracking-[1.1px] text-ink-3">ЗВУК</span>
      <Slider.Root
        className="relative flex h-5 w-[118px] touch-none select-none items-center"
        value={[topVolume]}
        max={100}
        step={1}
        onValueChange={([value]) => setTopVolume(value)}
        aria-label="Общая громкость"
      >
        <Slider.Track className="relative h-[3px] grow overflow-hidden rounded-full bg-white/15">
          <Slider.Range className="absolute h-full bg-accent" />
        </Slider.Track>
        <Slider.Thumb className="block h-[13px] w-[13px] rounded-full border-2 border-accent bg-white shadow-[0_2px_8px_rgba(0,0,0,.5)] focus:outline-none focus:ring-2 focus:ring-accent/35" />
      </Slider.Root>
      <span className="w-9 text-right text-[11.8px] tabular-nums text-ink-2">{topVolume}%</span>
    </header>
  );
}

function PageHead({ onMore, onClearRequest }) {
  return (
    <div className="flex items-end gap-4 pt-1 pb-0.5">
      <div>
        <h1 className="m-0 text-[30px] font-semibold tracking-[-0.6px]">Музыка</h1>
        <p className="mb-0 mt-1 text-[12px] text-ink-3">Треки по заявке: зритель присылает ссылку на YouTube в чат</p>
      </div>
      <div className="ml-auto flex items-center gap-2">
        <DropdownMenu.Root>
          <DropdownMenu.Trigger asChild>
            <button
              type="button"
              aria-label="Действия"
              className="grid h-8 w-8 place-items-center rounded-[9px] text-ink-3 hover:bg-white/[0.06] hover:text-ink data-[state=open]:bg-white/[0.06] data-[state=open]:text-ink"
            >
              <MoreHorizontal size={18} />
            </button>
          </DropdownMenu.Trigger>
          <DropdownMenu.Portal>
            <DropdownMenu.Content className="radix-menu" sideOffset={6} align="end">
              <DropdownMenu.Item className="radix-menu-item" onSelect={onMore}>
                Настройки музыки
              </DropdownMenu.Item>
              <DropdownMenu.Item className="radix-menu-item" onSelect={onMore}>
                Проверить yt-dlp
              </DropdownMenu.Item>
              <DropdownMenu.Separator className="radix-menu-sep" />
              <DropdownMenu.Item className="radix-menu-item danger" onSelect={onClearRequest}>
                Очистить очередь…
              </DropdownMenu.Item>
            </DropdownMenu.Content>
          </DropdownMenu.Portal>
        </DropdownMenu.Root>

        <button
          type="button"
          className="inline-flex h-[34px] items-center gap-2 rounded-[10px] border border-line bg-white/[0.06] px-3.5 text-[12.2px] font-medium hover:border-line-strong hover:bg-white/[0.08]"
        >
          <CircleDot size={15} strokeWidth={1.6} />
          Оверлей OBS
        </button>
        <button
          type="button"
          className="inline-flex h-[34px] items-center gap-[7px] rounded-[10px] border border-accent/38 bg-accent/13 px-3.5 text-[11.8px] text-accent-soft hover:bg-accent/20"
        >
          <span className="h-1.5 w-1.5 rounded-full bg-ok" />
          Принимаем заявки
        </button>
      </div>
    </div>
  );
}

function Wave({ position, duration, playing }) {
  const total = 56;
  const active = duration ? Math.round((position / duration) * total) : 0;
  return (
    <div className={`wave${playing ? "" : " paused"}`} aria-hidden="true">
      {Array.from({ length: total }, (_, index) => {
        const height = 6 + Math.abs(Math.sin(index * 1.37) * 15) + Math.abs(Math.cos(index * 0.61) * 7);
        return (
          <i
            key={index}
            className={index < active ? "on" : ""}
            style={{ height: `${height.toFixed(1)}px`, animationDelay: `${(-index * 0.037).toFixed(2)}s` }}
          />
        );
      })}
    </div>
  );
}

function NowPlaying({ track, position, setPosition, playing, onToggle, onRestart, onSkip, musicVolume, setMusicVolume, next }) {
  const duration = track?.duration || 0;
  return (
    <section className="hero-panel flex items-stretch gap-[18px] p-4">
      <div className="hero-cover cover self-center">
        <span className="cover-glow" />
        <span className="cover-label">LIVE</span>
        <span className="cover-eq">
          <i />
          <i />
          <i />
          <i />
          <i />
        </span>
      </div>

      <div className="flex min-w-0 flex-1 flex-col justify-center">
        <div className="text-[9.4px] font-semibold tracking-[1.6px] text-accent-soft">СЕЙЧАС ИГРАЕТ</div>
        <h2 className="mb-0 mt-[5px] truncate text-2xl font-semibold tracking-[-0.4px]">{track?.title || "Ничего не играет"}</h2>
        <div className="mt-1 text-[11.6px] text-ink-3">
          {track ? `заказал @${track.user} · YouTube · ${fmt(track.duration)}` : "Активируйте награду на канале — трек встанет в очередь"}
        </div>

        <Wave position={position} duration={duration} playing={playing} />

        <div className="mt-0.5 flex items-center gap-2.5">
          <span className="w-[34px] text-[10.6px] tabular-nums text-ink-3">{fmt(position)}</span>
          <Slider.Root
            className="relative flex h-4 flex-1 touch-none select-none items-center"
            value={[Math.min(position, duration)]}
            max={Math.max(1, duration)}
            step={1}
            onValueChange={([value]) => setPosition(value)}
            aria-label="Перемотка"
          >
            <Slider.Track className="relative h-[3px] grow rounded-full bg-white/15">
              <Slider.Range className="absolute h-full rounded-full bg-gradient-to-r from-accent to-accent-soft" />
            </Slider.Track>
            <Slider.Thumb className="block h-[11px] w-[11px] rounded-full border-2 border-accent bg-white shadow-[0_2px_8px_rgba(0,0,0,.45)] focus:outline-none focus:ring-2 focus:ring-accent/35" />
          </Slider.Root>
          <span className="w-[34px] text-right text-[10.6px] tabular-nums text-ink-3">{fmt(duration)}</span>
        </div>

        <div className="mt-2.5 flex items-center gap-2.5">
          <Tip label="Сначала">
            <button type="button" aria-label="Сначала" onClick={onRestart} className="round-button">
              <RotateCcw size={14} strokeWidth={1.7} />
            </button>
          </Tip>
          <Tip label={playing ? "Пауза" : "Продолжить"}>
            <motion.button
              type="button"
              aria-label={playing ? "Пауза" : "Продолжить"}
              onClick={onToggle}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.96 }}
              className="play-button"
            >
              {playing ? <Pause size={20} fill="currentColor" /> : <Play size={20} fill="currentColor" />}
            </motion.button>
          </Tip>
          <Tip label="Пропустить">
            <button type="button" aria-label="Пропустить" onClick={onSkip} className="round-button">
              <SkipForward size={14} fill="currentColor" strokeWidth={1.2} />
            </button>
          </Tip>
          <button type="button" onClick={onSkip} className="px-1 py-1 text-[11.8px] text-ink-2 hover:text-ink">
            Пропустить трек
          </button>
          <div className="flex-1" />
          <span className="truncate text-[10.8px] text-ink-3">
            Следующий: <span className="font-medium text-ink-2">{next?.title || "—"}</span>
          </span>
        </div>
      </div>

      <aside className="hero-side flex w-[190px] flex-[0_0_190px] flex-col justify-center gap-[7px] border-l border-line pl-4">
        <div className="flex items-center gap-2 text-[10.6px] text-ink-3">
          Громкость музыки
          <span className="ml-auto tabular-nums text-ink-2">{musicVolume}%</span>
        </div>
        <Slider.Root
          className="relative flex h-5 w-full touch-none select-none items-center"
          value={[musicVolume]}
          max={100}
          step={1}
          onValueChange={([value]) => setMusicVolume(value)}
          aria-label="Громкость музыки"
        >
          <Slider.Track className="relative h-[3px] grow overflow-hidden rounded-full bg-white/15">
            <Slider.Range className="absolute h-full bg-accent" />
          </Slider.Track>
          <Slider.Thumb className="block h-[13px] w-[13px] rounded-full border-2 border-accent bg-white shadow" />
        </Slider.Root>
        <p className="m-0 text-[10.2px] leading-[14px] text-ink-3">Не меняет громкость Windows — только очередь.</p>
        <div className="my-1 h-px bg-line" />
        <div className="text-[10.6px] text-ink-3">Следующий</div>
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="row-thumb t2" />
          <div className="min-w-0">
            <b className="block truncate text-[11px] font-medium">{next?.title || "—"}</b>
            <small className="mt-0.5 block text-[9.8px] text-ink-3">{next ? `@${next.user} · ${fmt(next.duration)}` : "Очередь пуста"}</small>
          </div>
        </div>
      </aside>
    </section>
  );
}

function Queue({ queue, onUp, onRemove, onAdd, onClear, newTrack, setNewTrack, next }) {
  return (
    <section className="surface-panel px-4 pb-3 pt-[13px]">
      <div className="flex items-center gap-2.5">
        <div className="text-[14.6px] font-semibold">
          Очередь <span className="ml-1 text-[11px] font-normal text-ink-3">· {queue.length} из 10</span>
        </div>
        <div className="flex gap-1.5">
          <span className="rounded-full border border-accent/30 bg-accent/10 px-2 py-0.5 text-[9.6px] text-accent-soft">1 играет</span>
          <span className="rounded-full border border-warn/30 bg-warn/10 px-2 py-0.5 text-[9.6px] text-warn">1 загружается</span>
        </div>
        <div className="flex-1" />
        <button type="button" onClick={onClear} className="px-0.5 text-[11.8px] text-danger hover:text-white">
          Очистить
        </button>
      </div>

      <LayoutGroup>
        <div className="mt-2 flex min-h-[164px] flex-col gap-0.5">
          <AnimatePresence initial={false}>
            {queue.map((track, index) => {
              const [label, pillClass] = STATUS[track.status];
              return (
                <motion.div
                  key={track.id}
                  layout
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, x: 16 }}
                  transition={{ duration: 0.22, ease: [0.2, 0.8, 0.2, 1] }}
                  className={`queue-row group${track.status === "playing" ? " is-playing" : ""}`}
                >
                  <span className="w-4 text-[10px] tabular-nums text-ink-3">{index + 1}</span>
                  <span className={`row-thumb ${track.thumb}`} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[12px] font-medium" title={track.title}>
                      {track.title}
                    </span>
                    <span className="mt-px block truncate text-[9.8px] text-ink-3">@{track.user} · YouTube</span>
                  </span>
                  <span className="text-[10px] tabular-nums text-ink-3">{fmt(track.duration)}</span>
                  <span className={`rounded-full border px-1.5 py-0.5 text-[9.6px] ${pillClass}`}>{label}</span>
                  <span className="flex gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
                    {track.status !== "playing" ? (
                      <button
                        type="button"
                        aria-label="Выше"
                        onClick={() => onUp(track.id)}
                        className="grid h-6 w-6 place-items-center rounded-md text-ink-3 hover:bg-white/[0.08] hover:text-ink"
                      >
                        <ArrowUp size={13} />
                      </button>
                    ) : null}
                    <button
                      type="button"
                      aria-label="Убрать"
                      onClick={() => onRemove(track.id)}
                      className="grid h-6 w-6 place-items-center rounded-md text-ink-3 hover:bg-white/[0.08] hover:text-ink"
                    >
                      <X size={13} />
                    </button>
                  </span>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      </LayoutGroup>

      <div className="mt-2.5 flex gap-2">
        <label className="flex h-8 flex-1 items-center gap-2 rounded-[9px] border border-line bg-white/[0.035] px-2.5 text-ink-3 focus-within:border-accent/45 focus-within:ring-2 focus-within:ring-accent/10">
          <span className="text-[16px] leading-none">+</span>
          <input
            value={newTrack}
            onChange={(event) => setNewTrack(event.target.value)}
            onKeyDown={(event) => event.key === "Enter" && onAdd()}
            placeholder="Вставьте ссылку YouTube и нажмите Enter — трек встанет в очередь"
            className="min-w-0 flex-1 border-0 bg-transparent text-[11.4px] text-ink outline-none placeholder:text-ink-3"
          />
        </label>
        <button
          type="button"
          onClick={onAdd}
          className="inline-flex h-[30px] items-center rounded-[10px] border border-line bg-white/[0.06] px-2.5 text-[11.6px] hover:border-line-strong hover:bg-white/[0.08]"
        >
          В очередь
        </button>
      </div>
      <div className="mt-[7px] text-[9.8px] text-ink-3">Ручная очередь не тратит баллы зрителей — удобно для проверки.</div>
      <div className="hidden">{next?.title}</div>
    </section>
  );
}

function BottomCards({ current, notify }) {
  return (
    <div className="bottom-grid grid grid-cols-[1.55fr_1fr] gap-[11px]">
      <section className="surface-panel min-w-0 px-[15px] py-[13px]">
        <div className="flex items-center gap-2">
          <div className="text-[12.6px] font-semibold">OBS — строка «Сейчас играет»</div>
          <div className="flex-1" />
          <button type="button" onClick={() => notify("Настройки оверлея OBS")} className="text-[11.8px] text-ink-2 hover:text-ink">
            Настроить
          </button>
        </div>
        <div className="mt-[9px] flex items-center gap-1.5">
          <code className="min-w-0 flex-1 truncate rounded-lg border border-line bg-white/[0.04] px-2.5 py-1.5 font-mono text-[10.6px] text-ink-2">
            http://127.0.0.1:8770/overlay
          </code>
          <Tip label="Скопировать">
            <button
              type="button"
              aria-label="Скопировать ссылку"
              onClick={() => notify("Ссылка на оверлей скопирована")}
              className="grid h-[26px] w-[26px] place-items-center rounded-[7px] text-ink-3 hover:bg-white/[0.07] hover:text-ink"
            >
              <Copy size={13} />
            </button>
          </Tip>
          <button
            type="button"
            onClick={() => notify("Строка «Сейчас играет» обновлена")}
            className="inline-flex h-[30px] items-center rounded-[10px] border border-line px-2.5 text-[11.6px] text-ink-2 hover:border-line-strong hover:text-ink"
          >
            Показать сейчас
          </button>
        </div>
        <div className="obs-preview">
          <span className="eq-mini">
            <i />
            <i />
            <i />
          </span>
          <span className="truncate text-[11.4px] font-medium">{current?.title || "Ничего не играет"}</span>
          <span className="whitespace-nowrap text-[10px] text-ink-3">{current ? `· заказал @${current.user}` : ""}</span>
        </div>
      </section>

      <section className="surface-panel px-[15px] py-[13px]">
        <div className="mb-[7px] text-[12.6px] font-semibold">Состояние</div>
        {[
          "yt-dlp 2026.10.26 — готов",
          "Чат: команда !трек включена",
          "Звук: Analogue 1/2 (Audient iD4)",
          "Оверлей: порт 8770 свободен",
        ].map((line) => (
          <div key={line} className="mt-[5px] flex items-center gap-[7px] text-[10.6px] text-ink-2">
            <Check size={11} className="text-ok" /> {line}
          </div>
        ))}
      </section>
    </div>
  );
}

function Toast({ toast, onClose }) {
  return (
    <AnimatePresence>
      {toast ? (
        <motion.div
          initial={{ opacity: 0, y: 10, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 8, scale: 0.98 }}
          transition={{ duration: 0.18, ease: "easeOut" }}
          className="toast-panel"
        >
          <Check size={13} className="shrink-0 text-ok" />
          <span className="flex-1">{toast.message}</span>
          {toast.actionLabel ? (
            <button
              type="button"
              onClick={() => {
                toast.action?.();
                onClose();
              }}
              className="px-1 py-0.5 text-[11.6px] text-accent-soft hover:text-white"
            >
              {toast.actionLabel}
            </button>
          ) : null}
          <button type="button" aria-label="Закрыть" onClick={onClose} className="px-1 py-0.5 text-ink-3 hover:text-ink">
            <X size={15} />
          </button>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

function App() {
  const [queue, setQueue] = useState(INITIAL_QUEUE);
  const [playing, setPlaying] = useState(true);
  const [position, setPosition] = useState(58);
  const [musicVolume, setMusicVolume] = useState(5);
  const [topVolume, setTopVolume] = useState(29);
  const [toast, setToast] = useState(
    SNAPSHOT ? { message: "Трек «Vulvas — Kanye West» встал в очередь", actionLabel: "Отменить", action: () => {} } : null
  );
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newTrack, setNewTrack] = useState("");
  const toastTimer = useRef(null);

  const current = queue.find((track) => track.status === "playing") || null;
  const pending = queue.filter((track) => track.status !== "playing");
  const duration = current?.duration || 0;

  const notify = useCallback((message, actionLabel, action) => {
    clearTimeout(toastTimer.current);
    setToast({ message, actionLabel, action });
    toastTimer.current = setTimeout(() => setToast(null), 4500);
  }, []);

  const skip = useCallback(() => {
    if (!current) return;
    const snapshot = queue;
    const rest = queue.filter((track) => track.id !== current.id);
    const next = rest.find((track) => track.status !== "playing");
    const updated = rest.map((track) => (track.id === next?.id ? { ...track, status: "playing" } : track));
    setQueue(updated);
    setPosition(0);
    const nextTrack = updated.find((track) => track.status === "playing");
    notify(
      nextTrack ? `Пропущено «${current.title}». Играет «${nextTrack.title}»` : `Пропущено «${current.title}». Очередь пуста`,
      "Отменить",
      () => {
        setQueue(snapshot);
        setPosition(58);
      }
    );
  }, [queue, current, notify]);

  useEffect(() => {
    if (!playing || SNAPSHOT || !duration) return undefined;
    const timer = setInterval(() => setPosition((value) => Math.min(duration, value + 0.5)), 500);
    return () => clearInterval(timer);
  }, [playing, duration]);

  useEffect(() => {
    if (duration > 0 && position >= duration) skip();
  }, [position, duration, skip]);

  useEffect(() => {
    const onKey = (event) => {
      if (event.key === " " && !["INPUT", "TEXTAREA"].includes(document.activeElement?.tagName)) {
        event.preventDefault();
        setPlaying((value) => !value);
      }
      if (event.key === "Escape") setDialogOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const moveUp = (id) => {
    const index = queue.findIndex((track) => track.id === id);
    if (index <= 0 || queue[index - 1]?.status === "playing") return;
    const copy = queue.slice();
    const [track] = copy.splice(index, 1);
    copy.splice(index - 1, 0, track);
    setQueue(copy);
  };

  const remove = (id) => {
    const snapshot = queue;
    const track = queue.find((item) => item.id === id);
    if (!track) return;
    let updated = queue.filter((item) => item.id !== id);
    if (track.status === "playing") {
      const next = updated.find((item) => item.status !== "playing");
      updated = updated.map((item) => (item.id === next?.id ? { ...item, status: "playing" } : item));
      setPosition(0);
    }
    setQueue(updated);
    notify(`«${track.title}» убран из очереди`, "Отменить", () => {
      setQueue(snapshot);
    });
  };

  const add = () => {
    const value = newTrack.trim();
    if (!value) return;
    const id = Math.max(0, ...queue.map((track) => track.id)) + 1;
    setQueue([
      ...queue,
      {
        id,
        title: value.includes("youtu") ? "Новая заявка с YouTube" : value,
        user: "manual",
        duration: 180,
        status: "queued",
        thumb: id % 2 ? "t2" : "t4",
      },
    ]);
    setNewTrack("");
    notify("Трек добавлен в очередь", "Отменить", () => setQueue((items) => items.filter((track) => track.id !== id)));
  };

  const clearQueue = () => {
    const snapshot = queue;
    setQueue(queue.filter((track) => track.status === "playing"));
    setDialogOpen(false);
    notify("Очередь очищена", "Отменить", () => setQueue(snapshot));
  };

  return (
    <Tooltip.Provider delayDuration={200}>
      <div className="app-window">
        <Sidebar />
        <div className="flex min-w-0 flex-1 flex-col">
          <TopBar topVolume={topVolume} setTopVolume={setTopVolume} />
          <main className="content-scroll">
            <PageHead
              onMore={() => notify("Настройки музыки — в полной версии")}
              onClearRequest={() => setDialogOpen(true)}
            />
            <NowPlaying
              track={current}
              position={position}
              setPosition={setPosition}
              playing={playing}
              onToggle={() => setPlaying((value) => !value)}
              onRestart={() => {
                setPosition(0);
                notify("Трек начат сначала");
              }}
              onSkip={skip}
              musicVolume={musicVolume}
              setMusicVolume={setMusicVolume}
              next={pending[0]}
            />
            <Queue
              queue={queue}
              onUp={moveUp}
              onRemove={remove}
              onAdd={add}
              onClear={() => setDialogOpen(true)}
              newTrack={newTrack}
              setNewTrack={setNewTrack}
              next={pending[0]}
            />
            <BottomCards current={current} notify={notify} />
          </main>
          <footer className="flex h-8 flex-[0_0_32px] items-center gap-2.5 border-t border-line px-6 text-[10px] text-ink-3">
            <span>Готово</span>
            <span className="flex-1" />
            <span className="text-white/25">версия 1.8.0</span>
          </footer>
        </div>

        <Toast toast={toast} onClose={() => setToast(null)} />

        <Dialog.Root open={dialogOpen} onOpenChange={setDialogOpen}>
          <Dialog.Portal>
            <Dialog.Overlay className="dialog-overlay" />
            <Dialog.Content className="dialog-content">
              <Dialog.Title className="m-0 text-base font-semibold">Очистить очередь?</Dialog.Title>
              <Dialog.Description className="mt-2 text-[12px] leading-[18px] text-ink-2">
                Баллы зрителей вернутся, треки исчезнут из очереди. Текущий трек доиграет до конца.
              </Dialog.Description>
              <div className="mt-[18px] flex justify-end gap-2">
                <Dialog.Close asChild>
                  <button type="button" className="inline-flex h-[34px] items-center rounded-[10px] border border-line bg-white/[0.06] px-3.5 text-[12.2px] hover:border-line-strong">
                    Отмена
                  </button>
                </Dialog.Close>
                <button
                  type="button"
                  onClick={clearQueue}
                  className="inline-flex h-[34px] items-center rounded-[10px] border border-danger/30 bg-danger/10 px-3.5 text-[12.2px] text-danger hover:bg-danger/15"
                >
                  Очистить
                </button>
              </div>
            </Dialog.Content>
          </Dialog.Portal>
        </Dialog.Root>
      </div>
    </Tooltip.Provider>
  );
}

export default App;
