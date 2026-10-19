'use client'

import * as React from 'react'
import { useState, useRef, useEffect, useMemo, useId } from 'react'
import { ChevronDown, Search, Check, X } from 'lucide-react'
import { cn } from '@/lib/cn'

export interface CountryData {
  code: string        // ISO 3166-1 alpha-2, e.g. 'PK'
  name: string        // e.g. 'Pakistan'
  dialCode: string    // e.g. '+92'
  flag: string        // e.g. '🇵🇰'
  placeholder: string // e.g. '300 1234567'
  aliases?: string[]  // Search aliases e.g. ['uae', 'dubai', 'emirates']
}

/**
 * Authoritative global trading country dataset.
 * Top trading countries (mandated by client & system plan) are pinned at the top,
 * followed by major regional international trading destinations.
 */
export const COUNTRIES: CountryData[] = [
  // ── Mandated Top Trading Countries ──
  { code: 'PK', name: 'Pakistan', dialCode: '+92', flag: '🇵🇰', placeholder: '300 1234567', aliases: ['pakistan', 'pk', 'karachi', 'lahore', 'islamabad'] },
  { code: 'AE', name: 'United Arab Emirates', dialCode: '+971', flag: '🇦🇪', placeholder: '50 123 4567', aliases: ['uae', 'emirates', 'dubai', 'abu dhabi', 'sharjah'] },
  { code: 'SA', name: 'Saudi Arabia', dialCode: '+966', flag: '🇸🇦', placeholder: '50 123 4567', aliases: ['ksa', 'saudi', 'riyadh', 'jeddah', 'mecca', 'medina'] },
  { code: 'GB', name: 'United Kingdom', dialCode: '+44', flag: '🇬🇧', placeholder: '7911 123456', aliases: ['uk', 'britain', 'great britain', 'england', 'scotland', 'wales', 'london'] },
  { code: 'US', name: 'United States', dialCode: '+1', flag: '🇺🇸', placeholder: '202 555 0123', aliases: ['usa', 'america', 'united states'] },
  { code: 'CA', name: 'Canada', dialCode: '+1', flag: '🇨🇦', placeholder: '416 555 0123', aliases: ['canada', 'toronto', 'vancouver', 'montreal'] },
  { code: 'IN', name: 'India', dialCode: '+91', flag: '🇮🇳', placeholder: '98123 45678', aliases: ['bharat', 'hindustan', 'delhi', 'mumbai'] },
  { code: 'TR', name: 'Turkey', dialCode: '+90', flag: '🇹🇷', placeholder: '532 123 4567', aliases: ['turkiye', 'istanbul', 'ankara'] },
  { code: 'QA', name: 'Qatar', dialCode: '+974', flag: '🇶🇦', placeholder: '3312 3456', aliases: ['doha'] },
  { code: 'OM', name: 'Oman', dialCode: '+968', flag: '🇴🇲', placeholder: '9123 4567', aliases: ['muscat'] },
  { code: 'KW', name: 'Kuwait', dialCode: '+965', flag: '🇰🇼', placeholder: '5123 4567', aliases: ['kuwait city'] },
  { code: 'BH', name: 'Bahrain', dialCode: '+973', flag: '🇧🇭', placeholder: '3612 3456', aliases: ['manama'] },
  { code: 'MY', name: 'Malaysia', dialCode: '+60', flag: '🇲🇾', placeholder: '12 345 6789', aliases: ['kuala lumpur'] },
  { code: 'SG', name: 'Singapore', dialCode: '+65', flag: '🇸🇬', placeholder: '8123 4567', aliases: ['singapore'] },
  { code: 'AU', name: 'Australia', dialCode: '+61', flag: '🇦🇺', placeholder: '412 345 678', aliases: ['oz', 'aussie', 'sydney', 'melbourne'] },
  { code: 'DE', name: 'Germany', dialCode: '+49', flag: '🇩🇪', placeholder: '151 12345678', aliases: ['deutschland', 'berlin', 'frankfurt'] },
  { code: 'FR', name: 'France', dialCode: '+33', flag: '🇫🇷', placeholder: '6 12 34 56 78', aliases: ['paris', 'lyon'] },

  // ── Eurasia & CIS ──
  { code: 'KZ', name: 'Kazakhstan', dialCode: '+7', flag: '🇰🇿', placeholder: '771 234 5678', aliases: ['almaty', 'astana'] },
  { code: 'RU', name: 'Russia', dialCode: '+7', flag: '🇷🇺', placeholder: '912 345 6789', aliases: ['russian federation', 'moscow', 'russia'] },
  { code: 'UZ', name: 'Uzbekistan', dialCode: '+998', flag: '🇺🇿', placeholder: '90 123 45 67', aliases: ['tashkent'] },
  { code: 'AZ', name: 'Azerbaijan', dialCode: '+994', flag: '🇦🇿', placeholder: '50 123 45 67', aliases: ['baku'] },
  { code: 'GE', name: 'Georgia', dialCode: '+995', flag: '🇬🇪', placeholder: '555 12 34 56', aliases: ['tbilisi'] },
  { code: 'UA', name: 'Ukraine', dialCode: '+380', flag: '🇺🇦', placeholder: '50 123 4567', aliases: ['kyiv', 'kiev'] },

  // ── Middle East & North Africa ──
  { code: 'EG', name: 'Egypt', dialCode: '+20', flag: '🇪🇬', placeholder: '10 1234 5678', aliases: ['cairo', 'alexandria', 'misr'] },
  { code: 'JO', name: 'Jordan', dialCode: '+962', flag: '🇯🇴', placeholder: '7 9012 3456', aliases: ['amman'] },
  { code: 'LB', name: 'Lebanon', dialCode: '+961', flag: '🇱🇧', placeholder: '70 123 456', aliases: ['beirut'] },
  { code: 'IQ', name: 'Iraq', dialCode: '+964', flag: '🇮🇶', placeholder: '790 123 4567', aliases: ['baghdad'] },
  { code: 'MA', name: 'Morocco', dialCode: '+212', flag: '🇲🇦', placeholder: '612 345678', aliases: ['casablanca', 'rabat', 'marrakech'] },
  { code: 'DZ', name: 'Algeria', dialCode: '+213', flag: '🇩🇿', placeholder: '551 23 45 67', aliases: ['algiers'] },
  { code: 'TN', name: 'Tunisia', dialCode: '+216', flag: '🇹🇳', placeholder: '20 123 456', aliases: ['tunis'] },
  { code: 'LY', name: 'Libya', dialCode: '+218', flag: '🇱🇾', placeholder: '91 234 5678', aliases: ['tripoli'] },
  { code: 'YE', name: 'Yemen', dialCode: '+967', flag: '🇾🇪', placeholder: '71 234 567', aliases: ['sanaa'] },

  // ── Asia & Pacific ──
  { code: 'BD', name: 'Bangladesh', dialCode: '+880', flag: '🇧🇩', placeholder: '1712 345678', aliases: ['dhaka'] },
  { code: 'ID', name: 'Indonesia', dialCode: '+62', flag: '🇮🇩', placeholder: '812 3456 7890', aliases: ['jakarta', 'bali'] },
  { code: 'PH', name: 'Philippines', dialCode: '+63', flag: '🇵🇭', placeholder: '917 123 4567', aliases: ['manila'] },
  { code: 'VN', name: 'Vietnam', dialCode: '+84', flag: '🇻🇳', placeholder: '91 234 5678', aliases: ['hanoi', 'ho chi minh'] },
  { code: 'TH', name: 'Thailand', dialCode: '+66', flag: '🇹🇭', placeholder: '81 234 5678', aliases: ['bangkok'] },
  { code: 'JP', name: 'Japan', dialCode: '+81', flag: '🇯🇵', placeholder: '90 1234 5678', aliases: ['nippon', 'tokyo'] },
  { code: 'KR', name: 'South Korea', dialCode: '+82', flag: '🇰🇷', placeholder: '10 1234 5678', aliases: ['korea', 'seoul'] },
  { code: 'HK', name: 'Hong Kong', dialCode: '+852', flag: '🇭🇰', placeholder: '5123 4567', aliases: ['hk'] },
  { code: 'TW', name: 'Taiwan', dialCode: '+886', flag: '🇹🇼', placeholder: '912 345 678', aliases: ['taipei'] },
  { code: 'NZ', name: 'New Zealand', dialCode: '+64', flag: '🇳🇿', placeholder: '21 123 4567', aliases: ['kiwi', 'auckland'] },
  { code: 'LK', name: 'Sri Lanka', dialCode: '+94', flag: '🇱🇰', placeholder: '71 234 5678', aliases: ['colombo'] },
  { code: 'NP', name: 'Nepal', dialCode: '+977', flag: '🇳🇵', placeholder: '984 1234567', aliases: ['kathmandu'] },
  { code: 'CN', name: 'China', dialCode: '+86', flag: '🇨🇳', placeholder: '138 0013 8000', aliases: ['beijing', 'shanghai'] },

  // ── Europe ──
  { code: 'NL', name: 'Netherlands', dialCode: '+31', flag: '🇳🇱', placeholder: '6 12345678', aliases: ['holland', 'amsterdam'] },
  { code: 'ES', name: 'Spain', dialCode: '+34', flag: '🇪🇸', placeholder: '612 34 56 78', aliases: ['espana', 'madrid', 'barcelona'] },
  { code: 'IT', name: 'Italy', dialCode: '+39', flag: '🇮🇹', placeholder: '312 345 6789', aliases: ['italia', 'rome', 'milan'] },
  { code: 'CH', name: 'Switzerland', dialCode: '+41', flag: '🇨🇭', placeholder: '78 123 45 67', aliases: ['swiss', 'zurich', 'geneva'] },
  { code: 'SE', name: 'Sweden', dialCode: '+46', flag: '🇸🇪', placeholder: '70 123 45 67', aliases: ['stockholm'] },
  { code: 'NO', name: 'Norway', dialCode: '+47', flag: '🇳🇴', placeholder: '412 34 567', aliases: ['oslo'] },
  { code: 'DK', name: 'Denmark', dialCode: '+45', flag: '🇩🇰', placeholder: '20 12 34 56', aliases: ['copenhagen'] },
  { code: 'PL', name: 'Poland', dialCode: '+48', flag: '🇵🇱', placeholder: '512 345 678', aliases: ['polska', 'warsaw'] },
  { code: 'IE', name: 'Ireland', dialCode: '+353', flag: '🇮🇪', placeholder: '85 123 4567', aliases: ['dublin'] },
  { code: 'BE', name: 'Belgium', dialCode: '+32', flag: '🇧🇪', placeholder: '470 12 34 56', aliases: ['brussels'] },
  { code: 'AT', name: 'Austria', dialCode: '+43', flag: '🇦🇹', placeholder: '664 1234567', aliases: ['vienna'] },
  { code: 'PT', name: 'Portugal', dialCode: '+351', flag: '🇵🇹', placeholder: '912 345 678', aliases: ['lisbon'] },
  { code: 'GR', name: 'Greece', dialCode: '+30', flag: '🇬🇷', placeholder: '691 234 5678', aliases: ['athens'] },
  { code: 'RO', name: 'Romania', dialCode: '+40', flag: '🇷🇴', placeholder: '712 345 678', aliases: ['bucharest'] },
  { code: 'CZ', name: 'Czech Republic', dialCode: '+420', flag: '🇨🇿', placeholder: '601 123 456', aliases: ['czechia', 'prague'] },
  { code: 'HU', name: 'Hungary', dialCode: '+36', flag: '🇭🇺', placeholder: '20 123 4567', aliases: ['budapest'] },
  { code: 'CY', name: 'Cyprus', dialCode: '+357', flag: '🇨🇾', placeholder: '96 123456', aliases: ['nicosia'] },
  { code: 'MT', name: 'Malta', dialCode: '+356', flag: '🇲🇹', placeholder: '7912 3456', aliases: ['valletta'] },
  { code: 'LU', name: 'Luxembourg', dialCode: '+352', flag: '🇱🇺', placeholder: '621 123 456', aliases: ['luxembourg'] },
  { code: 'FI', name: 'Finland', dialCode: '+358', flag: '🇫🇮', placeholder: '41 2345678', aliases: ['helsinki'] },
  { code: 'EE', name: 'Estonia', dialCode: '+372', flag: '🇪🇪', placeholder: '512 3456', aliases: ['tallinn'] },
  { code: 'LV', name: 'Latvia', dialCode: '+371', flag: '🇱🇻', placeholder: '21 234 567', aliases: ['riga'] },
  { code: 'LT', name: 'Lithuania', dialCode: '+370', flag: '🇱🇹', placeholder: '612 34567', aliases: ['vilnius'] },
  { code: 'SK', name: 'Slovakia', dialCode: '+421', flag: '🇸🇰', placeholder: '912 345 678', aliases: ['bratislava'] },
  { code: 'SI', name: 'Slovenia', dialCode: '+386', flag: '🇸🇮', placeholder: '31 234 567', aliases: ['ljubljana'] },
  { code: 'HR', name: 'Croatia', dialCode: '+385', flag: '🇭🇷', placeholder: '91 234 5678', aliases: ['zagreb'] },
  { code: 'BG', name: 'Bulgaria', dialCode: '+359', flag: '🇧🇬', placeholder: '87 123 4567', aliases: ['sofia'] },
  { code: 'RS', name: 'Serbia', dialCode: '+381', flag: '🇷🇸', placeholder: '60 1234567', aliases: ['belgrade'] },

  // ── Africa ──
  { code: 'NG', name: 'Nigeria', dialCode: '+234', flag: '🇳🇬', placeholder: '802 123 4567', aliases: ['lagos', 'abuja'] },
  { code: 'ZA', name: 'South Africa', dialCode: '+27', flag: '🇿🇦', placeholder: '71 123 4567', aliases: ['johannesburg', 'cape town'] },
  { code: 'KE', name: 'Kenya', dialCode: '+254', flag: '🇰🇪', placeholder: '712 345678', aliases: ['nairobi'] },
  { code: 'GH', name: 'Ghana', dialCode: '+233', flag: '🇬🇭', placeholder: '24 123 4567', aliases: ['accra'] },
  { code: 'UG', name: 'Uganda', dialCode: '+256', flag: '🇺🇬', placeholder: '712 345678', aliases: ['kampala'] },
  { code: 'TZ', name: 'Tanzania', dialCode: '+255', flag: '🇹🇿', placeholder: '712 345 678', aliases: ['dar es salaam'] },

  // ── Americas ──
  { code: 'BR', name: 'Brazil', dialCode: '+55', flag: '🇧🇷', placeholder: '11 91234 5678', aliases: ['brasil', 'sao paulo', 'rio'] },
  { code: 'MX', name: 'Mexico', dialCode: '+52', flag: '🇲🇽', placeholder: '55 1234 5678', aliases: ['mexico city'] },
  { code: 'CO', name: 'Colombia', dialCode: '+57', flag: '🇨🇴', placeholder: '300 123 4567', aliases: ['bogota', 'medellin'] },
  { code: 'AR', name: 'Argentina', dialCode: '+54', flag: '🇦🇷', placeholder: '9 11 1234 5678', aliases: ['buenos aires'] },
  { code: 'CL', name: 'Chile', dialCode: '+56', flag: '🇨🇱', placeholder: '9 1234 5678', aliases: ['santiago'] },
  { code: 'PE', name: 'Peru', dialCode: '+51', flag: '🇵🇪', placeholder: '912 345 678', aliases: ['lima'] },
]

