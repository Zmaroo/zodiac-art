import { useCallback, useEffect, useMemo, useState } from 'react'
import { fetchJsonAuth } from '../api/client'
import type { FrameEntry } from '../types'

type UseFramesResult = {
  frames: FrameEntry[]
  selectedId: string
  setSelectedId: (value: string) => void
  frameSearch: string
  setFrameSearch: (value: string) => void
  filteredFrames: FrameEntry[]
  error: string
  reload: () => void
  clearError: () => void
}

export function useFrames(apiBase: string, jwt: string): UseFramesResult {
  const [frames, setFrames] = useState<FrameEntry[]>([])
  const [selectedId, setSelectedId] = useState<string>(
    () => localStorage.getItem('zodiac_editor.frameId') ?? ''
  )
  const [frameSearch, setFrameSearch] = useState('')
  const [error, setError] = useState('')

  const loadFrames = useCallback(() => {
    fetchJsonAuth(`${apiBase}/api/frames`, jwt)
      .then((data: FrameEntry[]) => {
        setFrames(data)
        if (data.length > 0) {
          const saved = localStorage.getItem('zodiac_editor.frameId')
          const exists = saved && data.some((frame) => frame.id === saved)
          if (exists) {
            setSelectedId(saved as string)
          } else if (saved === '__chart_only__') {
            setSelectedId(saved)
          } else {
            setSelectedId(data[0].id)
          }
        }
      })
      .catch((err) => setError(String(err)))
  }, [apiBase, jwt])

  useEffect(() => {
    loadFrames()
  }, [loadFrames])

  useEffect(() => {
    localStorage.setItem('zodiac_editor.frameId', selectedId)
  }, [selectedId])

  const filteredFrames = useMemo(() => {
    const search = frameSearch.trim().toLowerCase()
    return frames.filter((frame) => {
      if (!search) {
        return true
      }
      const nameMatch = frame.name.toLowerCase().includes(search)
      const tagMatch = frame.tags.some((entry) => entry.toLowerCase().includes(search))
      return nameMatch || tagMatch
    })
  }, [frames, frameSearch])

  return {
    frames,
    selectedId,
    setSelectedId,
    frameSearch,
    setFrameSearch,
    filteredFrames,
    error,
    reload: loadFrames,
    clearError: () => setError(''),
  }
}
