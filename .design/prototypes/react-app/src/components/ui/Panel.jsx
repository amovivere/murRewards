export function Panel({ title, description, actions, children, compact = false, className = '' }) {
  return (
    <section className={`ui-panel${compact ? ' is-compact' : ''} ${className}`.trim()}>
      {title || actions ? (
        <header className="ui-panel__head">
          <div>
            {title ? <h2 className="ui-panel__title">{title}</h2> : null}
            {description ? <p className="ui-panel__description">{description}</p> : null}
          </div>
          {actions ? <div className="ui-panel__actions">{actions}</div> : null}
        </header>
      ) : null}
      <div className="ui-panel__body">{children}</div>
    </section>
  );
}

export function Pill({ tone = 'neutral', children }) {
  return <span className={`ui-pill ui-pill--${tone}`}>{children}</span>;
}

export function SectionLabel({ children }) {
  return <div className="ui-section-label">{children}</div>;
}
