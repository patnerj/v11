'use client'

/**
 * Web Audio API synthesized sound effects for trading actions.
 * Zero external audio files required, zero latency, lightweight.
 */

import { playHapticFeedback } from './haptics'
export { playHapticFeedback }

export function isSoundEnabled(): boolean {
  if (typeof window === 'undefined') return true
  try {
    return localStorage.getItem('fxsim_sound_enabled') !== 'false'
  } catch {
    return true
  }
}

export function setSoundEnabled(enabled: boolean): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem('fxsim_sound_enabled', String(enabled))
  } catch {}
}

let audioCtx: AudioContext | null = null

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null
  try {
    if (!audioCtx) {
      const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext
      if (AudioCtxClass) {
        audioCtx = new AudioCtxClass()
      }
    }
    if (audioCtx && audioCtx.state === 'suspended') {
      audioCtx.resume()
    }
    return audioCtx
  } catch {
    return null
  }
}

export function playOrderSuccessSound() {
  if (!isSoundEnabled()) return
  const ctx = getAudioContext()
  if (!ctx) return

  try {
    const now = ctx.currentTime
    const osc1 = ctx.createOscillator()
    const osc2 = ctx.createOscillator()
    const gain = ctx.createGain()

    osc1.type = 'sine'
    osc2.type = 'triangle'

    osc1.frequency.setValueAtTime(587.33, now) // D5
    osc1.frequency.exponentialRampToValueAtTime(880, now + 0.12) // A5

    osc2.frequency.setValueAtTime(880, now + 0.08)
    osc2.frequency.exponentialRampToValueAtTime(1174.66, now + 0.22) // D6

    gain.gain.setValueAtTime(0.08, now)
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35)

    osc1.connect(gain)
    osc2.connect(gain)
    gain.connect(ctx.destination)

    osc1.start(now)
    osc2.start(now + 0.08)
    osc1.stop(now + 0.25)
    osc2.stop(now + 0.35)
  } catch {
    /* Audio disabled or blocked by browser policy */
  }
}

export function playOrderCloseSound() {
  if (!isSoundEnabled()) return
  const ctx = getAudioContext()
  if (!ctx) return

  try {
    const now = ctx.currentTime
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()

    osc.type = 'sine'
    osc.frequency.setValueAtTime(880, now)
    osc.frequency.exponentialRampToValueAtTime(587.33, now + 0.18)

    gain.gain.setValueAtTime(0.07, now)
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25)

    osc.connect(gain)
    gain.connect(ctx.destination)

    osc.start(now)
    osc.stop(now + 0.25)
  } catch {
    /* Ignore audio policy errors */
  }
}

export function playSltpUpdatedSound() {
  if (!isSoundEnabled()) return
  const ctx = getAudioContext()
  if (!ctx) return

  try {
    const now = ctx.currentTime
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()

    osc.type = 'triangle'
    osc.frequency.setValueAtTime(659.25, now) // E5
    osc.frequency.setValueAtTime(880, now + 0.06) // A5

    gain.gain.setValueAtTime(0.06, now)
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18)

    osc.connect(gain)
    gain.connect(ctx.destination)

    osc.start(now)
    osc.stop(now + 0.18)
  } catch {
    /* Ignore audio policy errors */
  }
}

export function playCelebrationVictorySound() {
  if (!isSoundEnabled()) return
  const ctx = getAudioContext()
  if (!ctx) return

  try {
    const now = ctx.currentTime
    const osc1 = ctx.createOscillator()
    const osc2 = ctx.createOscillator()
    const osc3 = ctx.createOscillator()
    const gain = ctx.createGain()

    osc1.type = 'triangle'
    osc2.type = 'triangle'
    osc3.type = 'sine'

    // C major chord progression
    osc1.frequency.setValueAtTime(523.25, now) // C5
    osc1.frequency.setValueAtTime(659.25, now + 0.2) // E5
    osc1.frequency.setValueAtTime(783.99, now + 0.4) // G5
    osc1.frequency.setValueAtTime(1046.50, now + 0.6) // C6
    
    osc2.frequency.setValueAtTime(659.25, now) // E5
    osc2.frequency.setValueAtTime(783.99, now + 0.2) // G5
    osc2.frequency.setValueAtTime(1046.50, now + 0.4) // C6
    osc2.frequency.setValueAtTime(1318.51, now + 0.6) // E6

    osc3.frequency.setValueAtTime(261.63, now) // C4
    osc3.frequency.setValueAtTime(329.63, now + 0.2) // E4
    osc3.frequency.setValueAtTime(392.00, now + 0.4) // G4
    osc3.frequency.setValueAtTime(523.25, now + 0.6) // C5

    gain.gain.setValueAtTime(0.08, now)
    gain.gain.exponentialRampToValueAtTime(0.001, now + 1.2)

    osc1.connect(gain)
    osc2.connect(gain)
    osc3.connect(gain)
    gain.connect(ctx.destination)

    osc1.start(now)
    osc2.start(now)
    osc3.start(now)
    osc1.stop(now + 1.2)
    osc2.stop(now + 1.2)
    osc3.stop(now + 1.2)
  } catch {
    /* Audio disabled or blocked by browser policy */
  }
}
