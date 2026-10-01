import { useCallback, useEffect, useRef, useState } from 'react'
import { streamChat } from '@/lib/api'
import type { Lang } from '@/lib/i18n'
import type { AssistantEngine, ChatMessage } from '@/types/api'
import { strings } from './strings'

export interface ChatTurn {
  id: string
  role: 'user' | 'assistant'
  text: string
  lang: Lang
  engine?: AssistantEngine
  status: 'waiting' | 'streaming' | 'done' | 'error'
}

let nextId = 0
const newId = () => `turn-${++nextId}`
const NO_TURNS: ChatTurn[] = []

/**
 * One conversation per farm: switching farm shows a fresh chat (and stops any answer
 * still streaming). The greeting isn't a turn; the page renders it in the current language.
 */
export function useChat(farmId: string | null, lang: Lang) {
  const [chat, setChat] = useState<{ farmId: string | null; turns: ChatTurn[] }>({ farmId, turns: [] })
  const turns = chat.farmId === farmId ? chat.turns : NO_TURNS
  const controller = useRef<AbortController | null>(null)
  const busy = turns.some((t) => t.status === 'waiting' || t.status === 'streaming')

  useEffect(() => () => controller.current?.abort(), [farmId])

  const update = (id: string, change: (turn: ChatTurn) => Partial<ChatTurn>) =>
    setChat((c) => ({ ...c, turns: c.turns.map((t) => (t.id === id ? { ...t, ...change(t) } : t)) }))

  const send = useCallback(
    async (question: string): Promise<string | undefined> => {
      const text = question.trim()
      if (!text || !farmId || busy) return
      const user: ChatTurn = { id: newId(), role: 'user', text, lang, status: 'done' }
      const reply: ChatTurn = { id: newId(), role: 'assistant', text: '', lang, status: 'waiting' }
      const history: ChatMessage[] = [...turns, user]
        .filter((t) => t.status === 'done' && t.text)
        .map((t) => ({ role: t.role, content: t.text }))
      setChat({ farmId, turns: [...turns, user, reply] })

      const abort = new AbortController()
      controller.current = abort
      try {
        for await (const ev of streamChat({ farm_id: farmId, lang, messages: history }, abort.signal)) {
          if (ev.event === 'meta') update(reply.id, () => ({ engine: ev.data.engine, lang: ev.data.lang }))
          else if (ev.event === 'delta') update(reply.id, (t) => ({ text: t.text + ev.data.text, status: 'streaming' }))
          else if (ev.event === 'replace') update(reply.id, () => ({ text: ev.data.text, engine: ev.data.engine, status: 'streaming' }))
          else update(reply.id, () => ({ status: 'done', engine: ev.data.engine }))
        }
        // A stream that ends without "done" still leaves a finished bubble.
        update(reply.id, (t) => (t.status === 'done' ? {} : t.text ? { status: 'done' } : { status: 'error', text: strings[lang].error }))
      } catch (error) {
        if (abort.signal.aborted) {
          // Stopped by the farmer: keep what was written so far.
          update(reply.id, (t) => (t.text ? { status: 'done' } : { status: 'error', text: '…' }))
        } else {
          update(reply.id, () => ({ status: 'error', text: strings[lang].error }))
          console.warn('Assistant request failed', error)
        }
      }
      return reply.id
    },
    [busy, farmId, lang, turns],
  )

  const stop = useCallback(() => controller.current?.abort(), [])
  const reset = useCallback(() => {
    controller.current?.abort()
    setChat({ farmId, turns: [] })
  }, [farmId])

  return { turns, send, stop, reset, busy }
}
