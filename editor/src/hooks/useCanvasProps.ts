import { useCanvasViewModel } from './useCanvasViewModel'
import type { CanvasProps } from '../components/Canvas'

type UseCanvasPropsParams = Omit<CanvasProps, 'showFrameCircleDebug'> & {
  showFrameCircleDebug: boolean
}

export function useCanvasProps(params: UseCanvasPropsParams): CanvasProps {
  return useCanvasViewModel(params)
}
