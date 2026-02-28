import { useRef } from 'react'
import type { CanvasProps } from '../components/Canvas'
import type { ActiveSelectionLayer } from '../types'
import type { SidebarProps } from '../components/Sidebar'
import { useSelection } from './useSelection'
import { useEditorMessages } from './useEditorMessages'
import { useChartTransform } from './useChartTransform'
import { useAutoFit } from './useAutoFit'
import { useChartInteraction } from './useChartInteraction'
import { useFrameUploads } from './useFrameUploads'
import { useBackgroundImage } from './useBackgroundImage'
import { useEditorDerived } from './useEditorDerived'
import { useEditorInputHandlers } from './useEditorInputHandlers'
import { useEditorResetEffects } from './useEditorResetEffects'
import { useEditorSessionActions } from './useEditorSessionActions'
import { useEditorState } from './useEditorState'
import { useDesignUpdater } from './useDesignUpdater'
import { useEditorStatus } from './useEditorStatus'
import { useEditorLayoutPipeline } from './useEditorLayoutPipeline'
import { useSidebarProps } from './useSidebarProps'
import { useCanvasProps } from './useCanvasProps'
import { useEditorSession } from './useEditorSession'
import { useEditorActionBundle } from './useEditorActionBundle'
import { CHART_BACKGROUND_ID, CHART_ONLY_ID, DEFAULT_CHART_FIT, DEFAULT_DESIGN } from '../editor/constants'

type UseEditorAppResult = {
  sidebarProps: SidebarProps
  canvasProps: CanvasProps
}

