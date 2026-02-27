import type {
  ActiveSelectionLayer,
  ChartFit,
  DesignSettings,
  LayerOrderKey,
} from '../types'
import type { DesignSectionProps } from '../components/sidebar/DesignSection'

type UseDesignSectionViewModelParams = {
  chartFit: ChartFit
  onChartFitChange: (next: ChartFit) => void
  design: DesignSettings
  onLayerOrderChange: (value: LayerOrderKey[]) => void
  onLayerOpacityChange: (layer: LayerOrderKey, value: number) => void
  hasFrame: boolean
  hasChartBackground: boolean
  hasBackgroundImage: boolean
  backgroundImagePath: string | null
  backgroundImageUrl: string
  backgroundImageError: string
  backgroundImageStatus: string
  backgroundImageUploading: boolean
  onBackgroundImageUpload: (file: File | null) => void
  onBackgroundImageClear: () => void
  backgroundImageScale: number
  backgroundImageDx: number
  backgroundImageDy: number
  onBackgroundImageScaleChange: (value: number) => void
  onBackgroundImageDxChange: (value: number) => void
  onBackgroundImageDyChange: (value: number) => void
  onSignGlyphScaleChange: (value: number) => void
  onPlanetGlyphScaleChange: (value: number) => void
  onInnerRingScaleChange: (value: number) => void
  selectedElement: string
  selectableGroups: { label: string; items: { id: string; label: string }[] }[]
  onSelectedElementChange: (value: string) => void
  activeSelectionLayer: ActiveSelectionLayer
  onActiveSelectionLayerChange: (value: ActiveSelectionLayer) => void
  selectionColor: string
  selectionColorMixed: boolean
  selectionEnabled: boolean
  onColorChange: (color: string) => void
  onClearColor: () => void
  chartLinesColor: string
  onChartLinesColorChange: (color: string) => void
  onClearChartLinesColor: () => void
  chartBackgroundColor: string
  onChartBackgroundColorChange: (color: string) => void
  onClearChartBackgroundColor: () => void
  radialMoveEnabled: boolean
  onRadialMoveEnabledChange: (value: boolean) => void
  frameMaskCutoff: number
  onFrameMaskCutoffChange: (value: number) => void
  frameMaskOffwhiteBoost: number
  onFrameMaskOffwhiteBoostChange: (value: number) => void
  frameMaskEnabled: boolean
  onFrameMaskActivate: () => void
  frameMaskGuideVisible: boolean
  onFrameMaskGuideVisibleChange: (value: boolean) => void
  frameMaskLockAspect: boolean
  onFrameMaskLockAspectChange: (value: boolean) => void
  onSnapFrameMask: () => void
  onClearFrameMask: () => void
}

export function useDesignSectionViewModel(
  params: UseDesignSectionViewModelParams
): DesignSectionProps {
  return {
    chartFit: {
      value: params.chartFit,
      onChange: params.onChartFitChange,
    },
    layering: {
      design: params.design,
      onLayerOrderChange: params.onLayerOrderChange,
      onLayerOpacityChange: params.onLayerOpacityChange,
      hasFrame: params.hasFrame,
      hasChartBackground: params.hasChartBackground,
      hasBackgroundImage: params.hasBackgroundImage,
    },
    backgroundImage: {
      path: params.backgroundImagePath,
      url: params.backgroundImageUrl,
      error: params.backgroundImageError,
      status: params.backgroundImageStatus,
      uploading: params.backgroundImageUploading,
      onUpload: params.onBackgroundImageUpload,
      onClear: params.onBackgroundImageClear,
      scale: params.backgroundImageScale,
      dx: params.backgroundImageDx,
      dy: params.backgroundImageDy,
      onScaleChange: params.onBackgroundImageScaleChange,
      onDxChange: params.onBackgroundImageDxChange,
      onDyChange: params.onBackgroundImageDyChange,
    },
    glyphScale: {
      onSignGlyphScaleChange: params.onSignGlyphScaleChange,
      onPlanetGlyphScaleChange: params.onPlanetGlyphScaleChange,
      onInnerRingScaleChange: params.onInnerRingScaleChange,
    },
    selection: {
      selectedElement: params.selectedElement,
      selectableGroups: params.selectableGroups,
      onSelectedElementChange: params.onSelectedElementChange,
      selectionColor: params.selectionColor,
      selectionColorMixed: params.selectionColorMixed,
      selectionEnabled: params.selectionEnabled,
      onColorChange: params.onColorChange,
      onClearColor: params.onClearColor,
      chartLinesColor: params.chartLinesColor,
      onChartLinesColorChange: params.onChartLinesColorChange,
      onClearChartLinesColor: params.onClearChartLinesColor,
      chartBackgroundColor: params.chartBackgroundColor,
      onChartBackgroundColorChange: params.onChartBackgroundColorChange,
      onClearChartBackgroundColor: params.onClearChartBackgroundColor,
      radialMoveEnabled: params.radialMoveEnabled,
      onRadialMoveEnabledChange: params.onRadialMoveEnabledChange,
      frameMaskCutoff: params.frameMaskCutoff,
      onFrameMaskCutoffChange: params.onFrameMaskCutoffChange,
      frameMaskOffwhiteBoost: params.frameMaskOffwhiteBoost,
      onFrameMaskOffwhiteBoostChange: params.onFrameMaskOffwhiteBoostChange,
      frameMaskEnabled: params.frameMaskEnabled,
      onFrameMaskActivate: params.onFrameMaskActivate,
      activeSelectionLayer: params.activeSelectionLayer,
      onActiveSelectionLayerChange: params.onActiveSelectionLayerChange,
      frameMaskGuideVisible: params.frameMaskGuideVisible,
      onFrameMaskGuideVisibleChange: params.onFrameMaskGuideVisibleChange,
      frameMaskLockAspect: params.frameMaskLockAspect,
      onFrameMaskLockAspectChange: params.onFrameMaskLockAspectChange,
      onSnapFrameMask: params.onSnapFrameMask,
      onClearFrameMask: params.onClearFrameMask,
    },
  }
}
