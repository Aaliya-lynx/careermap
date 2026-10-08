// "People who took this path": three typical routes into the job, each as a short timeline.
// They are illustrative patterns written by the AI, never real people.
export default function Paths({ paths, busy, error, onLoad, onShowOnMap }) {
  if (!paths) {
    return (
      <section className="card paths-empty" aria-label="People who took this path">
        <h3>People who took this path</h3>
        <p className="muted">See three typical routes people take into this job: the roles in between, roughly how long each stage takes, and the side projects behind each step.</p>
        <button type="button" className="primary" onClick={onLoad} disabled={busy}>{busy ? 'Looking at typical routes…' : 'Show typical routes'}</button>
        {error && <p className="callout warn" role="alert">{error}</p>}
        <p className="notice">✨ These are illustrative routes written by AI, not real people. Use them for ideas, and confirm details with official sources.</p>
      </section>
    )
  }
  return (
    <div className="paths" aria-label="Typical routes into this job">
      {paths.map((path) => (
        <article className="card path" key={path.name}>
          <h3>{path.name}</h3>
          {path.summary && <p className="muted">{path.summary}</p>}
          <ol className="stages">
            {path.stages.map((stage, index) => (
              <li key={`${stage.role}-${index}`}>
                <strong>{stage.role}</strong>{stage.when && <span className="muted"> · {stage.when}</span>}
                {stage.did && <p>{stage.did}</p>}
                {stage.project && <p className="stage-project">Side project or credential: {stage.project}</p>}
              </li>
            ))}
          </ol>
          {path.steps_used.length > 0 && (
            <button type="button" className="secondary" onClick={() => onShowOnMap(path)}>Highlight this route on my map</button>
          )}
        </article>
      ))}
      <div className="paths-foot">
        <p className="notice">✨ Illustrative routes written by AI, not real people.</p>
        <button type="button" className="ghost" onClick={onLoad} disabled={busy}>{busy ? 'Looking…' : 'Show different routes'}</button>
        {error && <p className="callout warn" role="alert">{error}</p>}
      </div>
    </div>
  )
}
