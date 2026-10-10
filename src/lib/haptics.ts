'use client'

/**
 * Mobile haptic vibration feedback for trading interactions and milestone celebration.
 */

export function isHapticsEnabled(): boolean {
  if (typeof window === 'undefined') return true
  try {
    return localStorage.getItem('fxsim_haptics_enabled') !== 'false'
  } catch {
    return true
  }
}

export function setHapticsEnabled(enabled: boolean): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem('fxsim_haptics_enabled', String(enabled))
  } catch {}
}

export function playHapticFeedback(pattern: number[] = [300, 100, 300]) {
  if (typeof window === 'undefined' || typeof navigator === 'undefined' || !navigator.vibrate) return
  if (!isHapticsEnabled()) return
  try {
    navigator.vibrate(pattern)
  } catch {}
}

export function vibrateSuccess() {
  playHapticFeedback([100, 50, 100])
}

export function vibrateError() {
  playHapticFeedback([50, 50, 50, 50, 50])
}

export function vibrateTap() {
  playHapticFeedback([10])
}
