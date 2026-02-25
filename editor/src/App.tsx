import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react'
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
import { useChartTransform } from './hooks/useChartTransform'
import { useAutoFit } from './hooks/useAutoFit'
import { useChartInteraction } from './hooks/useChartInteraction'
import { useLayoutActions } from './hooks/useLayoutActions'
import { useFrameUploads } from './hooks/useFrameUploads'
import { usePersistedState } from './hooks/usePersistedState'
import { useBackgroundImage } from './hooks/useBackgroundImage'
import { useExport } from './hooks/useExport'
import { useEditorDrafts } from './hooks/useEditorDrafts'
import { useEditorDerived } from './hooks/useEditorDerived'
import { useEditorInputHandlers } from './hooks/useEditorInputHandlers'
import { useEditorHistory } from './hooks/useEditorHistory'
import { useEditorLayout } from './hooks/useEditorLayout'
import { useEditorActions } from './hooks/useEditorActions'
import { useEditorResetEffects } from './hooks/useEditorResetEffects'
import { useEditorSessionActions } from './hooks/useEditorSessionActions'
import { useEditorStatusView } from './hooks/useEditorStatusView'
import { useDesignSectionViewModel } from './hooks/useDesignSectionViewModel'
import { useCanvasViewModel } from './hooks/useCanvasViewModel'
import { useSidebarClears } from './hooks/useSidebarClears'
import { useSidebarMessages } from './hooks/useSidebarMessages'
import { useSidebarViewModel } from './hooks/useSidebarViewModel'
import { useEditorSync } from './hooks/useEditorSync'
import { useDebouncedValue } from './hooks/useDebouncedValue'
import { useEditorDoc } from './hooks/useEditorDoc'
import { createInitialEditorState, editorReducer } from './state/editorReducer'
import type {
  ChartFit,
  ChartOccluder,
  DesignSettings,
  EditorDoc,
  FrameCircle,
  LayerOrderKey,
  Offset,
} from './types'

