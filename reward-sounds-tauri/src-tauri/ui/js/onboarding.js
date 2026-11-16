/* Экран первого запуска: быстрый старт и локальные привязки (работают без Twitch). */

import {
  state,
  $,
  $$,
  invoke,
  tryInvoke,
  toast,
  confirmDialog,
  icons,
  escapeHtml,
  bindSlider,
  requestRefresh,
  navigate,
} from './bridge.js';

let boundRoot = null;
let signature = '';
let localOpen = false;
let lastView = null;

export function renderOnboarding(root, view) {
  boundRoot = root;
  lastView = view;
  root.innerHTML = onboardingHtml(view);
  bind(root, view);
  signature = viewSignature(view);
}

export function syncOnboarding(root, view) {
  if (boundRoot !== root) return;
  lastView = view;
  const next = viewSignature(view);
  if (next !== signature) {
    renderOnboarding(root, view);
  }
}

function viewSignature(view) {
  return JSON.stringify({
    connected: view.connected,
    bindings: view.local_bindings,
    audio_ready: view.audio_ready,
    audio_device: view.audio_device,
    login: view.login,
  });
}

function onboardingHtml(view) {
  const steps = stepState(view);
  const done = steps.filter((step) => step.done).length;
  const bindings = view.local_bindings || [];
  return `
    <div class="page-head">
      <div>
        <h1 class="h1">Награды</h1>
        <div class="sub">${view.connected ? `Twitch подключён — награды загрузятся через мгновение` : 'Подключите Twitch, чтобы увидеть награды канала'}</div>
      </div>
    </div>

    <div class="onboarding">
      <div class="card quick-start">
        <div class="quick-head">
          <div>
            <div class="section-title-lg">Быстрый старт</div>
            <div class="section-sub">Три шага — и звуки будут играть на стриме автоматически.</div>
          </div>
          <span class="pill ${done === 3 ? 'pill-accent' : ''}">${done} из 3</span>
        </div>
        ${steps.map(stepHtml).join('')}
        <div class="quick-foot">
          <div class="settings-status">
            <span class="dot ${view.audio_ready ? 'dot-green' : 'dot-red'}"></span>
            ${view.audio_ready ? `Аудиовыход в порядке · ${escapeHtml(view.audio_device || 'устройство по умолчанию')}` : 'Аудиовыход не найден'}
          </div>
          <div class="spacer"></div>
          <button class="btn btn-sm btn-ghost" id="onb-check">${icons.refresh} Проверить подключение</button>
        </div>
      </div>

      <div class="quick-side">
        <div class="card">
          <div class="section-title">Почему нужен Client ID?</div>
          <div class="bullet-list">
            <div><span>•</span>Это идентификатор приложения, а не логин и не пароль.</div>
            <div><span>•</span>Нужен один раз: приложение запоминает вход между запусками.</div>
            <div><span>•</span>Понадобится 2FA на аккаунте Twitch — этого требует сам Twitch.</div>
          </div>
          <button class="btn btn-sm btn-secondary" id="onb-instructions">Открыть инструкцию</button>
        </div>
        <div class="card audio-mini">
          <div class="audio-mini-icon">${bars()}</div>
          <div>
            <div class="settings-row-title">${view.audio_ready ? 'Звук готов' : 'Нет аудиовыхода'}</div>
            <div class="settings-row-hint">${view.audio_ready ? 'Можно проверить его без Twitch — ниже локальные привязки.' : 'Проверьте колонки или наушники в настройках Windows.'}</div>
            <div class="settings-actions"><button class="btn btn-sm btn-secondary" id="onb-test-audio">Проверить звук</button></div>
          </div>
        </div>
      </div>
    </div>

    <div class="card local-card onboarding-local">
      <div class="local-head">
        <div class="section-title">Локальные привязки · ${bindings.length}</div>
        <span class="pill pill-sm">работают без Twitch</span>
        <div class="spacer"></div>
        <button class="btn btn-sm btn-ghost" id="onb-local-toggle">${localOpen ? 'Свернуть' : 'Показать все'}</button>
      </div>
      ${bindings.length ? `<div class="local-grid">${(localOpen ? bindings : bindings.slice(0, 3)).map(localBindingHtml).join('')}</div>` : '<div class="settings-row-hint">Привязок пока нет — награды и звуки появятся здесь.</div>'}
      <div class="settings-row-hint">Файлы и громкость хранятся локально — их можно менять и слушать даже без подключения к Twitch.</div>
    </div>`;
}

function stepState(view) {
  const bindings = (view.local_bindings || []).length;
  return [
    { title: 'Подключите Twitch', done: !!view.connected, action: 'connect' },
    { title: 'Выберите награду и привяжите звук', done: bindings > 0, action: 'rewards' },
    { title: 'Проверьте звук', done: !!view.audio_ready && bindings > 0, action: 'test' },
  ];
}

