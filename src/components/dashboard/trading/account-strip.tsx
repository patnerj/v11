'use client'

import { memo } from 'react'
import type { Account, ChallengeMetrics } from '@/types/api'

interface Props {
  account: Account | null
  /** Sum of open-position PnL — passed in so the parent owns the data flow. */
  openPnL?: number
  metrics?: ChallengeMetrics | null
  compact?: boolean
}

export const AccountStrip = memo(function AccountStrip(_props: Props) {
  return null
})
