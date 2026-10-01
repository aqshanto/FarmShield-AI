import { type ReactNode, useState } from 'react'
import { RainCloudIllustration } from '@/components/illustrations/RainCloudIllustration'
import { SproutIllustration } from '@/components/illustrations/SproutIllustration'
import { SunIllustration } from '@/components/illustrations/SunIllustration'
import { WaterDropIllustration } from '@/components/illustrations/WaterDropIllustration'
import { Card } from '@/components/ui/Card'
import { Slider } from '@/components/ui/Slider'
import { digits, useLang, useText } from '@/lib/i18n'
import { Section } from './Section'

interface DemoProps {
  title: string
  source: string
  sliderLabel: string
  color: string
  initial: number
  // Three sentences, from the high end of the slider to the low end.
  sentences: readonly [string, string, string]
  cuts: readonly [number, number]
  render: (value: number) => ReactNode
}

function IllustrationDemo({ title, source, sliderLabel, color, initial, sentences, cuts, render }: DemoProps) {
  const [value, setValue] = useState(initial)
  const lang = useLang()

  return (
    <Card interactive glow={color} className="flex flex-col">
      <div className="flex items-center justify-between">
        <h3 className="font-bold text-ink">{title}</h3>
        <span className="text-xs font-semibold text-ink-subtle">{source}</span>
      </div>
      <div className="grid h-40 place-items-center">{render(value / 100)}</div>
      <p className="mb-4 min-h-10 text-sm text-ink-muted" aria-live="polite">
        {value >= cuts[0] ? sentences[0] : value >= cuts[1] ? sentences[1] : sentences[2]}
      </p>
      <Slider label={sliderLabel} value={value} onChange={setValue} color={color} valueLabel={`${digits(value, lang)}%`} className="mt-auto" />
    </Card>
  )
}

const text = {
  en: {
    eyebrow: 'Visual storytelling',
    title: 'Illustrations that react to data',
    description: 'Each NASA measurement gets a friendly picture that changes with the data, so farmers can read the situation at a glance.',
    crop: { title: 'Crop health', slider: 'Plant health', says: ['Your crop looks healthy.', 'Some plants look tired. Check for pests.', 'Your crop is struggling. Act soon.'] },
    soil: { title: 'Water in soil', slider: 'Soil moisture', says: ['Soil has plenty of water.', 'Soil is getting dry. Plan irrigation.', 'Soil is very dry. Irrigate today.'] },
    rain: { title: 'Rainfall', slider: 'Rain intensity', says: ['Heavy rain. Watch for flooding.', 'Steady rain expected.', 'Light or no rain.'] },
    heat: { title: 'Heat', slider: 'Temperature', says: ['Very hot. Plants lose water fast.', 'Warm day. Normal growing weather.', 'Cool and mild.'] },
  },
  bn: {
    eyebrow: 'ছবিতে গল্প',
    title: 'তথ্যের সাথে বদলায় এমন ছবি',
    description: 'নাসার প্রতিটি মাপের জন্য একটি সহজ ছবি, যা তথ্যের সাথে বদলায়, তাই কৃষক এক নজরেই অবস্থা বুঝতে পারেন।',
    crop: { title: 'ফসলের স্বাস্থ্য', slider: 'গাছের স্বাস্থ্য', says: ['আপনার ফসল সুস্থ দেখাচ্ছে।', 'কিছু গাছ দুর্বল দেখাচ্ছে। পোকা আছে কি না দেখুন।', 'আপনার ফসল কষ্টে আছে। শিগগির ব্যবস্থা নিন।'] },
    soil: { title: 'মাটিতে পানি', slider: 'মাটির আর্দ্রতা', says: ['মাটিতে যথেষ্ট পানি আছে।', 'মাটি শুকিয়ে আসছে। সেচের পরিকল্পনা করুন।', 'মাটি খুব শুকনো। আজই সেচ দিন।'] },
    rain: { title: 'বৃষ্টি', slider: 'বৃষ্টির তীব্রতা', says: ['ভারী বৃষ্টি। বন্যার দিকে নজর রাখুন।', 'নিয়মিত বৃষ্টি হতে পারে।', 'হালকা বা কোনো বৃষ্টি নেই।'] },
    heat: { title: 'গরম', slider: 'তাপমাত্রা', says: ['খুব গরম। গাছ দ্রুত পানি হারায়।', 'উষ্ণ দিন। স্বাভাবিক বাড়ার আবহাওয়া।', 'ঠান্ডা ও আরামদায়ক।'] },
  },
}

const triple = (s: string[]) => [s[0], s[1], s[2]] as const

export function IllustrationSection() {
  const t = useText(text)
  return (
    <Section id="illustrations" eyebrow={t.eyebrow} title={t.title} description={t.description}>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <IllustrationDemo
          title={t.crop.title}
          source="MODIS · NDVI"
          sliderLabel={t.crop.slider}
          color="var(--color-leaf-400)"
          initial={80}
          sentences={triple(t.crop.says)}
          cuts={[60, 30]}
          render={(h) => <SproutIllustration health={h} size={140} />}
        />
        <IllustrationDemo
          title={t.soil.title}
          source="SMAP"
          sliderLabel={t.soil.slider}
          color="var(--color-sky-400)"
          initial={55}
          sentences={triple(t.soil.says)}
          cuts={[60, 30]}
          render={(l) => <WaterDropIllustration level={l} size={140} />}
        />
        <IllustrationDemo
          title={t.rain.title}
          source="GPM"
          sliderLabel={t.rain.slider}
          color="var(--color-sky-300)"
          initial={45}
          sentences={triple(t.rain.says)}
          cuts={[70, 30]}
          render={(i) => <RainCloudIllustration intensity={i} size={140} />}
        />
        <IllustrationDemo
          title={t.heat.title}
          source="MODIS · LST"
          sliderLabel={t.heat.slider}
          color="var(--color-harvest-300)"
          initial={40}
          sentences={triple(t.heat.says)}
          cuts={[70, 35]}
          render={(h) => <SunIllustration heat={h} size={140} />}
        />
      </div>
    </Section>
  )
}
