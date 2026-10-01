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

function randomStats(): Omit<Stat, 'label'>[] {
  const r = (min: number, max: number) => Math.round(min + Math.random() * (max - min))
  return [
    { key: 'rain', value: r(20, 240), suffix: 'mm', icon: <CloudRain className="size-5" />, color: 'var(--color-sky-300)', source: 'GPM' },
    { key: 'soil', value: r(10, 90), suffix: '%', icon: <Droplets className="size-5" />, color: 'var(--color-sky-400)', source: 'SMAP' },
    { key: 'crop', value: r(30, 98), suffix: '%', icon: <Sprout className="size-5" />, color: 'var(--color-leaf-400)', source: 'MODIS' },
  ]
}

const text = {
  en: {
    eyebrow: 'Components',
    title: 'Living numbers',
    description:
      'Numbers count up when they scroll into view and spring to new values. In Bengali they switch to Bengali numerals. Hover a card to see the spotlight follow your cursor.',
    labels: { rain: 'Rain this week', soil: 'Soil moisture', crop: 'Crop health' } as Record<string, string>,
    mm: ' mm',
    simulate: 'Simulate new satellite pass',
  },
  bn: {
    eyebrow: 'উপাদান',
    title: 'জীবন্ত সংখ্যা',
    description:
      'চোখের সামনে এলে সংখ্যাগুলো গুনে গুনে বাড়ে, নতুন মানে লাফিয়ে যায়। বাংলায় সংখ্যাগুলো বাংলা অঙ্কে দেখায়। কার্ডের ওপর মাউস রাখলে আলো আপনার কার্সর অনুসরণ করে।',
    labels: { rain: 'এই সপ্তাহের বৃষ্টি', soil: 'মাটির আর্দ্রতা', crop: 'ফসলের স্বাস্থ্য' } as Record<string, string>,
    mm: ' মিমি',
    simulate: 'নতুন উপগ্রহ-পর্যবেক্ষণ দেখুন',
  },
}

export function StatsSection({ lang }: { lang: Lang }) {
  const [stats, setStats] = useState(randomStats)
  const t = text[lang]

  return (
    <Section id="stats" eyebrow={t.eyebrow} title={t.title} description={t.description}>
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
            <p className="mt-4 text-sm font-medium text-ink-muted">{t.labels[stat.key]}</p>
            <AnimatedNumber
              value={stat.value}
              suffix={stat.suffix === 'mm' ? t.mm : stat.suffix}
              locale={numberLocale[lang]}
              className="text-4xl font-extrabold tracking-tight text-ink"
            />
          </Card>
        ))}
      </div>
      <Button variant="secondary" icon={<RefreshCw className="size-4" />} onClick={() => setStats(randomStats())}>
        {t.simulate}
      </Button>
    </Section>
  )
}
