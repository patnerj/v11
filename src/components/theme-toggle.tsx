'use client'

import * as React from 'react'
import { Moon, Sun } from 'lucide-react'
import { useThemeContext } from '@/context/ThemeContext'
import { useTheme } from 'next-themes'

export function ThemeToggle({ className }: { className?: string }) {
  const { theme: ctxTheme, setTheme: setCtxTheme } = useThemeContext()
  const { resolvedTheme, setTheme: setNextTheme } = useTheme()
  const [mounted, setMounted] = React.useState(false)

  React.useEffect(() => {
    setMounted(true)
  }, [])

  // Active theme is dark if ctxTheme is anything other than clean-light
  const isDark = ctxTheme !== 'clean-light'

  const toggleTheme = (e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault()
      e.stopPropagation()
    }
    const nextDark = !isDark
    if (nextDark) {
      setNextTheme('dark')
      setCtxTheme('midnight-obsidian')
      if (typeof document !== 'undefined') {
        document.documentElement.classList.remove('light')
        document.documentElement.classList.add('dark')
        document.documentElement.setAttribute('data-theme', 'midnight-obsidian')
      }
      try {
        localStorage.setItem('theme', 'dark')
        localStorage.setItem('user-theme', 'midnight-obsidian')
      } catch (err) {}
    } else {
      setNextTheme('light')
      setCtxTheme('clean-light')
      if (typeof document !== 'undefined') {
        document.documentElement.classList.remove('dark')
        document.documentElement.classList.add('light')
        document.documentElement.setAttribute('data-theme', 'clean-light')
      }
      try {
        localStorage.setItem('theme', 'light')
        localStorage.setItem('user-theme', 'clean-light')
      } catch (err) {}
    }
  }

  if (!mounted) {
    return (
      <div className={`h-9 w-9 rounded-xl border border-gray-200 dark:border-surface-muted bg-gray-100 dark:bg-surface flex items-center justify-center text-gray-400 ${className || ''}`}>
        <Sun className="h-4 w-4" />
      </div>
    )
  }

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className={`h-9 w-9 rounded-xl border border-gray-200 dark:border-surface-muted bg-white dark:bg-surface hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white flex items-center justify-center transition-all shadow-sm group ${className || ''}`}
      title={isDark ? "Switch to Day Mode (Light)" : "Switch to Night Mode (Dark)"}
      aria-label="Toggle Day/Night Mode"
    >
      {isDark ? (
        <Sun className="h-4 w-4 text-amber-400 group-hover:rotate-45 transition-transform" />
      ) : (
        <Moon className="h-4 w-4 text-blue-600 dark:text-blue-400 group-hover:-rotate-12 transition-transform" />
      )}
      <span className="sr-only">{isDark ? 'Day Mode' : 'Night Mode'}</span>
    </button>
  )
}
