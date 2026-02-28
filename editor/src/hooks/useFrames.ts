import { useCallback, useEffect, useMemo, useState } from 'react'
import { apiFetch, fetchJsonAuth, readApiError } from '../api/client'
import type { FrameEntry } from '../types'

type UseFramesResult = {
  frames: FrameEntry[]
  selectedId: string
  setSelectedId: (value: string) => void
  frameSearch: string
  setFrameSearch: (value: string) => void
  filteredFrames: FrameEntry[]
  error: string
  status: string
  deleteFrame: (frameIdToDelete: string) => Promise<void>
  reload: () => void
  clearError: () => void
  clearStatus: () => void
}

export function useFrames(apiBase: string, jwt: string): UseFramesResult {
  const [frames, setFrames] = useState<FrameEntry[]>([])
  const [selectedId, setSelectedId] = useState<string>(
    () => localStorage.getItem('zodiac_editor.frameId') ?? ''
  )
  const [frameSearch, setFrameSearch] = useState('')
  const [error, setError] = useState('')
  const [status, setStatus] = useState('')

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
    status,
    deleteFrame: async (frameIdToDelete: string) => {
      if (!jwt) {
        setError('Login required to delete frames.')
        return
      }
      if (!frameIdToDelete || frameIdToDelete === '__chart_only__') {
        setError('Select a frame to delete.')
        return
      }
      const response = await apiFetch(`${apiBase}/api/dev/tools/frame/delete`, jwt, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ frame_id: frameIdToDelete }),
      })
      if (!response.ok) {
        const detail = await readApiError(response)
        setError(detail ?? 'Failed to delete frame.')
        setStatus('')
        return
      }
      if (selectedId === frameIdToDelete) {
        localStorage.removeItem('zodiac_editor.frameId')
      }
      setError('')
      setStatus(`Deleted frame ${frameIdToDelete}`)
      loadFrames()
    },
    reload: loadFrames,
    clearError: () => setError(''),
    clearStatus: () => setStatus(''),
  }
}
