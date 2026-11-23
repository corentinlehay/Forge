import type { SVGProps } from 'react';

/** Pictogrammes au trait, 24 × 24, couleur héritée du texte. */
const paths = {
  home: 'M4 10.5L12 4l8 6.5V20h-5.5v-6h-5v6H4z',
  training: 'M3 9.5v5M6.5 6.5v11M17.5 6.5v11M21 9.5v5M6.5 12h11',
  nutrition: 'M7 3v7a2 2 0 0 0 2 2v9M5 3v5M9 3v5M16 21V3c2.5 1.5 3.5 4.5 3.5 7.5S18 13 16 13',
  progression: 'M4 4v16h16M8 15l4-4 3 3 5-6',
  coach: 'M20 12a8 8 0 0 1-11.6 7.1L4 20l1-4.2A8 8 0 1 1 20 12z',
  back: 'M15 5l-7 7 7 7',
  chevron: 'M9 5l7 7-7 7',
  check: 'M5 12.5l4.5 4.5L19 7.5',
  close: 'M6 6l12 12M18 6L6 18',
  backspace: 'M9 5h11v14H9l-6-7zM12.5 9.5l5 5M17.5 9.5l-5 5',
  share: 'M12 3v12M7.5 7.5L12 3l4.5 4.5M5 12v8h14v-8',
  import: 'M12 15V3M7.5 10.5L12 15l4.5-4.5M5 12v8h14v-8',
  warning: 'M12 3.5L22 20.5H2zM12 10v4.5M12 17.5v0.1',
  clock: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 7v5l3 2',
  arrowUp: 'M12 19V5M6 11l6-6 6 6',
  arrowDown: 'M12 5v14M6 13l6 6 6-6',
  shield: 'M12 3l7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6z',
  phone: 'M8 2.5h8a1.5 1.5 0 0 1 1.5 1.5v16a1.5 1.5 0 0 1-1.5 1.5H8A1.5 1.5 0 0 1 6.5 20V4A1.5 1.5 0 0 1 8 2.5zM11 18.5h2',
  plus: 'M12 5v14M5 12h14',
  minus: 'M5 12h14',
  user: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4.5 20.5c1.2-3.5 4-5 7.5-5s6.3 1.5 7.5 5',
  moon: 'M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z',
  bolt: 'M13 2.5L4.5 13.5H12L11 21.5l8.5-11H12z',
  trophy: 'M8 4h8v5a4 4 0 0 1-8 0zM8 6H5a3 3 0 0 0 3 4M16 6h3a3 3 0 0 1-3 4M12 13v4M8.5 20.5h7M10 17h4v3.5h-4z',
  play: 'M7 4.5v15l12-7.5z',
  edit: 'M4 20h4L19 9l-4-4L4 16zM13.5 6.5l4 4',
  sparkle: 'M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8zM19 16l.8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8z',
  calendar: 'M4 6.5h16V20H4zM4 10.5h16M8.5 3.5v5M15.5 3.5v5',
  dots: 'M6 12h.01M12 12h.01M18 12h.01',
  info: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 11v5.5M12 7.5v.1',
} as const;

export type IconName = keyof typeof paths;

interface IconProps extends SVGProps<SVGSVGElement> {
  name: IconName;
  size?: number;
  strokeWidth?: number;
}

export function Icon({ name, size = 24, strokeWidth = 1.8, ...rest }: IconProps) {
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
      focusable="false"
      {...rest}
    >
      <path d={paths[name]} />
    </svg>
  );
}
