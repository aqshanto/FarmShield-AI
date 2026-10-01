import { AnimatePresence, motion } from 'framer-motion'
import { ArrowUpRight, Languages, MessageCircleQuestion, RotateCcw, Sparkles, Zap } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Badge } from '@/components/ui/Badge'
import { Card } from '@/components/ui/Card'
import { RiskBadge } from '@/components/ui/RiskBadge'
import { SegmentedControl } from '@/components/ui/SegmentedControl'
import { Skeleton } from '@/components/ui/Skeleton'
import { AssistantAvatar } from '@/features/assistant/AssistantAvatar'
import { ChatBubble } from '@/features/assistant/ChatBubble'
import { ChatComposer } from '@/features/assistant/ChatComposer'
import { useSpeaker } from '@/features/assistant/speech'
import { strings, suggestionsFor } from '@/features/assistant/strings'
import { useChat } from '@/features/assistant/useChat'
import { api } from '@/lib/api'
import { type Lang, saveLang, savedLang } from '@/lib/i18n'
import { fadeUp, spring, stagger } from '@/lib/motion'
import { useAsync } from '@/lib/useAsync'

const DISTRICT_BN: Record<string, string> = { Sunamganj: 'সুনামগঞ্জ', Rajshahi: 'রাজশাহী', Bogura: 'বগুড়া' }

