import { createContext, useContext, type ReactNode } from 'react'

type StoryboardHistoryContextValue = {
  takeSnapshot: () => void
}

const StoryboardHistoryContext =
  createContext<StoryboardHistoryContextValue | null>(null)

type StoryboardHistoryProviderProps = {
  takeSnapshot: () => void
  children: ReactNode
}

export function StoryboardHistoryProvider({
  takeSnapshot,
  children,
}: StoryboardHistoryProviderProps) {
  return (
    <StoryboardHistoryContext.Provider value={{ takeSnapshot }}>
      {children}
    </StoryboardHistoryContext.Provider>
  )
}

export function useStoryboardHistory(): StoryboardHistoryContextValue {
  const context = useContext(StoryboardHistoryContext)

  if (!context) {
    throw new Error(
      'useStoryboardHistory must be used within StoryboardHistoryProvider',
    )
  }

  return context
}
