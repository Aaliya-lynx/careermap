// A static example shown beside the start form. It is drawn here, not generated, and it is labelled as an example.
const RING = 2 * Math.PI * 42

function Ring({ percent }) {
  return (
    <svg className="pv-ring" viewBox="0 0 100 100" role="img" aria-label={`${percent} percent ready`}>
      <circle cx="50" cy="50" r="42" className="pv-ring-bg" />
      <circle cx="50" cy="50" r="42" className="pv-ring-fg" strokeDasharray={RING} strokeDashoffset={RING * (1 - percent / 100)} transform="rotate(-90 50 50)" />
      <text x="50" y="52" textAnchor="middle" className="pv-ring-num">{percent}%</text>
      <text x="50" y="67" textAnchor="middle" className="pv-ring-sub">ready</text>
    </svg>
  )
}

function MiniTree() {
  // three tiers of medallions, climbed from the bottom: two done, one ready, one locked
  return (
    <svg className="pv-tree" viewBox="0 0 220 150" role="img" aria-label="A small skill tree with two finished steps, one ready and one locked">
      <g className="pv-line"><path d="M55 120 L110 80" /><path d="M165 120 L110 80" /><path d="M110 80 L110 36" className="pv-line-lit" /></g>
      <g><circle cx="55" cy="120" r="19" className="pv-done" /><path d="M47 120 l6 6 l11 -12" className="pv-tick" /></g>
      <g><circle cx="165" cy="120" r="19" className="pv-done" /><path d="M157 120 l6 6 l11 -12" className="pv-tick" /></g>
      <g><circle cx="110" cy="80" r="19" className="pv-ready" /><circle cx="110" cy="80" r="26" className="pv-pulse" /></g>
      <g><circle cx="110" cy="36" r="19" className="pv-locked" /><rect x="103" y="34" width="14" height="10" rx="2" className="pv-lock" /><path d="M106 34 v-4 a4 4 0 0 1 8 0 v4" className="pv-lock-arc" /></g>
    </svg>
  )
}

export default function HomePreview() {
  return (
    <div className="pv" aria-label="Example of what you get">
      <span className="pv-tag">Example preview</span>

      <div className="pv-card pv-top">
        <Ring percent={78} />
        <div>
          <p className="pv-title">Ready by 3 Dec</p>
          <p className="pv-muted">8 weeks at 12 hours a week</p>
          <p className="pv-chip">10 of 15 steps done</p>
        </div>
      </div>

      <div className="pv-card">
        <p className="pv-title">Your skill tree</p>
        <MiniTree />
        <p className="pv-muted">Tick what you know and the tree and the date update at once.</p>
      </div>

      <div className="pv-card">
        <p className="pv-title">Your next steps</p>
        <ul className="pv-steps">
          <li className="done"><span aria-hidden="true">✓</span> HTML and CSS</li>
          <li className="done"><span aria-hidden="true">✓</span> JavaScript</li>
          <li className="now"><span aria-hidden="true">●</span> React <em>next</em></li>
          <li className="locked"><span aria-hidden="true">🔒</span> Portfolio project</li>
        </ul>
        <div className="pv-bar" aria-hidden="true"><span style={{ width: '62%' }} /></div>
      </div>
    </div>
  )
}
