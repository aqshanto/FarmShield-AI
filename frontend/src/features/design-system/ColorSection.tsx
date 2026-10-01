import { motion } from 'framer-motion'
import { useText } from '@/lib/i18n'
import { pop, stagger } from '@/lib/motion'
import { Section } from './Section'

type Swatch = { token: string; name: string; use: string }

const text = {
  en: {
    eyebrow: 'Foundations',
    title: 'Colors with meaning',
    description:
      'Every color tells the farmer something. Green means growth, blue means water, gold means sun, and the four-step risk scale is the same on every screen.',
    groups: [
      {
        name: 'Brand',
        swatches: [
          { name: 'Leaf', token: '--color-leaf-400', use: 'Growth, success, primary actions' },
          { name: 'Sky', token: '--color-sky-400', use: 'Water, rain, satellites' },
          { name: 'Harvest', token: '--color-harvest-300', use: 'Sun, heat, highlights' },
        ],
      },
      {
        name: 'Risk scale',
        swatches: [
          { name: 'Safe', token: '--color-risk-safe', use: 'No action needed' },
          { name: 'Watch', token: '--color-risk-watch', use: 'Keep an eye on it' },
          { name: 'Warning', token: '--color-risk-warning', use: 'Prepare now' },
          { name: 'Danger', token: '--color-risk-danger', use: 'Act today' },
        ],
      },
      {
        name: 'Night surfaces',
        swatches: [
          { name: 'Night 950', token: '--color-night-950', use: 'Page background' },
          { name: 'Night 800', token: '--color-night-800', use: 'Raised panels' },
          { name: 'Ink', token: '--color-ink', use: 'Primary text' },
          { name: 'Ink muted', token: '--color-ink-muted', use: 'Secondary text' },
        ],
      },
    ] as { name: string; swatches: Swatch[] }[],
  },
  bn: {
    eyebrow: 'ভিত্তি',
    title: 'অর্থবহ রং',
    description:
      'প্রতিটি রং কৃষককে কিছু বলে। সবুজ মানে বৃদ্ধি, নীল মানে পানি, সোনালি মানে রোদ, আর চার ধাপের ঝুঁকির রং প্রতিটি পাতায় একই।',
    groups: [
      {
        name: 'ব্র্যান্ড',
        swatches: [
          { name: 'পাতা', token: '--color-leaf-400', use: 'বৃদ্ধি, সাফল্য, মূল কাজ' },
          { name: 'আকাশ', token: '--color-sky-400', use: 'পানি, বৃষ্টি, উপগ্রহ' },
          { name: 'ফসল', token: '--color-harvest-300', use: 'রোদ, গরম, বিশেষ অংশ' },
        ],
      },
      {
        name: 'ঝুঁকির মাপকাঠি',
        swatches: [
          { name: 'নিরাপদ', token: '--color-risk-safe', use: 'কিছু করার দরকার নেই' },
          { name: 'নজরে রাখুন', token: '--color-risk-watch', use: 'চোখ রাখুন' },
          { name: 'সতর্কতা', token: '--color-risk-warning', use: 'এখনই প্রস্তুতি নিন' },
          { name: 'বিপদ', token: '--color-risk-danger', use: 'আজই ব্যবস্থা নিন' },
        ],
      },
      {
        name: 'রাতের পটভূমি',
        swatches: [
          { name: 'রাত ৯৫০', token: '--color-night-950', use: 'পাতার পটভূমি' },
          { name: 'রাত ৮০০', token: '--color-night-800', use: 'উঁচু প্যানেল' },
          { name: 'কালি', token: '--color-ink', use: 'মূল লেখা' },
          { name: 'হালকা কালি', token: '--color-ink-muted', use: 'সহায়ক লেখা' },
        ],
      },
    ] as { name: string; swatches: Swatch[] }[],
  },
}

export function ColorSection() {
  const t = useText(text)
  return (
    <Section id="colors" eyebrow={t.eyebrow} title={t.title} description={t.description}>
      <div className="grid gap-6 md:grid-cols-3">
        {t.groups.map((group) => (
          <div key={group.swatches[0].token} className="space-y-3">
            <h3 className="text-sm font-semibold text-ink-muted">{group.name}</h3>
            <motion.ul
              variants={stagger(0.06)}
              initial="hidden"
              whileInView="show"
              viewport={{ once: true }}
              className="grid grid-cols-2 gap-3"
            >
              {group.swatches.map((swatch) => (
                <motion.li key={swatch.token} variants={pop} whileHover={{ y: -3 }} className="glass rounded-2xl p-2">
                  <div
                    className="h-14 rounded-xl ring-1 ring-white/10"
                    style={{ background: `var(${swatch.token})` }}
                  />
                  <p className="mt-2 px-1 text-sm font-semibold text-ink">{swatch.name}</p>
                  <p className="px-1 pb-1 text-xs text-ink-subtle">{swatch.use}</p>
                </motion.li>
              ))}
            </motion.ul>
          </div>
        ))}
      </div>
    </Section>
  )
}
