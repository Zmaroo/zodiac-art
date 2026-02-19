import { useState } from 'react'

type UseEditorMessagesResult = {
  error: string
  status: string
  setError: (value: string) => void
  setStatus: (value: string) => void
  clearError: () => void
  clearStatus: () => void
}

export function useEditorMessages(): UseEditorMessagesResult {
  const [error, setError] = useState('')
  const [status, setStatus] = useState('')

  const clearError = () => setError('')
  const clearStatus = () => setStatus('')

  return { error, status, setError, setStatus, clearError, clearStatus }
}
