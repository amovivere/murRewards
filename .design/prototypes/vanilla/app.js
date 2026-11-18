const SNAPSHOT = new URLSearchParams(location.search).has("snapshot");

const state = {
  playing: true,
  volume: 5,
  topVolume: 29,
  position: 58,
  duration: 164,
  queue: [
    { id: 1, title: "ДИНАСТИЯ — Земляк", user: "nix", duration: 164, status: "playing", thumb: "" },
    { id: 2, title: "Vulvas — Kanye West", user: "goshanmur", duration: 213, status: "loading", thumb: "t2" },
    { id: 3, title: "run.mp3", user: "viewer1", duration: 6, status: "prefetched", thumb: "t3" },
    { id: 4, title: "Ночной дрифт — длинный трек для проверки обрезки", user: "viewer2", duration: 245, status: "queued", thumb: "t4" },
  ],
};

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => Array.from(document.querySelectorAll(selector));

const els = {
  play: $("#play"),
  skip: $("#skip"),
  skipText: $("#skip-text"),
  restart: $("#restart"),
  wave: $("#wave"),
  seek: $("#seek"),
  seekFill: $("#seek-fill"),
  seekKnob: $("#seek-knob"),
  position: $("#position"),
  duration: $("#duration"),
  queueList: $("#queue-list"),
  queueCount: $("#queue-count"),
  title: $("#track-title"),
  meta: $("#track-meta"),
  cover: $("#cover"),
  nextInline: $("#next-inline"),
  musicVolume: $("#music-volume"),
  musicVolumeValue: $("#music-volume-value"),
  topVolume: $("#top-volume"),
  topVolumeValue: $("#top-volume-value"),
  toast: $("#toast"),
  toastText: $("#toast-text"),
  toastAction: $("#toast-action"),
  toastClose: $("#toast-close"),
  menu: $("#menu"),
  moreBtn: $("#more-btn"),
  dialog: $("#clear-dialog"),
  newTrack: $("#new-track"),
  addTrack: $("#add-track"),
};

let toastTimer = null;
let undoAction = null;
let clockTimer = null;

/* ===== утилиты ===== */

const fmt = (seconds) => {
  const value = Math.max(0, Math.floor(Number(seconds) || 0));
  return `${Math.floor(value / 60)}:${String(value % 60).padStart(2, "0")}`;
};

const statusLabel = (status) => {
  if (status === "playing") return ["играет", "play"];
  if (status === "loading") return ["загрузка", "load"];
  if (status === "prefetched") return ["загружен", "prefetch"];
  return ["в очереди", ""];
};

const currentTrack = () => state.queue.find((track) => track.status === "playing") || null;
const pendingTracks = () => state.queue.filter((track) => track.status !== "playing");

/* ===== волна и прогресс ===== */

function buildWave() {
  const bars = 56;
  els.wave.innerHTML = "";
  for (let index = 0; index < bars; index += 1) {
    const bar = document.createElement("i");
    const height = 6 + Math.abs(Math.sin(index * 1.37) * 15) + Math.abs(Math.cos(index * 0.61) * 7);
    bar.style.height = `${height.toFixed(1)}px`;
    bar.style.animationDelay = `${(-index * 0.037).toFixed(2)}s`;
    els.wave.appendChild(bar);
  }
  paintWave();
}

function paintWave() {
  const percent = state.duration ? (state.position / state.duration) * 100 : 0;
  const activeBars = Math.round((percent / 100) * els.wave.children.length);
  Array.from(els.wave.children).forEach((bar, index) => {
    bar.classList.toggle("on", index < activeBars);
  });
  els.wave.classList.toggle("paused", !state.playing);
}

function paintProgress() {
  const percent = state.duration ? Math.min(100, (state.position / state.duration) * 100) : 0;
  els.seekFill.style.width = `${percent}%`;
  els.seekKnob.style.left = `calc(${percent}% - 5.5px)`;
  els.seek.setAttribute("aria-valuemax", String(state.duration));
  els.seek.setAttribute("aria-valuenow", String(Math.round(state.position)));
  els.position.textContent = fmt(state.position);
  els.duration.textContent = fmt(state.duration);
  paintWave();
}

