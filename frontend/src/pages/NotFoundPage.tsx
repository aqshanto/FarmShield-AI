import { motion } from 'framer-motion'
import { Link } from 'react-router-dom'
import { buttonStyles } from '@/components/ui/button-styles'

export function NotFoundPage() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col items-center gap-4 py-24 text-center"
    >
      <p className="text-6xl">🛰️</p>
      <h1 className="text-2xl font-semibold text-ink">This field is off the map</h1>
      <p className="text-ink-muted">Our satellites could not find that page.</p>
      <Link to="/" className={buttonStyles()}>
        Back to home
      </Link>
    </motion.div>
  )
}
