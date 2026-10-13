'use client'

import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Eye, LogOut, ShieldAlert } from 'lucide-react'
import { useImpersonation } from '@/store/impersonation'
import { useAuth } from '@/store/auth'
import { api } from '@/lib/api'
import { setSession, clearFxsimCache } from '@/lib/fxsim'

export function ImpersonationBanner() {
  const router  = useRouter()
  const record  = useImpersonation((s) => s.record)
  const endImp  = useImpersonation((s) => s.end)
  const refresh = useAuth((s) => s.refresh)
  const signout = useAuth((s) => s.signout)

  if (!record) return null

  const exit = async () => {
    const res = await api.admin.impersonateStop()
    if (res.ok && res.data.success) {
      // Admin auth cookie has been restored server-side. Adopt the fresh nonce
      // and re-load the session as the admin — no logout.
      if (res.data.nonce) setSession({ nonce: res.data.nonce, bearer: null })
      endImp()
      // Drop every cached GET fetched as the impersonated trader (account,
      // positions, dashboard, etc.) so the restored admin session shows its
      // own data immediately — no hard refresh.
      clearFxsimCache()
      await refresh(true)
      toast.success(`Returned to your admin account (${record.admin_username}).`)
      window.location.href = '/admin'
    } else {
      // Fallback: if the session couldn't be restored, fail safe to login.
      endImp()
      await signout()
      toast.error('Could not restore your admin session — please sign in again.')
      window.location.href = '/login'
    }
  }

  return (
    <div className="sticky top-0 z-50 bg-amber-500 dark:bg-amber-600 text-slate-950 font-medium shadow-md border-b border-amber-600/30">
      <div className="px-4 md:px-8 h-10 flex items-center gap-2.5 text-xs">
        <div className="flex items-center gap-1.5 shrink-0 text-slate-950">
          <ShieldAlert className="h-4 w-4" />
          <Eye className="h-4 w-4" />
        </div>
        <span className="truncate text-slate-950">
          Viewing as <strong className="font-bold">{record.target_username}</strong> <span className="opacity-80">(Admin: {record.admin_username})</span>
        </span>
        <button
          onClick={exit}
          className="ml-auto inline-flex items-center gap-1.5 h-7 px-3 rounded-md bg-slate-950 text-white hover:bg-slate-900 transition-all font-semibold text-xs shadow-sm shrink-0"
        >
          <LogOut className="h-3.5 w-3.5" />
          <span>Exit to Admin Panel</span>
        </button>
      </div>
    </div>
  )
}
