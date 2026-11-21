import { useId } from 'react';
import { View } from 'react-native';
import Svg, {
  Circle,
  Defs,
  G,
  LinearGradient,
  Path,
  RadialGradient,
  Rect,
  Stop,
  Text as SvgText,
} from 'react-native-svg';

/**
 * Welcome-page artwork (user request 2026-11-21: a full-screen welcome with
 * dental pictures). Hand-drawn vector scenes, so they stay sharp on every
 * phone, cost no download and need no licence.
 *
 * Like `BrandMark`, these colours are the artwork's own, not theme tokens: the
 * hero always sits on the MedTrackr blue gradient in light and dark mode, so
 * the pictures must not change with the theme. They live here, once.
 */
export const ART = {
  heroTop: '#1e3a8a',
  heroMid: '#2563eb',
  heroBottom: '#0891b2',
  white: '#ffffff',
  ink: '#0f172a',
  sky: '#dbeafe',
  skyDeep: '#bfdbfe',
  blue: '#2563eb',
  teal: '#14b8a6',
  green: '#10b981',
  amber: '#fbbf24',
  amberSoft: '#fde68a',
  pink: '#f472b6',
  slate: '#94a3b8',
  slateSoft: '#e2e8f0',
} as const;

/** Decorative: every scene is hidden from screen readers (the slide text says it). */
const HIDDEN = { accessible: false, importantForAccessibility: 'no-hide-descendants' } as const;

/** A four-point sparkle centred on (x, y). */
function Sparkle({ x, y, r, color = ART.amberSoft }: { x: number; y: number; r: number; color?: string }) {
  const k = r * 0.28;
  return (
    <Path
      fill={color}
      d={`M${x} ${y - r} Q${x + k} ${y - k} ${x + r} ${y} Q${x + k} ${y + k} ${x} ${y + r} Q${x - k} ${y + k} ${x - r} ${y} Q${x - k} ${y - k} ${x} ${y - r}Z`}
    />
  );
}

/** The soft glowing disc every scene stands on. */
function Halo({ id }: { id: string }) {
  return (
    <>
      <Defs>
        <RadialGradient id={id} cx="50%" cy="50%" r="50%">
          <Stop offset="0" stopColor={ART.white} stopOpacity={0.28} />
          <Stop offset="1" stopColor={ART.white} stopOpacity={0} />
        </RadialGradient>
      </Defs>
      <Circle cx={120} cy={120} r={118} fill={`url(#${id})`} />
      <Circle cx={120} cy={120} r={86} fill={ART.white} fillOpacity={0.1} />
    </>
  );
}

const TOOTH =
  'M78 72C78 48 100 42 120 54C140 42 162 48 162 72C162 98 153 112 151 134C148 164 143 190 132 190C121 190 124 156 120 156C116 156 119 190 108 190C97 190 92 164 89 134C87 112 78 98 78 72Z';

/** Slide 1 — a smiling tooth with a toothbrush and a "healthy" check. */
export function ToothScene({ size }: { size: number }) {
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, '');
  return (
    <Svg width={size} height={size} viewBox="0 0 240 240" {...HIDDEN}>
      <Halo id={`halo-${uid}`} />
      <Defs>
        <LinearGradient id={`tooth-${uid}`} x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor={ART.white} />
          <Stop offset="1" stopColor={ART.sky} />
        </LinearGradient>
      </Defs>

      {/* Toothbrush behind the tooth. */}
      <G rotation={-38} origin="120,120">
        <Rect x={22} y={112} width={120} height={14} rx={7} fill={ART.teal} />
        <Rect x={140} y={110} width={40} height={18} rx={6} fill={ART.white} />
        {[0, 1, 2, 3, 4].map((i) => (
          <Rect key={i} x={144 + i * 7} y={96} width={4} height={16} rx={2} fill={ART.skyDeep} />
        ))}
      </G>

      {/* Tooth with a shine and a friendly face. */}
      <Path d={TOOTH} fill={`url(#tooth-${uid})`} stroke={ART.skyDeep} strokeWidth={3} />
      <Path d="M92 70C92 60 100 56 108 58" stroke={ART.white} strokeWidth={6} strokeLinecap="round" fill="none" />
      <Circle cx={106} cy={100} r={5} fill={ART.ink} />
      <Circle cx={134} cy={100} r={5} fill={ART.ink} />
      <Circle cx={98} cy={114} r={6} fill={ART.pink} fillOpacity={0.45} />
      <Circle cx={142} cy={114} r={6} fill={ART.pink} fillOpacity={0.45} />
      <Path d="M108 116Q120 128 132 116" stroke={ART.ink} strokeWidth={4} strokeLinecap="round" fill="none" />

      {/* Healthy badge. */}
      <Circle cx={168} cy={168} r={22} fill={ART.green} stroke={ART.white} strokeWidth={4} />
      <Path d="M158 168l7 7 13-14" stroke={ART.white} strokeWidth={5} strokeLinecap="round" strokeLinejoin="round" fill="none" />

      <Sparkle x={58} y={58} r={11} />
      <Sparkle x={186} y={62} r={8} />
      <Sparkle x={196} y={112} r={5} color={ART.white} />
      <Sparkle x={44} y={150} r={6} color={ART.white} />
    </Svg>
  );
}

