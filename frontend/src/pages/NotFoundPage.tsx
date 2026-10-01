import { motion } from 'framer-motion'
import { Link } from 'react-router-dom'
import { buttonStyles } from '@/components/ui/button-styles'
import { useText } from '@/lib/i18n'

const text = {
  en: { title: 'This field is off the map', body: 'Our satellites could not find that page.', home: 'Back to home' },
  bn: { title: 'এই জমি মানচিত্রে নেই', body: 'আমাদের উপগ্রহ পাতাটি খুঁজে পায়নি।', home: 'হোমে ফিরুন' },
}

export function NotFoundPage() {
  const t = useText(text)
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col items-center gap-4 py-24 text-center"
    >
      <p className="text-6xl">🛰️</p>
      <h1 className="text-2xl font-semibold text-ink">{t.title}</h1>
      <p className="text-ink-muted">{t.body}</p>
      <Link to="/" className={buttonStyles()}>
        {t.home}
      </Link>
    </motion.div>
  )
}
