/* Единый компонент проверки звука: используется в настройках и онбординге. */

import { $, invoke, toast, icons } from './bridge.js';

let bound = false;

export function soundTestHtml({ compact = false, label = 'Проверить звук', hint } = {}) {
  return `
    <div class="sound-test${compact ? ' compact' : ''}">
      <div class="sound-test-info">
        <div class="sound-test-title">Тест звука</div>
        <div class="sound-test-hint" data-sound-test-device>${hint || 'Проверит тот же путь, что и активация награды'}</div>
      </div>
      <button class="btn btn-sm btn-secondary" data-sound-test>${icons.play}${label}</button>
      <span class="sound-test-state" data-sound-test-state></span>
    </div>`;
}

/** Обновляет подпись устройства и вешает обработчик на все тесты в root. */
export function bindSoundTest(root) {
  root.querySelectorAll('[data-sound-test]').forEach((button) => {
    if (button.dataset.bound) return;
    button.dataset.bound = '1';
    button.addEventListener('click', async () => {
      button.disabled = true;
      const stateNode = button.closest('.sound-test')?.querySelector('[data-sound-test-state]');
      try {
        await invoke('test_audio');
        if (stateNode) stateNode.textContent = 'Сигнал отправлен';
        toast('Тестовый сигнал отправлен на устройство вывода');
      } catch {
        if (stateNode) stateNode.textContent = 'Не удалось воспроизвести';
      } finally {
        button.disabled = false;
      }
    });
  });
  const view = window.RS?.state?.view;
  const device = view?.audio_ready
    ? view.audio_device || 'устройство по умолчанию'
    : 'аудиовыход не найден';
  root.querySelectorAll('[data-sound-test-device]').forEach((node) => {
    if (node.dataset.filled) return;
    node.dataset.filled = '1';
    node.textContent = device;
    node.title = `Устройство: ${device}`;
  });
  bound = true;
  return bound;
}
