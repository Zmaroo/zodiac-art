import { useAutoDismissMessage } from './useAutoDismissMessage'

type StatusValue = string

type UseEditorStatusViewParams = {
  authError: StatusValue
  authStatus: StatusValue
  framesError: StatusValue
  chartsError: StatusValue
  chartsStatus: StatusValue
  chartSvgError: StatusValue
  frameCircleError: StatusValue
  frameCircleStatus: StatusValue
  editorError: StatusValue
  editorStatus: StatusValue
  uploadError: StatusValue
  uploadStatus: StatusValue
}

type UseEditorStatusViewResult = {
  debugItems: { label: string; value: string }[]
  inlineAuthError: string
  inlineAuthStatus: string
  inlineChartsError: string
  inlineChartsStatus: string
  inlineFramesError: string
  inlineFramesStatus: string
  inlineUploadError: string
  inlineUploadStatus: string
  inlineActionsError: string
  inlineActionsStatus: string
}

export function useEditorStatusView(params: UseEditorStatusViewParams): UseEditorStatusViewResult {
  const {
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
  } = params

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

  return {
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
  }
}
