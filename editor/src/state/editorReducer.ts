import type { ActiveSelectionLayer, ChartFit, DesignSettings, Offset } from '../types'

export type EditorState = {
  chartFit: ChartFit
  savedFit: ChartFit
  initialFit: ChartFit
  userAdjustedFit: boolean
  overrides: Record<string, Offset>
  initialOverrides: Record<string, Offset>
  design: DesignSettings
  initialDesign: DesignSettings
  selectedElement: string
  activeSelectionLayer: ActiveSelectionLayer
}

export type EditorAction =
  | { type: 'LOAD_LAYOUT'; fit: ChartFit; overrides: Record<string, Offset>; design: DesignSettings }
  | { type: 'SET_CHART_FIT'; fit: ChartFit; userAdjusted: boolean; setInitial?: boolean }
  | { type: 'SET_SAVED_FIT'; fit: ChartFit }
  | { type: 'SET_OVERRIDES'; overrides: Record<string, Offset>; setInitial?: boolean }
  | { type: 'SET_DESIGN'; design: DesignSettings; setInitial?: boolean }
  | { type: 'APPLY_COLOR'; targets: string[]; color: string | null }
  | { type: 'SET_SELECTED_ELEMENT'; id: string }
  | { type: 'SET_ACTIVE_SELECTION_LAYER'; layer: ActiveSelectionLayer }
  | { type: 'CLEAR_SELECTION' }
  | { type: 'RESET_TO_INITIAL' }
  | { type: 'RESET_TO_SAVED' }
  | { type: 'AUTO_FIT_APPLIED'; fit: ChartFit }
  | { type: 'RESET_USER_ADJUSTED' }
  | { type: 'SET_USER_ADJUSTED'; value: boolean }

export function createInitialEditorState(defaultFit: ChartFit, defaultDesign: DesignSettings): EditorState {
  return {
    chartFit: defaultFit,
    savedFit: defaultFit,
    initialFit: defaultFit,
    userAdjustedFit: false,
    overrides: {},
    initialOverrides: {},
    design: defaultDesign,
    initialDesign: defaultDesign,
    selectedElement: '',
    activeSelectionLayer: 'auto',
  }
}

export function editorReducer(state: EditorState, action: EditorAction): EditorState {
  switch (action.type) {
    case 'LOAD_LAYOUT':
      return {
        ...state,
        chartFit: action.fit,
        savedFit: action.fit,
        initialFit: action.fit,
        overrides: action.overrides,
        initialOverrides: action.overrides,
        design: action.design,
        initialDesign: action.design,
        selectedElement: '',
        activeSelectionLayer: 'auto',
      }
    case 'SET_CHART_FIT':
      return {
        ...state,
        chartFit: action.fit,
        userAdjustedFit: action.userAdjusted,
        initialFit: action.setInitial ? action.fit : state.initialFit,
      }
    case 'SET_SAVED_FIT':
      return {
        ...state,
        savedFit: action.fit,
      }
    case 'SET_OVERRIDES':
      return {
        ...state,
        overrides: action.overrides,
        initialOverrides: action.setInitial ? action.overrides : state.initialOverrides,
      }
    case 'SET_DESIGN':
      return {
        ...state,
        design: action.design,
        initialDesign: action.setInitial ? action.design : state.initialDesign,
      }
    case 'APPLY_COLOR': {
      const next = { ...state.overrides }
      action.targets.forEach((id) => {
        const existing = next[id] || {}
        if (!action.color) {
          const rest = { ...existing }
          delete rest.color
          if (Object.keys(rest).length === 0) {
            delete next[id]
          } else {
            next[id] = rest
          }
          return
        }
        next[id] = { ...existing, color: action.color }
      })
      return {
        ...state,
        overrides: next,
      }
    }
    case 'SET_SELECTED_ELEMENT':
      return {
        ...state,
        selectedElement: action.id,
      }
    case 'SET_ACTIVE_SELECTION_LAYER':
      return {
        ...state,
        activeSelectionLayer: action.layer,
      }
    case 'CLEAR_SELECTION':
      return {
        ...state,
        selectedElement: '',
      }
    case 'RESET_TO_INITIAL':
      return {
        ...state,
        chartFit: state.initialFit,
        overrides: state.initialOverrides,
        design: state.initialDesign,
        selectedElement: '',
        activeSelectionLayer: 'auto',
        userAdjustedFit: false,
      }
    case 'RESET_TO_SAVED':
      return {
        ...state,
        chartFit: state.savedFit,
        initialFit: state.savedFit,
        userAdjustedFit: true,
      }
    case 'AUTO_FIT_APPLIED':
      return {
        ...state,
        chartFit: action.fit,
        initialFit: action.fit,
        userAdjustedFit: true,
      }
    case 'RESET_USER_ADJUSTED':
      return {
        ...state,
        userAdjustedFit: false,
      }
    case 'SET_USER_ADJUSTED':
      return {
        ...state,
        userAdjustedFit: action.value,
      }
    default:
      return state
  }
}
