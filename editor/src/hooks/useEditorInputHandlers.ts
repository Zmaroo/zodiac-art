import type { Dispatch } from 'react'
import type { ActiveSelectionLayer, ChartFit, DesignSettings, LayerOrderKey } from '../types'
import type { EditorAction } from '../state/editorReducer'

type UseEditorInputHandlersParams = {
  setAuthEmail: (value: string) => void
  setAuthPassword: (value: string) => void
  clearAuthError: () => void
  clearAuthStatus: () => void
  setChartName: (value: string) => void
  setBirthDate: (value: string) => void
  setBirthTime: (value: string) => void
  setLatitude: (value: number) => void
  setLongitude: (value: number) => void
  clearChartsError: () => void
  clearChartsStatus: () => void
  setFrameSearch: (value: string) => void
  setSelectedId: (value: string) => void
  clearFramesError: () => void
  setUploadName: (value: string) => void
  setUploadTags: (value: string) => void
  setUploadFile: (value: File | null) => void
  setUploadGlobal: (value: boolean) => void
  clearUploadMessages: () => void
  dispatch: Dispatch<EditorAction>
  updateDesign: (next: Partial<DesignSettings>) => void
  design: DesignSettings
  chartBackgroundId: string
  setSelectedElement: (value: string) => void
}

type UseEditorInputHandlersResult = {
  handleAuthEmailChange: (value: string) => void
  handleAuthPasswordChange: (value: string) => void
  clearAuthMessages: () => void
  handleChartNameChange: (value: string) => void
  handleBirthDateChange: (value: string) => void
  handleBirthTimeChange: (value: string) => void
  handleLatitudeChange: (value: number) => void
  handleLongitudeChange: (value: number) => void
  clearChartsMessages: () => void
  handleFrameSearchChange: (value: string) => void
  handleSelectedIdChange: (value: string) => void
  handleUploadNameChange: (value: string) => void
  handleUploadTagsChange: (value: string) => void
  handleUploadFileChange: (value: File | null) => void
  handleUploadGlobalChange: (value: boolean) => void
  handleChartLinesColorChange: (value: string) => void
  handleChartLinesColorClear: () => void
  handleChartFitChange: (next: ChartFit) => void
  handleLayerOrderChange: (value: DesignSettings['layer_order']) => void
  handleLayerOpacityChange: (layer: LayerOrderKey, value: number) => void
  handleSignGlyphScaleChange: (value: number) => void
  handlePlanetGlyphScaleChange: (value: number) => void
  handleInnerRingScaleChange: (value: number) => void
  handleBackgroundImageScaleChange: (value: number) => void
  handleBackgroundImageDxChange: (value: number) => void
  handleBackgroundImageDyChange: (value: number) => void
  handleChartBackgroundColorChange: (value: string) => void
  handleChartBackgroundColorClear: () => void
  handleActiveSelectionLayerChange: (layer: ActiveSelectionLayer) => void
  setSelectedElement: (value: string) => void
}

export function useEditorInputHandlers(
  params: UseEditorInputHandlersParams
): UseEditorInputHandlersResult {
  const {
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
    chartBackgroundId,
    setSelectedElement,
  } = params

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

  const handleChartFitChange = (next: ChartFit) => {
    dispatch({ type: 'SET_CHART_FIT', fit: next, userAdjusted: true })
  }

  const handleLayerOrderChange = (value: DesignSettings['layer_order']) => {
    updateDesign({ layer_order: value })
  }

  const handleLayerOpacityChange = (layer: LayerOrderKey, value: number) => {
    updateDesign({ layer_opacity: { ...design.layer_opacity, [layer]: value } })
  }

  const handleSignGlyphScaleChange = (value: number) => {
    updateDesign({ sign_glyph_scale: value })
  }

  const handlePlanetGlyphScaleChange = (value: number) => {
    updateDesign({ planet_glyph_scale: value })
  }

  const handleInnerRingScaleChange = (value: number) => {
    updateDesign({ inner_ring_scale: value })
  }

  const handleBackgroundImageScaleChange = (value: number) => {
    updateDesign({ background_image_scale: value })
  }

  const handleBackgroundImageDxChange = (value: number) => {
    updateDesign({ background_image_dx: value })
  }

  const handleBackgroundImageDyChange = (value: number) => {
    updateDesign({ background_image_dy: value })
  }

  const handleChartBackgroundColorChange = (value: string) => {
    dispatch({ type: 'APPLY_COLOR', targets: [chartBackgroundId], color: value })
  }

  const handleChartBackgroundColorClear = () => {
    dispatch({ type: 'APPLY_COLOR', targets: [chartBackgroundId], color: null })
  }

  const handleActiveSelectionLayerChange = (layer: ActiveSelectionLayer) => {
    dispatch({ type: 'SET_ACTIVE_SELECTION_LAYER', layer })
  }

  return {
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
    setSelectedElement,
  }
}
