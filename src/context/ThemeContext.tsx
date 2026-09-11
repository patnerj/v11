'use client'

import React, { createContext, useContext, useEffect, useState } from 'react'

export type Theme = 'midnight-obsidian' | 'vscode-dark' | 'cyberpunk-neon' | 'tokyo-night' | 'clean-light'

interface ThemeContextType {
  theme: Theme
  setTheme: (theme: Theme) => void
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined)

export function ThemeContextProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>('midnight-obsidian')

  useEffect(() => {
    // Read initial theme from localStorage on mount
    try {
      const storedTheme = localStorage.getItem('user-theme') as Theme
      const validThemes: Theme[] = ['midnight-obsidian', 'vscode-dark', 'cyberpunk-neon', 'tokyo-night', 'clean-light']
      const active = (storedTheme && validThemes.includes(storedTheme)) ? storedTheme : 'midnight-obsidian'
      setThemeState(active)
      if (typeof document !== 'undefined') {
        document.documentElement.setAttribute('data-theme', active)
        if (active === 'clean-light') {
          document.documentElement.classList.remove('dark')
          document.documentElement.classList.add('light')
          localStorage.setItem('theme', 'light')
        } else {
          document.documentElement.classList.add('dark')
          document.documentElement.classList.remove('light')
          localStorage.setItem('theme', 'dark')
        }
      }
    } catch (e) {}
  }, [])

  const setTheme = (newTheme: Theme) => {
    setThemeState(newTheme)
    try {
      localStorage.setItem('user-theme', newTheme)
      if (typeof document !== 'undefined') {
        document.documentElement.setAttribute('data-theme', newTheme)
        if (newTheme === 'clean-light') {
          document.documentElement.classList.remove('dark')
          document.documentElement.classList.add('light')
          localStorage.setItem('theme', 'light')
        } else {
          document.documentElement.classList.add('dark')
          document.documentElement.classList.remove('light')
          localStorage.setItem('theme', 'dark')
        }
      }
    } catch (e) {}
  }

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useThemeContext() {
  const context = useContext(ThemeContext)
  if (!context) {
    throw new Error('useThemeContext must be used within a ThemeContextProvider')
  }
  return context
}
