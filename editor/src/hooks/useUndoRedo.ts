import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ChartFit, DesignSettings, Offset } from '../types'
import type { EditorAction } from '../state/editorReducer'

type Snapshot = {
  chartFit: ChartFit
  overrides: Record<string, Offset>
  design: DesignSettings
}

type UseUndoRedoParams = {
  chartFit: ChartFit
  overrides: Record<string, Offset>
  design: DesignSettings
  dispatch: (action: EditorAction) => void
  limit?: number
  resetKey?: string
}

type UseUndoRedoResult = {
  canUndo: boolean
  canRedo: boolean
  undo: () => void
  redo: () => void
}

const DEFAULT_LIMIT = 50

function cloneSnapshot(snapshot: Snapshot): Snapshot {
  return JSON.parse(JSON.stringify(snapshot)) as Snapshot
}

function isEqualSnapshot(a: Snapshot, b: Snapshot): boolean {
  return JSON.stringify(a) === JSON.stringify(b)
}

export function useUndoRedo({
  chartFit,
  overrides,
  design,
  dispatch,
  limit = DEFAULT_LIMIT,
  resetKey = '',
}: UseUndoRedoParams): UseUndoRedoResult {
  const pastRef = useRef<Snapshot[]>([])
  const futureRef = useRef<Snapshot[]>([])
  const applyingRef = useRef(false)
  const debounceRef = useRef<number | null>(null)
  const [canUndo, setCanUndo] = useState(false)
  const [canRedo, setCanRedo] = useState(false)
  const snapshot = useMemo(() => ({ chartFit, overrides, design }), [chartFit, overrides, design])
  const snapshotRef = useRef<Snapshot>(cloneSnapshot(snapshot))

  useEffect(() => {
    pastRef.current = []
    futureRef.current = []
    queueMicrotask(() => {
      setCanUndo(false)
      setCanRedo(false)
    })
  }, [resetKey])

  useEffect(() => {
    if (applyingRef.current) {
      snapshotRef.current = cloneSnapshot(snapshot)
      applyingRef.current = false
      return
    }
    if (isEqualSnapshot(snapshotRef.current, snapshot)) {
      return
    }
    if (debounceRef.current) {
      window.clearTimeout(debounceRef.current)
    }
    debounceRef.current = window.setTimeout(() => {
      pastRef.current.push(cloneSnapshot(snapshotRef.current))
      if (pastRef.current.length > limit) {
        pastRef.current.shift()
      }
      futureRef.current = []
      snapshotRef.current = cloneSnapshot(snapshot)
      setCanUndo(pastRef.current.length > 0)
      setCanRedo(false)
    }, 300)
  }, [limit, snapshot])

  const undo = useCallback(() => {
    const past = pastRef.current
    if (past.length === 0) {
      return
    }
    const previous = past.pop()
    if (!previous) {
      return
    }
    futureRef.current.push(cloneSnapshot(snapshotRef.current))
    applyingRef.current = true
    dispatch({ type: 'APPLY_SNAPSHOT', snapshot: previous })
    setCanUndo(past.length > 0)
    setCanRedo(true)
  }, [dispatch])

  const redo = useCallback(() => {
    const future = futureRef.current
    if (future.length === 0) {
      return
    }
    const next = future.pop()
    if (!next) {
      return
    }
    pastRef.current.push(cloneSnapshot(snapshotRef.current))
    applyingRef.current = true
    dispatch({ type: 'APPLY_SNAPSHOT', snapshot: next })
    setCanUndo(true)
    setCanRedo(future.length > 0)
  }, [dispatch])

  return {
    canUndo,
    canRedo,
    undo,
    redo,
  }
}
