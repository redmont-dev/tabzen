interface LogoProps {
  size?: number;
  showText?: boolean;
  textSize?: number;
  color?: string;
}

export function Logo({ size = 20, showText = true, textSize = 18, color = '#1a1a1a' }: LogoProps) {
  const opacity = color === '#1a1a1a' ? '0.4' : '0.3';
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: size * 0.5 }}>
      <svg width={size} height={size} viewBox="0 0 28 28" fill="none">
        <circle cx="6" cy="6" r="3" fill="#3b82f6"/>
        <circle cx="14" cy="6" r="3" fill={color} opacity={opacity}/>
        <circle cx="22" cy="6" r="3" fill={color} opacity={opacity}/>
        <circle cx="6" cy="14" r="3" fill={color} opacity={opacity}/>
        <circle cx="14" cy="14" r="3" fill="#22c55e"/>
        <circle cx="22" cy="14" r="3" fill={color} opacity={opacity}/>
        <circle cx="6" cy="22" r="3" fill={color} opacity={opacity}/>
        <circle cx="14" cy="22" r="3" fill={color} opacity={opacity}/>
        <circle cx="22" cy="22" r="3" fill="#a855f7"/>
      </svg>
      {showText && (
        <span style={{ fontSize: textSize, color, letterSpacing: '-0.3px' }}>
          <span style={{ fontWeight: 300 }}>Tab</span>
          <span style={{ fontWeight: 700 }}>zen</span>
        </span>
      )}
    </span>
  );
}