export function useEditorApp(): UseEditorAppResult {
  const {
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
  } = useEditorSession()
  const {
    editorState,
    dispatch,
    chartLinesColor,
    showFrameCircleDebug,
    setShowFrameCircleDebug,
    frameMaskCutoff,
    setFrameMaskCutoff,
    frameMaskOffwhiteBoost,
    setFrameMaskOffwhiteBoost,
    radialMoveEnabled,
    setRadialMoveEnabled,
    frameMaskGuideVisible,
    setFrameMaskGuideVisible,
    frameMaskLockAspect,
    setFrameMaskLockAspect,
  } = useEditorState()
  const {
    chartFit,
    userAdjustedFit,
    overrides,
    selectedElement,
    activeSelectionLayer,
    design,
    clientVersion,
    serverVersion,
    lastSavedAt,
    lastSyncedAt,
  } = editorState
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
  const {
    meta,
    selectedFrameDetail,
    chartSvg,
    chartSvgError,
    hasSavedFit,
    frameCircle,
    setFrameCircle,
    setFrameCircleFromUser,
    resetFrameCircleAuto,
    frameCircleError,
    frameCircleStatus,
    frameCircleLastUpdateReason,
    clearFrameCircleStatus,
    snapFrameMask,
    editorDoc,
    draftKey,
    draftStatus,
    draftInfo,
    draftState,
    draftFrameCircleApplied,
    chartBackgroundColor,
    draftPrompt,
  } = useEditorLayoutPipeline({
    apiBase,
    jwt,
    chartId,
    selectedId,
    isChartOnly,
    design,
    overrides,
    chartFit,
    activeSelectionLayer,
    frameMaskCutoff,
    frameMaskOffwhiteBoost,
    clientVersion,
    serverVersion,
    lastSavedAt,
    lastSyncedAt,
    defaultDesign: DEFAULT_DESIGN,
    chartBackgroundId: CHART_BACKGROUND_ID,
    dispatch,
    setFrameMaskCutoff,
    setFrameMaskOffwhiteBoost,
  })

  const { updateDesign } = useDesignUpdater({ design, dispatch })
  const handleFrameMaskCutoffChange = (value: number) => {
    setFrameMaskCutoff(value)
    dispatch({ type: 'BUMP_CLIENT_VERSION' })
  }
  const handleFrameMaskOffwhiteBoostChange = (value: number) => {
    setFrameMaskOffwhiteBoost(value)
    dispatch({ type: 'BUMP_CLIENT_VERSION' })
  }
  const frameMaskEnabled = frameMaskCutoff < 255
  const handleFrameMaskActivate = () => {
    if (!frameMaskEnabled) {
      setFrameMaskCutoff(252)
      resetFrameCircleAuto()
      dispatch({ type: 'BUMP_CLIENT_VERSION' })
    }
    setFrameMaskGuideVisible(true)
    dispatch({ type: 'SET_ACTIVE_SELECTION_LAYER', layer: 'frame_mask' })
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
  const handleClearFrameMask = () => {
    setFrameCircleFromUser(null)
    setFrameMaskCutoff(255)
    setFrameMaskGuideVisible(false)
    dispatch({ type: 'SET_ACTIVE_SELECTION_LAYER', layer: 'auto' })
    dispatch({ type: 'BUMP_CLIENT_VERSION' })
  }

  useChartTransform({ chartFit, meta, chartSvg, chartRootRef, chartBackgroundRef })
  useAutoFit({ isChartOnly, meta, frameCircle, userAdjustedFit, dispatch })

  const { onPointerDown, onPointerMove, onPointerUp } = useChartInteraction({
    chartFit,
    overrides,
    design,
    selectedElement,
    activeSelectionLayer,
    updateDesign,
    meta,
    frameCircle,
    setFrameCircleFromUser,
    frameMaskLockAspect,
    svgRef,
    chartRootRef,
    dispatch,
    radialMoveEnabled,
  })

  useEditorResetEffects({
    isChartOnly,
    chartId,
    selectedId,
    hasSavedFit,
    defaultChartFit: DEFAULT_CHART_FIT,
    defaultDesign: DEFAULT_DESIGN,
    dispatch,
    setFrameCircle,
  })

  const {
    syncStatus,
    exportFormat,
    setExportFormat,
    exportEnabled,
    exportDisabledTitle,
    handleExport,
    handleAutoFit,
    handleResetToSavedFit,
    handleSaveAllClick,
    handleResetView,
    canUndo,
    canRedo,
    undo,
    redo,
    clearActionsMessages,
  } = useEditorActionBundle({
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
    frameMaskCutoff,
    frameMaskOffwhiteBoost,
    clientVersion,
    setError,
    setStatus,
    dispatch,
    editorDoc,
    draftKey,
    chartName,
    selectedFrameDetail,
    computeFitFromCircle,
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
  const handleActiveSelectionLayerChangeWithMask = (value: ActiveSelectionLayer) => {
    if (value === 'frame_mask' && frameMaskEnabled && !frameCircle) {
      resetFrameCircleAuto()
    }
    handleActiveSelectionLayerChange(value)
  }

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
    defaultChartFit: DEFAULT_CHART_FIT,
    defaultDesign: DEFAULT_DESIGN,
    dispatch,
    setFrameCircle,
    setFrameMaskCutoff,
    setFrameMaskOffwhiteBoost,
    setFrameMaskGuideVisible,
    setFrameMaskLockAspect,
    setStatus,
    setError,
  })

  const { sidebarMessages, sidebarClears, debugItems } = useEditorStatus({
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
    draftStatus,
    draftInfo,
    syncStatus,
    debugExtras: [
      { label: 'Client version', value: String(clientVersion) },
      { label: 'Server version', value: String(serverVersion) },
      { label: 'Draft key', value: draftKey || '' },
      { label: 'Draft present', value: draftState ? 'yes' : '' },
      { label: 'Active layer', value: activeSelectionLayer },
      { label: 'Frame mask cutoff', value: String(frameMaskCutoff) },
      { label: 'Frame circle', value: frameCircle ? 'yes' : '' },
      { label: 'Frame circle value', value: frameCircle ? JSON.stringify(frameCircle) : '' },
      { label: 'Frame circle last set', value: frameCircleLastUpdateReason },
      {
        label: 'Draft frame circle',
        value: draftState ? JSON.stringify(draftState.frame_circle) : '',
      },
      {
        label: 'Draft frame circle applied',
        value:
          draftFrameCircleApplied === undefined ? '' : JSON.stringify(draftFrameCircleApplied),
      },
    ],
    clearAuthError,
    clearAuthStatus,
    clearChartsError,
    clearChartsStatus,
    clearFramesError,
    clearFrameCircleStatus,
    clearUploadMessages,
  })

  const sidebarProps = useSidebarProps({
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
      selectedFrameSizeLabel: selectedFrameDetail
        ? `${selectedFrameDetail.width}×${selectedFrameDetail.height} px`
        : '',
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
      selectedElement,
      selectableGroups,
      onSelectedElementChange: setSelectedElementFromHandlers,
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
      onFrameMaskCutoffChange: handleFrameMaskCutoffChange,
      frameMaskOffwhiteBoost,
      onFrameMaskOffwhiteBoostChange: handleFrameMaskOffwhiteBoostChange,
      frameMaskEnabled,
      onFrameMaskActivate: handleFrameMaskActivate,
      activeSelectionLayer,
      onActiveSelectionLayerChange: handleActiveSelectionLayerChangeWithMask,
      frameMaskGuideVisible,
      onFrameMaskGuideVisibleChange: setFrameMaskGuideVisible,
      frameMaskLockAspect,
      onFrameMaskLockAspectChange: setFrameMaskLockAspect,
      onSnapFrameMask: () => snapFrameMask(frameMaskCutoff, frameMaskOffwhiteBoost),
      onClearFrameMask: handleClearFrameMask,
    },
    actions: {
      onSaveAll: handleSaveAllClick,
      onUndo: undo,
      onRedo: redo,
      canUndo,
      canRedo,
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
    draftPrompt,
  })

  const canvasProps = useCanvasProps({
    meta,
    selectedFrameDetail,
    apiBase,
    chartSvg,
    chartId,
    isChartOnly,
    chartBackgroundColor,
    chartBackgroundOffset: overrides?.['chart.background'],
    layerOrder: design.layer_order,
    layerOpacity: design.layer_opacity,
    backgroundImageUrl,
    backgroundImageScale: design.background_image_scale,
    backgroundImageDx: design.background_image_dx,
    backgroundImageDy: design.background_image_dy,
    activeSelectionLayer,
    frameMaskCutoff,
    frameMaskOffwhiteBoost,
    frameMaskGuideVisible,
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

  return { sidebarProps, canvasProps }
}
