export default function Modal({ open, title, subtitle, onClose, children, footer, width = 620 }) {
  if (!open) return null;
  return (
    <div className="ui-modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose?.()}>
      <section className="ui-modal" style={{ width }} role="dialog" aria-modal="true" aria-label={title}>
        <header className="ui-modal__head">
          <div>
            <h2 className="ui-modal__title">{title}</h2>
            {subtitle ? <p className="ui-modal__subtitle">{subtitle}</p> : null}
          </div>
          <button className="ui-modal__close" onClick={onClose} aria-label="Закрыть">
            ×
          </button>
        </header>
        <div className="ui-modal__body">{children}</div>
        {footer ? <footer className="ui-modal__footer">{footer}</footer> : null}
      </section>
    </div>
  );
}
