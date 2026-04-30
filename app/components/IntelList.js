'use client'

function timeAgo(ts) {
  const s = Math.floor((Date.now() - ts) / 1000)
  if (s < 60) return `${s}s ago`
  if (s < 3600) return `${Math.floor(s / 60)}m ago`
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`
  return `${Math.floor(s / 86400)}d ago`
}

export default function IntelList({ items, onDelete, onClear }) {
  return (
    <div>
      <div className="section-title">
        <span>Intel feed · {items.length}</span>
        {items.length > 0 && (
          <button className="btn-ghost btn" onClick={onClear} type="button" title="Clear all intel">
            clear
          </button>
        )}
      </div>

      {items.length === 0 ? (
        <div className="empty">No intel yet. Drop a note above to seed the engine.</div>
      ) : (
        <div className="intel-list">
          {items.map((it) => (
            <div className="intel-item" key={it.id}>
              <div className="intel-meta">
                <span className={`tag kind-${it.kind}`}>{it.kind}</span>
                {it.tickers?.map((t) => (
                  <span key={t} className="tag ticker">${t}</span>
                ))}
                <span style={{ marginLeft: 'auto' }}>{timeAgo(it.createdAt)}</span>
              </div>
              <div className="intel-body">{it.body}</div>
              {(it.source || it.conviction) && (
                <div className="intel-meta">
                  {it.source && <span>src: {it.source}</span>}
                  {it.conviction != null && <span>conv: {it.conviction}/10</span>}
                </div>
              )}
              <div className="intel-actions">
                <button
                  type="button"
                  className="btn btn-danger-ghost"
                  onClick={() => onDelete(it.id)}
                  title="Delete"
                >
                  remove
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