/** Slide 2 — a phone showing a live queue token, with a "your turn soon" bell. */
export function TokenScene({ size }: { size: number }) {
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, '');
  return (
    <Svg width={size} height={size} viewBox="0 0 240 240" {...HIDDEN}>
      <Halo id={`halo-${uid}`} />
      {/* Phone. */}
      <Rect x={72} y={28} width={96} height={184} rx={18} fill={ART.ink} />
      <Rect x={78} y={36} width={84} height={168} rx={13} fill={ART.white} />
      <Rect x={106} y={40} width={28} height={5} rx={2.5} fill={ART.ink} />

      {/* Token card on screen. */}
      <Rect x={86} y={58} width={68} height={74} rx={10} fill={ART.blue} />
      <SvgText x={120} y={76} fontSize={9} fill={ART.skyDeep} textAnchor="middle" fontWeight="600">
        TOKEN
      </SvgText>
      <SvgText x={120} y={112} fontSize={30} fill={ART.white} textAnchor="middle" fontWeight="800">
        A12
      </SvgText>
      <Rect x={96} y={120} width={48} height={4} rx={2} fill={ART.white} fillOpacity={0.3} />
      <Rect x={96} y={120} width={34} height={4} rx={2} fill={ART.amber} />

      {/* Queue rows. */}
      {[0, 1, 2].map((i) => (
        <G key={i}>
          <Circle cx={94} cy={150 + i * 18} r={6} fill={i === 0 ? ART.green : ART.slateSoft} />
          <Rect x={106} y={147 + i * 18} width={i === 0 ? 46 : 38 - i * 6} height={6} rx={3} fill={ART.slateSoft} />
        </G>
      ))}

      {/* Notification bell bubble. */}
      <Circle cx={174} cy={62} r={24} fill={ART.amber} stroke={ART.white} strokeWidth={4} />
      <Path
        d="M164 68h20l-3-4v-7a7 7 0 0 0-14 0v7z"
        fill={ART.white}
      />
      <Circle cx={174} cy={72} r={3} fill={ART.white} />

      {/* Clock chip. */}
      <Circle cx={58} cy={168} r={20} fill={ART.white} />
      <Circle cx={58} cy={168} r={14} fill="none" stroke={ART.blue} strokeWidth={3} />
      <Path d="M58 160v8l6 4" stroke={ART.blue} strokeWidth={3} strokeLinecap="round" fill="none" />

      <Sparkle x={196} y={140} r={8} />
      <Sparkle x={46} y={80} r={9} />
    </Svg>
  );
}

/** Slide 3 — medicine bottle, capsule and a reminder clock. */
export function MedicineScene({ size }: { size: number }) {
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, '');
  return (
    <Svg width={size} height={size} viewBox="0 0 240 240" {...HIDDEN}>
      <Halo id={`halo-${uid}`} />
      {/* Bottle. */}
      <Rect x={70} y={70} width={84} height={120} rx={16} fill={ART.white} />
      <Rect x={78} y={50} width={68} height={26} rx={7} fill={ART.teal} />
      <Rect x={80} y={100} width={64} height={56} rx={8} fill={ART.sky} />
      <Rect x={106} y={110} width={12} height={36} rx={3} fill={ART.blue} />
      <Rect x={94} y={122} width={36} height={12} rx={3} fill={ART.blue} />
      <Rect x={82} y={168} width={40} height={6} rx={3} fill={ART.slateSoft} />

      {/* Capsule. */}
      <G rotation={-35} origin="172,178">
        <Rect x={146} y={166} width={52} height={24} rx={12} fill={ART.white} />
        <Path d="M172 166h14a12 12 0 0 1 0 24h-14z" fill={ART.pink} />
      </G>

      {/* Reminder clock. */}
      <Circle cx={170} cy={78} r={30} fill={ART.white} stroke={ART.amber} strokeWidth={5} />
      <Path d="M170 62v16l11 7" stroke={ART.ink} strokeWidth={4} strokeLinecap="round" fill="none" />
      <Circle cx={170} cy={78} r={3} fill={ART.ink} />
      <Circle cx={196} cy={56} r={9} fill={ART.green} />
      <Path d="M192 56l3 3 5-6" stroke={ART.white} strokeWidth={2.5} strokeLinecap="round" fill="none" />

      <Sparkle x={52} y={60} r={9} />
      <Sparkle x={48} y={176} r={6} color={ART.white} />
      <Sparkle x={204} y={150} r={7} />
    </Svg>
  );
}

