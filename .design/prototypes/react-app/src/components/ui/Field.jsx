import { useEffect, useState } from 'react';

export function Field({ label, hint, children, wide = false }) {
  return (
    <label className={`ui-field${wide ? ' is-wide' : ''}`}>
      <span className="ui-field__label">{label}</span>
      {children}
      {hint ? <span className="ui-field__hint">{hint}</span> : null}
    </label>
  );
}

export function TextInput({ value, onChange, placeholder, type = 'text', mono = false, ...rest }) {
  return (
    <input
      className={`ui-input${mono ? ' is-mono' : ''}`}
      type={type}
      value={value}
      placeholder={placeholder}
      onChange={(event) => onChange?.(event.target.value)}
      {...rest}
    />
  );
}

export function Select({ value, onChange, children, ...rest }) {
  return (
    <select className="ui-select" value={value} onChange={(event) => onChange?.(event.target.value)} {...rest}>
      {children}
    </select>
  );
}

export function ToggleRow({ label, hint, checked, onChange, trailing }) {
  return (
    <div className="ui-toggle-row">
      <div className="ui-toggle-row__text">
        <div className="ui-toggle-row__label">{label}</div>
        {hint ? <div className="ui-toggle-row__hint">{hint}</div> : null}
      </div>
      <div className="ui-toggle-row__control">
        {trailing ? <span className="ui-toggle-row__state">{trailing}</span> : null}
        <button
          type="button"
          role="switch"
          aria-label={label}
          aria-checked={checked}
          className={`ui-switch${checked ? ' is-on' : ''}`}
          onClick={() => onChange(!checked)}
        >
          <span className="ui-switch__dot" />
        </button>
      </div>
    </div>
  );
}

export function SliderRow({ label, value, min, max, step = 1, unit = '', onChange, format }) {
  const shown = format ? format(value) : `${value}${unit}`;
  return (
    <div className="ui-slider-row">
      <span className="ui-slider-row__label">{label}</span>
      <input
        className="ui-range"
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        aria-label={label}
        onChange={(event) => onChange(Number(event.target.value))}
      />
      <span className="ui-slider-row__value">{shown}</span>
    </div>
  );
}

export function ColorField({ label, value, onChange, opacity, onOpacity }) {
  const [draft, setDraft] = useState(value.toUpperCase());

  useEffect(() => {
    if (/^#[0-9A-F]{6}$/i.test(value)) setDraft(value.toUpperCase());
  }, [value]);

  function commit(next) {
    const text = next.trim();
    if (/^#[0-9a-f]{6}$/i.test(text)) onChange(text.toLowerCase());
    else setDraft(value.toUpperCase());
  }

  return (
    <div className="ui-color-field">
      <span className="ui-color-field__label">{label}</span>
      <div className="ui-color-field__row">
        <label className="ui-color-swatch" style={{ background: value }}>
          <input
            type="color"
            value={value}
            aria-label={`${label}: выбрать цвет`}
            onChange={(event) => onChange(event.target.value)}
          />
        </label>
        <input
          className="ui-input is-mono ui-color-field__hex"
          value={draft}
          aria-label={`${label}: HEX`}
          onChange={(event) => {
            setDraft(event.target.value);
            const next = event.target.value.trim();
            if (/^#[0-9a-f]{6}$/i.test(next)) onChange(next.toLowerCase());
          }}
          onBlur={() => commit(draft)}
        />
        {onOpacity ? (
          <span className="ui-color-field__opacity">
            <input
              className="ui-range"
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={opacity}
              aria-label={`${label}: прозрачность`}
              onChange={(event) => onOpacity(Number(event.target.value))}
            />
            <span>{Math.round(opacity * 100)}%</span>
          </span>
        ) : null}
      </div>
    </div>
  );
}

export function TagInput({ value, onChange, placeholder, ariaLabel }) {
  const [draft, setDraft] = useState(value.join(', '));

  useEffect(() => {
    setDraft(value.join(', '));
  }, [value]);

  function commit() {
    onChange(
      draft
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean)
    );
  }

  return (
    <input
      className="ui-input is-mono"
      value={draft}
      placeholder={placeholder}
      aria-label={ariaLabel || placeholder}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={commit}
      onKeyDown={(event) => {
        if (event.key === 'Enter') {
          commit();
          event.currentTarget.blur();
        }
      }}
    />
  );
}
