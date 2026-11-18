const paths = {
  rewards: (
    <>
      <rect x="3" y="3" width="7" height="7" rx="2" fill="currentColor" stroke="none" />
      <rect x="14" y="3" width="7" height="7" rx="2" fill="currentColor" stroke="none" />
      <rect x="3" y="14" width="7" height="7" rx="2" fill="currentColor" stroke="none" />
      <rect x="14" y="14" width="7" height="7" rx="2" fill="currentColor" stroke="none" />
    </>
  ),
  music: (
    <>
      <path d="M9 18V5l11-2v13" />
      <circle cx="6" cy="18" r="3" />
      <circle cx="17" cy="16" r="3" />
    </>
  ),
  overlay: (
    <>
      <rect x="3" y="4" width="18" height="13" rx="2" />
      <path d="M8 21h8M12 17v4" />
    </>
  ),
  settings: (
    <>
      <path d="M4 6h16M4 12h16M4 18h16" />
      <circle cx="8" cy="6" r="2" fill="var(--sidebar)" />
      <circle cx="15" cy="12" r="2" fill="var(--sidebar)" />
      <circle cx="10" cy="18" r="2" fill="var(--sidebar)" />
    </>
  ),
  log: (
    <>
      <circle cx="5" cy="6" r="1.4" fill="currentColor" stroke="none" />
      <circle cx="5" cy="12" r="1.4" fill="currentColor" stroke="none" />
      <circle cx="5" cy="18" r="1.4" fill="currentColor" stroke="none" />
      <path d="M10 6h10M10 12h10M10 18h10" />
    </>
  ),
  design: (
    <>
      <path d="M12 3 3 12l9 9 9-9-9-9Z" />
      <path d="m8 12 4 4 4-4" />
    </>
  ),
  volume: (
    <>
      <path d="M4 9v6h4l5 4V5L8 9H4Z" />
      <path d="M16 9.5a4 4 0 0 1 0 5M18.5 7a7.5 7.5 0 0 1 0 10" />
    </>
  ),
  plus: <path d="M12 5v14M5 12h14" />,
  dots: (
    <>
      <circle cx="5" cy="12" r="1.3" fill="currentColor" stroke="none" />
      <circle cx="12" cy="12" r="1.3" fill="currentColor" stroke="none" />
      <circle cx="19" cy="12" r="1.3" fill="currentColor" stroke="none" />
    </>
  ),
  search: (
    <>
      <circle cx="10.5" cy="10.5" r="6.5" />
      <path d="m16 16 4 4" />
    </>
  ),
  copy: (
    <>
      <rect x="8" y="8" width="11" height="11" rx="2" />
      <path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3" />
    </>
  ),
  play: <path d="m8 5 11 7-11 7V5Z" fill="currentColor" stroke="none" />,
  pause: (
    <>
      <rect x="7" y="5" width="3" height="14" rx="1" fill="currentColor" stroke="none" />
      <rect x="14" y="5" width="3" height="14" rx="1" fill="currentColor" stroke="none" />
    </>
  ),
  next: (
    <>
      <path d="m8 5 10 7-10 7V5Z" fill="currentColor" stroke="none" />
      <path d="M19 5v14" />
    </>
  ),
  grid: (
    <>
      <rect x="3" y="3" width="7" height="7" rx="1.5" />
      <rect x="14" y="3" width="7" height="7" rx="1.5" />
      <rect x="3" y="14" width="7" height="7" rx="1.5" />
      <rect x="14" y="14" width="7" height="7" rx="1.5" />
    </>
  ),
  list: (
    <>
      <path d="M8 6h13M8 12h13M8 18h13" />
      <circle cx="4" cy="6" r="1.3" fill="currentColor" stroke="none" />
      <circle cx="4" cy="12" r="1.3" fill="currentColor" stroke="none" />
      <circle cx="4" cy="18" r="1.3" fill="currentColor" stroke="none" />
    </>
  ),
  external: (
    <>
      <path d="M14 4h6v6M20 4l-9 9" />
      <path d="M19 14v5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h5" />
    </>
  ),
};

export default function Icon({ name, size = 16, strokeWidth = 1.6 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths[name] ?? paths.design}
    </svg>
  );
}
