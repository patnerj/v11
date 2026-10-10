import { toast } from 'sonner'
import type { ApiResult } from '@/types/api'

export function playAlertChime(type: 'critical' | 'normal' = 'normal') {
  if (typeof window === 'undefined') return
  try {
    const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    if (!AudioContextClass) return
    const ctx = new AudioContextClass()
    const now = ctx.currentTime
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.connect(gain)
    gain.connect(ctx.destination)
    if (type === 'critical') {
      osc.type = 'triangle'
      osc.frequency.setValueAtTime(880, now)
      osc.frequency.setValueAtTime(587, now + 0.12)
      gain.gain.setValueAtTime(0.15, now)
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35)
      osc.start(now)
      osc.stop(now + 0.35)
    } else {
      osc.type = 'sine'
      osc.frequency.setValueAtTime(523.25, now)
      osc.frequency.exponentialRampToValueAtTime(659.25, now + 0.08)
      gain.gain.setValueAtTime(0.1, now)
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25)
      osc.start(now)
      osc.stop(now + 0.25)
    }
  } catch {}
}

export async function requestNotificationPermission(): Promise<NotificationPermission | 'unsupported'> {
  if (typeof window === 'undefined' || !('Notification' in window)) return 'unsupported'
  if (Notification.permission === 'granted' || Notification.permission === 'denied') {
    return Notification.permission
  }
  try {
    return await Notification.requestPermission()
  } catch {
    return 'denied'
  }
}

export function showDesktopNotification(title: string, options?: NotificationOptions) {
  if (typeof window === 'undefined' || !('Notification' in window)) return
  if (Notification.permission !== 'granted') return
  if (typeof document !== 'undefined' && !document.hidden) return
  try {
    new Notification(title, {
      icon: '/favicon.svg',
      ...options,
    })
  } catch {}
}

export const notify = {
  requestPermission: requestNotificationPermission,
  playAlertChime,
  showDesktopNotification,

  success: (message: string, desktopTitle?: string) => {
    toast.success(message)
    if (desktopTitle) showDesktopNotification(desktopTitle, { body: message })
  },
  error: (message: string, desktopTitle?: string, playChime = true) => {
    toast.error(message)
    if (playChime) playAlertChime('critical')
    if (desktopTitle) showDesktopNotification(desktopTitle, { body: message })
  },
  info: (message: string, desktopTitle?: string) => {
    toast.info(message)
    if (desktopTitle) showDesktopNotification(desktopTitle, { body: message })
  },
  warning: (message: string, desktopTitle?: string, playChime = false) => {
    toast.warning(message)
    if (playChime) playAlertChime('critical')
    if (desktopTitle) showDesktopNotification(desktopTitle, { body: message })
  },

  /**
   * Standard helper to handle ApiResult<T> and show toast notifications automatically.
   * Returns true if request succeeded (res.ok === true), false otherwise.
   */
  apiResult: <T>(
    result: ApiResult<T>,
    options?: {
      successMessage?: string
      errorMessage?: string
      onSuccess?: (data: T) => void
      onError?: (error: string) => void
    }
  ): boolean => {
    if (result.ok) {
      if (options?.successMessage) {
        toast.success(options.successMessage)
      }
      options?.onSuccess?.(result.data)
      return true
    } else {
      const msg = options?.errorMessage || result.error || 'An unexpected error occurred'
      toast.error(msg)
      options?.onError?.(result.error)
      return false
    }
  },
}
