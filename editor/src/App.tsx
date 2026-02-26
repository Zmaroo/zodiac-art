import './App.css'
import Canvas from './components/Canvas'
import Sidebar from './components/Sidebar'
import { useEditorApp } from './hooks/useEditorApp'

function App() {
  const { sidebarProps, canvasProps } = useEditorApp()


  return (
    <div className="app">
      <Sidebar {...sidebarProps} />
      <Canvas {...canvasProps} />
    </div>
  )
}

export default App