function stepHtml(step, index) {
  const number = index + 1;
  return `
    <div class="quick-step${step.done ? ' done' : ''}">
      <div class="step-number">${step.done ? icons.check : number}</div>
      <div class="step-body">
        <div class="step-title">${escapeHtml(step.title)}</div>
        <div class="step-text">${stepText(step.action)}</div>
        ${step.action === 'connect' && !step.done ? '<div class="settings-actions"><button class="btn btn-primary" id="onb-connect">Подключить Twitch</button><button class="btn btn-ghost" id="onb-client-id">Где взять Client ID?</button></div>' : ''}
        ${step.action === 'connect' && step.done ? '<div class="settings-actions"><button class="btn btn-sm btn-ghost" id="onb-settings">Открыть настройки Twitch</button></div>' : ''}
        ${step.action === 'test' ? '<div class="settings-actions"><button class="btn btn-sm btn-secondary" id="onb-test">Проверить звук</button></div>' : ''}
        ${step.action === 'rewards' && step.done ? '<div class="settings-actions"><button class="btn btn-sm btn-ghost" id="onb-local-edit">Открыть локальные привязки</button></div>' : ''}
      </div>
    </div>`;
}

function stepText(action) {
  if (action === 'connect') {
    return 'Публичный Client ID вашего приложения на dev.twitch.tv — не пароль. Вход подтверждается кодом на сайте Twitch, токены хранятся только на этом компьютере.';
  }
  if (action === 'rewards') {
    return 'Награды Channel Points подтянутся с канала. Можно создать награду прямо здесь — и сразу выбрать для неё файл.';
  }
  return 'Кнопка «Проверить звук» проиграет файл так же, как при активации награды, и покажет индикатор в шапке.';
}

function localBindingHtml(binding) {
  const file = binding.file;
  const exists = !!file?.exists;
  const volume = Math.max(0, Math.min(2, Number(file?.volume) || 0));
  const pct = (volume / 2) * 100;
  return `
    <div class="local-binding" data-id="${escapeHtml(binding.reward_id)}">
      <div class="local-title">${escapeHtml(binding.title || binding.reward_id)}</div>
      <div class="local-meta">${exists ? escapeHtml(file?.meta || '') : 'файл не найден'}</div>
      <div class="local-row">
        <button class="soundchip-play" data-local-play="${escapeHtml(binding.reward_id)}"${exists ? '' : ' disabled'} title="Прослушать">${icons.play}</button>
        <div class="slider sm${exists ? '' : ' disabled'}" data-local-volume="${escapeHtml(binding.reward_id)}">
          <div class="track"></div><div class="fill" style="width:${pct}%"></div><div class="knob" style="left:${pct}%"></div>
        </div>
        <span class="local-value">${Math.round(volume * 100)}%</span>
      </div>
    </div>`;
}

function bind(root, view) {
  $('#onb-connect', root)?.addEventListener('click', () => navigate('settings'));
  $('#onb-settings', root)?.addEventListener('click', () => navigate('settings'));
  $('#onb-client-id', root)?.addEventListener('click', () =>
    invoke('open_url', { url: 'https://dev.twitch.tv/console/apps' }).catch(() => {})
  );
  $('#onb-instructions', root)?.addEventListener('click', () =>
    invoke('open_url', { url: 'https://dev.twitch.tv/docs/authentication' }).catch(() => {})
  );
  $('#onb-check', root)?.addEventListener('click', async () => {
    const result = await tryInvoke('refresh_twitch_now');
    if (result) {
      state.view = result;
      requestRefresh();
      toast(result.connected ? 'Twitch подключён' : 'Twitch пока не подключён', result.connected ? 'info' : 'warn');
    }
  });
  const test = async () => {
    const ok = await tryInvoke('test_audio');
    if (ok !== null) toast('Тестовый сигнал отправлен на устройство вывода');
  };
  $('#onb-test', root)?.addEventListener('click', test);
  $('#onb-test-audio', root)?.addEventListener('click', test);
  $('#onb-local-edit', root)?.addEventListener('click', () => {
    localOpen = true;
    renderOnboarding(root, lastView);
  });
  $('#onb-local-toggle', root)?.addEventListener('click', () => {
    localOpen = !localOpen;
    renderOnboarding(root, lastView);
  });
  bindLocal(root);
}

function bindLocal(root) {
  root.querySelectorAll('[data-local-play]').forEach((button) => {
    button.addEventListener('click', () => {
      invoke('preview_sound', { rewardId: button.dataset.localPlay })
        .then(() => toast('Проигрываем звук'))
        .catch(() => {});
    });
  });
  root.querySelectorAll('[data-local-volume]').forEach((slider) => {
    const rewardId = slider.dataset.localVolume;
    const value = slider.closest('.local-binding')?.querySelector('.local-value');
    bindSlider(slider, {
      onChange: (fraction) => {
        if (value) value.textContent = `${Math.round(fraction * 2 * 100)}%`;
      },
      onCommit: async (fraction) => {
        const result = await tryInvoke('set_sound_volume', { rewardId, volume: fraction * 2 });
        if (result) {
          state.view = result;
          requestRefresh();
        }
      },
    });
  });
}

function bars() {
  return '<span style="width:3px;height:7px"></span><span style="width:3px;height:12px"></span><span style="width:3px;height:16px"></span><span style="width:3px;height:9px"></span>';
}
