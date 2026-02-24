import type { Dispatch } from 'react'
import type { ChartFit, DesignSettings, FrameCircle, User } from '../types'
import type { EditorAction } from '../state/editorReducer'

type UseEditorSessionActionsParams = {
  birthDate: string
  birthTime: string
  latitude: number
  longitude: number
  setBirthDate: (value: string) => void
  setBirthTime: (value: string) => void
  setLatitude: (value: number) => void
  setLongitude: (value: number) => void
  setChartId: (value: string) => void
  setChartName: (value: string) => void
  setApiBase: (value: string) => void
  setJwt: (value: string) => void
  setUser: (value: User | null) => void
  createChart: (payload: {
    birthDate: string
    birthTime: string
    latitude: number
    longitude: number
  }) => Promise<void>
  login: () => Promise<void>
  register: () => Promise<void>
  logout: () => void
  uploadFrame: () => Promise<void>
  clearAuthMessages: () => void
  clearChartsMessages: () => void
  clearUploadMessages: () => void
  clearActionsMessages: () => void
  defaultApiBase: string
  defaultChartFit: ChartFit
  defaultDesign: DesignSettings
  dispatch: Dispatch<EditorAction>
  setFrameCircle: (value: FrameCircle | null) => void
  setStatus: (value: string) => void
  setError: (value: string) => void
}

type UseEditorSessionActionsResult = {
  handleCreateChart: () => Promise<void>
  handleLoginClick: () => Promise<void>
  handleRegisterClick: () => Promise<void>
  handleUploadFrame: () => Promise<void>
  handleLogout: () => void
  handleResetSession: () => void
  handleFactoryReset: () => void
}

export function useEditorSessionActions(
  params: UseEditorSessionActionsParams
): UseEditorSessionActionsResult {
  const {
    birthDate,
    birthTime,
    latitude,
    longitude,
    setBirthDate,
    setBirthTime,
    setLatitude,
    setLongitude,
    setChartId,
    setChartName,
    setApiBase,
    setJwt,
    setUser,
    createChart,
    login,
    register,
    logout,
    uploadFrame,
    clearAuthMessages,
    clearChartsMessages,
    clearUploadMessages,
    clearActionsMessages,
    defaultApiBase,
    defaultChartFit,
    defaultDesign,
    dispatch,
    setFrameCircle,
    setStatus,
    setError,
  } = params

  const handleCreateChart = async () => {
    clearChartsMessages()
    await createChart({ birthDate, birthTime, latitude, longitude })
  }

  const handleLoginClick = async () => {
    clearAuthMessages()
    await login()
  }

  const handleRegisterClick = async () => {
    clearAuthMessages()
    await register()
  }

  const handleUploadFrame = async () => {
    clearUploadMessages()
    await uploadFrame()
  }

  const handleLogout = () => {
    clearAuthMessages()
    logout()
    setChartId('')
    setChartName('')
    localStorage.removeItem('zodiac_editor.chartId')
  }

  const handleResetSession = () => {
    clearActionsMessages()
    localStorage.removeItem('zodiac_editor.chartId')
    localStorage.removeItem('zodiac_editor.birthDate')
    localStorage.removeItem('zodiac_editor.birthTime')
    localStorage.removeItem('zodiac_editor.latitude')
    localStorage.removeItem('zodiac_editor.longitude')
    setBirthDate('1990-04-12')
    setBirthTime('08:45')
    setLatitude(40.7128)
    setLongitude(-74.006)
    setChartId('')
    setChartName('')
    dispatch({ type: 'LOAD_LAYOUT', fit: defaultChartFit, overrides: {}, design: defaultDesign })
    setFrameCircle(null)
    setStatus('')
    setError('')
  }

  const handleFactoryReset = () => {
    clearActionsMessages()
    Object.keys(localStorage)
      .filter((key) => key.startsWith('zodiac_editor.'))
      .forEach((key) => localStorage.removeItem(key))
    setApiBase(defaultApiBase)
    setJwt('')
    setUser(null)
    setBirthDate('1990-04-12')
    setBirthTime('08:45')
    setLatitude(40.7128)
    setLongitude(-74.006)
    setChartId('')
    setChartName('')
    dispatch({ type: 'LOAD_LAYOUT', fit: defaultChartFit, overrides: {}, design: defaultDesign })
    setFrameCircle(null)
    setStatus('')
    setError('')
  }

  return {
    handleCreateChart,
    handleLoginClick,
    handleRegisterClick,
    handleUploadFrame,
    handleLogout,
    handleResetSession,
    handleFactoryReset,
  }
}
