import { useEffect, useState } from 'react'

type UseChartInputsResult = {
  birthDate: string
  setBirthDate: (value: string) => void
  birthTime: string
  setBirthTime: (value: string) => void
  latitude: number
  setLatitude: (value: number) => void
  longitude: number
  setLongitude: (value: number) => void
}

export function useChartInputs(): UseChartInputsResult {
  const [birthDate, setBirthDate] = useState(
    () => localStorage.getItem('zodiac_editor.birthDate') ?? '1990-04-12'
  )
  const [birthTime, setBirthTime] = useState(
    () => localStorage.getItem('zodiac_editor.birthTime') ?? '08:45'
  )
  const [latitude, setLatitude] = useState(
    () => Number(localStorage.getItem('zodiac_editor.latitude') ?? 40.7128)
  )
  const [longitude, setLongitude] = useState(
    () => Number(localStorage.getItem('zodiac_editor.longitude') ?? -74.006)
  )

  useEffect(() => {
    localStorage.setItem('zodiac_editor.birthDate', birthDate)
    localStorage.setItem('zodiac_editor.birthTime', birthTime)
    localStorage.setItem('zodiac_editor.latitude', String(latitude))
    localStorage.setItem('zodiac_editor.longitude', String(longitude))
  }, [birthDate, birthTime, latitude, longitude])

  return {
    birthDate,
    setBirthDate,
    birthTime,
    setBirthTime,
    latitude,
    setLatitude,
    longitude,
    setLongitude,
  }
}
