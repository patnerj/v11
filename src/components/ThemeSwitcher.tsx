'use client'

import * as React from 'react'
import { Moon, Sun } from 'lucide-react'
import { useThemeContext } from '@/context/ThemeContext'
import { useTheme } from 'next-themes'
import { cn } from '@/lib/cn'

export function ThemeSwitcher({ className }: { className?: string } = {}) {
  const { theme, setTheme } = useThemeContext()
  const { setTheme: setNextTheme } = useTheme()
  const [mounted, setMounted] = React.useState(false)
  React.useEffect(() => setMounted(true), [])

  const isDark = theme !== 'clean-light'

  const toggleTheme = (e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault()
      e.stopPropagation()
    }
    const nextDark = !isDark
    if (nextDark) {
      setTheme('midnight-obsidian')
      try {
        setNextTheme('dark')
      } catch (err) {}
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
      setTheme('clean-light')
      try {
        setNextTheme('light')
      } catch (err) {}
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
      <div className={cn("w-9 h-9 rounded-xl border border-border bg-surface flex items-center justify-center text-text-muted", className)}>
        <Sun className="w-4 h-4 text-text-muted" />
      </div>
    )
  }

  return (
    <button 
      type="button"
      onClick={toggleTheme}
      className={cn(
        "w-9 h-9 rounded-xl border border-border bg-surface hover:bg-surface-muted text-text-muted hover:text-text flex items-center justify-center transition-all shadow-sm focus-ring select-none cursor-pointer group",
        className
      )}
      title={isDark ? "Switch to Day Mode (Clean Light)" : "Switch to Night Mode (Midnight Obsidian)"}
      aria-label="Toggle Day / Night Mode"
    >
      {isDark ? (
        <Sun className="w-4 h-4 text-amber-400 group-hover:rotate-45 transition-transform" />
      ) : (
        <Moon className="w-4 h-4 text-accent group-hover:-rotate-12 transition-transform" />
      )}
      <span className="sr-only">{isDark ? 'Day Mode' : 'Night Mode'}</span>
    </button>
  )
}
