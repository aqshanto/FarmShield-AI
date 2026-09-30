import { CloudRain, Droplets, RefreshCw, Sprout } from 'lucide-react'
import { type ReactNode, useState } from 'react'
import { AnimatedNumber } from '@/components/ui/AnimatedNumber'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { type Lang, numberLocale } from '@/lib/i18n'
import { Section } from './Section'

interface Stat {
  key: string
  label: string
  value: number
  suffix: string
  icon: ReactNode
  color: string
  source: string
}

function randomStats(): Stat[] {
  const r = (min: number, max: number) => Math.round(min + Math.random() * (max - min))
  return [
    { key: 'rain', label: 'Rain this week', value: r(20, 240), suffix: ' mm', icon: <CloudRain className="size-5" />, color: 'var(--color-sky-300)', source: 'GPM' },
    { key: 'soil', label: 'Soil moisture', value: r(10, 90), suffix: '%', icon: <Droplets className="size-5" />, color: 'var(--color-sky-400)', source: 'SMAP' },
    { key: 'crop', label: 'Crop health', value: r(30, 98), suffix: '%', icon: <Sprout className="size-5" />, color: 'var(--color-leaf-400)', source: 'MODIS' },
  ]
}

export function StatsSection({ lang }: { lang: Lang }) {
  const [stats, setStats] = useState(randomStats)

  return (
    <Section
      id="stats"
      eyebrow="Components"
      title="Living numbers"
      description="Numbers count up when they scroll into view and spring to new values. In Bengali they switch to Bengali numerals. Hover a card to see the spotlight follow your cursor."
    >
      <div className="grid gap-4 sm:grid-cols-3">
        {stats.map((stat) => (
          <Card key={stat.key} interactive glow={stat.color}>
            <div className="flex items-center justify-between">
              <span
                className="grid size-11 place-items-center rounded-2xl"
                style={{ color: stat.color, background: `color-mix(in oklab, ${stat.color} 15%, transparent)` }}
              >
                {stat.icon}
              </span>
              <Badge tone="neutral">{stat.source}</Badge>
            </div>
            <p className="mt-4 text-sm font-medium text-ink-muted">{stat.label}</p>
            <AnimatedNumber
              value={stat.value}
              suffix={stat.suffix}
              locale={numberLocale[lang]}
              className="text-4xl font-extrabold tracking-tight text-ink"
            />
          </Card>
        ))}
      </div>
      <Button variant="secondary" icon={<RefreshCw className="size-4" />} onClick={() => setStats(randomStats())}>
        Simulate new satellite pass
      </Button>
    </Section>
  )
}
