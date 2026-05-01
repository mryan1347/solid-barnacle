'use client'

import { claudeUrl } from '../lib/prompts'

export default function AskClaudeButton({ prompt, label = 'Ask Claude', size = 'sm' }) {
  if (!prompt) return null
  const styles = size === 'sm'
    ? { minHeight: 28, padding: '3px 9px', fontSize: 11, textDecoration: 'none' }
    : { minHeight: 32, padding: '4px 11px', fontSize: 12, textDecoration: 'none' }

  return (
    <a
      href={claudeUrl(prompt)}
      target="_blank"
      rel="noopener noreferrer"
      className="btn btn-ghost"
      style={styles}
      title="Open this in claude.ai with a tailored prompt"
    >
      ✱ {label}
    </a>
  )
}
