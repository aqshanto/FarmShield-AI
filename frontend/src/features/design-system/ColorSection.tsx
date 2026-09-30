import { motion } from 'framer-motion'
import { pop, stagger } from '@/lib/motion'
import { Section } from './Section'

const groups = [
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
]

export function ColorSection() {
  return (
    <Section
      id="colors"
      eyebrow="Foundations"
      title="Colors with meaning"
      description="Every color tells the farmer something. Green means growth, blue means water, gold means sun, and the four-step risk scale is the same on every screen."
    >
      <div className="grid gap-6 md:grid-cols-3">
        {groups.map((group) => (
          <div key={group.name} className="space-y-3">
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
