'use client'

import * as React from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { Search, ChevronRight, User, Settings, CreditCard, LayoutDashboard, Shield } from 'lucide-react'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { cn } from '@/lib/cn'

const ACTIONS = [
  { title: 'Dashboard', icon: LayoutDashboard, href: '/dashboard' },
  { title: 'Admin Overview', icon: LayoutDashboard, href: '/admin' },
  { title: 'Manage Traders', icon: User, href: '/admin/traders' },
  { title: 'Risk Control', icon: Shield, href: '/admin/risk' },
  { title: 'System Config', icon: Settings, href: '/admin/config' },
  { title: 'Payout Requests', icon: CreditCard, href: '/admin/payouts' },
  { title: 'Account Settings', icon: Settings, href: '/dashboard/settings' },
]

export function CommandPalette() {
  const [mounted, setMounted] = React.useState(false)
  const pathname = usePathname()
  const [open, setOpen] = React.useState(false)
  const [query, setQuery] = React.useState('')
  const router = useRouter()

  React.useEffect(() => {
    setMounted(true)
  }, [])

  const isAdmin = pathname?.startsWith('/admin')

  React.useEffect(() => {
    if (!mounted || isAdmin) return
    const down = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        setOpen((open) => !open)
      }
    }
    document.addEventListener('keydown', down)
    return () => document.removeEventListener('keydown', down)
  }, [mounted, isAdmin])

  const runCommand = React.useCallback((command: () => void) => {
    setOpen(false)
    command()
  }, [])

  if (!mounted || isAdmin) return null

  const filtered = query === '' 
    ? ACTIONS 
    : ACTIONS.filter(a => a.title.toLowerCase().includes(query.toLowerCase()))

  return (
    <>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="dark p-0 overflow-hidden max-w-xl bg-[#070C14] text-slate-100 border border-emerald-500/30 shadow-[0_0_50px_-10px_rgba(16,185,129,0.2)] backdrop-blur-2xl ring-1 ring-emerald-500/20">
          <div className="flex items-center border-b border-emerald-500/20 bg-[#0D1522] px-4">
            <Search className="h-5 w-5 text-emerald-400 shrink-0" />
            <input
              autoFocus
              className="flex h-14 w-full rounded-md bg-transparent px-3 py-3 text-sm outline-none text-slate-100 placeholder:text-slate-400 font-medium"
              placeholder="Type a command or search..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <kbd className="hidden sm:inline-flex h-6 items-center gap-1 rounded border border-slate-700 bg-slate-800 px-2 font-mono text-2xs font-medium text-slate-300 opacity-100">
              <span className="text-xs">ESC</span>
            </kbd>
          </div>
          <div className="max-h-[300px] overflow-y-auto p-2 space-y-1 bg-[#070C14]">
            {filtered.length === 0 && (
              <p className="p-4 text-center text-sm text-slate-400">No results found.</p>
            )}
            {filtered.map((action, i) => {
              const Icon = action.icon
              return (
                <button
                  key={i}
                  onClick={() => runCommand(() => router.push(action.href))}
                  className={cn(
                    "relative flex w-full cursor-pointer select-none items-center rounded-lg px-3 py-2.5 text-sm outline-none transition-colors",
                    "text-slate-300 hover:bg-emerald-500/15 hover:border-emerald-500/40 hover:text-white"
                  )}
                >
                  <div className="w-7 h-7 rounded-md bg-slate-800/80 border border-slate-700/60 flex items-center justify-center mr-3 shrink-0 text-slate-300 group-hover:text-emerald-400">
                    <Icon className="h-4 w-4 shrink-0" />
                  </div>
                  <span className="font-medium text-slate-100">{action.title}</span>
                  <ChevronRight className="ml-auto h-4 w-4 text-slate-400" />
                </button>
              )
            })}
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}

function Trophy(props: any) {
    return <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" />
      <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" />
      <path d="M4 22h16" />
      <path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22" />
      <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22" />
      <path d="M18 2H6v7c0 6 3 10 6 10s6-4 6-10z" />
    </svg>
}
