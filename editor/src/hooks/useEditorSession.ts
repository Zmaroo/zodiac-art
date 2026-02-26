import { useAuth } from './useAuth'
import { useChartInputs } from './useChartInputs'
import { useCharts } from './useCharts'
import { useFrames } from './useFrames'

type UseEditorSessionResult = {
  defaultApiBase: string
  jwt: string
  user: ReturnType<typeof useAuth>['user']
  apiBase: string
  setApiBase: ReturnType<typeof useAuth>['setApiBase']
  authEmail: string
  setAuthEmail: ReturnType<typeof useAuth>['setAuthEmail']
  authPassword: string
  setAuthPassword: ReturnType<typeof useAuth>['setAuthPassword']
  login: ReturnType<typeof useAuth>['login']
  register: ReturnType<typeof useAuth>['register']
  logout: ReturnType<typeof useAuth>['logout']
  authError: string
  authStatus: string
  setJwt: ReturnType<typeof useAuth>['setJwt']
  setUser: ReturnType<typeof useAuth>['setUser']
  clearAuthError: ReturnType<typeof useAuth>['clearError']
  clearAuthStatus: ReturnType<typeof useAuth>['clearStatus']
  birthDate: string
  setBirthDate: ReturnType<typeof useChartInputs>['setBirthDate']
  birthTime: string
  setBirthTime: ReturnType<typeof useChartInputs>['setBirthTime']
  latitude: number
  setLatitude: ReturnType<typeof useChartInputs>['setLatitude']
  longitude: number
  setLongitude: ReturnType<typeof useChartInputs>['setLongitude']
  frames: ReturnType<typeof useFrames>['frames']
  selectedId: string
  setSelectedId: ReturnType<typeof useFrames>['setSelectedId']
  frameSearch: string
  setFrameSearch: ReturnType<typeof useFrames>['setFrameSearch']
  filteredFrames: ReturnType<typeof useFrames>['filteredFrames']
  framesError: string
  reloadFrames: ReturnType<typeof useFrames>['reload']
  clearFramesError: ReturnType<typeof useFrames>['clearError']
  charts: ReturnType<typeof useCharts>['charts']
  chartId: string
  setChartId: ReturnType<typeof useCharts>['setChartId']
  chartName: string
  setChartName: ReturnType<typeof useCharts>['setChartName']
  createChart: ReturnType<typeof useCharts>['createChart']
  selectChart: ReturnType<typeof useCharts>['selectChart']
  chartsError: string
  chartsStatus: string
  clearChartsError: ReturnType<typeof useCharts>['clearError']
  clearChartsStatus: ReturnType<typeof useCharts>['clearStatus']
}

export function useEditorSession(): UseEditorSessionResult {
  const defaultApiBase = import.meta.env.VITE_API_BASE_URL ?? 'http://127.0.0.1:8000'
  const {
    jwt,
    user,
    apiBase,
    setApiBase,
    authEmail,
    setAuthEmail,
    authPassword,
    setAuthPassword,
    login,
    register,
    logout,
    error: authError,
    status: authStatus,
    setJwt,
    setUser,
    clearError: clearAuthError,
    clearStatus: clearAuthStatus,
  } = useAuth(defaultApiBase)
  const { birthDate, setBirthDate, birthTime, setBirthTime, latitude, setLatitude, longitude, setLongitude } =
    useChartInputs()
  const {
    frames,
    selectedId,
    setSelectedId,
    frameSearch,
    setFrameSearch,
    filteredFrames,
    error: framesError,
    reload: reloadFrames,
    clearError: clearFramesError,
  } = useFrames(apiBase, jwt)
  const {
    charts,
    chartId,
    setChartId,
    chartName,
    setChartName,
    createChart,
    selectChart,
    error: chartsError,
    status: chartsStatus,
    clearError: clearChartsError,
    clearStatus: clearChartsStatus,
  } = useCharts({
    apiBase,
    jwt,
    selectedId,
    setSelectedId,
    setBirthDate,
    setBirthTime,
    setLatitude,
    setLongitude,
  })

  return {
    defaultApiBase,
    jwt,
    user,
    apiBase,
    setApiBase,
    authEmail,
    setAuthEmail,
    authPassword,
    setAuthPassword,
    login,
    register,
    logout,
    authError,
    authStatus,
    setJwt,
    setUser,
    clearAuthError,
    clearAuthStatus,
    birthDate,
    setBirthDate,
    birthTime,
    setBirthTime,
    latitude,
    setLatitude,
    longitude,
    setLongitude,
    frames,
    selectedId,
    setSelectedId,
    frameSearch,
    setFrameSearch,
    filteredFrames,
    framesError,
    reloadFrames,
    clearFramesError,
    charts,
    chartId,
    setChartId,
    chartName,
    setChartName,
    createChart,
    selectChart,
    chartsError,
    chartsStatus,
    clearChartsError,
    clearChartsStatus,
  }
}
