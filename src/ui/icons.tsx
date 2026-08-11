/**
 * Inline SVGs instead of react-icons: pulling a single glyph out of react-icons/gi
 * dragged ~7 MB of module source through the build for one icon.
 */
interface IconProps {
  size?: number;
  color?: string;
}

function Svg({ size = 14, color = "currentColor", children }: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ display: "block", flexShrink: 0 }}
      aria-hidden
    >
      {children}
    </svg>
  );
}

export function IconPlus(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M12 5v14M5 12h14" />
    </Svg>
  );
}

export function IconDice(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="3" y="3" width="18" height="18" rx="3" />
      <circle cx="8.5" cy="8.5" r="1.2" fill="currentColor" stroke="none" />
      <circle cx="15.5" cy="15.5" r="1.2" fill="currentColor" stroke="none" />
      <circle cx="15.5" cy="8.5" r="1.2" fill="currentColor" stroke="none" />
      <circle cx="8.5" cy="15.5" r="1.2" fill="currentColor" stroke="none" />
    </Svg>
  );
}

export function IconShare(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx="18" cy="5" r="2.6" />
      <circle cx="6" cy="12" r="2.6" />
      <circle cx="18" cy="19" r="2.6" />
      <path d="M8.4 10.8 15.6 6.6M8.4 13.2l7.2 4.2" />
    </Svg>
  );
}

export function IconTrash(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M4 7h16M9 7V5h6v2M6 7l1 13h10l1-13" />
    </Svg>
  );
}

export function IconLock({ size = 14, color = "currentColor" }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={color} style={{ display: "block", flexShrink: 0 }} aria-hidden>
      <path d="M17 9V7a5 5 0 0 0-10 0v2H5.5A1.5 1.5 0 0 0 4 10.5v9A1.5 1.5 0 0 0 5.5 21h13a1.5 1.5 0 0 0 1.5-1.5v-9A1.5 1.5 0 0 0 18.5 9H17ZM9 7a3 3 0 0 1 6 0v2H9V7Z" />
    </svg>
  );
}

/** Overflow affordance at the end of a team line. */
export function IconDots({ size = 16, color = "currentColor" }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={color} style={{ display: "block", flexShrink: 0 }} aria-hidden>
      <circle cx="12" cy="5" r="2" />
      <circle cx="12" cy="12" r="2" />
      <circle cx="12" cy="19" r="2" />
    </svg>
  );
}

/** Marks the control that changes which evolution follows a Digimon. */
export function IconEdit(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M4 20h4L19 9a2.1 2.1 0 0 0-3-3L5 17v3Z" />
      <path d="M14.5 7.5 16.5 9.5" />
    </Svg>
  );
}

export function IconInfo(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v5M12 8h.01" />
    </Svg>
  );
}

/** Plugin icon in Decky's plugin list: a stylised Digi-Egg. */
export function IconDigiEgg({ size = 18 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={{ display: "block" }} aria-hidden>
      <path
        d="M12 2c4.2 0 7.5 5.4 7.5 10.4C19.5 17.7 16.1 22 12 22s-7.5-4.3-7.5-9.6C4.5 7.4 7.8 2 12 2Z"
        stroke="currentColor"
        strokeWidth="1.8"
      />
      <path d="M8.2 12.6 10 10l2 2.6L14 10l1.8 2.6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="9.4" cy="7.4" r="1" fill="currentColor" />
      <circle cx="14.6" cy="7.4" r="1" fill="currentColor" />
    </svg>
  );
}