const defaultChartFit: ChartFit = { dx: 0, dy: 0, scale: 1, rotation_deg: 0 }
const defaultDesign: DesignSettings = {
  layer_order: ['background', 'frame', 'chart_background_image', 'chart'],
  layer_opacity: {},
  background_image_path: null,
  background_image_scale: 1,
  background_image_dx: 0,
  background_image_dy: 0,
  sign_glyph_scale: 1,
  planet_glyph_scale: 1,
  inner_ring_scale: 1,
}
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
    createInitialEditorState(defaultChartFit, defaultDesign)
  )
  const {
    chartFit,
    userAdjustedFit,
    overrides,
    selectedElement,
    selectedOccluderId,
    activeSelectionLayer,
    design,
    chartOccluders,
    clientVersion,
    serverVersion,
    lastSavedAt,
    lastSyncedAt,
  } = editorState
  const chartLinesColor = overrides['chart.lines']?.color ?? ''
  const [showFrameCircleDebug, setShowFrameCircleDebug] = useState(false)
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

  const isChartOnly = selectedId === CHART_ONLY_ID

  const layoutHandlerRef = useRef<
    (result: {
      fit: ChartFit
      overrides: Record<string, Offset>
      frameCircle: FrameCircle | null
      design: DesignSettings
      userAdjustedFit: boolean
      occluders: ChartOccluder[]
    }) => void
  >(() => {})
  const handleLayoutLoadedProxy = useCallback(
    (result: {
      fit: ChartFit
      overrides: Record<string, Offset>
      frameCircle: FrameCircle | null
      design: DesignSettings
      userAdjustedFit: boolean
      occluders: ChartOccluder[]
    }) => {
      layoutHandlerRef.current(result)
    },
    []
  )


  const debouncedDesign = useDebouncedValue(design, 400)
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
    designPreview: debouncedDesign,
    defaultDesign,
    onLayoutLoaded: handleLayoutLoadedProxy,
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

  const editorDoc: EditorDoc = useEditorDoc({
    chartId,
    selectedId,
    isChartOnly,
    chartFit,
    overrides,
    design,
    frameCircle,
    chartOccluders,
    clientVersion,
    serverVersion,
    lastSavedAt,
    lastSyncedAt,
  })

  const { draftKey, draftStatus, draftInfo, draftState, draftAppliedRef } = useEditorDrafts({
    doc: editorDoc,
    dispatch,
    setFrameCircle,
  })

  const { handleLayoutLoaded: layoutHandler } = useEditorLayout({
    draftKey,
    draftState,
    draftAppliedRef,
    dispatch,
    setFrameCircle,
  })
  useEffect(() => {
    layoutHandlerRef.current = layoutHandler
  }, [layoutHandler])

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

  const ensureRequiredLayers = (layerOrder: DesignSettings['layer_order']) => {
    const required: LayerOrderKey[] = ['background', 'frame', 'chart']
    const deduped = layerOrder.filter((layer, index) => layerOrder.indexOf(layer) === index)
    const withRequired = [...deduped]
    required.forEach((layer) => {
      if (!withRequired.includes(layer)) {
        withRequired.push(layer)
      }
    })
    return withRequired
  }

  const ensureLayerOrder = (layerOrder: DesignSettings['layer_order'], layer: LayerOrderKey) => {
    if (layerOrder.includes(layer)) {
      return layerOrder
    }
    const chartIndex = layerOrder.indexOf('chart')
    if (chartIndex >= 0) {
      return [...layerOrder.slice(0, chartIndex), layer, ...layerOrder.slice(chartIndex)]
    }
    return [...layerOrder, layer]
  }

  const updateDesign = (next: Partial<DesignSettings>) => {
    let nextDesign = { ...design, ...next }
    nextDesign = {
      ...nextDesign,
      layer_order: ensureRequiredLayers(nextDesign.layer_order),
    }
    if (nextDesign.background_image_path) {
      nextDesign = {
        ...nextDesign,
        layer_order: ensureLayerOrder(nextDesign.layer_order, 'chart_background_image'),
      }
    }
    dispatch({ type: 'SET_DESIGN', design: nextDesign })
  }

  const occluderDefaults = () => {
    const centerX = meta?.chart.center.x ?? 0
    const centerY = meta?.chart.center.y ?? 0
    const base = meta?.canvas.width ?? 1000
    const size = Math.max(24, base * 0.06)
    return { centerX, centerY, size }
  }

  const createOccluderId = () => {
    if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
      return crypto.randomUUID()
    }
    return `occ-${Date.now()}-${Math.random().toString(16).slice(2)}`
  }

  const handleAddOccluderEllipse = () => {
    const { centerX, centerY, size } = occluderDefaults()
    const nextOccluder: ChartOccluder = {
      id: createOccluderId(),
      shape: 'ellipse',
      cx: centerX,
      cy: centerY,
      rx: size,
      ry: size,
      rotation_deg: 0,
    }
    const next = [...chartOccluders, nextOccluder]
    dispatch({ type: 'SET_OCCLUDERS', occluders: next })
    dispatch({ type: 'SET_SELECTED_OCCLUDER', id: nextOccluder.id })
  }

  const handleAddOccluderRect = () => {
    const { centerX, centerY, size } = occluderDefaults()
    const nextOccluder: ChartOccluder = {
      id: createOccluderId(),
      shape: 'rect',
      x: centerX - size,
      y: centerY - size,
      width: size * 2,
      height: size * 2,
      rotation_deg: 0,
    }
    const next = [...chartOccluders, nextOccluder]
    dispatch({ type: 'SET_OCCLUDERS', occluders: next })
    dispatch({ type: 'SET_SELECTED_OCCLUDER', id: nextOccluder.id })
  }

  const handleSelectOccluder = (id: string) => {
    dispatch({ type: 'SET_SELECTED_OCCLUDER', id })
  }

  const handleUpdateOccluder = (id: string, nextOccluder: ChartOccluder) => {
    const next = chartOccluders.map((item) => (item.id === id ? nextOccluder : item))
    dispatch({ type: 'SET_OCCLUDERS', occluders: next })
  }

  const handleDeleteOccluder = (id: string) => {
    const next = chartOccluders.filter((item) => item.id !== id)
    dispatch({ type: 'SET_OCCLUDERS', occluders: next })
    if (selectedOccluderId === id) {
      dispatch({ type: 'SET_SELECTED_OCCLUDER', id: '' })
    }
  }

  const handleSnapOccluderToChart = () => {
    if (!meta || !selectedOccluderId) {
      return
    }
    const radius = meta.chart.ring_outer
    if (!Number.isFinite(radius) || radius <= 0) {
      return
    }
    const centerX = meta.chart.center.x
    const centerY = meta.chart.center.y
    const next = chartOccluders.map((item) => {
      if (item.id !== selectedOccluderId) {
        return item
      }
      if (item.shape === 'ellipse') {
        return {
          ...item,
          cx: centerX,
          cy: centerY,
          rx: radius,
          ry: radius,
        }
      }
      return {
        ...item,
        x: centerX - radius,
        y: centerY - radius,
        width: radius * 2,
        height: radius * 2,
      }
    })
    dispatch({ type: 'SET_OCCLUDERS', occluders: next })
  }

  const {
    backgroundImageUrl,
    backgroundImageError,
    backgroundImageStatus,
    backgroundImageUploading,
    handleBackgroundImageUpload,
    handleBackgroundImageClear,
  } = useBackgroundImage({
    apiBase,
    jwt,
    chartId,
    design,
    updateDesign,
    lastSavedAt,
    lastSyncedAt,
  })

  const {
    selectableGroups,
    selectionColor,
    selectionColorMixed,
    selectionEnabled,
    setSelectedElement: setSelectedElementFromSelection,
    applySelectionColor,
  } = useSelection({
    chartSvg,
    meta,
    overrides,
    selectedElement,
    dispatch,
  })

  const { computeFitFromCircle, resetToSavedEnabled } = useEditorDerived({ meta })


  useChartTransform({ chartFit, meta, chartSvg, chartRootRef, chartBackgroundRef })
  useAutoFit({ isChartOnly, meta, frameCircle, userAdjustedFit, dispatch })

  const { onPointerDown, onPointerMove, onPointerUp } = useChartInteraction({
    chartFit,
    chartOccluders,
    overrides,
    design,
    selectedElement,
    activeSelectionLayer,
    updateDesign,
    svgRef,
    chartRootRef,
    dispatch,
    radialMoveEnabled,
  })

  const { canUndo, canRedo, undo, redo } = useEditorHistory({
    chartFit,
    overrides,
    design,
    occluders: chartOccluders,
    dispatch,
    resetKey: draftKey,
  })

  const { saveAll } = useLayoutActions({
    apiBase,
    jwt,
    chartId,
    selectedId,
    isChartOnly,
    meta,
    chartFit,
    overrides,
    design,
    frameCircle,
    chartOccluders,
    clientVersion,
    setError,
    setStatus,
    dispatch,
  })

  const { syncStatus, syncEnabled, handleSyncNow, syncInFlight } = useEditorSync({
    jwt,
    doc: editorDoc,
    saveAll,
    draftKey,
  })

  useEditorResetEffects({
    isChartOnly,
    chartId,
    selectedId,
    hasSavedFit,
    defaultChartFit,
    defaultDesign,
    dispatch,
    setFrameCircle,
  })

  const clearActionsMessages = () => {
    setError('')
    setStatus('')
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
  })

  const {
    handleAuthEmailChange,
    handleAuthPasswordChange,
    clearAuthMessages,
    handleChartNameChange,
    handleBirthDateChange,
    handleBirthTimeChange,
    handleLatitudeChange,
    handleLongitudeChange,
    clearChartsMessages,
    handleFrameSearchChange,
    handleSelectedIdChange,
    handleUploadNameChange,
    handleUploadTagsChange,
    handleUploadFileChange,
    handleUploadGlobalChange,
    handleChartLinesColorChange,
    handleChartLinesColorClear,
    handleChartFitChange,
    handleLayerOrderChange,
    handleLayerOpacityChange,
    handleSignGlyphScaleChange,
    handlePlanetGlyphScaleChange,
    handleInnerRingScaleChange,
    handleBackgroundImageScaleChange,
    handleBackgroundImageDxChange,
    handleBackgroundImageDyChange,
    handleChartBackgroundColorChange,
    handleChartBackgroundColorClear,
    handleActiveSelectionLayerChange,
    setSelectedElement: setSelectedElementFromHandlers,
  } = useEditorInputHandlers({
    setAuthEmail,
    setAuthPassword,
    clearAuthError,
    clearAuthStatus,
    setChartName,
    setBirthDate,
    setBirthTime,
    setLatitude,
    setLongitude,
    clearChartsError,
    clearChartsStatus,
    setFrameSearch,
    setSelectedId,
    clearFramesError,
    setUploadName,
    setUploadTags,
    setUploadFile,
    setUploadGlobal,
    clearUploadMessages,
    dispatch,
    updateDesign,
    design,
    chartBackgroundId: CHART_BACKGROUND_ID,
    setSelectedElement: setSelectedElementFromSelection,
  })

  const {
    handleCreateChart,
    handleLoginClick,
    handleRegisterClick,
    handleUploadFrame,
    handleLogout,
    handleResetSession,
    handleFactoryReset,
  } = useEditorSessionActions({
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
  })

  const {
    debugItems,
    inlineAuthError,
    inlineAuthStatus,
    inlineChartsError,
    inlineChartsStatus,
    inlineFramesError,
    inlineFramesStatus,
    inlineUploadError,
    inlineUploadStatus,
    inlineActionsError,
    inlineActionsStatus,
  } = useEditorStatusView({
    authError,
    authStatus,
    framesError,
    chartsError,
    chartsStatus,
    chartSvgError,
    frameCircleError,
    frameCircleStatus,
    editorError,
    editorStatus,
    uploadError,
    uploadStatus,
  })

  const sidebarMessages = useSidebarMessages({
    accountError: inlineAuthError,
    accountStatus: inlineAuthStatus,
    chartsError: inlineChartsError,
    chartsStatus: inlineChartsStatus,
    createChartError: inlineChartsError,
    createChartStatus: inlineChartsStatus,
    framesError: inlineFramesError,
    framesStatus: inlineFramesStatus,
    uploadError: inlineUploadError,
    uploadStatus: inlineUploadStatus,
    actionsError: inlineActionsError,
    actionsStatus: inlineActionsStatus,
    draftStatus: draftStatus || draftInfo,
    syncStatus,
  })

  const sidebarClears = useSidebarClears({
    onClearAccountMessages: () => {
      clearAuthError()
      clearAuthStatus()
    },
    onClearChartsMessages: () => {
      clearChartsError()
      clearChartsStatus()
    },
    onClearCreateChartMessages: () => {
      clearChartsError()
      clearChartsStatus()
    },
    onClearFramesMessages: () => {
      clearFramesError()
      clearFrameCircleStatus()
    },
    onClearUploadMessages: clearUploadMessages,
  })

  const designSectionProps = useDesignSectionViewModel({
    chartFit,
    onChartFitChange: handleChartFitChange,
    design,
    onLayerOrderChange: handleLayerOrderChange,
    onLayerOpacityChange: handleLayerOpacityChange,
    hasFrame: Boolean(selectedFrameDetail),
    hasChartBackground: Boolean(chartBackgroundColor),
    hasBackgroundImage: Boolean(design.background_image_path),
    backgroundImagePath: design.background_image_path ?? null,
    backgroundImageUrl,
    backgroundImageError,
    backgroundImageStatus,
    backgroundImageUploading,
    onBackgroundImageUpload: handleBackgroundImageUpload,
    onBackgroundImageClear: handleBackgroundImageClear,
    backgroundImageScale: design.background_image_scale,
    backgroundImageDx: design.background_image_dx,
    backgroundImageDy: design.background_image_dy,
    onBackgroundImageScaleChange: handleBackgroundImageScaleChange,
    onBackgroundImageDxChange: handleBackgroundImageDxChange,
    onBackgroundImageDyChange: handleBackgroundImageDyChange,
    onSignGlyphScaleChange: handleSignGlyphScaleChange,
    onPlanetGlyphScaleChange: handlePlanetGlyphScaleChange,
    onInnerRingScaleChange: handleInnerRingScaleChange,
    occluders: chartOccluders,
    selectedOccluderId,
    onSelectOccluder: handleSelectOccluder,
    onAddOccluderEllipse: handleAddOccluderEllipse,
    onAddOccluderRect: handleAddOccluderRect,
    onDeleteOccluder: handleDeleteOccluder,
    onUpdateOccluder: handleUpdateOccluder,
    onSnapOccluderToChart: handleSnapOccluderToChart,
    canSnapOccluderToChart: Boolean(meta && selectedOccluderId),
    selectedElement,
    selectableGroups,
    onSelectedElementChange: setSelectedElementFromHandlers,
    activeSelectionLayer,
    onActiveSelectionLayerChange: handleActiveSelectionLayerChange,
    selectionColor,
    selectionColorMixed,
    selectionEnabled,
    onColorChange: (color) => applySelectionColor(color),
    onClearColor: () => applySelectionColor(null),
    chartLinesColor,
    onChartLinesColorChange: handleChartLinesColorChange,
    onClearChartLinesColor: handleChartLinesColorClear,
    chartBackgroundColor,
    onChartBackgroundColorChange: handleChartBackgroundColorChange,
    onClearChartBackgroundColor: handleChartBackgroundColorClear,
    radialMoveEnabled,
    onRadialMoveEnabledChange: setRadialMoveEnabled,
    frameMaskCutoff,
    onFrameMaskCutoffChange: setFrameMaskCutoff,
  })

  const sidebarProps = useSidebarViewModel({
    messages: sidebarMessages,
    clears: sidebarClears,
    account: {
      user,
      authEmail,
      authPassword,
      onAuthEmailChange: handleAuthEmailChange,
      onAuthPasswordChange: handleAuthPasswordChange,
      onLogin: handleLoginClick,
      onRegister: handleRegisterClick,
      onLogout: handleLogout,
    },
    charts: {
      charts,
      chartId,
      onSelectChart: selectChart,
      onChartIdChange: setChartId,
      chartName,
      birthDate,
      birthTime,
      latitude,
      longitude,
      onChartNameChange: handleChartNameChange,
      onBirthDateChange: handleBirthDateChange,
      onBirthTimeChange: handleBirthTimeChange,
      onLatitudeChange: handleLatitudeChange,
      onLongitudeChange: handleLongitudeChange,
      onCreateChart: handleCreateChart,
      onResetSession: handleResetSession,
      onFactoryReset: handleFactoryReset,
      onResetView: handleResetView,
      onAutoFit: handleAutoFit,
      onResetToSavedFit: handleResetToSavedFit,
      resetToSavedEnabled,
      autoFitEnabled: !isChartOnly && Boolean(meta && frameCircle),
    },
    frames: {
      frameSearch,
      onFrameSearchChange: handleFrameSearchChange,
      selectedId,
      onSelectedIdChange: handleSelectedIdChange,
      filteredFrames,
      chartOnlyId: CHART_ONLY_ID,
    },
    upload: {
      uploadName,
      uploadTags,
      uploadGlobal,
      uploading,
      onUploadNameChange: handleUploadNameChange,
      onUploadTagsChange: handleUploadTagsChange,
      onUploadFileChange: handleUploadFileChange,
      onUploadGlobalChange: handleUploadGlobalChange,
      onUploadFrame: handleUploadFrame,
    },
    design: {
      sectionProps: designSectionProps,
    },
    actions: {
      onSaveAll: handleSaveAllClick,
      onUndo: undo,
      onRedo: redo,
      canUndo,
      canRedo,
      onSyncNow: handleSyncNow,
      syncEnabled,
      syncInFlight,
      onExport: handleExport,
      exportFormat,
      onExportFormatChange: setExportFormat,
      exportEnabled,
      exportDisabledTitle,
    },
    debug: {
      debugItems,
      showFrameCircleDebug,
      onShowFrameCircleDebugChange: setShowFrameCircleDebug,
    },
  })

  const canvasProps = useCanvasViewModel({
    meta,
    selectedFrameDetail,
    apiBase,
    chartSvg,
    chartId,
    isChartOnly,
    chartBackgroundColor,
    chartOccluders,
    selectedOccluderId,
    layerOrder: design.layer_order,
    layerOpacity: design.layer_opacity,
    backgroundImageUrl,
    backgroundImageScale: design.background_image_scale,
    backgroundImageDx: design.background_image_dx,
    backgroundImageDy: design.background_image_dy,
    activeSelectionLayer,
    frameMaskCutoff,
    showChartBackground: Boolean(chartBackgroundColor),
    frameCircle,
    showFrameCircleDebug,
    svgRef,
    chartBackgroundRef,
    chartRootRef,
    onPointerDown,
    onPointerMove,
    onPointerUp,
  })


  return (
    <div className="app">
      <Sidebar {...sidebarProps} />
      <Canvas {...canvasProps} />
    </div>
  )
}

export default App