/**
 * Auto-sanitizes raw user input into an authoritative E.164 international phone string.
 * Strips non-digit chars, removes leading 0s (e.g. 03001234567 -> 3001234567),
 * guards against duplicate dial-code prefixes without truncating valid national numbers,
 * and returns clean `+<dialCode><number>`.
 * Returns empty string if no valid digits were entered (prevents saving bare `+92`).
 */
export function sanitizePhoneNumber(dialCode: string, localNumber: string): string {
  const raw = (localNumber || '').trim()
  if (!raw) return ''

  // Keep only digits
  let digits = raw.replace(/\D/g, '')
  if (!digits) return ''

  // If user typed/pasted international '00' prefix, strip it first
  if (digits.startsWith('00')) {
    digits = digits.slice(2)
  }

  // Dial code numeric representation (e.g. '92' from '+92', '7' from '+7')
  const dialDigits = dialCode.replace(/\D/g, '')

  // Strip dialDigits ONLY if digits genuinely starts with dial code AND remaining digits form a full national number.
  // For single-digit dial codes (+7, +1), local numbers often start with 7 (e.g. Kazakhstan 771xxxxxxx).
  // Therefore, only strip single-digit dial code when digits.length >= 11 (dial code + 10-digit national number).
  if (dialDigits && digits.startsWith(dialDigits)) {
    const minLocalLen = dialDigits.length === 1 ? 10 : 7
    if (digits.length >= dialDigits.length + minLocalLen) {
      digits = digits.slice(dialDigits.length)
    }
  }

  // Strip all leading trunk zeros (e.g. 03001234567 -> 3001234567)
  digits = digits.replace(/^0+/, '')

  if (!digits) return ''

  const prefix = dialCode.startsWith('+') ? dialCode : `+${dialCode}`
  return `${prefix}${digits}`
}

