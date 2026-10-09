import { useEffect, useRef, useState } from 'react'

const supported = () => typeof window !== 'undefined' && 'speechSynthesis' in window && 'SpeechSynthesisUtterance' in window

// Voices load a moment after the page opens on some browsers (Chrome only starts loading them when asked). Ask early and remember them,
// so that pressing "Listen" does not have to wait.
let known = []
function warmUp() {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return
  known = window.speechSynthesis.getVoices()
  window.speechSynthesis.addEventListener('voiceschanged', () => { known = window.speechSynthesis.getVoices() })
}
if (typeof window !== 'undefined') warmUp()

// A speech engine starts cold the first time it is used, which can take a second or two. So the first time the visitor taps or
// presses a key anywhere on the page, say one silent space with the voice we will use. By the time "Listen" is pressed it is ready.
let warmed = false
function warmEngine() {
  if (warmed || !supported()) return
  warmed = true
  try {
    const voice = chooseVoices(window.speechSynthesis.getVoices())[0]
    const quiet = new SpeechSynthesisUtterance(' ')
    quiet.volume = 0
    if (voice) { quiet.voice = voice; quiet.lang = voice.lang }
    window.speechSynthesis.speak(quiet)
  } catch { /* the warm-up is only a speed-up, never needed */ }
}
if (typeof window !== 'undefined') {
  for (const name of ['pointerdown', 'keydown', 'touchstart']) window.addEventListener(name, warmEngine, { once: true, passive: true, capture: true })
}

function loadVoices() {
  return new Promise((resolve) => {
    const now = window.speechSynthesis.getVoices()
    if (now.length) return resolve(now)
    if (known.length) return resolve(known)
    const done = () => {
      window.speechSynthesis.removeEventListener('voiceschanged', done)
      resolve(window.speechSynthesis.getVoices())
    }
    window.speechSynthesis.addEventListener('voiceschanged', done)
    setTimeout(done, 600)
  })
}

// The speech engine pauses between every queued item, so many short sentences sound choppy.
// Join sentences into a few longer chunks (kept short enough that Chrome does not cut a long utterance off).
function joinLines(lines, limit = 200, firstLimit = 60) {
  const chunks = []
  for (const line of lines) {
    const last = chunks.length - 1
    const room = last === 0 ? firstLimit : limit
    if (last >= 0 && chunks[last].length + line.length < room) chunks[last] += ' ' + line
    else chunks.push(line)
  }
  return chunks
}

// Which voices to try, best first: English voices that are stored on the device (they work offline), then online ones.
// The last try uses the browser's own default voice. Online voices can stay silent when the connection blocks them.
const accent = (v) => (v.lang === 'en-IN' || v.lang === 'en_IN' ? 0 : v.lang === 'en-GB' || v.lang === 'en_GB' ? 1 : v.lang === 'en-US' || v.lang === 'en_US' ? 2 : 3)
export function chooseVoices(voices) {
  const english = voices.filter((v) => v.lang.toLowerCase().replace('_', '-').startsWith('en'))
  const ranked = [...english].sort((a, b) => (a.localService ? 0 : 10) + accent(a) - ((b.localService ? 0 : 10) + accent(b)))
  const best = ranked[0] ?? voices[0] ?? null
  const other = ranked.find((v) => v !== best && v.localService !== best?.localService) ?? ranked[1] ?? null
  const tries = []
  for (const voice of [best, other]) if (voice && !tries.includes(voice)) tries.push(voice)
  tries.push(null)                                              // the browser's own default voice comes last
  return tries
}

// "Listen" button: reads the plan aloud with the browser's own voice (free, no AI call). Tap again to stop.
// If nothing is heard, it says why instead of failing silently.
export default function Listen({ getLines, disabled }) {
  const [playing, setPlaying] = useState(false)
  const [starting, setStarting] = useState(false)   // pressed, but the voice has not begun yet
  const [note, setNote] = useState('')
  const timer = useRef(null)
  const run = useRef(0)            // changes whenever the reading is stopped or started again, so an old attempt stops itself

  useEffect(() => () => {
    run.current += 1
    clearTimeout(timer.current)
    if (supported()) window.speechSynthesis.cancel()
  }, [])

  if (!supported()) return <p className="listen-note" role="status">Reading aloud is not supported in this browser. Try Chrome.</p>

  function stop() {
    run.current += 1
    clearTimeout(timer.current)
    window.speechSynthesis.cancel()
    setPlaying(false)
    setStarting(false)
    setNote('')
  }

  // Reads every chunk with one voice. Resolves true as soon as the voice starts, false if it stays silent.
  function speakWith(chunks, voice, id, patience) {
    return new Promise((resolve) => {
      let started = false
      timer.current = setTimeout(() => resolve(false), patience)
      chunks.forEach((text, i) => {
        const utterance = new SpeechSynthesisUtterance(text)
        if (voice) { utterance.voice = voice; utterance.lang = voice.lang }
        utterance.rate = 1
        utterance.onstart = () => { started = true; clearTimeout(timer.current); if (run.current === id) setStarting(false); resolve(true) }
        if (i === chunks.length - 1) utterance.onend = () => { if (run.current === id) { setPlaying(false); setStarting(false) } }
        utterance.onerror = (event) => {
          if (event.error === 'interrupted' || event.error === 'canceled') return
          clearTimeout(timer.current)
          if (!started) { resolve(false); return }
          setNote(`The voice stopped (${event.error}). Check that the device volume is up and this tab is not muted.`)
          setPlaying(false)
          setStarting(false)
        }
        window.speechSynthesis.speak(utterance)
      })
    })
  }

  async function play() {
    setNote('')
    const id = run.current + 1
    run.current = id
    const busy = window.speechSynthesis.speaking || window.speechSynthesis.pending
    window.speechSynthesis.cancel()
    window.speechSynthesis.resume()
    setPlaying(true)
    setStarting(true)
    const voices = await loadVoices()
    if (run.current !== id) return
    if (!voices.length) {
      setNote('This device has no text-to-speech voice installed, so nothing can be read aloud. On Android, open Settings, search for "Text-to-speech output" and install or enable Speech Services by Google.')
      setPlaying(false)
      setStarting(false)
      return
    }
    const chunks = joinLines(getLines())
    let first = true
    for (const voice of chooseVoices(voices)) {
      // the best voice gets more time (a cold engine is slow once); the fallbacks get less
      const patience = first ? 3000 : 2000
      // Chrome can drop a speak() that comes straight after cancel(), so wait a moment, but only when something was cancelled
      if (!first || busy) await new Promise((resolve) => setTimeout(resolve, 80))
      first = false
      if (run.current !== id) return
      if (await speakWith(chunks, voice, id, patience)) return            // this voice started: done
      window.speechSynthesis.cancel()                           // silent: try the next voice
    }
    if (run.current !== id) return
    setPlaying(false)
    setStarting(false)
    setNote('The voice did not start. Check that the device volume is up and this tab is not muted. If it stays silent, the voices on this device may need an internet connection or may not be installed. On a phone, make sure the phone is not on silent.')
  }

  return (
    <>
      <button type="button" className={`ghost listen ${playing ? 'is-playing' : ''}`} data-ico={playing ? undefined : 'speaker'} onClick={playing ? stop : play} disabled={disabled}
        aria-pressed={playing} aria-label={playing ? 'Stop reading the plan aloud' : 'Listen to your plan read aloud'}>
        {playing ? (starting ? '⏳ Starting… tap to cancel' : '⏹ Stop') : 'Listen to my plan'}
      </button>
      {note && <p className="listen-note callout warn" role="status">{note}</p>}
    </>
  )
}
