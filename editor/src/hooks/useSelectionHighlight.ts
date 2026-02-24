import { useEffect } from 'react'

type UseSelectionHighlightParams = {
  selectedElement: string
  svgRef: React.RefObject<SVGSVGElement | null>
  chartSvg: string
  bulkIds: string[]
  outlineColor: string
  highlightElementsRef: React.MutableRefObject<Element[]>
}

export function useSelectionHighlight(params: UseSelectionHighlightParams) {
  const {
    selectedElement,
    svgRef,
    chartSvg,
    bulkIds,
    outlineColor,
    highlightElementsRef,
  } = params

  useEffect(() => {
    const restoreAttribute = (node: Element, attr: string) => {
      const dataKey = `data-prev-${attr}`
      if (!node.hasAttribute(dataKey)) {
        return
      }
      const prev = node.getAttribute(dataKey)
      node.removeAttribute(dataKey)
      if (prev === null || prev === '') {
        node.removeAttribute(attr)
      } else {
        node.setAttribute(attr, prev)
      }
    }

    if (highlightElementsRef.current.length > 0) {
      highlightElementsRef.current.forEach((node) => {
        node.classList.remove('selection-highlight')
        restoreAttribute(node, 'stroke')
        restoreAttribute(node, 'stroke-width')
        restoreAttribute(node, 'paint-order')
        restoreAttribute(node, 'vector-effect')
      })
      highlightElementsRef.current = []
    }
    if (!selectedElement || !svgRef.current) {
      return
    }
    if (
      selectedElement === 'chartRoot' ||
      selectedElement === 'chart.background' ||
      selectedElement === 'chart.background_image'
    ) {
      return
    }
    if (bulkIds.includes(selectedElement)) {
      return
    }
    svgRef.current.style.setProperty(
      '--selection-outline-color',
      outlineColor || '#d9730d'
    )
    const node = svgRef.current.querySelector(`[id="${CSS.escape(selectedElement)}"]`)
    if (!node) {
      return
    }
    const nodesToHighlight = [node, ...Array.from(node.querySelectorAll('*'))]
    nodesToHighlight.forEach((element) => {
      const setAttr = (attr: string, value: string) => {
        const dataKey = `data-prev-${attr}`
        if (!element.hasAttribute(dataKey)) {
          element.setAttribute(dataKey, element.getAttribute(attr) ?? '')
        }
        element.setAttribute(attr, value)
      }
      element.classList.add('selection-highlight')
      setAttr('stroke', outlineColor || '#d9730d')
      setAttr('stroke-width', '2.5')
      setAttr('paint-order', 'stroke fill')
      setAttr('vector-effect', 'non-scaling-stroke')
    })
    highlightElementsRef.current = nodesToHighlight
    return () => {
      highlightElementsRef.current.forEach((element) =>
        element.classList.remove('selection-highlight')
      )
      highlightElementsRef.current = []
    }
  }, [bulkIds, chartSvg, highlightElementsRef, outlineColor, selectedElement, svgRef])
}
