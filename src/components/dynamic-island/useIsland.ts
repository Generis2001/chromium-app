'use client'

import React, { createContext, useCallback, useContext, useMemo, useState } from 'react'
import type { DynamicIslandData, DynamicIslandState, IslandContext } from './types'

// A sentinel default that will throw if used outside the provider
const defaultCtx: IslandContext = {
  state: 'idle',
  data: null,
  expand: () => {
    throw new Error('useIsland must be used inside <IslandProvider>')
  },
  collapse: () => {
    throw new Error('useIsland must be used inside <IslandProvider>')
  },
  setState: () => {
    throw new Error('useIsland must be used inside <IslandProvider>')
  },
}

// The React context object — named IslandCtx to avoid collision with the exported type
const IslandCtx = createContext<IslandContext>(defaultCtx)

// Re-export the React context object under the original name for components that need it
export { IslandCtx as IslandContext }

// ─── Provider ────────────────────────────────────────────────────────────────

export function IslandProvider({
  children,
}: {
  children: React.ReactNode
}): React.JSX.Element {
  const [state, setStateInternal] = useState<DynamicIslandState>('idle')
  const [data, setData] = useState<DynamicIslandData | null>(null)
  const [preExpandState, setPreExpandState] = useState<DynamicIslandState>('weather')

  const setState = useCallback(
    (nextState: DynamicIslandState, nextData?: DynamicIslandData) => {
      setStateInternal(nextState)
      if (nextData !== undefined) {
        setData(nextData)
      }
    },
    [],
  )

  const expand = useCallback(() => {
    setStateInternal((prev) => {
      setPreExpandState(prev)
      return 'expanded'
    })
  }, [])

  const collapse = useCallback(() => {
    setStateInternal((prev) => {
      if (prev === 'expanded') {
        return preExpandState
      }
      return prev
    })
  }, [preExpandState])

  const value = useMemo<IslandContext>(
    () => ({ state, data, expand, collapse, setState }),
    [state, data, expand, collapse, setState],
  )

  return React.createElement(IslandCtx.Provider, { value }, children)
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useIsland(): IslandContext {
  return useContext(IslandCtx)
}
