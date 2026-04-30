'use client'

const TYPE_LABEL = {
  undervalued: 'Undervalued',
  hidden_gem: 'Hidden Gem',
  options: 'Options',
  momentum: 'Momentum',
  contrarian: 'Contrarian',
  short: 'Short',
}

export default function PickCard({ pick }) {
  const c = Math.max(0, Math.min(10, Number(pick.conviction) || 0))
  return (
    <article className="pick">
      <header className="pick-head">
        <div className="pick-id">
          <span className="pick-ticker">${pick.ticker}</span>
          {pick.company && <span className="pick-company">{pick.company}</span>}
          <div className="pick-tags">
            <span className={`tag type-${pick.type}`}>{TYPE_LABEL[pick.type] || pick.type}</span>
            {pick.timeHorizon && <span className="tag">{pick.timeHorizon}</span>}
            {pick.sector && <span className="tag">{pick.sector}</span>}
          </div>
        </div>
        <div className="conviction" title="AI conviction score">
          <span>conv</span>
          <div className="conviction-bar">
            <div className="conviction-fill" style={{ width: `${(c / 10) * 100}%` }} />
          </div>
          <span className="conviction-num">{c.toFixed(1)}</span>
        </div>
      </header>

      <div className="pick-body">
        {pick.option && (
          <div className="option-detail">
            {pick.option.strategy?.toUpperCase() || 'OPTION'}
            {pick.option.strike != null && ` · $${pick.option.strike}`}
            {pick.option.expiry && ` · ${pick.option.expiry}`}
            {pick.option.contracts != null && ` · ${pick.option.contracts}x`}
            {pick.option.premium != null && ` · ~$${pick.option.premium}`}
            {pick.option.breakeven != null && ` · BE $${pick.option.breakeven}`}
          </div>
        )}

        <p className="pick-thesis">{pick.thesis}</p>

        <div className="pick-grid">
          {pick.catalysts?.length > 0 && (
            <div className="pick-block">
              <div className="pick-block-label">Catalysts</div>
              <ul>
                {pick.catalysts.map((c, i) => <li key={i}>{c}</li>)}
              </ul>
            </div>
          )}
          {pick.risks?.length > 0 && (
            <div className="pick-block">
              <div className="pick-block-label">Risks</div>
              <ul>
                {pick.risks.map((c, i) => <li key={i}>{c}</li>)}
              </ul>
            </div>
          )}
        </div>

        <div className="pick-meta">
          {pick.entry && (
            <div className="pick-meta-item">
              <span className="pick-meta-label">Entry</span>
              <span className="pick-meta-val">{pick.entry}</span>
            </div>
          )}
          {pick.target && (
            <div className="pick-meta-item">
              <span className="pick-meta-label">Target</span>
              <span className="pick-meta-val">{pick.target}</span>
            </div>
          )}
          {pick.stop && (
            <div className="pick-meta-item">
              <span className="pick-meta-label">Stop</span>
              <span className="pick-meta-val">{pick.stop}</span>
            </div>
          )}
          {pick.upsidePct != null && (
            <div className="pick-meta-item">
              <span className="pick-meta-label">Upside</span>
              <span className="pick-meta-val" style={{ color: 'var(--accent)' }}>
                {pick.upsidePct > 0 ? '+' : ''}{pick.upsidePct}%
              </span>
            </div>
          )}
          {pick.strongBuyCount != null && (
            <div className="pick-meta-item">
              <span className="pick-meta-label">Strong Buys</span>
              <span className="pick-meta-val">{pick.strongBuyCount}</span>
            </div>
          )}
          {pick.analystTarget && (
            <div className="pick-meta-item">
              <span className="pick-meta-label">St Tgt</span>
              <span className="pick-meta-val">{pick.analystTarget}</span>
            </div>
          )}
        </div>
      </div>
    </article>
  )
}