function setPaused(paused) {
  state.playing = !paused;
  els.play.innerHTML = paused
    ? '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5.5v13l11-6.5z"/></svg>'
    : '<svg viewBox="0 0 24 24" fill="currentColor"><rect x="7" y="5" width="3.6" height="14" rx="1.4"/><rect x="13.4" y="5" width="3.6" height="14" rx="1.4"/></svg>';
  els.play.setAttribute("aria-label", paused ? "Продолжить" : "Пауза");
  els.play.dataset.tip = paused ? "Продолжить" : "Пауза";
  els.wave.classList.toggle("paused", paused);
  if (paused) {
    clearInterval(clockTimer);
    clockTimer = null;
  } else {
    startClock();
  }
  if (!paused) toast("Воспроизведение продолжено");
}

function startClock() {
  if (SNAPSHOT || clockTimer) return;
  clockTimer = setInterval(() => {
    state.position += 0.5;
    if (state.position >= state.duration) {
      state.position = state.duration;
      paintProgress();
      skipTrack(false);
      return;
    }
    paintProgress();
  }, 500);
}

/* ===== очередь ===== */

function renderQueue({ animate = true } = {}) {
  const oldRects = new Map();
  if (animate) {
    $$(".queue-row").forEach((row) => oldRects.set(row.dataset.id, row.getBoundingClientRect()));
  }
  els.queueList.innerHTML = state.queue
    .map((track, index) => {
      const [label, statusClass] = statusLabel(track.status);
      return `
      <div class="queue-row${track.status === "playing" ? " playing" : ""}" data-id="${track.id}">
        <span class="num">${index + 1}</span>
        <span class="row-thumb ${track.thumb}"></span>
        <span class="row-main">
          <span class="row-title" title="${track.title}">${track.title}</span>
          <span class="row-meta">@${track.user} · YouTube</span>
        </span>
        <span class="row-duration">${fmt(track.duration)}</span>
        <span class="row-status"><span class="status-pill ${statusClass}">${label}</span></span>
        <span class="row-actions">
          ${track.status !== "playing" ? `<button class="row-icon-btn" data-action="up" aria-label="Выше"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M12 19V5M6 11l6-6 6 6"/></svg></button>` : ""}
          <button class="row-icon-btn" data-action="remove" aria-label="Убрать"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg></button>
        </span>
      </div>`;
    })
    .join("");
  els.queueCount.textContent = `· ${state.queue.length} из 10`;
  els.nextInline.textContent = pendingTracks()[0]?.title || "—";

  if (animate) {
    $$(".queue-row").forEach((row) => {
      const before = oldRects.get(row.dataset.id);
      if (!before) {
        row.animate(
          [{ opacity: 0, transform: "translateY(6px)" }, { opacity: 1, transform: "none" }],
          { duration: 220, easing: "cubic-bezier(.2,.8,.2,1)" }
        );
        return;
      }
      const after = row.getBoundingClientRect();
      const delta = before.top - after.top;
      if (Math.abs(delta) > 1) {
        row.animate(
          [{ transform: `translateY(${delta}px)` }, { transform: "translateY(0)" }],
          { duration: 260, easing: "cubic-bezier(.2,.8,.2,1)" }
        );
      }
    });
  }
}

function setCurrentFromQueue() {
  const track = currentTrack();
  if (!track) {
    els.title.textContent = "Ничего не играет";
    els.meta.textContent = "Активируйте награду на канале — трек встанет в очередь";
    els.duration.textContent = "0:00";
    els.position.textContent = "0:00";
    state.duration = 0;
    state.position = 0;
    paintProgress();
    return;
  }
  els.title.textContent = track.title;
  els.meta.textContent = `заказал @${track.user} · YouTube · ${fmt(track.duration)}`;
  state.duration = track.duration;
  state.position = Math.min(state.position, track.duration);
  paintProgress();
}

function skipTrack(notify = true) {
  const snapshot = state.queue.map((track) => ({ ...track }));
  const skipped = currentTrack();
  if (!skipped) return;
  state.queue = state.queue.filter((track) => track.id !== skipped.id);
  const next = state.queue.find((track) => track.status !== "playing");
  if (next) {
    next.status = "playing";
  }
  state.position = 0;
  renderQueue();
  setCurrentFromQueue();
  if (notify) {
    const nextTitle = currentTrack()?.title;
    showToast(
      nextTitle ? `Пропущено «${skipped.title}». Играет «${nextTitle}»` : `Пропущено «${skipped.title}». Очередь пуста`,
      "Отменить",
      () => {
        state.queue = snapshot;
        state.position = 58;
        renderQueue();
        setCurrentFromQueue();
        showToast("Действие отменено");
      }
    );
  }
}

function moveTrack(id, direction) {
  const index = state.queue.findIndex((track) => track.id === Number(id));
  if (index < 0) return;
  const target = index + direction;
  if (target < 0 || target >= state.queue.length) return;
  if (state.queue[target].status === "playing") return;
  const [track] = state.queue.splice(index, 1);
  state.queue.splice(target, 0, track);
  renderQueue();
  setCurrentFromQueue();
}

function removeTrack(id) {
  const index = state.queue.findIndex((track) => track.id === Number(id));
  if (index < 0) return;
  const snapshot = state.queue.map((track) => ({ ...track }));
  const [removed] = state.queue.splice(index, 1);
  renderQueue();
  if (removed.status === "playing") {
    const next = state.queue.find((track) => track.status !== "playing");
    if (next) next.status = "playing";
    state.position = 0;
    setCurrentFromQueue();
  } else {
    els.nextInline.textContent = pendingTracks()[0]?.title || "—";
  }
  showToast(`«${removed.title}» убран из очереди`, "Отменить", () => {
    state.queue = snapshot;
    renderQueue();
    setCurrentFromQueue();
    showToast("Действие отменено");
  });
}

function addTrack() {
  const value = els.newTrack.value.trim();
  if (!value) {
    els.newTrack.focus();
    return;
  }
  const id = Math.max(0, ...state.queue.map((track) => track.id)) + 1;
  state.queue.push({
    id,
    title: value.includes("youtu") ? "Новая заявка с YouTube" : value,
    user: "manual",
    duration: 180,
    status: "queued",
    thumb: id % 2 ? "t2" : "t4",
  });
  els.newTrack.value = "";
  renderQueue();
  els.nextInline.textContent = pendingTracks()[0]?.title || "—";
  showToast("Трек добавлен в очередь", "Отменить", () => {
    state.queue = state.queue.filter((track) => track.id !== id);
    renderQueue();
    showToast("Действие отменено");
  });
}

/* ===== тосты, меню, диалог ===== */

function showToast(message, actionLabel, action) {
  clearTimeout(toastTimer);
  els.toastText.textContent = message;
  els.toast.hidden = false;
  undoAction = action || null;
  if (actionLabel && action) {
    els.toastAction.textContent = actionLabel;
    els.toastAction.hidden = false;
  } else {
    els.toastAction.hidden = true;
  }
  toastTimer = setTimeout(hideToast, 4500);
}

function hideToast() {
  clearTimeout(toastTimer);
  els.toast.hidden = true;
  undoAction = null;
}

function closeMenu() {
  els.menu.hidden = true;
  els.moreBtn.setAttribute("aria-expanded", "false");
}

function openMenu() {
  const rect = els.moreBtn.getBoundingClientRect();
  els.menu.hidden = false;
  els.moreBtn.setAttribute("aria-expanded", "true");
  const width = els.menu.offsetWidth;
  els.menu.style.left = `${Math.min(rect.right - width, window.innerWidth - width - 12)}px`;
  els.menu.style.top = `${rect.bottom + 6}px`;
}

/* ===== события ===== */

els.play.addEventListener("click", () => setPaused(state.playing));
els.restart.addEventListener("click", () => {
  state.position = 0;
  paintProgress();
  showToast("Трек начат сначала");
});
els.skip.addEventListener("click", () => skipTrack());
els.skipText.addEventListener("click", () => skipTrack());

els.seek.addEventListener("click", (event) => {
  const rect = els.seek.getBoundingClientRect();
  const fraction = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width));
  state.position = Math.round(fraction * state.duration);
  paintProgress();
  showToast(`Перемотка: ${fmt(state.position)}`);
});
els.seek.addEventListener("keydown", (event) => {
  if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
  event.preventDefault();
  if (event.key === "Home") state.position = 0;
  else if (event.key === "End") state.position = state.duration;
  else state.position += event.key === "ArrowRight" ? 5 : -5;
  state.position = Math.max(0, Math.min(state.duration, state.position));
  paintProgress();
});

els.queueList.addEventListener("click", (event) => {
  const button = event.target.closest("[data-action]");
  if (!button) return;
  const row = button.closest(".queue-row");
  const id = row?.dataset.id;
  if (button.dataset.action === "up") moveTrack(id, -1);
  if (button.dataset.action === "remove") removeTrack(id);
});

els.addTrack.addEventListener("click", addTrack);
els.newTrack.addEventListener("keydown", (event) => {
  if (event.key === "Enter") addTrack();
});

els.musicVolume.addEventListener("input", () => {
  state.volume = Number(els.musicVolume.value);
  els.musicVolume.style.setProperty("--fill", `${state.volume}%`);
  els.musicVolumeValue.textContent = `${state.volume}%`;
});
els.topVolume.addEventListener("input", () => {
  state.topVolume = Number(els.topVolume.value);
  els.topVolume.style.setProperty("--fill", `${state.topVolume}%`);
  els.topVolumeValue.textContent = `${state.topVolume}%`;
});

els.toastAction.addEventListener("click", () => {
  const action = undoAction;
  hideToast();
  action?.();
});
els.toastClose.addEventListener("click", hideToast);

els.moreBtn.addEventListener("click", () => {
  if (els.menu.hidden) openMenu();
  else closeMenu();
});
document.addEventListener("click", (event) => {
  if (!els.menu.hidden && !els.menu.contains(event.target) && !els.moreBtn.contains(event.target)) closeMenu();
});
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    closeMenu();
    if (els.dialog.open) els.dialog.close();
  }
  if (event.key === " " && !["INPUT", "TEXTAREA"].includes(document.activeElement?.tagName)) {
    event.preventDefault();
    setPaused(state.playing);
  }
});

els.menu.addEventListener("click", (event) => {
  const item = event.target.closest(".menu-item");
  if (!item) return;
  closeMenu();
  if (item.dataset.action === "clear") {
    els.dialog.showModal();
  } else if (item.dataset.action === "check") {
    showToast("yt-dlp 2026.10.26 — готов");
  } else {
    showToast("Настройки музыки — в полной версии");
  }
});

$("#clear-queue").addEventListener("click", () => els.dialog.showModal());
$("#clear-cancel").addEventListener("click", () => els.dialog.close());
$("#clear-confirm").addEventListener("click", () => {
  const snapshot = state.queue.map((track) => ({ ...track }));
  state.queue = state.queue.filter((track) => track.status === "playing");
  renderQueue();
  setCurrentFromQueue();
  els.dialog.close();
  showToast("Очередь очищена", "Отменить", () => {
    state.queue = snapshot;
    renderQueue();
    setCurrentFromQueue();
    showToast("Действие отменено");
  });
});

$("#obs-open").addEventListener("click", () => showToast("Ссылка на оверлей скопирована"));
$("#obs-settings").addEventListener("click", () => showToast("Настройки оверлея OBS"));
$("#copy-url").addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText($("#obs-url").textContent);
    showToast("Ссылка на оверлей скопирована");
  } catch {
    showToast("Ссылка: " + $("#obs-url").textContent);
  }
});
$("#show-now").addEventListener("click", () => showToast("Строка «Сейчас играет» обновлена"));
$("#accepting").addEventListener("click", () => showToast("Приём заявок включён"));

/* ===== старт ===== */

buildWave();
paintProgress();
renderQueue({ animate: false });
setCurrentFromQueue();
if (!SNAPSHOT) startClock();
if (SNAPSHOT) {
  showToast("Трек «Vulvas — Kanye West» встал в очередь", "Отменить", () => {});
}
