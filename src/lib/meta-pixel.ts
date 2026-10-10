/**
 * Meta (Facebook) Pixel & Event Manager Standard Events Helper
 * Conforming to Meta Pixel standard event specifications:
 * https://eventsmanager.facebook.com/business/help/402791146561655?id=1205376682832142
 */

export const FB_PIXEL_ID =
  process.env.NEXT_PUBLIC_FACEBOOK_PIXEL_ID || ''

declare global {
  interface Window {
    fbq?: (...args: any[]) => void
    _fbq?: any
  }
}

/**
 * Trigger standard PageView event.
 */
export function pageview(): void {
  if (typeof window !== 'undefined' && typeof window.fbq === 'function') {
    window.fbq('track', 'PageView')
  }
}

/**
 * Trigger custom or standard Meta Pixel event.
 */
export function event(name: string, options: Record<string, any> = {}): void {
  if (typeof window !== 'undefined' && typeof window.fbq === 'function') {
    window.fbq('track', name, options)
  }
}

/**
 * Track CompleteRegistration standard event when a trader creates an account.
 */
export function trackRegistration(options?: { method?: string; status?: string }): void {
  event('CompleteRegistration', {
    content_name: 'trader_signup',
    status: options?.status || 'success',
    method: options?.method || 'email',
  })
}

/**
 * Track InitiateCheckout standard event when a trader enters checkout with a plan.
 */
export function trackInitiateCheckout(options: {
  content_name: string
  value: number
  currency?: string
  content_ids?: (string | number)[]
}): void {
  event('InitiateCheckout', {
    content_name: options.content_name,
    value: Number(options.value) || 0,
    currency: options.currency || 'USD',
    content_ids: options.content_ids ? options.content_ids.map(String) : [],
    num_items: 1,
  })
}

/**
 * Track Purchase standard event when payment is confirmed / approved.
 */
export function trackPurchase(options: {
  order_id?: string | number
  content_name: string
  value: number
  currency?: string
}): void {
  event('Purchase', {
    order_id: options.order_id ? String(options.order_id) : undefined,
    content_name: options.content_name,
    value: Number(options.value) || 0,
    currency: options.currency || 'USD',
  })
}

/**
 * Track Lead standard event when a visitor submits contact form or newsletter.
 */
export function trackLead(options?: { content_name?: string; value?: number; currency?: string }): void {
  event('Lead', {
    content_name: options?.content_name || 'lead_capture',
    value: options?.value || 0,
    currency: options?.currency || 'USD',
  })
}

/**
 * Track ViewContent standard event when a trader views a challenge plan or evaluation tier.
 */
export function trackViewContent(options: {
  content_name: string
  value?: number
  currency?: string
  content_type?: string
}): void {
  event('ViewContent', {
    content_name: options.content_name,
    value: Number(options.value) || 0,
    currency: options.currency || 'USD',
    content_type: options.content_type || 'challenge_plan',
  })
}

/**
 * Track Contact standard event when support or live chat is contacted.
 */
export function trackContact(options?: { content_name?: string }): void {
  event('Contact', {
    content_name: options?.content_name || 'support_inquiry',
  })
}
