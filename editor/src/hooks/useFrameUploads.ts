import { useState } from 'react'
import { apiFetch, readApiError } from '../api/client'
import type { User } from '../types'

type UseFrameUploadsParams = {
  apiBase: string
  jwt: string
  user: User | null
  reloadFrames: () => void
  setSelectedId: (value: string) => void
}

export function useFrameUploads(params: UseFrameUploadsParams) {
  const { apiBase, jwt, user, reloadFrames, setSelectedId } = params
  const [uploadName, setUploadName] = useState('')
  const [uploadTags, setUploadTags] = useState('')
  const [uploadFile, setUploadFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [uploadGlobal, setUploadGlobal] = useState(false)
  const [uploadError, setUploadError] = useState('')
  const [uploadStatus, setUploadStatus] = useState('')

  const apiFetchWithAuth = (url: string, init: RequestInit = {}) => apiFetch(url, jwt, init)

  const uploadFrame = async () => {
    if (!jwt) {
      setUploadError('Login required to upload frames.')
      return
    }
    if (!uploadFile) {
      setUploadError('Select an image to upload.')
      return
    }
    if (!uploadName.trim()) {
      setUploadError('Frame name is required.')
      return
    }
    setUploading(true)
    setUploadError('')
    setUploadStatus('Uploading frame...')
    try {
      const formData = new FormData()
      formData.append('file', uploadFile)
      formData.append('name', uploadName.trim())
      if (uploadTags.trim()) {
        formData.append('tags', uploadTags.trim())
      }
      if (uploadGlobal && !user?.is_admin) {
        setUploadError('Admin required to publish globally.')
        setUploadStatus('')
        return
      }
      if (uploadGlobal && user?.is_admin) {
        formData.append('global_frame', 'true')
      }
      const response = await apiFetchWithAuth(`${apiBase}/api/frames`, {
        method: 'POST',
        body: formData,
      })
      if (!response.ok) {
        const detail = await readApiError(response)
        setUploadError(detail ?? 'Failed to upload frame.')
        setUploadStatus('')
        return
      }
      const data = (await response.json()) as { id: string; name: string }
      setUploadStatus(`Uploaded frame ${data.name}`)
      setUploadFile(null)
      setUploadName('')
      setUploadTags('')
      setUploadGlobal(false)
      reloadFrames()
      setSelectedId(data.id)
    } finally {
      setUploading(false)
    }
  }

  return {
    uploadName,
    setUploadName,
    uploadTags,
    setUploadTags,
    uploadFile,
    setUploadFile,
    uploading,
    uploadGlobal,
    setUploadGlobal,
    uploadFrame,
    uploadError,
    uploadStatus,
    clearUploadMessages: () => {
      setUploadError('')
      setUploadStatus('')
    },
  }
}
