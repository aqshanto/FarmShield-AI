import { AnimatePresence, motion } from 'framer-motion'
import { Mic, MicOff, SendHorizontal, Square } from 'lucide-react'
import { type FormEvent, type KeyboardEvent, useState } from 'react'
import { cn } from '@/lib/cn'
import type { Lang } from '@/lib/i18n'
import { spring } from '@/lib/motion'
import { useVoiceInput } from './speech'
import { strings } from './strings'

interface ChatComposerProps {
  lang: Lang
  busy: boolean
  onSend: (text: string, byVoice: boolean) => void
  onStop: () => void
}

// Text box with a microphone and send/stop button. Enter sends, Shift+Enter adds a line.
export function ChatComposer({ lang, busy, onSend, onStop }: ChatComposerProps) {
  const t = strings[lang]
  const [text, setText] = useState('')
  const voice = useVoiceInput(lang, (spoken) => onSend(spoken, true))

  const submit = (event?: FormEvent) => {
    event?.preventDefault()
    if (busy || !text.trim()) return
    onSend(text, false)
    setText('')
  }

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault()
      submit()
    }
  }

  return (
    <form onSubmit={submit} className="glass flex items-end gap-2 rounded-2xl p-2 focus-within:ring-2 focus-within:ring-leaf-400/50">
      {voice.supported && (
        <motion.button
          type="button"
          whileTap={{ scale: 0.9 }}
          onClick={voice.listening ? voice.stop : voice.start}
          disabled={busy}
          aria-label={voice.listening ? t.micStop : t.micStart}
          aria-pressed={voice.listening}
          className={cn(
            'focus-ring relative grid size-11 shrink-0 cursor-pointer place-items-center rounded-xl transition disabled:cursor-not-allowed disabled:opacity-40',
            voice.listening ? 'bg-sky-400/20 text-sky-200' : 'text-ink-muted hover:bg-surface-2 hover:text-ink',
          )}
        >
          {voice.listening && (
            <>
              <span className="absolute inset-0 animate-ping-soft rounded-xl bg-sky-300/30" aria-hidden="true" />
              <span className="absolute inset-1.5 animate-ping-soft rounded-xl bg-sky-300/20 [animation-delay:0.4s]" aria-hidden="true" />
            </>
          )}
          {voice.listening ? <MicOff className="relative size-5" /> : <Mic className="relative size-5" />}
        </motion.button>
      )}

      <label className="sr-only" htmlFor="assistant-question">
        {t.placeholder}
      </label>
      <textarea
        id="assistant-question"
        rows={1}
        lang={lang}
        value={voice.listening ? voice.interim : text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={onKeyDown}
        readOnly={voice.listening}
        placeholder={voice.listening ? t.listening : t.placeholder}
        maxLength={1000}
        className="field-sizing-content max-h-36 min-h-11 flex-1 resize-none bg-transparent px-2 py-2.5 text-[0.95rem] text-ink outline-none placeholder:text-ink-subtle"
      />

      <AnimatePresence mode="popLayout" initial={false}>
        {busy ? (
          <motion.button
            key="stop"
            type="button"
            initial={{ scale: 0.6, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.6, opacity: 0 }}
            transition={spring.bouncy}
            onClick={onStop}
            aria-label={t.stop}
            className="focus-ring grid size-11 shrink-0 cursor-pointer place-items-center rounded-xl bg-surface-3 text-ink hover:bg-surface-2"
          >
            <Square className="size-4 fill-current" />
          </motion.button>
        ) : (
          <motion.button
            key="send"
            type="submit"
            initial={{ scale: 0.6, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.6, opacity: 0 }}
            transition={spring.bouncy}
            whileTap={{ scale: 0.9 }}
            disabled={!text.trim() || voice.listening}
            aria-label={t.send}
            className="focus-ring grid size-11 shrink-0 cursor-pointer place-items-center rounded-xl bg-gradient-to-b from-leaf-400 to-leaf-600 text-night-950 shadow-glow-leaf transition disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none"
          >
            <SendHorizontal className="size-5" />
          </motion.button>
        )}
      </AnimatePresence>
    </form>
  )
}
