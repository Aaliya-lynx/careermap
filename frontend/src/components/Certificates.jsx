import { useState } from 'react'
import { toSmallJpeg } from '../images.js'

const FIT = { strong: 'Strong fit', good: 'Good fit', stretch: 'Stretch' }

// Upload or scan certificates, count what they prove for this roadmap, and see which careers fit.
export default function Certificates({ steps, result, evidence, busy, error, onAnalyze, onUseCareer }) {
  const [images, setImages] = useState([])        // small JPEG data URLs, kept only in this page until they are read
  const [typed, setTyped] = useState([])
  const [title, setTitle] = useState('')
  const [issuer, setIssuer] = useState('')
  const [problem, setProblem] = useState('')

  async function addFiles(event) {
    const files = [...event.target.files]
    event.target.value = ''
    setProblem('')
    for (const file of files) {
      if (images.length + 1 > 3) { setProblem('You can add up to 3 images at a time.'); break }
      try {
        const url = await toSmallJpeg(file)
        setImages((current) => (current.length < 3 ? [...current, url] : current))
      } catch (error_) {
        setProblem(error_.message)
      }
    }
  }

  function addTyped(event) {
    event.preventDefault()
    if (title.trim().length < 2 || typed.length >= 8) return
    setTyped((current) => [...current, { title: title.trim(), issuer: issuer.trim() }])
    setTitle('')
    setIssuer('')
  }

  async function read() {
    const ok = await onAnalyze({ certificates: typed, images })
    if (ok) { setImages([]); setTyped([]) }       // the photos are dropped as soon as they have been read
  }

  const count = Object.keys(evidence).length
  const ready = images.length + typed.length > 0

  return (
    <section className="card certs" aria-label="Certificates">
      <h3>My certificates</h3>
      <p className="muted">Add a certificate and we count what it shows you already know, then suggest careers that fit. This is self-reported: we cannot check that a certificate is genuine.</p>

      <div className="cert-add">
        <label className="file-button">
          📷 Take a photo or choose an image
          <input type="file" accept="image/*" multiple onChange={addFiles} disabled={busy} />
        </label>
        <form onSubmit={addTyped} className="cert-typed">
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Or type a certificate name" maxLength={120} aria-label="Certificate name" />
          <input value={issuer} onChange={(e) => setIssuer(e.target.value)} placeholder="Issuer (optional)" maxLength={80} aria-label="Issuer" />
          <button type="submit" className="secondary" disabled={title.trim().length < 2}>Add</button>
        </form>
      </div>
      <p className="notice">📌 Cover your name and any ID numbers before you upload. The image is shrunk in your browser, sent once to an AI service to be read, never stored by CareerMap, and cleared from this page afterwards. Photos and screenshots only (no PDFs).</p>
      {problem && <p className="callout warn" role="alert">{problem}</p>}

      {(images.length > 0 || typed.length > 0) && (
        <ul className="cert-list" aria-label="Ready to read">
          {images.map((url, i) => (
            <li key={url.slice(-40) + i}><img src={url} alt={`Certificate image ${i + 1}`} />
              <button type="button" className="ghost" onClick={() => setImages((c) => c.filter((_, j) => j !== i))}>Remove</button></li>
          ))}
          {typed.map((t, i) => (
            <li key={t.title + i}><span>🎓 {t.title}{t.issuer ? ` · ${t.issuer}` : ''}</span>
              <button type="button" className="ghost" onClick={() => setTyped((c) => c.filter((_, j) => j !== i))}>Remove</button></li>
          ))}
        </ul>
      )}
      <button type="button" className="primary" onClick={read} disabled={!ready || busy}>{busy ? 'Reading your certificates…' : 'Read my certificates'}</button>
      {error && <p className="callout warn" role="alert">{error}</p>}

      {result && (
        <div className="cert-result">
          <h4>What we found</h4>
          <ul>
            {result.read.map((r) => {
              const covers = result.matches.find((m) => m.certificate === r.title)?.covers ?? []
              return (
                <li key={r.title}><strong>{r.title}</strong>{r.issuer ? <span className="muted"> · {r.issuer}</span> : null}
                  <span className="muted"> {covers.length ? `counts toward ${covers.length} step${covers.length > 1 ? 's' : ''}: ${covers.map((id) => steps.find((s) => s.id === id)?.title).filter(Boolean).join(', ')}` : '· no roadmap step is clearly covered'}</span></li>
              )
            })}
          </ul>
          {count > 0 && <p className="callout">{count} step{count > 1 ? 's' : ''} marked as known from certificates (self-reported, not verified).</p>}

          <h4>Careers that fit you</h4>
          <ul className="careers">
            {result.careers.map((career) => (
              <li key={career.title}>
                <div><strong>{career.title}</strong> <span className={`fit fit-${career.fit}`}>{FIT[career.fit]}</span>
                  <p className="muted">{career.reason}</p></div>
                <button type="button" className="secondary" onClick={() => onUseCareer(career.title)}>Build a roadmap</button>
              </li>
            ))}
          </ul>
          <p className="notice">These are suggestions, not a verdict. Use them to explore, and confirm requirements with official sources.</p>
        </div>
      )}
    </section>
  )
}
