import { motion, useReducedMotion } from 'framer-motion'
import { useId } from 'react'
import type { FieldCrop, FieldState } from './fieldState'

// A side view of the farmer's field. Every layer is driven by a 0–1 value from
// fieldState(), and colors change through CSS transitions on plain elements (Framer
// can't tween CSS-variable fills), so the scene morphs smoothly as risks change.

const W = 480
const H = 260
const GROUND = 192 // soil surface
const PLANT_HEIGHT: Record<FieldCrop, number> = { rice: 72, wheat: 82, potato: 44 }
const PLANT_X = [36, 86, 136, 188, 240, 292, 344, 394, 444]
// How early each plant shows stress, so trouble appears in patches, not all at once.
const SENSITIVITY = [0.55, 0.15, 0.8, 0.35, 0.95, 0.25, 0.65, 0.05, 0.45]

const clamp = (v: number, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, v))
const mix = (a: number, b: number, t: number) => a + (b - a) * t

/** Healthy green → yellow → brown. */
function plantColors(sick: number) {
  const hue = sick < 0.5 ? mix(122, 55, sick * 2) : mix(55, 28, (sick - 0.5) * 2)
  const light = mix(42, 40, sick)
  return { leaf: `hsl(${hue} 62% ${light}%)`, dark: `hsl(${hue} 58% ${light - 12}%)` }
}

type PlantProps = { px: number; h: number; droop: number; color: ReturnType<typeof plantColors> }
const spring = { type: 'spring', stiffness: 80, damping: 14 } as const

// Plants are drawn in scene coordinates (base at px, GROUND) so every rotation pivots
// exactly on the plant's base.
function RicePlant({ px, h, droop, color }: PlantProps) {
  return (
    <g style={{ stroke: color.leaf, transition: 'stroke 0.6s' }} strokeWidth="3" fill="none" strokeLinecap="round">
      {[-26, -13, 0, 13, 26].map((a, i) => (
        <motion.path
          key={a}
          d={`M${px} ${GROUND} Q ${px + a * 0.25} ${GROUND - h * 0.55} ${px + a} ${GROUND - h + Math.abs(a) * 0.4}`}
          style={{ transformBox: 'view-box', transformOrigin: `${px}px ${GROUND}px`, stroke: i % 2 ? color.dark : undefined }}
          animate={{ rotate: Math.sign(a || 1) * droop * 0.7, scaleY: 1 - droop / 220 }}
          transition={spring}
        />
      ))}
    </g>
  )
}

function WheatPlant({ px, h, droop, color }: PlantProps) {
  return (
    <g strokeLinecap="round">
      {[-7, 0, 7].map((dx, i) => {
        const x = px + dx
        return (
          <motion.g
            key={dx}
            style={{ transformBox: 'view-box', transformOrigin: `${x}px ${GROUND}px` }}
            animate={{ rotate: (i - 1) * (4 + droop * 0.4) + droop * 0.25, scaleY: 1 - droop / 190 }}
            transition={spring}
          >
            <line x1={x} y1={GROUND} x2={x} y2={GROUND - h} style={{ stroke: color.dark, transition: 'stroke 0.6s' }} strokeWidth="2.5" />
            <path d={`M${x} ${GROUND - h * 0.45} q ${dx >= 0 ? 12 : -12} -6 ${dx >= 0 ? 18 : -18} 4`} fill="none" style={{ stroke: color.leaf, transition: 'stroke 0.6s' }} strokeWidth="2.5" />
            <ellipse cx={x} cy={GROUND - h - 7} rx="3.4" ry="9" style={{ fill: color.leaf, transition: 'fill 0.6s' }} />
          </motion.g>
        )
      })}
    </g>
  )
}

function PotatoPlant({ px, droop, color }: PlantProps) {
  const leaves: [number, number][] = [
    [-15, -18],
    [0, -30],
    [15, -20],
    [-6, -10],
    [8, -9],
  ]
  return (
    <motion.g style={{ transformBox: 'view-box', transformOrigin: `${px}px ${GROUND}px` }} animate={{ scaleY: 1 - droop / 140 }} transition={spring}>
      <path
        d={`M${px} ${GROUND} l-8 -16 M${px} ${GROUND} l0 -26 M${px} ${GROUND} l9 -17`}
        style={{ stroke: color.dark, transition: 'stroke 0.6s' }}
        strokeWidth="2.5"
        fill="none"
      />
      {leaves.map(([x, y]) => (
        <circle key={`${x}${y}`} cx={px + x} cy={GROUND + y} r="9.5" style={{ fill: color.leaf, stroke: color.dark, transition: 'fill 0.6s, stroke 0.6s' }} strokeWidth="1.5" />
      ))}
    </motion.g>
  )
}

