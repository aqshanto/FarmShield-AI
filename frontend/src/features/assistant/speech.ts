import { useCallback, useEffect, useRef, useState } from 'react'
import { type Lang, speechLocale } from '@/lib/i18n'

// The Web Speech API isn't in every browser (or in TypeScript's DOM types), so describe
// the small part we use and feature-detect it.
interface RecognitionResult {
  readonly isFinal: boolean
  readonly 0: { readonly transcript: string }
}
interface RecognitionEvent {
  readonly resultIndex: number
  readonly results: ArrayLike<RecognitionResult>
}
interface Recognition {
  lang: string
  interimResults: boolean
  continuous: boolean
  onresult: ((event: RecognitionEvent) => void) | null
  onerror: ((event: { error: string }) => void) | null
  onend: (() => void) | null
  start(): void
  stop(): void
  abort(): void
}
type RecognitionCtor = new () => Recognition

function recognitionCtor(): RecognitionCtor | null {
  const w = window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor }
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null
}

/** Speech-to-text for questions. `onFinal` receives the whole spoken question. */
export function useVoiceInput(lang: Lang, onFinal: (text: string) => void) {
  const [supported] = useState(() => recognitionCtor() !== null)
  const [listening, setListening] = useState(false)
  const [interim, setInterim] = useState('')
  const recognition = useRef<Recognition | null>(null)
  const finalCb = useRef(onFinal)
  useEffect(() => {
    finalCb.current = onFinal
  }, [onFinal])

  const stop = useCallback(() => recognition.current?.stop(), [])

  const start = useCallback(() => {
    const Ctor = recognitionCtor()
    if (!Ctor) return
    recognition.current?.abort()
    const rec = new Ctor()
    rec.lang = speechLocale[lang]
    rec.interimResults = true
    rec.continuous = false
    let finalText = ''
    rec.onresult = (event) => {
      let partial = ''
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i]
        if (result.isFinal) finalText += result[0].transcript
        else partial += result[0].transcript
      }
      setInterim(finalText + partial)
    }
    rec.onerror = () => setListening(false)
    rec.onend = () => {
      setListening(false)
      setInterim('')
      if (finalText.trim()) finalCb.current(finalText.trim())
    }
    recognition.current = rec
    setListening(true)
    rec.start()
  }, [lang])

  useEffect(() => () => recognition.current?.abort(), [])

  return { supported, listening, interim, start, stop }
}

function voiceFor(lang: Lang): SpeechSynthesisVoice | null {
  const voices = window.speechSynthesis.getVoices()
  const tag = speechLocale[lang].toLowerCase()
  return (
    voices.find((v) => v.lang.toLowerCase() === tag) ??
    voices.find((v) => v.lang.toLowerCase().replace('_', '-').startsWith(lang)) ??
    null
  )
}

/** Reads replies aloud. `canSpeak(lang)` is false when the device has no voice for it. */
export function useSpeaker() {
  const supported = typeof window !== 'undefined' && 'speechSynthesis' in window
  const [speakingId, setSpeakingId] = useState<string | null>(null)
  const [voicesReady, setVoicesReady] = useState(() => supported && window.speechSynthesis.getVoices().length > 0)

  useEffect(() => {
    if (!supported) return
    const synth = window.speechSynthesis
    const onVoices = () => setVoicesReady(synth.getVoices().length > 0)
    synth.addEventListener?.('voiceschanged', onVoices)
    // Voices may have loaded between the first render and now, without an event we heard.
    onVoices()
    return () => {
      synth.removeEventListener?.('voiceschanged', onVoices)
      synth.cancel()
    }
  }, [supported])

  const canSpeak = useCallback((lang: Lang) => supported && voicesReady && voiceFor(lang) !== null, [supported, voicesReady])

  const cancel = useCallback(() => {
    if (supported) window.speechSynthesis.cancel()
    setSpeakingId(null)
  }, [supported])

  const speak = useCallback(
    (id: string, text: string, lang: Lang) => {
      if (!supported) return
      const voice = voiceFor(lang)
      if (!voice) return
      const synth = window.speechSynthesis
      synth.cancel()
      // Bullets and symbols sound odd when read out.
      const utterance = new SpeechSynthesisUtterance(text.replace(/[•*#]/g, ' '))
      utterance.voice = voice
      utterance.lang = voice.lang
      utterance.rate = 0.95
      utterance.onend = () => setSpeakingId((current) => (current === id ? null : current))
      utterance.onerror = utterance.onend
      setSpeakingId(id)
      synth.speak(utterance)
    },
    [supported],
  )

  return { supported, canSpeak, speak, cancel, speakingId }
}
