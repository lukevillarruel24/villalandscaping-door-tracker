// Small inline icon set (no external icon library needed)
const PATHS = {
  map: 'M9 4 3 6v14l6-2 6 2 6-2V4l-6 2-6-2zm0 0v14m6-12v14',
  star: 'm12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9L12 3z',
  briefcase: 'M4 8h16v11H4zM9 8V5h6v3M4 13h16',
  chart: 'M4 20V10m6 10V4m6 16v-7m4 7H3',
  user: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zm-7 8a7 7 0 0 1 14 0',
  plus: 'M12 5v14M5 12h14',
  locate: 'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8zm0-6v3m0 14v3M2 12h3m14 0h3',
  search: 'm20 20-4.5-4.5M10.5 17a6.5 6.5 0 1 0 0-13 6.5 6.5 0 0 0 0 13z',
  close: 'M6 6l12 12M18 6 6 18',
  back: 'M15 5l-7 7 7 7',
  phone: 'M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z',
  message: 'M4 5h16v11H8l-4 4z',
  nav: 'M3 11 21 3l-8 18-2-8z',
  camera: 'M4 8h3l2-3h6l2 3h3v11H4zM12 17a4 4 0 1 0 0-8 4 4 0 0 0 0 8z',
  trash: 'M4 7h16M9 7V4h6v3m-8 0 1 13h8l1-13',
  edit: 'M4 20h4L19 9l-4-4L4 16zM14 6l4 4',
  filter: 'M3 5h18l-7 8v6l-4 2v-8z',
  layers: 'm12 3 9 5-9 5-9-5zm-9 9 9 5 9-5',
  check: 'M5 12l5 5L20 7',
  print: 'M7 9V3h10v6M7 17H4v-7h16v7h-3M7 14h10v7H7z',
  history: 'M3 12a9 9 0 1 0 3-6.7L3 8m0-5v5h5m4-1v5l3 3',
  pin: 'M12 22s7-6.2 7-12a7 7 0 1 0-14 0c0 5.8 7 12 7 12zm0-9a3 3 0 1 0 0-6 3 3 0 0 0 0 6z',
}

export function Icon({ name, size = 20, stroke = 2, className = '' }) {
  return (
    <svg
      className={'icon ' + className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={stroke}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={PATHS[name] || ''} />
    </svg>
  )
}
