import { useEffect, useRef, useState } from 'react'

const supported = () => typeof window !== 'undefined' && 'speechSynthesis' in window && 'SpeechSynthesisUtterance' in window

// Voices load a moment after the page opens on some browsers: wait for them (up to a second) before choosing one.
function loadVoices() {
  return new Promise((resolve) => {
    const now = window.speechSynthesis.getVoices()
    if (now.length) return resolve(now)
    const done = () => {
      window.speechSynthesis.removeEventListener('voiceschanged', done)
      resolve(window.speechSynthesis.getVoices())
    }
    window.speechSynthesis.addEventListener('voiceschanged', done)
    setTimeout(done, 1200)
  })
}

// Prefer an Indian or British English voice, then any English voice, then the device's first voice.
const pickVoice = (voices) =>
  voices.find((v) => v.lang === 'en-IN') ?? voices.find((v) => v.lang === 'en-GB') ?? voices.find((v) => v.lang.startsWith('en')) ?? voices[0] ?? null

// "Listen" button: reads the plan aloud with the browser's own voice (free, no AI call). Tap again to stop.
// If nothing is heard, it says why instead of failing silently.
export default function Listen({ getLines, disabled }) {
  const [playing, setPlaying] = useState(false)
  const [note, setNote] = useState('')
  const timer = useRef(null)

  useEffect(() => () => {
    clearTimeout(timer.current)
    if (supported()) window.speechSynthesis.cancel()
  }, [])

  if (!supported()) return <p className="listen-note" role="status">Reading aloud is not supported in this browser. Try Chrome.</p>

  function stop() {
    clearTimeout(timer.current)
    window.speechSynthesis.cancel()
    setPlaying(false)
    setNote('')
  }

  async function play() {
    setNote('')
    window.speechSynthesis.cancel()
    window.speechSynthesis.resume()
    setPlaying(true)
    const voices = await loadVoices()
    if (!voices.length) {
      setNote('This device has no text-to-speech voice installed, so nothing can be read aloud. On Android, open Settings, search for "Text-to-speech output" and install or enable Speech Services by Google.')
      setPlaying(false)
      return
    }
    const voice = pickVoice(voices)
    const lines = getLines()
    await new Promise((resolve) => setTimeout(resolve, 80))   // Chrome can drop a speak() that comes straight after cancel()
    let started = false
    lines.forEach((text, i) => {
      const utterance = new SpeechSynthesisUtterance(text)
      if (voice) { utterance.voice = voice; utterance.lang = voice.lang }
      utterance.rate = 1
      utterance.onstart = () => { started = true }
      if (i === lines.length - 1) utterance.onend = () => setPlaying(false)
      utterance.onerror = (event) => {
        if (event.error === 'interrupted' || event.error === 'canceled') return
        setNote(`The voice stopped (${event.error}). Check that the device volume is up and this tab is not muted.`)
        setPlaying(false)
      }
      window.speechSynthesis.speak(utterance)
    })
    timer.current = setTimeout(() => {
      if (started) return
      window.speechSynthesis.cancel()
      setPlaying(false)
      setNote('The voice did not start. Check that the device volume is up and this tab is not muted. On a phone, make sure a text-to-speech engine is installed and the phone is not on silent.')
    }, 2800)
  }

  return (
    <>
      <button type="button" className={`ghost listen ${playing ? 'is-playing' : ''}`} onClick={playing ? stop : play} disabled={disabled}
        aria-pressed={playing} aria-label={playing ? 'Stop reading the plan aloud' : 'Listen to your plan read aloud'}>
        {playing ? '⏹ Stop' : '🔊 Listen to my plan'}
      </button>
      {note && <p className="listen-note callout warn" role="status">{note}</p>}
    </>
  )
}
