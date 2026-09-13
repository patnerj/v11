import { TradingScreenLoader } from '@/components/ui/trading-loader'

export default function ArenaLoading() {
  return (
    <TradingScreenLoader
      fullscreen={false}
      label="Loading 1v1 Trader Arena"
      subtitle="Connecting to PvP matchmaker, live gladiators, and prize pools..."
    />
  )
}
