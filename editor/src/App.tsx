import { useEffect, useMemo, useReducer, useRef, useState } from 'react'
import './App.css'
import Canvas from './components/Canvas'
import Sidebar from './components/Sidebar'
import { applyOverrides, stripElementById } from './utils/svg'
import { useChartBackground } from './hooks/useChartBackground'
import { useAuth } from './hooks/useAuth'
import { useFrames } from './hooks/useFrames'
import { useCharts } from './hooks/useCharts'
import { useChartInputs } from './hooks/useChartInputs'
import { useChartSvg } from './hooks/useChartSvg'
import { useFrameCircle } from './hooks/useFrameCircle'
import { useSelection } from './hooks/useSelection'
import { useEditorMessages } from './hooks/useEditorMessages'
import { useAutoDismissMessage } from './hooks/useAutoDismissMessage'
import { useSelectionHighlight } from './hooks/useSelectionHighlight'
import { useChartTransform } from './hooks/useChartTransform'
import { useAutoFit } from './hooks/useAutoFit'
import { useChartInteraction } from './hooks/useChartInteraction'
import { useLayoutActions } from './hooks/useLayoutActions'
import { useFrameUploads } from './hooks/useFrameUploads'
import { usePersistedState } from './hooks/usePersistedState'
import { useExport } from './hooks/useExport'
import { useEditorDerived } from './hooks/useEditorDerived'
import { useEditorActions } from './hooks/useEditorActions'
import { createInitialEditorState, editorReducer } from './state/editorReducer'
import type { ChartFit, FrameCircle, Offset } from './types'

const defaultChartFit: ChartFit = { dx: 0, dy: 0, scale: 1, rotation_deg: 0 }
const CHART_ONLY_ID = '__chart_only__'
const CHART_BACKGROUND_ID = 'chart.background'

