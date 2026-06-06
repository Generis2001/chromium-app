import type { DynamicIslandData, DynamicIslandState } from '@/types'

export type { DynamicIslandData, DynamicIslandState }

export type IslandContext = {
  state: DynamicIslandState
  data: DynamicIslandData | null
  expand: () => void
  collapse: () => void
  setState: (state: DynamicIslandState, data?: DynamicIslandData) => void
}
