import { motion } from 'framer-motion'
import { AlertCircle, Sparkles, Volume2, VolumeX, Zap } from 'lucide-react'
import { cn } from '@/lib/cn'
import type { Lang } from '@/lib/i18n'
import { spring } from '@/lib/motion'
import type { AssistantEngine } from '@/types/api'
import { AssistantAvatar } from './AssistantAvatar'
import { strings } from './strings'

export function TypingDots({ label }: { label: string }) {
  return (
    <span role="status" aria-label={label} className="flex items-center gap-1.5 py-1.5">
      {[0, 1, 2].map((i) => (
        <motion.span
          key={i}
          className="size-2 rounded-full bg-leaf-300"
          animate={{ y: [0, -5, 0], opacity: [0.5, 1, 0.5] }}
          transition={{ duration: 0.9, repeat: Infinity, delay: i * 0.15, ease: 'easeInOut' }}
        />
      ))}
    </span>
  )
}

interface ChatBubbleProps {
  role: 'user' | 'assistant'
  text: string
  lang: Lang
  uiLang: Lang
  status?: 'waiting' | 'streaming' | 'done' | 'error'
  engine?: AssistantEngine
  speaking?: boolean
  canSpeak?: boolean
  onSpeak?: () => void
}

export function ChatBubble({ role, text, lang, uiLang, status = 'done', engine, speaking, canSpeak, onSpeak }: ChatBubbleProps) {
  const t = strings[uiLang]
  const mine = role === 'user'
  const streaming = status === 'streaming'
  const showFooter = !mine && status === 'done' && (engine || onSpeak)

  return (
    <motion.li
      layout="position"
      initial={{ opacity: 0, y: 14, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={spring.gentle}
      className={cn('flex items-end gap-2.5', mine ? 'justify-end' : 'justify-start')}
    >
      {!mine && <AssistantAvatar mood={status === 'waiting' ? 'thinking' : speaking ? 'speaking' : 'idle'} />}
      <div className={cn('flex max-w-[85%] flex-col gap-1 sm:max-w-[75%]', mine && 'items-end')}>
        <span className="sr-only">{mine ? t.you : t.assistant}:</span>
        <div
          lang={lang}
          aria-live={streaming ? 'polite' : undefined}
          className={cn(
            'rounded-2xl px-4 py-2.5 text-[0.95rem] leading-relaxed whitespace-pre-wrap',
            mine
              ? 'rounded-br-md bg-gradient-to-b from-leaf-300 to-leaf-500 font-medium text-night-950'
              : status === 'error'
                ? 'rounded-bl-md bg-alert-500/10 text-alert-300 ring-1 ring-alert-400/30'
                : 'glass rounded-bl-md text-ink',
          )}
        >
          {status === 'waiting' ? (
            <TypingDots label={t.thinking} />
          ) : (
            <>
              {status === 'error' && <AlertCircle className="mr-1.5 inline size-4 align-[-3px]" aria-hidden="true" />}
              {text}
              {streaming && (
                <motion.span
                  aria-hidden="true"
                  className="ml-0.5 inline-block h-4 w-0.5 translate-y-0.5 rounded-full bg-leaf-300"
                  animate={{ opacity: [1, 0, 1] }}
                  transition={{ duration: 0.8, repeat: Infinity }}
                />
              )}
            </>
          )}
        </div>
        {showFooter && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center gap-2 pl-1 text-xs text-ink-subtle">
            {engine && (
              <span className="inline-flex items-center gap-1" title={engine === 'claude' ? t.engineClaudeHint : t.engineOfflineHint}>
                {engine === 'claude' ? <Sparkles className="size-3" aria-hidden="true" /> : <Zap className="size-3" aria-hidden="true" />}
                {engine === 'claude' ? t.engineClaude : t.quickAnswer}
              </span>
            )}
            {onSpeak && (
              <button
                type="button"
                onClick={onSpeak}
                disabled={!canSpeak}
                title={canSpeak ? undefined : t.noVoice(lang)}
                aria-pressed={speaking}
                className="focus-ring inline-flex cursor-pointer items-center gap-1 rounded-full px-2 py-0.5 font-semibold text-leaf-300 transition hover:bg-leaf-500/10 disabled:cursor-not-allowed disabled:text-ink-subtle disabled:hover:bg-transparent"
              >
                {speaking ? <VolumeX className="size-3.5" aria-hidden="true" /> : <Volume2 className="size-3.5" aria-hidden="true" />}
                {speaking ? t.stopListen : t.listen}
              </button>
            )}
          </motion.div>
        )}
      </div>
    </motion.li>
  )
}
