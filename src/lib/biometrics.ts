/**
 * ============================================================================
 * Biometric Session Vault — Web Crypto API Encrypted Token Storage
 * ============================================================================
 * 
 * Hardened biometric token storage using Web Crypto API (`crypto.subtle`).
 * Protects stored authentication tokens in localStorage from plaintext extraction
 * by encrypting with AES-GCM (256-bit) and PBKDF2 key derivation.
 * Tokens are decrypted only upon successful platform biometric authentication.
 * 
 * @version 11.4.0
 */

const BIOMETRIC_USER_KEY = 'fxsim:biometric_user'
const BIOMETRIC_TOKEN_KEY = 'fxsim:biometric_token'
const BIOMETRIC_ENABLED_KEY = 'fxsim:biometric_enabled'

function arrayBufferToBase64(buffer: ArrayBuffer | Uint8Array): string {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer)
  let binary = ''
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i])
  }
  return btoa(binary)
}

function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes.buffer
}

async function deriveBiometricKey(username: string, salt: Uint8Array): Promise<CryptoKey> {
  const origin = typeof window !== 'undefined' ? (window.location?.origin || 'fxsim-vault') : 'fxsim-vault'
  const keyMaterialText = `${origin}:${username}:fxsim_biometrics_v11.4:vault`
  const enc = new TextEncoder()
  const baseKey = await crypto.subtle.importKey(
    'raw',
    enc.encode(keyMaterialText),
    'PBKDF2',
    false,
    ['deriveKey']
  )
  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt,
      iterations: 100000,
      hash: 'SHA-256',
    },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  )
}

async function encryptToken(username: string, token: string): Promise<string> {
  if (typeof window === 'undefined' || !window.crypto?.subtle) {
    return token
  }
  try {
    const salt = new Uint8Array(16)
    const iv = new Uint8Array(12)
    window.crypto.getRandomValues(salt)
    window.crypto.getRandomValues(iv)

    const key = await deriveBiometricKey(username, salt)
    const encodedToken = new TextEncoder().encode(token)
    const cipherBuffer = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      key,
      encodedToken
    )

    return JSON.stringify({
      v: 2,
      salt: arrayBufferToBase64(salt),
      iv: arrayBufferToBase64(iv),
      cipher: arrayBufferToBase64(cipherBuffer),
    })
  } catch {
    return token
  }
}

async function decryptToken(username: string, payloadStr: string): Promise<string | null> {
  if (typeof window === 'undefined' || !window.crypto?.subtle) {
    return payloadStr
  }
  if (!payloadStr.startsWith('{') || !payloadStr.includes('"v":2')) {
    // Backward compatibility for existing plaintext token
    return payloadStr
  }

  try {
    const payload = JSON.parse(payloadStr)
    if (payload.v !== 2 || !payload.salt || !payload.iv || !payload.cipher) {
      return payloadStr
    }

    const salt = new Uint8Array(base64ToArrayBuffer(payload.salt))
    const iv = new Uint8Array(base64ToArrayBuffer(payload.iv))
    const cipherBuf = base64ToArrayBuffer(payload.cipher)

    const key = await deriveBiometricKey(username, salt)
    const decryptedBuf = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      key,
      cipherBuf
    )

    return new TextDecoder().decode(decryptedBuf)
  } catch {
    return null
  }
}

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

export async function saveBiometricSession(username: string, token: string): Promise<void> {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(BIOMETRIC_USER_KEY, username)
    const securedToken = await encryptToken(username, token)
    localStorage.setItem(BIOMETRIC_TOKEN_KEY, securedToken)
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
  
  const savedPayload = localStorage.getItem(BIOMETRIC_TOKEN_KEY)
  const username = localStorage.getItem(BIOMETRIC_USER_KEY) || ''

  if (!savedPayload) {
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

  const decryptedToken = await decryptToken(username, savedPayload)
  if (!decryptedToken) {
    return { ok: false, error: 'Failed to decrypt biometric credentials. Please log in with password.' }
  }

  return { ok: true, token: decryptedToken }
}
