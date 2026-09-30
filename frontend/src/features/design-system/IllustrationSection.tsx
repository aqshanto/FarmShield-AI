import { type ReactNode, useState } from 'react'
import { RainCloudIllustration } from '@/components/illustrations/RainCloudIllustration'
import { SproutIllustration } from '@/components/illustrations/SproutIllustration'
import { SunIllustration } from '@/components/illustrations/SunIllustration'
import { WaterDropIllustration } from '@/components/illustrations/WaterDropIllustration'
import { Card } from '@/components/ui/Card'
import { Slider } from '@/components/ui/Slider'
import { Section } from './Section'

interface DemoProps {
  title: string
  source: string
  sliderLabel: string
  color: string
  initial: number
  describe: (value: number) => string
  render: (value: number) => ReactNode
}

function IllustrationDemo({ title, source, sliderLabel, color, initial, describe, render }: DemoProps) {
  const [value, setValue] = useState(initial)

  return (
    <Card interactive glow={color} className="flex flex-col">
      <div className="flex items-center justify-between">
        <h3 className="font-bold text-ink">{title}</h3>
        <span className="text-xs font-semibold text-ink-subtle">{source}</span>
      </div>
      <div className="grid h-40 place-items-center">{render(value / 100)}</div>
      <p className="mb-4 min-h-10 text-sm text-ink-muted" aria-live="polite">
        {describe(value)}
      </p>
      <Slider label={sliderLabel} value={value} onChange={setValue} color={color} valueLabel={`${value}%`} className="mt-auto" />
    </Card>
  )
}

export function IllustrationSection() {
  return (
    <Section
      id="illustrations"
      eyebrow="Visual storytelling"
      title="Illustrations that react to data"
      description="Each NASA measurement gets a friendly picture that changes with the data, so farmers can read the situation at a glance."
    >
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <IllustrationDemo
          title="Crop health"
          source="MODIS · NDVI"
          sliderLabel="Plant health"
          color="var(--color-leaf-400)"
          initial={80}
          describe={(v) => (v >= 60 ? 'Your crop looks healthy.' : v >= 30 ? 'Some plants look tired. Check for pests.' : 'Your crop is struggling. Act soon.')}
          render={(h) => <SproutIllustration health={h} size={140} />}
        />
        <IllustrationDemo
          title="Water in soil"
          source="SMAP"
          sliderLabel="Soil moisture"
          color="var(--color-sky-400)"
          initial={55}
          describe={(v) => (v >= 60 ? 'Soil has plenty of water.' : v >= 30 ? 'Soil is getting dry. Plan irrigation.' : 'Soil is very dry. Irrigate today.')}
          render={(l) => <WaterDropIllustration level={l} size={140} />}
        />
        <IllustrationDemo
          title="Rainfall"
          source="GPM"
          sliderLabel="Rain intensity"
          color="var(--color-sky-300)"
          initial={45}
          describe={(v) => (v >= 70 ? 'Heavy rain. Watch for flooding.' : v >= 30 ? 'Steady rain expected.' : 'Light or no rain.')}
          render={(i) => <RainCloudIllustration intensity={i} size={140} />}
        />
        <IllustrationDemo
          title="Heat"
          source="MODIS · LST"
          sliderLabel="Temperature"
          color="var(--color-harvest-300)"
          initial={40}
          describe={(v) => (v >= 70 ? 'Very hot. Plants lose water fast.' : v >= 35 ? 'Warm day. Normal growing weather.' : 'Cool and mild.')}
          render={(h) => <SunIllustration heat={h} size={140} />}
        />
      </div>
    </Section>
  )
}
