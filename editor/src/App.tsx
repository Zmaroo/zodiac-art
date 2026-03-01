import './App.css'
import Canvas from './components/Canvas'
import Sidebar from './components/Sidebar'
import MockupPlacementCanvas from './components/MockupPlacementCanvas'
import CheckoutSuccess from './components/CheckoutSuccess'
import { useEditorApp } from './hooks/useEditorApp'

function App() {
  const { sidebarProps, canvasProps } = useEditorApp()


  const isSuccess = new URLSearchParams(window.location.search).get('success') === 'true'

  if (isSuccess) {
    return <CheckoutSuccess />
  }

  return (
    <div className="app">
      <Sidebar {...sidebarProps} />
      {sidebarProps.shop.selectedBlueprintId ? (
        <MockupPlacementCanvas shop={sidebarProps.shop} canvasProps={canvasProps} />
      ) : (
        <Canvas {...canvasProps} />
      )}
    </div>
  )
}

export default App
