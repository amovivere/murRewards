export default function Button({
  children,
  variant = 'secondary',
  size = 'md',
  icon = null,
  disabled = false,
  active = false,
  full = false,
  type = 'button',
  onClick,
  title,
  ...rest
}) {
  const cls = [
    'ui-button',
    `ui-button--${variant}`,
    `ui-button--${size}`,
    active ? 'is-active' : '',
    full ? 'is-full' : '',
  ]
    .filter(Boolean)
    .join(' ');
  return (
    <button type={type} className={cls} disabled={disabled} onClick={onClick} title={title} {...rest}>
      {icon ? <span className="ui-button__icon">{icon}</span> : null}
      {children ? <span>{children}</span> : null}
    </button>
  );
}
