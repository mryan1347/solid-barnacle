'use client'

// Client-side fetch wrapper that injects the APP_PASSWORD header
// if one is stored. All component fetches should go through apiFetch.

const STORAGE_KEY = 'intel-desk-pw'

export function getStoredPassword() {
  if (typeof window === 'undefined') return ''
  try { return localStorage.getItem(STORAGE_KEY) || '' } catch { return '' }
}

export function setStoredPassword(pw) {
  if (typeof window === 'undefined') return
  try { localStorage.setItem(STORAGE_KEY, pw) } catch {}
}

export function clearStoredPassword() {
  if (typeof window === 'undefined') return
  try { localStorage.removeItem(STORAGE_KEY) } catch {}
}

export async function apiFetch(input, init = {}) {
  const headers = new Headers(init.headers || {})
  const pw = getStoredPassword()
  if (pw) headers.set('x-app-password', pw)
  return fetch(input, { ...init, headers })
}
