import { create } from 'zustand'

interface CopilotStore {
  isOpen: boolean
  isMinimized: boolean
  activeTab: 'chat' | 'calculator' | 'headroom' | 'news' | 'journal'
  setIsOpen: (isOpen: boolean) => void
  toggleOpen: () => void
  setIsMinimized: (isMinimized: boolean) => void
  setActiveTab: (tab: 'chat' | 'calculator' | 'headroom' | 'news' | 'journal') => void
}

export const useCopilotStore = create<CopilotStore>((set) => ({
  isOpen: false,
  isMinimized: false,
  activeTab: 'chat',
  setIsOpen: (isOpen) => set({ isOpen, isMinimized: false }),
  toggleOpen: () => set((state) => ({ isOpen: !state.isOpen, isMinimized: false })),
  setIsMinimized: (isMinimized) => set({ isMinimized }),
  setActiveTab: (activeTab) => set({ activeTab, isOpen: true, isMinimized: false }),
}))