/**
 * Parses an existing full E.164 phone string (or raw number) into matched Country and local number.
 */
export function parsePhoneNumber(
  value: string | undefined | null,
  defaultCountryCode = 'PK'
): { country: CountryData; localNumber: string } {
  const fallback = COUNTRIES.find((c) => c.code === defaultCountryCode) || COUNTRIES[0]

  if (!value || typeof value !== 'string') {
    return { country: fallback, localNumber: '' }
  }

  let clean = value.trim()
  if (!clean) {
    return { country: fallback, localNumber: '' }
  }

  // Normalize international 00 prefix to +
  if (clean.startsWith('00')) {
    clean = '+' + clean.slice(2)
  }

  if (clean.startsWith('+')) {
    // Sort by dial code length descending so longer codes (e.g. +971) match before +9
    const sorted = [...COUNTRIES].sort((a, b) => b.dialCode.length - a.dialCode.length)
    const match = sorted.find((c) => clean.startsWith(c.dialCode))
    if (match) {
      // If default country has same dial code (e.g. Canada CA vs USA US +1), preserve default
      const resolvedCountry = fallback.dialCode === match.dialCode ? fallback : match
      const rest = clean.slice(resolvedCountry.dialCode.length).trim().replace(/^0+/, '')
      return { country: resolvedCountry, localNumber: rest }
    }
  }

  // If no '+' prefix, strip leading 0s and pair with default country
  return { country: fallback, localNumber: clean.replace(/^0+/, '') }
}

