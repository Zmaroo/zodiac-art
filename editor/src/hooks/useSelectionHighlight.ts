import { useEffect } from 'react'

type UseSelectionHighlightParams = {
  selectedElement: string
  svgRef: React.RefObject<SVGSVGElement | null>
  chartSvg: string
  bulkIds: string[]
  highlightElementsRef: React.MutableRefObject<Element[]>
  highlightTimeoutRef: React.MutableRefObject<number | null>
}

export function useSelectionHighlight(params: UseSelectionHighlightParams) {
  const {
    selectedElement,
    svgRef,
    chartSvg,
    bulkIds,
    highlightElementsRef,
    highlightTimeoutRef,
  } = params

  useEffect(() => {
    if (highlightTimeoutRef.current) {
      window.clearTimeout(highlightTimeoutRef.current)
      highlightTimeoutRef.current = null
    }
    if (highlightElementsRef.current.length > 0) {
      highlightElementsRef.current.forEach((node) => node.classList.remove('selection-highlight'))
      highlightElementsRef.current = []
    }
    if (!selectedElement || !svgRef.current) {
      return
    }
    if (bulkIds.includes(selectedElement)) {
      return
    }
    const node = svgRef.current.querySelector(`[id="${CSS.escape(selectedElement)}"]`)
    if (!node) {
      return
    }
    const nodesToHighlight = [node, ...Array.from(node.querySelectorAll('*'))]
    nodesToHighlight.forEach((element) => element.classList.add('selection-highlight'))
    highlightElementsRef.current = nodesToHighlight
    highlightTimeoutRef.current = window.setTimeout(() => {
      highlightElementsRef.current.forEach((element) =>
        element.classList.remove('selection-highlight')
      )
      highlightElementsRef.current = []
      highlightTimeoutRef.current = null
    }, 1400)
    return () => {
      if (highlightTimeoutRef.current) {
        window.clearTimeout(highlightTimeoutRef.current)
        highlightTimeoutRef.current = null
      }
      highlightElementsRef.current.forEach((element) =>
        element.classList.remove('selection-highlight')
      )
      highlightElementsRef.current = []
    }
  }, [bulkIds, chartSvg, highlightElementsRef, highlightTimeoutRef, selectedElement, svgRef])
}
