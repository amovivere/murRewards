// WCAG contrast calculation for observed computed colors (from probe JSON / CSS).
const pairs = [
  // [element, fg, bg, font, weight, note]
  ['brand-sub', '#64646c', '#0e0e0e', '11px', '400', 'подзаголовок бренда'],
  ['sidebar version', '#5b5b63', '#0e0e0e', '10.5px', '400', 'версия в сайдбаре'],
  ['nav-label', '#6f6f78', '#0e0e0e', '10px', '700', 'заголовки разделов'],
  ['nav-item (inactive)', '#8d8d97', '#0e0e0e', '14px', '400', 'пункт меню'],
  ['footer', '#666670', '#0b0b0c', '11px', '400', 'статус «Готово»'],
  ['eyebrow', '#8f8f9c', '#0b0b0c', '10px', '700', 'надзаголовок страницы'],
  ['page-subtitle', '#8b8b93', '#0b0b0c', '13.5px', '400', 'подзаголовок'],
  ['panel-description', '#8b8b93', '#111111', '12.5px', '400', 'описание панели'],
  ['reward-meta', '#7f7f8a', '#111113', '10.5px', '400', 'мета карточки награды'],
  ['sound-name', '#b7b7c1', '#111113', '11px', '400', 'имя звука'],
  ['sound-format', '#686872', '#111113', '9px', '400', 'формат MP3'],
  ['sound-empty', '#676772', '#111113', '11px', '400', '«Звук не выбран»'],
  ['card-volume-value', '#9c9ca6', '#111113', '10.5px', '400', 'значение громкости'],
  ['filter-count (inactive)', '#6f6f79', '#121214', '12px', '400', 'счётчик фильтра (measured 4.22)'],
  ['queue-meta', '#74747e', '#121214', '10.5px', '400', 'мета трека (measured 4.05)'],
  ['log-time', '#72727c', '#111111', '11px', '400', 'время записи (measured 3.97)'],
  ['log-level DEBUG', '#8e8e98', '#111111', '10px', '700', 'уровень DEBUG'],
  ['ui-field__hint', '#666670', '#111111', '11px', '400', 'подсказка поля (measured 3.33)'],
  ['ui-toggle-row__hint', '#71717b', '#111111', '11.5px', '400', 'подсказка переключателя (measured 3.91)'],
  ['overlay-preview__hint', '#70707a', '#101012', '11px', '400', 'подсказка превью (measured 3.88)'],
  ['danger button text', '#ffffff', '#ef4444', '13px', '550', 'белый текст на красной кнопке (measured 3.76)'],
  ['volume label', '#8f8f99', '#0e0e0e', '10px', '700', '«ЗВУК» в шапке'],
  ['volume value', '#d2d2da', '#0e0e0e', '12px', '400', '29% в шапке'],
  ['health-popover row detail', '#8a8a94', '#121215', '11.5px', '400', 'детали health-попапа (approx)'],
  ['modal subtitle', '#8b8b93', '#101013', '12.5px', '400', 'подзаголовок модалки'],
  ['modal hint', '#6f6f79', '#101013', '11.5px', '400', 'подсказка в модалке (approx)'],
];

const hex = (h) => { h = h.replace('#', ''); if (h.length === 3) h = h.split('').map((c) => c + c).join(''); return { r: parseInt(h.slice(0, 2), 16), g: parseInt(h.slice(2, 4), 16), b: parseInt(h.slice(4, 6), 16) }; };
const lum = (c) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b); };
const ratio = (a, b) => { const L1 = lum(a), L2 = lum(b); const hi = Math.max(L1, L2), lo = Math.min(L1, L2); return Math.round(((hi + 0.05) / (lo + 0.05)) * 100) / 100; };

const out = pairs.map(([el, fg, bg, size, weight, note]) => {
  const r = ratio(hex(fg), hex(bg));
  const px = parseFloat(size);
  const large = px >= 24 || (px >= 18.66 && Number(weight) >= 600);
  const need = large ? 3 : 4.5;
  return { el, fg, bg, size, weight, ratio: r, need, pass: r >= need, note };
});
console.log(JSON.stringify(out, null, 1));
require('fs').writeFileSync(require('path').resolve(__dirname, '..', 'notes', 'contrast-calc.json'), JSON.stringify(out, null, 1));
const fails = out.filter((o) => !o.pass);
console.log('FAILS', fails.length, 'of', out.length);
