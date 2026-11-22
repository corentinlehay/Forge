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
