import { motion } from 'framer-motion'
import { Leaf } from 'lucide-react'
import { cn } from '@/lib/cn'

export type AvatarMood = 'idle' | 'thinking' | 'speaking' | 'listening'

interface AssistantAvatarProps {
  mood?: AvatarMood
  size?: 'sm' | 'lg'
  className?: string
}

// A small planet with a satellite in orbit: it spins faster while thinking,
// breathes while speaking and glows sky-blue while listening.
export function AssistantAvatar({ mood = 'idle', size = 'sm', className }: AssistantAvatarProps) {
  const big = size === 'lg'
  const orbitSeconds = mood === 'thinking' ? 1.4 : 6
  return (
    <span
      data-mood={mood}
      aria-hidden="true"
      className={cn('relative grid shrink-0 place-items-center', big ? 'size-16' : 'size-9', className)}
    >
      {(mood === 'listening' || mood === 'speaking') && (
        <span
          className={cn(
            'absolute inset-0 animate-ping-soft rounded-full',
            mood === 'listening' ? 'bg-sky-300/40' : 'bg-leaf-300/35',
          )}
        />
      )}
      <motion.span
        className={cn(
          'relative grid size-full place-items-center rounded-full bg-gradient-to-br from-leaf-300 via-leaf-500 to-sky-500 text-night-950',
          mood === 'listening' ? 'shadow-[0_0_24px_rgb(125_211_252/0.55)]' : 'shadow-glow-leaf',
        )}
        animate={mood === 'speaking' ? { scale: [1, 1.08, 1] } : { scale: 1 }}
        transition={mood === 'speaking' ? { duration: 0.9, repeat: Infinity, ease: 'easeInOut' } : { duration: 0.2 }}
      >
        <Leaf className={big ? 'size-7' : 'size-4'} strokeWidth={2.4} />
      </motion.span>
      {/* Orbiting satellite */}
      <motion.span
        className="absolute inset-[-5px]"
        animate={{ rotate: 360 }}
        transition={{ duration: orbitSeconds, repeat: Infinity, ease: 'linear' }}
      >
        <span className={cn('absolute left-1/2 top-0 -translate-x-1/2 rounded-full bg-sky-200 shadow-[0_0_8px_rgb(186_230_253)]', big ? 'size-2.5' : 'size-1.5')} />
      </motion.span>
    </span>
  )
}
