import { useEffect, useState } from 'react'

const supported = () => typeof window !== 'undefined' && 'speechSynthesis' in window && 'SpeechSynthesisUtterance' in window

// Prefer an Indian or British English voice, then any English voice, then whatever the device has.
function pickVoice() {
  const voices = window.speechSynthesis.getVoices()
  return voices.find((v) => v.lang === 'en-IN') ?? voices.find((v) => v.lang === 'en-GB') ?? voices.find((v) => v.lang.startsWith('en')) ?? null
}

// "Listen" button: reads the plan aloud with the browser's own voice (free, no AI call). Tap again to stop.
export default function Listen({ getLines, disabled }) {
  const [playing, setPlaying] = useState(false)

  useEffect(() => () => { if (supported()) window.speechSynthesis.cancel() }, [])

  if (!supported()) return null

  function stop() {
    window.speechSynthesis.cancel()
    setPlaying(false)
  }

  function play() {
    window.speechSynthesis.cancel()
    const lines = getLines()
    const voice = pickVoice()
    lines.forEach((text, i) => {
      const utterance = new SpeechSynthesisUtterance(text)
      utterance.lang = voice?.lang ?? 'en-IN'
      if (voice) utterance.voice = voice
      utterance.rate = 0.98
      if (i === lines.length - 1) utterance.onend = () => setPlaying(false)
      utterance.onerror = () => setPlaying(false)
      window.speechSynthesis.speak(utterance)
    })
    setPlaying(true)
  }

  return (
    <button type="button" className={`ghost listen ${playing ? 'is-playing' : ''}`} onClick={playing ? stop : play} disabled={disabled}
      aria-pressed={playing} aria-label={playing ? 'Stop reading the plan aloud' : 'Listen to your plan read aloud'}>
      {playing ? '⏹ Stop' : '🔊 Listen to my plan'}
    </button>
  )
}
