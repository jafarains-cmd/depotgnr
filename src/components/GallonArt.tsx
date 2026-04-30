/**
 * GallonArt — ilustrasi galon 19L (port dari Claude Design)
 * Tier:
 *  - standard (default): brand color
 *  - premium: ocean blue
 *  - ro: mint green
 */

type Tier = "standard" | "premium" | "ro";

const TIER_COLORS: Record<Tier, { body: string; cap: string; water: string }> = {
  standard: { body: "var(--brand)", cap: "var(--brand-deep)", water: "#7DD9F0" },
  premium: { body: "#1E5BFF", cap: "#0B2D8A", water: "#8AAEFF" },
  ro: { body: "#00C39A", cap: "#006B55", water: "#7FE5C9" },
};

export function GallonArt({
  size = 160,
  tier = "standard",
  label = "GNR",
  color,
  accent,
}: {
  size?: number;
  tier?: Tier;
  label?: string;
  color?: string;
  accent?: string;
}) {
  const w = size;
  const h = size * 1.3;
  const c = TIER_COLORS[tier];
  const body = color ?? c.body;
  const cap = accent ?? c.cap;
  const water = c.water;
  const idx = `${tier}-${label}`;

  return (
    <svg width={w} height={h} viewBox="0 0 160 208" style={{ display: "block" }}>
      <defs>
        <linearGradient id={`gx-${idx}`} x1="0" x2="1">
          <stop offset="0" stopColor={body} stopOpacity="0.85" />
          <stop offset="0.5" stopColor={body} />
          <stop offset="1" stopColor={body} stopOpacity="0.7" />
        </linearGradient>
        <linearGradient id={`wx-${idx}`} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor={water} stopOpacity="0.55" />
          <stop offset="1" stopColor={water} stopOpacity="0.95" />
        </linearGradient>
      </defs>
      {/* cap */}
      <rect x="62" y="6" width="36" height="20" rx="4" fill={cap} />
      <rect x="62" y="6" width="36" height="6" rx="3" fill="rgba(255,255,255,0.25)" />
      {/* neck */}
      <path d="M68 26 L60 42 L100 42 L92 26 Z" fill={body} />
      {/* handle */}
      <path
        d="M104 50 q20 6 20 24 q0 18 -20 22"
        fill="none"
        stroke={body}
        strokeWidth="10"
        strokeLinecap="round"
      />
      <path
        d="M104 56 q14 6 14 18 q0 14 -14 18"
        fill="none"
        stroke={body}
        strokeOpacity="0.4"
        strokeWidth="3"
      />
      {/* body */}
      <path
        d="M40 46 Q36 48 36 56 L36 188 Q36 200 50 200 L110 200 Q124 200 124 188 L124 56 Q124 48 120 46 Z"
        fill={`url(#gx-${idx})`}
      />
      {/* highlight */}
      <path d="M48 60 L48 184" stroke="rgba(255,255,255,0.55)" strokeWidth="6" strokeLinecap="round" />
      <path d="M58 60 L58 100" stroke="rgba(255,255,255,0.25)" strokeWidth="3" strokeLinecap="round" />
      {/* label window */}
      <rect x="50" y="80" width="60" height="78" rx="6" fill="rgba(255,255,255,0.95)" />
      <rect
        x="50"
        y="80"
        width="60"
        height="78"
        rx="6"
        fill={`url(#wx-${idx})`}
        opacity="0.45"
      />
      <text
        x="80"
        y="118"
        textAnchor="middle"
        fontFamily="ui-sans-serif, system-ui"
        fontWeight="800"
        fontSize="20"
        fill={cap}
        letterSpacing="0.5"
      >
        {label}
      </text>
      <text
        x="80"
        y="138"
        textAnchor="middle"
        fontFamily="ui-sans-serif, system-ui"
        fontWeight="600"
        fontSize="9"
        fill={cap}
        opacity="0.7"
        letterSpacing="2"
      >
        PURE WATER
      </text>
      <line x1="58" y1="148" x2="102" y2="148" stroke={cap} strokeOpacity="0.3" />
      <text
        x="80"
        y="158"
        textAnchor="middle"
        fontFamily="ui-sans-serif, system-ui"
        fontWeight="700"
        fontSize="10"
        fill={cap}
        opacity="0.85"
      >
        19 LITER
      </text>
      <ellipse cx="80" cy="204" rx="40" ry="3" fill="#000" opacity="0.08" />
    </svg>
  );
}

export function DropFill({
  size = 24,
  color = "currentColor",
}: {
  size?: number;
  color?: string;
}) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
      <path d="M12 2 C 8 7 5 12 5 16 a7 7 0 0 0 14 0 C 19 12 16 7 12 2 z" />
    </svg>
  );
}
