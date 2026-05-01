'use client'

import VoiceButton from './VoiceButton'
import AskClaudeButton from './AskClaudeButton'
import { pickScript } from '../lib/voice'
import { pickPrompt } from '../lib/prompts'

const TYPE_LABEL = {
  undervalued: 'Undervalued',
  hidden_gem: 'Hidden Gem',
  options: 'Options',
  momentum: 'Momentum',
  contrarian: 'Contrarian',
  short: 'Short',
  sleeper: 'Sleeper',
  top_pick: 'Top Pick',
}

export default function PickCard({ pick, liveQuote }) {
  const c = Math.max(0, Math.min(10, Number(pick.conviction) || 0))
  const pct = liveQuote?.pctChange
  const pxColor = pct == null ? 'var(--text-faint)' : pct > 0 ? 'var(--accent)' : pct < 0 ? 'var(--danger)' : 'var(--text-dim)'
  return (
    <article className="pick">
      <header className="pick-head">
        <div className="pick-id">
          <span className="pick-ticker">${pick.ticker}</span>
          {liveQuote?.price != null && (
            <span className="live-px" title="Live price (refreshes every 60s)">
              ${liveQuote.price.toFixed(2)}
              <span style={{ color: pxColor, marginLeft: 4 }}>
                {pct == null ? '' : `${pct >= 0 ? '+' : ''}${pct.toFixed(2)}%`}
              </span>
              <span className="live-pulse" />
            </span>
          )}
          {pick.company && <span className="pick-company">{pick.company}</span>}
          <div className="pick-tags">
            <span className={`tag type-${pick.type}`}>{TYPE_LABEL[pick.type] || pick.type}</span>
            {pick.timeHorizon && <span className="tag">{pick.timeHorizon}</span>}
            {pick.sector && <span className="tag">{pick.sector}</span>}
          </div>
        </div>
        <div className="pick-head-right">
          <AskClaudeButton prompt={pickPrompt(pick)} label="Ask Claude" size="sm" />
          <VoiceButton text={pickScript(pick)} label="Listen" size="sm" />
          <div className="conviction" title="AI conviction score">
            <span>conv</span>
            <div className="conviction-bar">
              <div className="conviction-fill" style={{ width: `${(c / 10) * 100}%` }} />
            </div>
            <span className="conviction-num">{c.toFixed(1)}</span>
          </div>
        </div>
      </header>
      <style jsx>{`
        .pick-head-right { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
        .live-px {
          font-family: var(--mono);
          font-size: 13px;
          font-weight: 600;
          color: var(--text);
          background: var(--bg-elev-2);
          border: 1px solid var(--border);
          border-radius: 5px;
          padding: 2px 7px;
          display: inline-flex;
          align-items: center;
          gap: 4px;
          line-height: 1.3;
        }
        .live-pulse {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: var(--accent);
          box-shadow: 0 0 6px var(--accent);
          animation: pulse 1.6s ease-in-out infinite;
          margin-left: 4px;
        }
        @keyframes pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.4; transform: scale(0.85); }
        }
      `}</style>

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
