import { useMemo } from 'react'

// Deterministic pseudo-random so stars don't jump between renders.
function seeded(seed: number) {
  let s = seed
  return () => {
    s = (s * 16807) % 2147483647
    return s / 2147483647
  }
}

// Softly twinkling night sky behind every page.
export function Starfield({ count = 60 }: { count?: number }) {
  const stars = useMemo(() => {
    const rand = seeded(42)
    return Array.from({ length: count }, () => ({
      left: rand() * 100,
      top: rand() * 70,
      size: rand() < 0.85 ? 1 : 2,
      delay: rand() * 4,
      duration: 2.5 + rand() * 3,
    }))
  }, [count])

  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
      {stars.map((star, i) => (
        <span
          key={i}
          className="absolute animate-pulse rounded-full bg-white/70"
          style={{
            left: `${star.left}%`,
            top: `${star.top}%`,
            width: star.size,
            height: star.size,
            animationDelay: `${star.delay}s`,
            animationDuration: `${star.duration}s`,
          }}
        />
      ))}
      <div className="absolute -top-40 left-1/2 h-96 w-[48rem] -translate-x-1/2 rounded-full bg-leaf-500/10 blur-3xl" />
    </div>
  )
}
