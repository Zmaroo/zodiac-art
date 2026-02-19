import { useEffect, useRef, useState } from 'react'

export function useAutoDismissMessage(value: string, delayMs: number) {
  const [inlineValue, setInlineValue] = useState('')
  const timeoutRef = useRef<number | null>(null)

  useEffect(() => {
    if (!value) {
      return
    }
    setInlineValue(value)
    if (timeoutRef.current) {
      window.clearTimeout(timeoutRef.current)
    }
    timeoutRef.current = window.setTimeout(() => {
      setInlineValue('')
      timeoutRef.current = null
    }, delayMs)
  }, [delayMs, value])

  return inlineValue
}
