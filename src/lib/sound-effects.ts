'use client'

/**
 * Web Audio API synthesized sound effects engine for trading actions.
 * Zero external audio files required, zero latency, lightweight.
 * Autoplay Policy Resilient & Strictly respects mute state from localStorage.
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
let hasAddedUserGestureListener = false

/**
 * Cleanly unlock suspended AudioContext on the first genuine user gesture
 * without throwing browser console warnings or unhandled rejections.
 */
function initUserGestureUnlock() {
  if (typeof window === 'undefined' || hasAddedUserGestureListener) return
  hasAddedUserGestureListener = true

  const unlock = () => {
    try {
      if (audioCtx && audioCtx.state === 'suspended') {
        audioCtx.resume().catch(() => {})
      }
    } catch {}
  }

  window.addEventListener('pointerdown', unlock, { once: true, passive: true })
  window.addEventListener('keydown', unlock, { once: true, passive: true })
}

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null
  initUserGestureUnlock()

  try {
    if (!audioCtx) {
      const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext
      if (AudioCtxClass) {
        audioCtx = new AudioCtxClass()
      }
    }
    if (audioCtx && audioCtx.state === 'suspended') {
      audioCtx.resume().catch(() => {})
    }
    return audioCtx
  } catch {
    return null
  }
}

/**
 * Tactile crisp mechanical switch click for order execution open.
 */
export function playOrderOpenClickSound() {
  if (!isSoundEnabled()) return
  const ctx = getAudioContext()
  if (!ctx) return

  try {
    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {})
    }
    const now = ctx.currentTime
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()

    osc.type = 'sine'
    osc.frequency.setValueAtTime(1400, now)
    osc.frequency.exponentialRampToValueAtTime(500, now + 0.04)

    gain.gain.setValueAtTime(0.09, now)
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05)

    osc.connect(gain)
    gain.connect(ctx.destination)

    osc.start(now)
    osc.stop(now + 0.05)
  } catch {
    /* Audio disabled or blocked by browser policy */
  }
}

/**
 * Harmonic bell chord when an order is successfully executed.
 */
export function playOrderSuccessSound() {
  if (!isSoundEnabled()) return
  const ctx = getAudioContext()
  if (!ctx) return

  try {
    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {})
    }
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

/**
 * Clean descending acoustic tone for position close.
 */
export function playOrderCloseSound() {
  if (!isSoundEnabled()) return
  const ctx = getAudioContext()
  if (!ctx) return

  try {
    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {})
    }
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
    /* Audio disabled or blocked by browser policy */
  }
}

/**
 * Crisp dual-tone blip when SL/TP bracket is updated.
 */
export function playSltpUpdatedSound() {
  if (!isSoundEnabled()) return
  const ctx = getAudioContext()
  if (!ctx) return

  try {
    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {})
    }
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
    /* Audio disabled or blocked by browser policy */
  }
}

/**
 * Harmonic triumphant celebration arpeggio.
 */
export function playCelebrationVictorySound() {
  if (!isSoundEnabled()) return
  const ctx = getAudioContext()
  if (!ctx) return

  try {
    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {})
    }
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

/**
 * Clean harmonic crystal chime for profit-taking position close.
 */
export function playOrderProfitChimeSound() {
  if (!isSoundEnabled()) return
  const ctx = getAudioContext()
  if (!ctx) return

  try {
    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {})
    }
    const now = ctx.currentTime
    const osc1 = ctx.createOscillator()
    const osc2 = ctx.createOscillator()
    const gain = ctx.createGain()

    osc1.type = 'sine'
    osc2.type = 'triangle'

    // Sparkling ascending chime (A5 880Hz -> C#6 1108.7Hz -> E6 1318.5Hz)
    osc1.frequency.setValueAtTime(880, now)
    osc1.frequency.exponentialRampToValueAtTime(1318.5, now + 0.15)

    osc2.frequency.setValueAtTime(1108.7, now + 0.06)
    osc2.frequency.exponentialRampToValueAtTime(1760, now + 0.22)

    gain.gain.setValueAtTime(0.08, now)
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.45)

    osc1.connect(gain)
    osc2.connect(gain)
    gain.connect(ctx.destination)

    osc1.start(now)
    osc2.start(now + 0.06)
    osc1.stop(now + 0.35)
    osc2.stop(now + 0.45)
  } catch {
    /* Audio disabled or blocked by browser policy */
  }
}

/**
 * Soft dampened low-frequency thump for loss position close.
 */
export function playOrderLossThumpSound() {
  if (!isSoundEnabled()) return
  const ctx = getAudioContext()
  if (!ctx) return

  try {
    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {})
    }
    const now = ctx.currentTime
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()

    osc.type = 'sine'
    osc.frequency.setValueAtTime(140, now)
    osc.frequency.exponentialRampToValueAtTime(45, now + 0.22)

    gain.gain.setValueAtTime(0.12, now)
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.28)

    osc.connect(gain)
    gain.connect(ctx.destination)

    osc.start(now)
    osc.stop(now + 0.28)
  } catch {
    /* Audio disabled or blocked by browser policy */
  }
}
