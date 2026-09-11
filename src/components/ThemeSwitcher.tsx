'use client'

import * as React from 'react'
import { Moon, Sun, Monitor, Code, Palette, Zap } from 'lucide-react'
import { useThemeContext, Theme } from '@/context/ThemeContext'
import { useTheme } from 'next-themes'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/cn'

const themes: { value: Theme; label: string; icon: React.FC<any> }[] = [
  { value: 'midnight-obsidian', label: 'Midnight Obsidian', icon: Moon },
  { value: 'vscode-dark', label: 'VS Code Dark', icon: Code },
  { value: 'cyberpunk-neon', label: 'Cyberpunk Neon', icon: Zap },
  { value: 'tokyo-night', label: 'Tokyo Night', icon: Monitor },
  { value: 'clean-light', label: 'Clean Light', icon: Sun },
]

export function ThemeSwitcher({ className }: { className?: string } = {}) {
  const { theme, setTheme } = useThemeContext()
  const { setTheme: setNextTheme } = useTheme()
  
  const [mounted, setMounted] = React.useState(false)
  React.useEffect(() => setMounted(true), [])

  const handleSelectTheme = (val: Theme) => {
    setTheme(val)
    try {
      setNextTheme(val === 'clean-light' ? 'light' : 'dark')
    } catch (e) {}
  }

  const ActiveIcon = themes.find(t => t.value === theme)?.icon || Palette

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button 
          type="button"
          className={cn(
            "w-9 h-9 rounded-xl border border-border bg-surface hover:bg-surface-muted text-text-muted hover:text-text flex items-center justify-center transition-all shadow-sm focus-ring select-none",
            className
          )}
          title="Select Theme"
          aria-label="Toggle theme"
        >
          {mounted ? <ActiveIcon className="w-4 h-4 text-accent" /> : <Palette className="w-4 h-4 text-text-muted" />}
          <span className="sr-only">Toggle theme</span>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48 bg-surface border border-border shadow-2xl p-1.5 z-50">
        <DropdownMenuLabel className="text-text-subtle font-semibold text-[11px] tracking-wider uppercase px-2.5 py-1.5">
          IDE Themes
        </DropdownMenuLabel>
        <DropdownMenuSeparator className="bg-border" />
        {themes.map((t) => {
          const isSelected = theme === t.value
          return (
            <DropdownMenuItem 
              key={t.value} 
              onClick={() => handleSelectTheme(t.value)}
              className={cn(
                "flex items-center justify-between cursor-pointer py-2 px-2.5 rounded-lg text-xs font-medium transition-colors",
                isSelected 
                  ? "bg-accent/15 text-accent font-semibold" 
                  : "text-text-muted hover:text-text hover:bg-surface-muted"
              )}
            >
              <div className="flex items-center gap-2">
                <t.icon className={cn("w-4 h-4", isSelected ? "text-accent" : "text-text-subtle")} />
                <span>{t.label}</span>
              </div>
              {isSelected && (
                <span className="w-1.5 h-1.5 rounded-full bg-accent" />
              )}
            </DropdownMenuItem>
          )
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
