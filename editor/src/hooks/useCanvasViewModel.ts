import type { CanvasProps } from '../components/Canvas'

type UseCanvasViewModelParams = Omit<CanvasProps, 'showFrameCircleDebug'> & {
  showFrameCircleDebug: boolean
}

export function useCanvasViewModel(params: UseCanvasViewModelParams): CanvasProps {
  return {
    ...params,
    showFrameCircleDebug: params.showFrameCircleDebug && import.meta.env.DEV,
  }
}