export function AssistantPage() {
  const [params, setParams] = useSearchParams()
  const [lang, setLang] = useState<Lang>(savedLang)
  const t = strings[lang]

  const farms = useAsync('farms', (signal) => api.farms({ signal }), { retries: 3 })
  const farmId = params.get('farm') ?? farms.data?.[0]?.id ?? null
  const farm = farms.data?.find((f) => f.id === farmId) ?? null
  const dashboard = useAsync(farmId, (signal) => api.dashboard(farmId!, { signal }))
  const status = useAsync('assistant-status', (signal) => api.assistantStatus({ signal }), { retries: 3 })
  const dash = dashboard.data?.farm.id === farmId ? dashboard.data : undefined

  const { turns, send, stop, reset, busy } = useChat(farmId, lang)
  const speaker = useSpeaker()
  const speakAfter = useRef<string | null>(null)
  const list = useRef<HTMLUListElement>(null)

  const changeLang = (next: Lang) => {
    setLang(next)
    saveLang(next)
  }
  const changeFarm = (id: string) => {
    speaker.cancel()
    setParams({ farm: id }, { preventScrollReset: true })
  }

  const ask = useCallback(
    async (text: string, byVoice = false) => {
      speaker.cancel()
      const id = await send(text)
      // Spoken questions get spoken answers.
      if (byVoice && id) speakAfter.current = id
    },
    [send, speaker],
  )

  // Read the reply aloud once it's complete, if the question was spoken.
  useEffect(() => {
    const id = speakAfter.current
    const turn = id ? turns.find((x) => x.id === id) : undefined
    if (turn && turn.status === 'done') {
      speakAfter.current = null
      if (speaker.canSpeak(turn.lang)) speaker.speak(turn.id, turn.text, turn.lang)
    }
  }, [turns, speaker])

  // Keep the newest words in view while the answer streams.
  useEffect(() => {
    const el = list.current
    el?.scrollTo?.({ top: el.scrollHeight, behavior: 'smooth' })
  }, [turns])

  const worst = dash?.modules.reduce((a, b) => (b.score > a.score ? b : a))
  const suggestions = suggestionsFor(lang, worst?.id).slice(0, turns.length ? 3 : 5)
  const farmLabel = farm ? (lang === 'bn' ? DISTRICT_BN[farm.district] ?? farm.district : farm.name) : '…'
  const engine = status.data?.engine
  const waiting = turns.some((x) => x.status === 'waiting')
  const mood = waiting ? 'thinking' : speaker.speakingId ? 'speaking' : 'idle'

  return (
    <motion.div variants={stagger(0.07)} initial="hidden" animate="show" className="mx-auto max-w-3xl space-y-5 pb-8">
      {/* Hero */}
      <motion.header variants={fadeUp} className="flex flex-col items-center gap-3 pt-2 text-center">
        <AssistantAvatar size="lg" mood={mood} />
        <h1 lang={lang} className="text-3xl font-extrabold tracking-tight text-ink sm:text-4xl">
          {t.title}
        </h1>
        <p lang={lang} className="max-w-lg text-ink-muted">
          {t.subtitle}
        </p>
      </motion.header>

      {/* Controls */}
      <motion.div variants={fadeUp} className="flex flex-wrap items-center justify-center gap-3">
        <SegmentedControl<Lang>
          ariaLabel="Language / ভাষা"
          size="sm"
          value={lang}
          onChange={changeLang}
          options={[
            { value: 'en', label: 'English', icon: <Languages className="size-3.5" aria-hidden="true" /> },
            { value: 'bn', label: 'বাংলা', lang: 'bn' },
          ]}
        />
        {farms.data && farms.data.length > 1 && farmId && (
          <SegmentedControl
            ariaLabel={t.farm}
            size="sm"
            value={farmId}
            onChange={changeFarm}
            options={farms.data.map((f) => ({ value: f.id, label: lang === 'bn' ? DISTRICT_BN[f.district] ?? f.district : f.district, lang }))}
          />
        )}
        {engine && (
          <Badge
            tone={engine === 'claude' ? 'leaf' : 'sky'}
            icon={engine === 'claude' ? <Sparkles className="size-3.5" /> : <Zap className="size-3.5" />}
            title={engine === 'claude' ? t.engineClaudeHint : t.engineOfflineHint}
          >
            <span lang={lang}>{engine === 'claude' ? t.engineClaude : t.engineOffline}</span>
          </Badge>
        )}
      </motion.div>

      {/* What the assistant is looking at */}
      <motion.div variants={fadeUp}>
        <AnimatePresence mode="wait" initial={false}>
          {dash ? (
            <motion.div
              key={dash.farm.id}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={spring.gentle}
              className="glass flex flex-wrap items-center gap-x-3 gap-y-2 rounded-2xl px-4 py-3 text-sm"
            >
              <span lang={lang} className="text-ink-subtle">
                {t.lookingAt}:
              </span>
              <span className="font-semibold text-ink">{dash.farm.name}</span>
              <span className="text-ink-subtle">· {dash.farm.crop}</span>
              <RiskBadge level={dash.overall.level} lang={lang} />
              <Link
                to={`/dashboard?farm=${encodeURIComponent(dash.farm.id)}`}
                lang={lang}
                className="focus-ring ml-auto inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold text-leaf-300 hover:bg-leaf-500/10"
              >
                {t.openDashboard} <ArrowUpRight className="size-3.5" aria-hidden="true" />
              </Link>
            </motion.div>
          ) : (
            <Skeleton className="h-12 rounded-2xl" />
          )}
        </AnimatePresence>
      </motion.div>

      {/* Conversation */}
      <motion.div variants={fadeUp}>
        <Card className="overflow-hidden p-0">
          {/* Chat header: who's answering, and a fresh start */}
          <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-2.5 sm:px-6">
            <p className="flex items-center gap-2 text-sm font-semibold text-ink" aria-live="polite">
              <span className="relative flex size-2" aria-hidden="true">
                <span className="absolute inset-0 animate-ping-soft rounded-full bg-leaf-300" />
                <span className="relative size-2 rounded-full bg-leaf-300" />
              </span>
              <span lang={lang}>{waiting ? `${t.thinking}…` : t.assistant}</span>
            </p>
            <AnimatePresence>
              {turns.length > 0 && (
                <motion.button
                  type="button"
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  transition={spring.snappy}
                  onClick={() => {
                    speaker.cancel()
                    reset()
                  }}
                  lang={lang}
                  className="focus-ring inline-flex cursor-pointer items-center gap-1 rounded-full bg-surface-2 px-2.5 py-1 text-xs font-semibold text-ink-muted ring-1 ring-line hover:text-ink"
                >
                  <RotateCcw className="size-3.5" aria-hidden="true" /> {t.newChat}
                </motion.button>
              )}
            </AnimatePresence>
          </div>
          <ul
            ref={list}
            aria-label={t.title}
            className="flex h-[min(58vh,560px)] min-h-80 flex-col gap-4 overflow-y-auto scroll-smooth px-4 pt-5 pb-4 sm:px-6"
          >
            <ChatBubble key={`greeting-${lang}-${farmId}`} role="assistant" text={t.greeting(farmLabel)} lang={lang} uiLang={lang} />
            {turns.map((turn) => (
              <ChatBubble
                key={turn.id}
                role={turn.role}
                text={turn.text}
                lang={turn.lang}
                uiLang={lang}
                status={turn.status}
                engine={turn.engine}
                speaking={speaker.speakingId === turn.id}
                canSpeak={speaker.canSpeak(turn.lang)}
                onSpeak={
                  speaker.supported
                    ? () => (speaker.speakingId === turn.id ? speaker.cancel() : speaker.speak(turn.id, turn.text, turn.lang))
                    : undefined
                }
              />
            ))}
          </ul>
        </Card>
      </motion.div>

      {/* Suggested questions */}
      <motion.div variants={fadeUp} className="space-y-2">
        <p lang={lang} className="flex items-center gap-1.5 text-xs font-semibold text-ink-subtle">
          <MessageCircleQuestion className="size-3.5" aria-hidden="true" /> {t.suggestions}
        </p>
        <motion.div key={`${lang}-${turns.length > 0}`} variants={stagger(0.05)} initial="hidden" animate="show" className="flex flex-wrap gap-2">
          {suggestions.map((q) => (
            <motion.button
              key={q}
              type="button"
              variants={fadeUp}
              whileHover={{ y: -2 }}
              whileTap={{ scale: 0.95 }}
              disabled={busy || !farmId}
              onClick={() => ask(q)}
              lang={lang}
              className="focus-ring cursor-pointer rounded-full bg-surface-2 px-3.5 py-2 text-sm font-medium text-ink ring-1 ring-line transition-colors hover:bg-leaf-500/15 hover:text-leaf-200 hover:ring-leaf-400/40 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {q}
            </motion.button>
          ))}
        </motion.div>
      </motion.div>

      <motion.div variants={fadeUp} className="space-y-2">
        <ChatComposer lang={lang} busy={busy} onSend={ask} onStop={stop} />
        <p lang={lang} className="text-center text-xs text-ink-subtle">
          {t.disclaimer}
        </p>
      </motion.div>
    </motion.div>
  )
}