function App() {
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
  const [editorState, dispatch] = useReducer(
    editorReducer,
    createInitialEditorState(defaultChartFit)
  )
  const { chartFit, userAdjustedFit, overrides, selectedElement } = editorState
  const chartLinesColor = overrides['chart.lines']?.color ?? ''
  const [showFrameCircleDebug, setShowFrameCircleDebug] = useState(false)
  const [selectionOutlineColor, setSelectionOutlineColor] = usePersistedState(
    'zodiac_editor.glyphOutlineColor',
    '#ffffff'
  )
  const [frameMaskCutoff, setFrameMaskCutoff] = usePersistedState(
    'zodiac_editor.frameMaskCutoff',
    252,
    (raw) => {
      const parsed = Number(raw)
      return Number.isFinite(parsed) ? parsed : 252
    },
    (value) => String(value)
  )
  const [radialMoveEnabled, setRadialMoveEnabled] = usePersistedState(
    'zodiac_editor.radialMoveEnabled',
    true,
    (raw) => raw === '1',
    (value) => (value ? '1' : '0')
  )
  const { error: editorError, status: editorStatus, setError, setStatus } = useEditorMessages()
  const {
    uploadName,
    setUploadName,
    uploadTags,
    setUploadTags,
    setUploadFile,
    uploading,
    uploadGlobal,
    setUploadGlobal,
    uploadFrame,
    uploadError,
    uploadStatus,
    clearUploadMessages,
  } = useFrameUploads({
    apiBase,
    jwt,
    user,
    reloadFrames,
    setSelectedId,
  })

  const svgRef = useRef<SVGSVGElement | null>(null)
  const chartBackgroundRef = useRef<SVGGElement | null>(null)
  const chartRootRef = useRef<SVGGElement | null>(null)
  const highlightElementsRef = useRef<Element[]>([])

  const isChartOnly = selectedId === CHART_ONLY_ID

  const handleLayoutLoaded = (result: { fit: ChartFit; overrides: Record<string, Offset>; frameCircle: FrameCircle | null }) => {
    dispatch({ type: 'LOAD_LAYOUT', fit: result.fit, overrides: result.overrides })
    setFrameCircle(result.frameCircle)
  }

  const {
    meta,
    selectedFrameDetail,
    chartSvgBase,
    hasSavedFit,
    error: chartSvgError,
  } = useChartSvg({
    apiBase,
    jwt,
    chartId,
    selectedId,
    isChartOnly,
    onLayoutLoaded: handleLayoutLoaded,
  })

  const {
    frameCircle,
    setFrameCircle,
    error: frameCircleError,
    status: frameCircleStatus,
    clearStatus: clearFrameCircleStatus,
  } = useFrameCircle({
    apiBase,
    jwt,
    chartId,
    selectedId,
    isChartOnly,
    selectedFrameDetail,
    overrides,
  })

  const { chartBackgroundColor } = useChartBackground({
    chartSvgBase,
    overrides,
    chartBackgroundId: CHART_BACKGROUND_ID,
  })

  const chartSvg = useMemo(() => {
    if (!chartSvgBase) {
      return ''
    }
    const base = chartBackgroundColor
      ? stripElementById(chartSvgBase, CHART_BACKGROUND_ID)
      : chartSvgBase
    return applyOverrides(base, overrides)
  }, [chartBackgroundColor, chartSvgBase, overrides])

  const {
    selectableGroups,
    selectableIds,
    selectionColor,
    selectionColorMixed,
    selectionEnabled,
    setSelectedElement,
    applySelectionColor,
    bulkIds,
  } = useSelection({
    chartSvg,
    meta,
    overrides,
    selectedElement,
    dispatch,
  })

  const { computeFitFromCircle, resetToSavedEnabled } = useEditorDerived({ meta })

  useSelectionHighlight({
    selectedElement,
    svgRef,
    chartSvg,
    bulkIds: Object.values(bulkIds),
    outlineColor: selectionOutlineColor,
    highlightElementsRef,
  })

  useChartTransform({ chartFit, meta, chartSvg, chartRootRef, chartBackgroundRef })
  useAutoFit({ isChartOnly, meta, frameCircle, userAdjustedFit, dispatch })

  const { onPointerDown, onPointerMove, onPointerUp } = useChartInteraction({
    chartFit,
    overrides,
    svgRef,
    chartRootRef,
    dispatch,
    radialMoveEnabled,
  })

  const { saveAll, autoFix } = useLayoutActions({
    apiBase,
    jwt,
    chartId,
    selectedId,
    isChartOnly,
    meta,
    chartFit,
    overrides,
    frameCircle,
    setError,
    setStatus,
    dispatch,
  })

  useEffect(() => {
    if (!selectedElement) {
      return
    }
    const bulkValues = Object.values(bulkIds)
    if (!selectableIds.includes(selectedElement) && !bulkValues.includes(selectedElement)) {
      setSelectedElement('')
    }
  }, [bulkIds, selectableIds, selectedElement, setSelectedElement])

  useEffect(() => {
    dispatch({ type: 'RESET_USER_ADJUSTED' })
  }, [chartId, selectedId])

  useEffect(() => {
    if (isChartOnly && !chartId) {
      dispatch({ type: 'LOAD_LAYOUT', fit: defaultChartFit, overrides: {} })
      setFrameCircle(null)
    }
  }, [chartId, isChartOnly, setFrameCircle])

  useEffect(() => {
    dispatch({ type: 'SET_USER_ADJUSTED', value: hasSavedFit })
  }, [hasSavedFit])

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

  const clearActionsMessages = () => {
    setError('')
    setStatus('')
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
    dispatch({ type: 'LOAD_LAYOUT', fit: defaultChartFit, overrides: {} })
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
    dispatch({ type: 'LOAD_LAYOUT', fit: defaultChartFit, overrides: {} })
    setFrameCircle(null)
    setStatus('')
    setError('')
  }

  const { exportFormat, setExportFormat, exportEnabled, exportDisabledTitle, handleExport } = useExport({
    apiBase,
    jwt,
    chartId,
    chartName,
    selectedId,
    isChartOnly,
    selectedFrameDetail,
    setError,
    setStatus,
    clearActionsMessages,
  })

  const {
    handleAutoFit,
    handleResetToSavedFit,
    handleSaveAllClick,
    handleAutoFixClick,
    handleResetView,
  } = useEditorActions({
    isChartOnly,
    meta,
    frameCircle,
    computeFitFromCircle,
    dispatch,
    setError,
    setStatus,
    clearActionsMessages,
    saveAll,
    autoFix,
  })

  // error/status aggregated for debug panel
  const debugItems = [
    { label: 'Auth error', value: authError },
    { label: 'Auth status', value: authStatus },
    { label: 'Frames error', value: framesError },
    { label: 'Charts error', value: chartsError },
    { label: 'Charts status', value: chartsStatus },
    { label: 'Chart SVG error', value: chartSvgError },
    { label: 'Frame circle error', value: frameCircleError },
    { label: 'Frame circle status', value: frameCircleStatus },
    { label: 'Editor error', value: editorError },
    { label: 'Editor status', value: editorStatus },
    { label: 'Upload error', value: uploadError },
    { label: 'Upload status', value: uploadStatus },
  ]

  const inlineAuthError = useAutoDismissMessage(authError, 6000)
  const inlineAuthStatus = useAutoDismissMessage(authStatus, 4000)
  const inlineChartsError = useAutoDismissMessage(chartsError, 6000)
  const inlineChartsStatus = useAutoDismissMessage(chartsStatus, 4000)
  const inlineFramesError = useAutoDismissMessage(framesError || chartSvgError || frameCircleError, 6000)
  const inlineFramesStatus = useAutoDismissMessage(frameCircleStatus, 4000)
  const inlineUploadError = useAutoDismissMessage(uploadError, 6000)
  const inlineUploadStatus = useAutoDismissMessage(uploadStatus, 4000)
  const inlineActionsError = useAutoDismissMessage(editorError, 6000)
  const inlineActionsStatus = useAutoDismissMessage(editorStatus, 4000)

  const handleAuthEmailChange = (value: string) => {
    setAuthEmail(value)
    clearAuthError()
    clearAuthStatus()
  }

  const handleAuthPasswordChange = (value: string) => {
    setAuthPassword(value)
    clearAuthError()
    clearAuthStatus()
  }

  const clearAuthMessages = () => {
    clearAuthError()
    clearAuthStatus()
  }

  const handleChartNameChange = (value: string) => {
    setChartName(value)
    clearChartsError()
    clearChartsStatus()
  }

  const handleBirthDateChange = (value: string) => {
    setBirthDate(value)
    clearChartsError()
    clearChartsStatus()
  }

  const handleBirthTimeChange = (value: string) => {
    setBirthTime(value)
    clearChartsError()
    clearChartsStatus()
  }

  const handleLatitudeChange = (value: number) => {
    setLatitude(value)
    clearChartsError()
    clearChartsStatus()
  }

  const handleLongitudeChange = (value: number) => {
    setLongitude(value)
    clearChartsError()
    clearChartsStatus()
  }

  const clearChartsMessages = () => {
    clearChartsError()
    clearChartsStatus()
  }

  const handleFrameSearchChange = (value: string) => {
    setFrameSearch(value)
    clearFramesError()
  }

  const handleSelectedIdChange = (value: string) => {
    setSelectedId(value)
    clearFramesError()
  }


  const handleUploadNameChange = (value: string) => {
    setUploadName(value)
    clearUploadMessages()
  }

  const handleUploadTagsChange = (value: string) => {
    setUploadTags(value)
    clearUploadMessages()
  }

  const handleUploadFileChange = (value: File | null) => {
    setUploadFile(value)
    clearUploadMessages()
  }

  const handleUploadGlobalChange = (value: boolean) => {
    setUploadGlobal(value)
    clearUploadMessages()
  }

  const handleChartLinesColorChange = (value: string) => {
    dispatch({ type: 'APPLY_COLOR', targets: ['chart.lines'], color: value })
  }

  const handleChartLinesColorClear = () => {
    dispatch({ type: 'APPLY_COLOR', targets: ['chart.lines'], color: null })
  }

  return (
    <div className="app">
      <Sidebar
        user={user}
        authEmail={authEmail}
        authPassword={authPassword}
        onAuthEmailChange={handleAuthEmailChange}
        onAuthPasswordChange={handleAuthPasswordChange}
        onLogin={handleLoginClick}
        onRegister={handleRegisterClick}
        onLogout={handleLogout}
        charts={charts}
        chartId={chartId}
        onSelectChart={selectChart}
        onChartIdChange={setChartId}
        chartName={chartName}
        birthDate={birthDate}
        birthTime={birthTime}
        latitude={latitude}
        longitude={longitude}
        onChartNameChange={handleChartNameChange}
        onBirthDateChange={handleBirthDateChange}
        onBirthTimeChange={handleBirthTimeChange}
        onLatitudeChange={handleLatitudeChange}
        onLongitudeChange={handleLongitudeChange}
        onCreateChart={handleCreateChart}
        onResetSession={handleResetSession}
        onFactoryReset={handleFactoryReset}
        onResetView={handleResetView}
        frameSearch={frameSearch}
        onFrameSearchChange={handleFrameSearchChange}
        selectedId={selectedId}
        onSelectedIdChange={handleSelectedIdChange}
        filteredFrames={filteredFrames}
        chartOnlyId={CHART_ONLY_ID}
        accountError={inlineAuthError}
        accountStatus={inlineAuthStatus}
        onClearAccountMessages={() => {
          clearAuthError()
          clearAuthStatus()
        }}
        chartsError={inlineChartsError}
        chartsStatus={inlineChartsStatus}
        onClearChartsMessages={() => {
          clearChartsError()
          clearChartsStatus()
        }}
        createChartError={inlineChartsError}
        createChartStatus={inlineChartsStatus}
        onClearCreateChartMessages={() => {
          clearChartsError()
          clearChartsStatus()
        }}
        framesError={inlineFramesError}
        framesStatus={inlineFramesStatus}
        onClearFramesMessages={() => {
          clearFramesError()
          clearFrameCircleStatus()
        }}
        uploadName={uploadName}
        uploadTags={uploadTags}
        uploadGlobal={uploadGlobal}
        uploading={uploading}
        userIsAdmin={Boolean(user?.is_admin)}
        uploadError={inlineUploadError}
        uploadStatus={inlineUploadStatus}
        onClearUploadMessages={clearUploadMessages}
        onUploadNameChange={handleUploadNameChange}
        onUploadTagsChange={handleUploadTagsChange}
        onUploadFileChange={handleUploadFileChange}
        onUploadGlobalChange={handleUploadGlobalChange}
        onUploadFrame={handleUploadFrame}
        selectedElement={selectedElement}
        selectableGroups={selectableGroups}
        onSelectedElementChange={setSelectedElement}
        selectionColor={selectionColor}
        selectionColorMixed={selectionColorMixed}
        selectionEnabled={selectionEnabled}
        onColorChange={(color) => applySelectionColor(color)}
        onClearColor={() => applySelectionColor(null)}
        chartLinesColor={chartLinesColor}
        onChartLinesColorChange={handleChartLinesColorChange}
        onClearChartLinesColor={handleChartLinesColorClear}
        radialMoveEnabled={radialMoveEnabled}
        onRadialMoveEnabledChange={setRadialMoveEnabled}
        outlineColor={selectionOutlineColor}
        onOutlineColorChange={setSelectionOutlineColor}
        frameMaskCutoff={frameMaskCutoff}
        onFrameMaskCutoffChange={setFrameMaskCutoff}
        showFrameCircleDebug={showFrameCircleDebug}
        onShowFrameCircleDebugChange={setShowFrameCircleDebug}
        autoFitEnabled={!isChartOnly && Boolean(meta && frameCircle)}
        onAutoFit={handleAutoFit}
        onResetToSavedFit={handleResetToSavedFit}
        actionsError={inlineActionsError}
        actionsStatus={inlineActionsStatus}
        resetToSavedEnabled={resetToSavedEnabled}
        debugItems={debugItems}
        onSaveAll={handleSaveAllClick}
        onAutoFix={handleAutoFixClick}
        onExport={handleExport}
        exportFormat={exportFormat}
        onExportFormatChange={setExportFormat}
        exportEnabled={exportEnabled}
        exportDisabledTitle={exportDisabledTitle}
      />
      <Canvas
        meta={meta}
        selectedFrameDetail={selectedFrameDetail}
        apiBase={apiBase}
        chartSvg={chartSvg}
        chartId={chartId}
        isChartOnly={isChartOnly}
        chartBackgroundColor={chartBackgroundColor}
        showChartBackground={Boolean(chartBackgroundColor)}
        frameMaskCutoff={frameMaskCutoff}
        frameCircle={frameCircle}
        showFrameCircleDebug={showFrameCircleDebug && import.meta.env.DEV}
        svgRef={svgRef}
        chartBackgroundRef={chartBackgroundRef}
        chartRootRef={chartRootRef}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
      />
    </div>
  )
}

export default App
