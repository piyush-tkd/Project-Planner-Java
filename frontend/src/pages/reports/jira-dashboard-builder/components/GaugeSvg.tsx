import { UX_ERROR, UX_POSITIVE, UX_WARNING, DEEP_BLUE_HEX, DEEP_BLUE_TINTS } from '../../../../brandTokens';

// @ts-expect-error -- unused
export function GaugeSvg({ value, max, greenUpper, yellowUpper, unit, label }: {
  value: number; max: number; greenUpper: number; yellowUpper: number;
  unit?: string; label?: string;
}) {
  let color = UX_ERROR;
  let zone = 'Critical';
  if (value <= greenUpper) { color = UX_POSITIVE; zone = 'Good'; }
  else if (value <= yellowUpper) { color = UX_WARNING; zone = 'Watch'; }
  const displayVal = Number.isInteger(value) ? String(value) : value.toFixed(1);
  const suffix = unit ?? '';
  return (
    <svg width={180} height={130} viewBox="0 0 180 130">
      {/* Background track */}
      <circle cx="90" cy="90" r="52" fill="none" stroke={DEEP_BLUE_TINTS[10]} strokeWidth="9" />
      {/* Value arc */}
      <circle
        cx="90" cy="90" r="52" fill="none" stroke={color} strokeWidth="9"
        strokeDasharray={2 * Math.PI * 52} strokeDashoffset={2 * Math.PI * 52 - (Math.min(value / max, 1) * 2 * Math.PI * 52)}
        strokeLinecap="round" style={{ transition: 'stroke-dashoffset 0.5s ease' }}
      />
      {/* Value + unit — centered in visible semicircle */}
      <text x="90" y="84" textAnchor="middle" fontSize="24" fontWeight="bold" fill={DEEP_BLUE_HEX}>
        {displayVal}{suffix}
      </text>
      {/* Zone badge */}
      <text x="90" y="102" textAnchor="middle" fontSize="10" fontWeight="600" fill={color}>
        {zone}
      </text>
      {/* Threshold scale labels — below arc endpoints */}
      <text x="30" y="124" textAnchor="middle" fontSize="8" fill={DEEP_BLUE_TINTS[40]}>0{suffix}</text>
      <text x="90" y="124" textAnchor="middle" fontSize="8" fill={DEEP_BLUE_TINTS[40]}>{(max / 2)}{suffix}</text>
      <text x="150" y="124" textAnchor="middle" fontSize="8" fill={DEEP_BLUE_TINTS[40]}>{max}{suffix}</text>
    </svg>
  );
}
