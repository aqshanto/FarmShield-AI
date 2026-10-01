import { Card } from '@/components/ui/Card'
import { useText } from '@/lib/i18n'
import { Section } from './Section'

const text = {
  en: {
    eyebrow: 'Foundations',
    title: 'Friendly, readable type',
    description:
      'Plus Jakarta Sans for a warm, modern voice, and Noto Sans Bengali so Bengali reads just as clearly. Both are bundled, so they work offline in the field.',
    display: 'Healthy fields',
    h2: 'Rain is coming on Thursday',
    h3: 'Water your rice field early this week',
    body: 'Body text stays short and plain. We say “Your crop looks healthy”, never “NDVI value: 0.62”.',
    other: 'বৃহস্পতিবার বৃষ্টি আসছে। এই সপ্তাহে আগে সেচ দিন।',
    otherLang: 'bn',
    eyebrowSample: 'Eyebrow label',
  },
  bn: {
    eyebrow: 'ভিত্তি',
    title: 'সহজে পড়া যায় এমন লেখা',
    description:
      'উষ্ণ, আধুনিক ভাবের জন্য Plus Jakarta Sans, আর বাংলা সমান স্পষ্ট পড়ার জন্য Noto Sans Bengali। দুটোই অ্যাপের সাথে আছে, তাই মাঠে ইন্টারনেট ছাড়াও কাজ করে।',
    display: 'সুস্থ জমি',
    h2: 'বৃহস্পতিবার বৃষ্টি আসছে',
    h3: 'এই সপ্তাহে আগে আগে ধানক্ষেতে সেচ দিন',
    body: 'মূল লেখা ছোট ও সহজ। আমরা বলি “আপনার ফসল সুস্থ দেখাচ্ছে”, কখনও “NDVI মান: ০.৬২” নয়।',
    other: 'Rain is coming on Thursday. Water early this week.',
    otherLang: 'en',
    eyebrowSample: 'ছোট শিরোনাম',
  },
}

export function TypographySection() {
  const t = useText(text)
  return (
    <Section id="typography" eyebrow={t.eyebrow} title={t.title} description={t.description}>
      <Card className="space-y-5">
        <p className="text-display text-gradient-brand">{t.display}</p>
        <p className="text-3xl font-bold tracking-tight text-ink">{t.h2}</p>
        <p className="text-xl font-semibold text-ink">{t.h3}</p>
        <p className="max-w-2xl text-base text-ink-muted">{t.body}</p>
        <p lang={t.otherLang} className="text-xl font-semibold text-ink">
          {t.other}
        </p>
        <p className="text-xs font-bold tracking-[0.2em] text-leaf-300 uppercase">{t.eyebrowSample}</p>
      </Card>
    </Section>
  )
}
