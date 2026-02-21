import { useEffect, useState } from 'react'

type Parser<T> = (raw: string) => T
type Serializer<T> = (value: T) => string

export function usePersistedState<T>(
  key: string,
  defaultValue: T,
  parse?: Parser<T>,
  serialize?: Serializer<T>
): [T, (value: T) => void] {
  const [value, setValue] = useState<T>(() => {
    const raw = localStorage.getItem(key)
    if (raw === null) {
      return defaultValue
    }
    return parse ? parse(raw) : (raw as unknown as T)
  })

  useEffect(() => {
    const serialized = serialize ? serialize(value) : String(value)
    localStorage.setItem(key, serialized)
  }, [key, value, serialize])

  return [value, setValue]
}
