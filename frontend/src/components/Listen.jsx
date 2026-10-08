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

// The speech engine pauses between every queued item, so many short sentences sound choppy.
// Join sentences into a few longer chunks (kept short enough that Chrome does not cut a long utterance off).
function joinLines(lines, limit = 200) {
  const chunks = []
  for (const line of lines) {
    const last = chunks.length - 1
    if (last >= 0 && chunks[last].length + line.length < limit) chunks[last] += ' ' + line
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
    setNote('')
  }

  // Reads every chunk with one voice. Resolves true as soon as the voice starts, false if it stays silent.
  function speakWith(chunks, voice, id) {
    return new Promise((resolve) => {
      let started = false
      timer.current = setTimeout(() => resolve(false), 2500)
      chunks.forEach((text, i) => {
        const utterance = new SpeechSynthesisUtterance(text)
        if (voice) { utterance.voice = voice; utterance.lang = voice.lang }
        utterance.rate = 1
        utterance.onstart = () => { started = true; clearTimeout(timer.current); resolve(true) }
        if (i === chunks.length - 1) utterance.onend = () => { if (run.current === id) setPlaying(false) }
        utterance.onerror = (event) => {
          if (event.error === 'interrupted' || event.error === 'canceled') return
          clearTimeout(timer.current)
          if (!started) { resolve(false); return }
          setNote(`The voice stopped (${event.error}). Check that the device volume is up and this tab is not muted.`)
          setPlaying(false)
        }
        window.speechSynthesis.speak(utterance)
      })
    })
  }

  async function play() {
    setNote('')
    const id = run.current + 1
    run.current = id
    window.speechSynthesis.cancel()
    window.speechSynthesis.resume()
    setPlaying(true)
    const voices = await loadVoices()
    if (run.current !== id) return
    if (!voices.length) {
      setNote('This device has no text-to-speech voice installed, so nothing can be read aloud. On Android, open Settings, search for "Text-to-speech output" and install or enable Speech Services by Google.')
      setPlaying(false)
      return
    }
    const chunks = joinLines(getLines())
    for (const voice of chooseVoices(voices)) {
      await new Promise((resolve) => setTimeout(resolve, 80))   // Chrome can drop a speak() that comes straight after cancel()
      if (run.current !== id) return
      if (await speakWith(chunks, voice, id)) return            // this voice started: done
      window.speechSynthesis.cancel()                           // silent: try the next voice
    }
    if (run.current !== id) return
    setPlaying(false)
    setNote('The voice did not start. Check that the device volume is up and this tab is not muted. If it stays silent, the voices on this device may need an internet connection or may not be installed. On a phone, make sure the phone is not on silent.')
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
