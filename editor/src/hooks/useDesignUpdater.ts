import type { DesignSettings, LayerOrderKey } from '../types'
import type { EditorAction } from '../state/editorReducer'

type UseDesignUpdaterParams = {
  design: DesignSettings
  dispatch: (action: EditorAction) => void
}

export function useDesignUpdater(params: UseDesignUpdaterParams) {
  const { design, dispatch } = params

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

  return { updateDesign }
}
