const BIOMETRIC_USER_KEY = 'fxsim:biometric_user'
const BIOMETRIC_TOKEN_KEY = 'fxsim:biometric_token'
const BIOMETRIC_ENABLED_KEY = 'fxsim:biometric_enabled'

export async function isBiometricsAvailable(): Promise<boolean> {
  if (typeof window === 'undefined') return false
  try {
    if (window.PublicKeyCredential) {
      const available = await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable()
      return available
    }
  } catch {
    // fallback
  }
  return typeof window !== 'undefined' && !!localStorage.getItem(BIOMETRIC_TOKEN_KEY)
}

export function hasSavedBiometricProfile(): boolean {
  if (typeof window === 'undefined') return false
  return !!localStorage.getItem(BIOMETRIC_TOKEN_KEY) && !!localStorage.getItem(BIOMETRIC_USER_KEY)
}

export function getSavedBiometricUser(): string | null {
  if (typeof window === 'undefined') return null
  return localStorage.getItem(BIOMETRIC_USER_KEY)
}

export function saveBiometricSession(username: string, token: string) {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(BIOMETRIC_USER_KEY, username)
    localStorage.setItem(BIOMETRIC_TOKEN_KEY, token)
    localStorage.setItem(BIOMETRIC_ENABLED_KEY, '1')
  } catch {}
}

export function clearBiometricSession() {
  if (typeof window === 'undefined') return
  try {
    localStorage.removeItem(BIOMETRIC_USER_KEY)
    localStorage.removeItem(BIOMETRIC_TOKEN_KEY)
    localStorage.removeItem(BIOMETRIC_ENABLED_KEY)
  } catch {}
}

export async function authenticateWithBiometrics(): Promise<{ ok: boolean; token?: string; error?: string }> {
  if (typeof window === 'undefined') return { ok: false, error: 'Browser not ready' }
  
  const savedToken = localStorage.getItem(BIOMETRIC_TOKEN_KEY)

  if (!savedToken) {
    return { ok: false, error: 'No thumb/biometric credentials saved on this device yet. Please login once with password first.' }
  }

  if (window.PublicKeyCredential && await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable().catch(() => false)) {
    try {
      const challenge = new Uint8Array(32)
      window.crypto.getRandomValues(challenge)

      await navigator.credentials.get({
        publicKey: {
          challenge,
          timeout: 60000,
          userVerification: 'required',
          rpId: window.location.hostname,
        }
      }).catch((err) => {
        if (err.name === 'NotAllowedError') {
          throw new Error('Biometric authentication canceled.')
        }
        return null
      })
    } catch (e: any) {
      if (e.message?.includes('canceled')) {
        return { ok: false, error: 'Thumb authentication was canceled.' }
      }
    }
  }

  return { ok: true, token: savedToken }
}
