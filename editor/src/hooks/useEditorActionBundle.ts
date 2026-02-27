import { useEditorActions } from './useEditorActions'
import { useEditorHistory } from './useEditorHistory'
import { useEditorSync } from './useEditorSync'
import { useExport } from './useExport'
import { useLayoutActions } from './useLayoutActions'
import type {
  ChartFit,
  ChartMeta,
  DesignSettings,
  EditorDoc,
  FrameCircle,
  FrameDetail,
  Offset,
} from '../types'
import type { EditorAction } from '../state/editorReducer'

type UseEditorActionBundleParams = {
  apiBase: string
  jwt: string
  chartId: string
  selectedId: string
  isChartOnly: boolean
  meta: ChartMeta | null
  chartFit: ChartFit
  overrides: Record<string, Offset>
  design: DesignSettings
  frameCircle: FrameCircle | null
  frameMaskCutoff: number
  frameMaskOffwhiteBoost: number
  clientVersion: number
  setError: (value: string) => void
  setStatus: (value: string) => void
  dispatch: (action: EditorAction) => void
  editorDoc: EditorDoc
  draftKey: string
  chartName: string
  selectedFrameDetail: FrameDetail | null
  computeFitFromCircle: (metaData: ChartMeta, circle: FrameCircle) => ChartFit
}

export function useEditorActionBundle(params: UseEditorActionBundleParams) {
  const {
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
  } = params

  const { canUndo, canRedo, undo, redo } = useEditorHistory({
    chartFit,
    overrides,
    design,
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
    frameMaskCutoff,
    frameMaskOffwhiteBoost,
    clientVersion,
    setError,
    setStatus,
    dispatch,
  })

  const { syncStatus } = useEditorSync({
    jwt,
    doc: editorDoc,
    draftKey,
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

  return {
    saveAll,
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
  }
}
