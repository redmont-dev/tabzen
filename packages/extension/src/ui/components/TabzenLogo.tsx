interface TabzenLogoProps {
  size?: number;
}

export function TabzenLogo({ size = 20 }: TabzenLogoProps) {
  const textSize = size * 0.9;
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: size * 0.4 }}>
      <svg width={size} height={size} viewBox="0 0 28 28" fill="none">
        <circle cx="6" cy="6" r="3" fill="#3b82f6" />
        <circle cx="14" cy="6" r="3" fill="currentColor" opacity="0.4" />
        <circle cx="22" cy="6" r="3" fill="currentColor" opacity="0.4" />
        <circle cx="6" cy="14" r="3" fill="currentColor" opacity="0.4" />
        <circle cx="14" cy="14" r="3" fill="#22c55e" />
        <circle cx="22" cy="14" r="3" fill="currentColor" opacity="0.4" />
        <circle cx="6" cy="22" r="3" fill="currentColor" opacity="0.4" />
        <circle cx="14" cy="22" r="3" fill="currentColor" opacity="0.4" />
        <circle cx="22" cy="22" r="3" fill="#a855f7" />
      </svg>
      <span style={{ fontSize: textSize, letterSpacing: '-0.3px' }}>
        <span style={{ fontWeight: 300 }}>Tab</span>
        <span style={{ fontWeight: 700 }}>zen</span>
      </span>
    </span>
  );
}
