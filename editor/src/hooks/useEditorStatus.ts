import { useEditorStatusView } from './useEditorStatusView'
import { useSidebarClears } from './useSidebarClears'
import { useSidebarMessages } from './useSidebarMessages'

type UseEditorStatusParams = {
  authError: string
  authStatus: string
  framesError: string
  framesStatus: string
  chartsError: string
  chartsStatus: string
  chartSvgError: string
  frameCircleError: string
  frameCircleStatus: string
  editorError: string
  editorStatus: string
  uploadError: string
  uploadStatus: string
  draftStatus: string
  draftInfo: string
  syncStatus: string
  debugExtras?: { label: string; value: string }[]
  clearAuthError: () => void
  clearAuthStatus: () => void
  clearChartsError: () => void
  clearChartsStatus: () => void
  clearFramesError: () => void
  clearFramesStatus: () => void
  clearFrameCircleStatus: () => void
  clearUploadMessages: () => void
}

export function useEditorStatus(params: UseEditorStatusParams) {
  const {
    authError,
    authStatus,
    framesError,
    framesStatus,
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
    debugExtras,
    clearAuthError,
    clearAuthStatus,
    clearChartsError,
    clearChartsStatus,
    clearFramesError,
    clearFramesStatus,
    clearFrameCircleStatus,
    clearUploadMessages,
  } = params

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
    framesStatus,
    chartsError,
    chartsStatus,
    chartSvgError,
    frameCircleError,
    frameCircleStatus,
    editorError,
    editorStatus,
    uploadError,
    uploadStatus,
    extraDebugItems: debugExtras,
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
      clearFramesStatus()
      clearFrameCircleStatus()
    },
    onClearUploadMessages: clearUploadMessages,
  })

  return { sidebarMessages, sidebarClears, debugItems }
}