function Cracks({ dryness }: { dryness: number }) {
  const show = clamp((dryness - 0.42) / 0.35) // cracks belong to the "cracked soil" stage
  const deep = clamp((dryness - 0.7) / 0.3)
  return (
    <g stroke="#3b2414" strokeLinecap="round" strokeLinejoin="round" fill="none" style={{ opacity: show, transition: 'opacity 0.6s' }}>
      {[60, 112, 162, 214, 266, 318, 370, 420].map((x, i) => (
        <path
          key={x}
          strokeWidth={1.5 + deep * 1.5}
          d={`M${x} ${GROUND + 2} l ${i % 2 ? 5 : -4} ${8 + deep * 14} l ${i % 2 ? -6 : 6} ${6 + deep * 16} m ${i % 2 ? 3 : -3} ${-10 - deep * 8} l ${i % 2 ? 9 : -9} ${5 + deep * 6}`}
        />
      ))}
    </g>
  )
}

export function FieldScene({ state, label }: { state: FieldState; label: string }) {
  const reduce = useReducedMotion()
  // Unique ids: several scenes can share a page (e.g. the design-system gallery).
  const uid = useId().replace(/:/g, '')
  const skyId = `field-sky-${uid}`
  const frameId = `field-frame-${uid}`
  const plantH = PLANT_HEIGHT[state.crop]
  const waterTop = GROUND - state.water * plantH
  const flooded = state.water > 0.13 // above normal paddy water: muddy floodwater
  const puddles = state.crop !== 'rice' && state.water > 0.001 && state.water < 0.06
  const pale = Math.sqrt(state.dryness) // the first drying shows most: dark brown turns tan quickly
  const soil = `hsl(${mix(24, 34, pale)} ${mix(42, 38, pale)}% ${mix(20, 50, pale)}%)`
  const skyTop = `hsl(${mix(205, 28, state.heat)} ${mix(65, 80, state.heat)}% ${mix(58, 62, state.heat)}%)`
  const skyBottom = `hsl(${mix(195, 40, state.heat)} ${mix(70, 85, state.heat)}% ${mix(82, 78, state.heat)}%)`
  const droop = clamp((state.dryness - 0.4) / 0.6) * 38
  const loop = (duration: number) => (reduce ? { duration: 0 } : { duration, repeat: Infinity, ease: 'linear' as const })

  return (
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={label} className="block h-auto w-full" data-water={state.water.toFixed(2)}>
      <defs>
        <linearGradient id={skyId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" style={{ stopColor: skyTop, transition: 'stop-color 0.8s' }} />
          <stop offset="100%" style={{ stopColor: skyBottom, transition: 'stop-color 0.8s' }} />
        </linearGradient>
        <clipPath id={frameId}>
          <rect width={W} height={H} rx="18" />
        </clipPath>
      </defs>

      <g clipPath={`url(#${frameId})`}>
        {/* Sky, sun and heat */}
        <rect width={W} height={GROUND} fill={`url(#${skyId})`} />
        <circle cx="410" cy="48" r={24 + state.heat * 26} fill="#fde047" style={{ opacity: 0.18 + state.heat * 0.3, transition: 'all 0.8s' }} />
        <circle cx="410" cy="48" r="20" style={{ fill: state.heat > 0.5 ? '#fb923c' : '#facc15', transition: 'fill 0.8s' }} />
        {state.heat > 0.35 && (
          <motion.g
            data-layer="heat"
            stroke="#fff7ed"
            strokeWidth="2"
            fill="none"
            style={{ opacity: (state.heat - 0.35) * 0.9 }}
            animate={reduce ? undefined : { x: [0, 12, 0] }}
            transition={reduce ? undefined : { duration: 3, repeat: Infinity, ease: 'easeInOut' }}
          >
            {[120, 136, 152].map((y) => (
              <path key={y} d={`M20 ${y} q 20 -6 40 0 t 40 0 t 40 0 t 40 0 t 40 0 t 40 0 t 40 0 t 40 0 t 40 0 t 40 0 t 40 0`} />
            ))}
          </motion.g>
        )}

        {/* Rain clouds from the forecast */}
        <g data-layer="rain" style={{ opacity: clamp(state.rain * 1.6), transition: 'opacity 0.8s' }}>
          {[
            [90, 44, 1],
            [230, 30, 1.25],
            [345, 58, 0.9],
          ].map(([x, y, s]) => (
            <g key={x} transform={`translate(${x} ${y}) scale(${s})`} fill={state.rain > 0.5 ? '#94a3b8' : '#e2e8f0'}>
              <ellipse cx="0" cy="0" rx="30" ry="14" />
              <ellipse cx="-20" cy="6" rx="20" ry="11" />
              <ellipse cx="22" cy="6" rx="22" ry="12" />
            </g>
          ))}
          {state.rain > 0.25 &&
            Array.from({ length: Math.round(state.rain * 26) }, (_, i) => (
              <motion.line
                key={i}
                x1={40 + ((i * 37) % 400)}
                x2={36 + ((i * 37) % 400)}
                y1="62"
                y2="74"
                stroke="#bae6fd"
                strokeWidth="2"
                strokeLinecap="round"
                animate={reduce ? undefined : { y: [0, 110], opacity: [0, 1, 0] }}
                transition={reduce ? undefined : { duration: 1.1, repeat: Infinity, delay: (i % 7) * 0.15, ease: 'linear' }}
              />
            ))}
        </g>

        {/* Distant hills and the field's soil */}
        <path d={`M0 150 Q 90 112 190 142 T 380 132 T ${W} 140 V ${GROUND} H 0Z`} fill="#3f7d4f" opacity="0.55" />
        <rect y={GROUND} width={W} height={H - GROUND} style={{ fill: soil, transition: 'fill 0.8s' }} />
        <rect y={GROUND + 26} width={W} height={H - GROUND} fill="#000" opacity="0.15" />
        <Cracks dryness={state.dryness} />

        {/* Plants */}
        {PLANT_X.map((x, i) => {
          const sick = clamp((state.sickness - SENSITIVITY[i] * 0.75) / 0.35)
          const color = plantColors(sick)
          const spots = state.disease > 0.3 && SENSITIVITY[i] < state.disease
          const props = { px: x, h: state.crop === 'wheat' ? plantH - 10 : plantH, droop, color }
          return (
            <motion.g
              key={x}
              data-plant={i}
              data-sick={sick.toFixed(2)}
              style={{ transformBox: 'view-box', transformOrigin: `${x}px ${GROUND}px` }}
              animate={reduce || state.water > 0.9 ? undefined : { rotate: [0, 1.6, 0, -1.6, 0] }}
              transition={{ duration: 4 + (i % 3), repeat: Infinity, ease: 'easeInOut' }}
            >
              {state.crop === 'rice' && <RicePlant {...props} />}
              {state.crop === 'wheat' && <WheatPlant {...props} />}
              {state.crop === 'potato' && <PotatoPlant {...props} />}
              {spots && (
                <g fill="#713f12" data-layer="spots">
                  <circle cx={x - 6} cy={GROUND - plantH * 0.45} r="2.2" />
                  <circle cx={x + 5} cy={GROUND - plantH * 0.6} r="1.8" />
                  <circle cx={x - 2} cy={GROUND - plantH * 0.3} r="1.6" />
                </g>
              )}
            </motion.g>
          )
        })}

        {/* Water: puddles, paddy water or floodwater, drawn over the plants */}
        {puddles &&
          [61, 162, 266, 369].map((x) => (
            <motion.ellipse key={x} data-layer="puddle" cx={x} cy={GROUND + 3} initial={{ rx: 0 }} animate={{ rx: 10 + state.water * 300 }} ry="3.5" fill="#7dd3fc" opacity="0.7" />
          ))}
        {!puddles && state.water > 0.001 && (
          <g data-layer="water">
            {/* The water body ends at the soil surface; only its top moves. */}
            <motion.rect
              x="0"
              width={W}
              initial={false}
              animate={{ y: waterTop, height: GROUND + 3 - waterTop }}
              transition={{ type: 'spring', stiffness: 50, damping: 16 }}
              style={{ fill: flooded ? '#5b8fa8' : '#7cc5e8', opacity: flooded ? 0.78 : 0.6, transition: 'fill 0.8s, opacity 0.8s' }}
            />
            <motion.g initial={false} animate={{ y: waterTop - GROUND }} transition={{ type: 'spring', stiffness: 50, damping: 16 }}>
              <motion.path
                d={`M-40 ${GROUND} ${'q 15 -5 30 0 '.repeat(1)}${'t 30 0 '.repeat(17)}V ${GROUND + 3} H -40Z`}
                fill="#e0f2fe"
                opacity="0.55"
                animate={reduce ? undefined : { x: [0, 30] }}
                transition={loop(2.4)}
              />
            </motion.g>
          </g>
        )}
      </g>
    </svg>
  )
}