/** Slide 4 — the clinic: a dental chair under its lamp, with a patient list. */
export function ClinicScene({ size }: { size: number }) {
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, '');
  return (
    <Svg width={size} height={size} viewBox="0 0 240 240" {...HIDDEN}>
      <Halo id={`halo-${uid}`} />
      <Defs>
        <LinearGradient id={`beam-${uid}`} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={ART.amberSoft} stopOpacity={0.75} />
          <Stop offset="1" stopColor={ART.amberSoft} stopOpacity={0} />
        </LinearGradient>
      </Defs>

      {/* Lamp arm + light beam. */}
      <Path d="M196 30V56H150" stroke={ART.white} strokeWidth={6} strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <Path d="M132 64L168 64L182 120L118 120Z" fill={`url(#beam-${uid})`} />
      <Rect x={134} y={52} width={34} height={14} rx={7} fill={ART.amber} />

      {/* Chair: base, column, seat, backrest, headrest, footrest. */}
      <Rect x={70} y={194} width={92} height={12} rx={6} fill={ART.white} />
      <Rect x={108} y={160} width={16} height={36} rx={4} fill={ART.skyDeep} />
      <Rect x={74} y={146} width={96} height={22} rx={11} fill={ART.teal} />
      <G rotation={-58} origin="80,156">
        <Rect x={44} y={146} width={78} height={22} rx={11} fill={ART.teal} />
      </G>
      <Circle cx={52} cy={88} r={12} fill={ART.teal} />
      <G rotation={22} origin="168,156">
        <Rect x={160} y={150} width={46} height={16} rx={8} fill={ART.teal} />
      </G>

      {/* Tray with a tool. */}
      <Rect x={176} y={110} width={40} height={6} rx={3} fill={ART.white} />
      <Rect x={194} y={116} width={4} height={28} rx={2} fill={ART.white} />
      <Rect x={182} y={102} width={22} height={4} rx={2} fill={ART.slate} />

      {/* Patient list card. */}
      <Rect x={22} y={150} width={44} height={52} rx={8} fill={ART.white} />
      {[0, 1, 2].map((i) => (
        <G key={i}>
          <Circle cx={32} cy={164 + i * 13} r={3.5} fill={i === 0 ? ART.green : ART.skyDeep} />
          <Rect x={39} y={162 + i * 13} width={20} height={4} rx={2} fill={ART.slateSoft} />
        </G>
      ))}

      <Sparkle x={96} y={44} r={9} />
      <Sparkle x={210} y={176} r={6} color={ART.white} />
    </Svg>
  );
}

/** The blue hero gradient behind the slides; fills its parent. */
export function HeroBackground() {
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, '');
  return (
    <View className="absolute inset-0" {...HIDDEN}>
    <Svg width="100%" height="100%" preserveAspectRatio="none" viewBox="0 0 100 100" {...HIDDEN}>
      <Defs>
        <LinearGradient id={`hero-${uid}`} x1="0" y1="0" x2="0.6" y2="1">
          <Stop offset="0" stopColor={ART.heroTop} />
          <Stop offset="0.55" stopColor={ART.heroMid} />
          <Stop offset="1" stopColor={ART.heroBottom} />
        </LinearGradient>
      </Defs>
      <Rect width="100" height="100" fill={`url(#hero-${uid})`} />
      <Circle cx="92" cy="8" r="26" fill={ART.white} fillOpacity={0.06} />
      <Circle cx="4" cy="62" r="20" fill={ART.white} fillOpacity={0.05} />
    </Svg>
    </View>
  );
}
