import { lazy, Suspense, useEffect, useMemo, useState } from 'react'
import './App.css'
import { CatalogSidebar } from './components/CatalogSidebar'
import { HomePage } from './components/HomePage'
import { PropertiesPanel } from './components/PropertiesPanel'
import { SceneToolbar } from './components/SceneToolbar'
import { useAutosave } from './hooks/useAutosave'
import { sceneCatalog } from './lib/catalog'
import { useEditorStore } from './store/editorStore'

const EditorCanvas2D = lazy(() =>
  import('./components/EditorCanvas2D').then((module) => ({
    default: module.EditorCanvas2D,
  })),
)

const ThreePreview = lazy(() =>
  import('./components/ThreePreview').then((module) => ({
    default: module.ThreePreview,
  })),
)

function App() {
  const appView = useEditorStore((state) => state.appView)
  const mode = useEditorStore((state) => state.mode)
  const selectedId = useEditorStore((state) => state.selectedId)
  const scene = useEditorStore((state) => state.scene)
  const initialize = useEditorStore((state) => state.initialize)
  const selectedElement = useMemo(
    () => scene?.elements.find((item) => item.id === selectedId) ?? null,
    [scene, selectedId],
  )
  const [status, setStatus] = useState('正在初始化...')

  useEffect(() => {
    void initialize().then((message) => setStatus(message))
  }, [initialize])

  useAutosave()

  if (appView === 'home') {
    return <HomePage status={status} onStatusChange={setStatus} />
  }

  if (!scene) {
    return null
  }

  return (
    <div className="app-shell">
      <SceneToolbar onStatusChange={setStatus} />
      <main className="workspace">
        <CatalogSidebar catalog={sceneCatalog} />
        <section className="stage-panel">
          <Suspense
            fallback={<div className="canvas-loading">正在加载编辑器模块...</div>}
          >
            {mode === '2d' ? <EditorCanvas2D /> : <ThreePreview />}
          </Suspense>
        </section>
        <PropertiesPanel element={selectedElement} />
      </main>
    </div>
  )
}

export default App
