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
    if (highlightElementsRef.current.length > 0) {
      highlightElementsRef.current.forEach((node) => node.classList.remove('selection-highlight'))
      highlightElementsRef.current = []
    }
    if (!selectedElement || !svgRef.current) {
      return
    }
    if (selectedElement === 'chartRoot' || selectedElement === 'chart.background') {
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
    nodesToHighlight.forEach((element) => element.classList.add('selection-highlight'))
    highlightElementsRef.current = nodesToHighlight
    return () => {
      highlightElementsRef.current.forEach((element) =>
        element.classList.remove('selection-highlight')
      )
      highlightElementsRef.current = []
    }
  }, [bulkIds, chartSvg, highlightElementsRef, outlineColor, selectedElement, svgRef])
}
