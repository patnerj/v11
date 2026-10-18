'use client'

import { useState, useEffect } from 'react'

export function getActiveDocumentTheme(): string {
  if (typeof document === 'undefined') return 'midnight-obsidian'
  const el = document.documentElement
  const dt = el.getAttribute('data-theme')
  if (dt) return dt
  if (el.classList.contains('dark')) return 'midnight-obsidian'
  if (el.classList.contains('light')) return 'clean-light'
  try {
    const userTheme = localStorage.getItem('user-theme')
    if (userTheme) return userTheme
  } catch {}
  return 'midnight-obsidian'
}

export function isDocumentDark(): boolean {
  if (typeof document === 'undefined') return true
  const el = document.documentElement
  const dt = el.getAttribute('data-theme')
  if (dt) {
    return dt !== 'clean-light' && dt !== 'light'
  }
  if (el.classList.contains('dark')) return true
  if (el.classList.contains('light')) return false
  try {
    const userTheme = localStorage.getItem('user-theme')
    if (userTheme) return userTheme !== 'clean-light' && userTheme !== 'light'
    const theme = localStorage.getItem('theme')
    if (theme === 'light') return false
  } catch {}
  return true
}

/**
 * Tracks the app's active theme, which this app expresses as a `data-theme`
 * attribute and `.dark`/`.light` class on <html> (e.g. "midnight-obsidian",
 * "clean-light") — NOT solely via next-themes. Returns the current value and
 * updates on change so consumers (charts, heatmaps, TradingView widgets) react
 * to theme switches instantly.
 */
export function useThemeAttribute(): string {
  const [theme, setTheme] = useState<string>(() => getActiveDocumentTheme())

  useEffect(() => {
    const el = document.documentElement
    const update = () => setTheme(getActiveDocumentTheme())
    update()
    const obs = new MutationObserver(update)
    obs.observe(el, { attributes: true, attributeFilter: ['data-theme', 'class'] })
    return () => obs.disconnect()
  }, [])

  return theme
}

/**
 * Reactive boolean hook indicating whether the active document theme is dark.
 * Synchronizes immediately with `<html data-theme="..." class="dark|light">`.
 */
export function useIsDarkTheme(): boolean {
  const [isDark, setIsDark] = useState<boolean>(() => isDocumentDark())

  useEffect(() => {
    const el = document.documentElement
    const update = () => setIsDark(isDocumentDark())
    update()
    const obs = new MutationObserver(update)
    obs.observe(el, { attributes: true, attributeFilter: ['data-theme', 'class'] })
    return () => obs.disconnect()
  }, [])

  return isDark
}