export interface CountryPhoneInputProps {
  id?: string
  name?: string
  value?: string
  onChange?: (e164Value: string) => void
  onCountryChange?: (country: CountryData) => void
  disabled?: boolean
  required?: boolean
  autoFocus?: boolean
  placeholder?: string
  className?: string
  defaultCountryCode?: string
}

export const CountryPhoneInput = React.forwardRef<HTMLInputElement, CountryPhoneInputProps>(
  (
    {
      id,
      name = 'phone',
      value,
      onChange,
      onCountryChange,
      disabled = false,
      required = false,
      autoFocus = false,
      placeholder,
      className,
      defaultCountryCode = 'PK',
    },
    ref
  ) => {
    const listboxId = useId()
    const containerRef = useRef<HTMLDivElement>(null)
    const searchInputRef = useRef<HTMLInputElement>(null)
    const listRef = useRef<HTMLDivElement>(null)
    const internalInputRef = useRef<HTMLInputElement | null>(null)

    const [isOpen, setIsOpen] = useState(false)
    const [search, setSearch] = useState('')
    const [highlightedIndex, setHighlightedIndex] = useState(0)

    // Internal state initialized from props
    const [selectedCountry, setSelectedCountry] = useState<CountryData>(() => {
      return parsePhoneNumber(value, defaultCountryCode).country
    })
    const [localNumber, setLocalNumber] = useState<string>(() => {
      return parsePhoneNumber(value, defaultCountryCode).localNumber
    })

    // Synchronize if value prop updates externally
    useEffect(() => {
      if (value === undefined) return
      const currentSanitized = sanitizePhoneNumber(selectedCountry.dialCode, localNumber)
      if (value !== currentSanitized) {
        const parsed = parsePhoneNumber(value, defaultCountryCode)
        setSelectedCountry(parsed.country)
        setLocalNumber(parsed.localNumber)
      }
    }, [value, defaultCountryCode, selectedCountry.dialCode, localNumber])

    // Filter countries based on name, code, dial code, and aliases
    const filteredCountries = useMemo(() => {
      if (!search.trim()) return COUNTRIES
      const q = search.toLowerCase().trim()
      const qClean = q.replace(/^\+/, '')
      return COUNTRIES.filter((c) => {
        const nameMatch = c.name.toLowerCase().includes(q)
        const codeMatch = c.code.toLowerCase().includes(q)
        const dialMatch = c.dialCode.replace(/^\+/, '').includes(qClean)
        const aliasMatch = c.aliases?.some((a) => a.toLowerCase().includes(q))
        return nameMatch || codeMatch || dialMatch || aliasMatch
      })
    }, [search])

    // Reset highlighted index when search results change
    useEffect(() => {
      setHighlightedIndex(0)
    }, [filteredCountries])

    // Focus search input on open
    useEffect(() => {
      if (isOpen) {
        setTimeout(() => {
          searchInputRef.current?.focus()
        }, 30)
      } else {
        setSearch('')
      }
    }, [isOpen])

    // Close on click outside or Escape
    useEffect(() => {
      if (!isOpen) return

      const handleClickOutside = (e: MouseEvent | TouchEvent) => {
        if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
          setIsOpen(false)
        }
      }

      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
          e.preventDefault()
          setIsOpen(false)
          internalInputRef.current?.focus()
        }
      }

      document.addEventListener('mousedown', handleClickOutside)
      document.addEventListener('touchstart', handleClickOutside)
      document.addEventListener('keydown', handleKeyDown)
      return () => {
        document.removeEventListener('mousedown', handleClickOutside)
        document.removeEventListener('touchstart', handleClickOutside)
        document.removeEventListener('keydown', handleKeyDown)
      }
    }, [isOpen])

    const handleSelectCountry = (country: CountryData) => {
      setSelectedCountry(country)
      onCountryChange?.(country)
      setIsOpen(false)
      setSearch('')

      // Recalculate with new dial code and notify parent
      const sanitized = sanitizePhoneNumber(country.dialCode, localNumber)
      onChange?.(sanitized)

      // Return focus to number input for natural typing flow
      setTimeout(() => {
        internalInputRef.current?.focus()
      }, 50)
    }

    const handleLocalNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const inputVal = e.target.value
      const trimmed = inputVal.trim()

      // If user pasted full international number starting with '+' or '00'
      if (trimmed.startsWith('+') || trimmed.startsWith('00')) {
        const normalized = trimmed.startsWith('00') ? '+' + trimmed.slice(2) : trimmed
        const parsed = parsePhoneNumber(normalized, selectedCountry.code)
        setSelectedCountry(parsed.country)
        setLocalNumber(parsed.localNumber)
        const sanitized = sanitizePhoneNumber(parsed.country.dialCode, parsed.localNumber)
        onChange?.(sanitized)
        return
      }

      // Filter to numbers, spaces, and hyphens
      const allowed = inputVal.replace(/[^\d\s\-()]/g, '')
      setLocalNumber(allowed)

      const sanitized = sanitizePhoneNumber(selectedCountry.dialCode, allowed)
      onChange?.(sanitized)
    }

    const handleBlur = () => {
      // Clean up display on blur: remove redundant dial code and leading zeros
      let cleaned = localNumber.trim()
      const dialDigits = selectedCountry.dialCode.replace(/\D/g, '')
      const digitsOnly = cleaned.replace(/\D/g, '')

      const minLocalLen = dialDigits.length === 1 ? 10 : 7
      if (dialDigits && digitsOnly.startsWith(dialDigits) && digitsOnly.length >= dialDigits.length + minLocalLen) {
        cleaned = digitsOnly.slice(dialDigits.length)
      }
      cleaned = cleaned.replace(/^0+/, '')

      if (cleaned !== localNumber) {
        setLocalNumber(cleaned)
        const sanitized = sanitizePhoneNumber(selectedCountry.dialCode, cleaned)
        onChange?.(sanitized)
      }
    }

    // Keyboard navigation inside search dropdown
    const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setHighlightedIndex((prev) => (prev < filteredCountries.length - 1 ? prev + 1 : 0))
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : filteredCountries.length - 1))
      } else if (e.key === 'Enter') {
        e.preventDefault()
        const selected = filteredCountries[highlightedIndex]
        if (selected) {
          handleSelectCountry(selected)
        }
      }
    }

    // Scroll highlighted item into view
    useEffect(() => {
      if (!isOpen || !listRef.current) return
      const activeEl = listRef.current.children[highlightedIndex] as HTMLElement
      if (activeEl) {
        activeEl.scrollIntoView({ block: 'nearest' })
      }
    }, [highlightedIndex, isOpen])

    return (
      <div ref={containerRef} className={cn('relative w-full', className)}>
        {/* Main Input Control Frame */}
        <div
          className={cn(
            'flex h-10 w-full items-center rounded-lg border border-border bg-surface shadow-sm transition-all duration-150',
            'hover:border-border-strong',
            'focus-within:border-accent focus-within:ring-1 focus-within:ring-accent/20',
            disabled && 'opacity-60 cursor-not-allowed bg-surface-muted/50'
          )}
        >
          {/* Country Trigger Button */}
          <button
            type="button"
            disabled={disabled}
            onClick={() => setIsOpen((prev) => !prev)}
            aria-haspopup="listbox"
            aria-expanded={isOpen}
            aria-controls={listboxId}
            aria-label={`Select country code. Current: ${selectedCountry.name} (${selectedCountry.dialCode})`}
            className={cn(
              'group inline-flex items-center gap-1.5 h-full px-3 text-xs sm:text-sm font-medium border-r border-border',
              'text-text select-none cursor-pointer rounded-l-lg shrink-0 transition-colors',
              'hover:bg-surface-muted/70 focus:outline-none focus-visible:bg-surface-muted/70',
              disabled && 'pointer-events-none'
            )}
            title={`Selected: ${selectedCountry.name} (${selectedCountry.dialCode})`}
          >
            <span className="text-base leading-none select-none" aria-hidden="true">
              {selectedCountry.flag}
            </span>
            <span className="font-mono text-xs font-semibold tabular-nums text-text">
              {selectedCountry.dialCode}
            </span>
            <ChevronDown
              className={cn(
                'h-3.5 w-3.5 text-text-muted transition-transform duration-200 shrink-0',
                isOpen && 'rotate-180 text-accent'
              )}
            />
          </button>

          {/* Local Phone Number Input */}
          <input
            ref={(node) => {
              internalInputRef.current = node
              if (typeof ref === 'function') ref(node)
              else if (ref) (ref as React.MutableRefObject<HTMLInputElement | null>).current = node
            }}
            id={id}
            name={name}
            type="tel"
            autoComplete="tel-national"
            disabled={disabled}
            required={required}
            autoFocus={autoFocus}
            value={localNumber}
            onChange={handleLocalNumberChange}
            onBlur={handleBlur}
            placeholder={placeholder || selectedCountry.placeholder}
            className={cn(
              'flex-1 h-full bg-transparent px-3 py-2 text-sm text-text tabular-nums font-normal',
              'placeholder:text-text-muted focus:outline-none',
              'disabled:cursor-not-allowed disabled:opacity-50'
            )}
          />
        </div>

        {/* Searchable Dropdown Popover */}
        {isOpen && (
          <div
            id={listboxId}
            role="listbox"
            aria-label="Select country"
            className={cn(
              'absolute left-0 top-full mt-1.5 w-full min-w-[280px] sm:w-[320px] max-w-[340px]',
              'rounded-xl bg-surface border border-border shadow-2xl backdrop-blur-xl p-2 z-50',
              'flex flex-col gap-1.5 animate-in fade-in-0 zoom-in-95 duration-150'
            )}
          >
            {/* Search Filter Header */}
            <div className="relative flex items-center">
              <Search className="absolute left-2.5 h-3.5 w-3.5 text-text-muted pointer-events-none" />
              <input
                ref={searchInputRef}
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={handleSearchKeyDown}
                placeholder="Search country or dial code..."
                aria-label="Search countries"
                className={cn(
                  'w-full h-8 pl-8 pr-7 text-xs bg-surface-muted border border-border rounded-lg',
                  'text-text placeholder:text-text-muted/70',
                  'focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent/20'
                )}
              />
              {search && (
                <button
                  type="button"
                  onClick={() => {
                    setSearch('')
                    searchInputRef.current?.focus()
                  }}
                  className="absolute right-2 text-text-muted hover:text-text transition-colors p-0.5 cursor-pointer"
                  title="Clear search"
                  aria-label="Clear search"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            {/* Countries List */}
            <div
              ref={listRef}
              className="max-h-60 overflow-y-auto space-y-0.5 custom-scrollbar pr-0.5 divide-y divide-border/20"
            >
              {filteredCountries.length === 0 ? (
                <div className="py-6 text-center text-xs text-text-muted">
                  No matching countries found
                </div>
              ) : (
                filteredCountries.map((c, index) => {
                  const isSelected = c.code === selectedCountry.code
                  const isHighlighted = index === highlightedIndex

                  return (
                    <button
                      key={`${c.code}-${c.dialCode}`}
                      type="button"
                      role="option"
                      aria-selected={isSelected}
                      onClick={() => handleSelectCountry(c)}
                      onMouseEnter={() => setHighlightedIndex(index)}
                      className={cn(
                        'w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-xs font-medium',
                        'transition-colors cursor-pointer text-left',
                        isSelected
                          ? 'bg-accent/10 text-accent font-semibold'
                          : isHighlighted
                          ? 'bg-surface-muted text-text'
                          : 'text-text hover:bg-surface-muted'
                      )}
                    >
                      <div className="flex items-center gap-2 min-w-0 pr-2">
                        <span className="text-base shrink-0 leading-none" aria-hidden="true">
                          {c.flag}
                        </span>
                        <span className="truncate max-w-[150px] sm:max-w-[180px]">
                          {c.name}
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0 ml-auto">
                        <span className="font-mono text-xs tabular-nums text-text-muted">
                          {c.dialCode}
                        </span>
                        {isSelected && (
                          <Check className="h-3.5 w-3.5 text-accent shrink-0" />
                        )}
                      </div>
                    </button>
                  )
                })
              )}
            </div>
          </div>
        )}
      </div>
    )
  }
)

CountryPhoneInput.displayName = 'CountryPhoneInput'
