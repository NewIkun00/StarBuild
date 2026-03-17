import { lazy, Suspense, useEffect, useMemo, useState } from 'react'
import './App.css'
import { CatalogSidebar } from './components/CatalogSidebar'
import { GroundSidebar } from './components/GroundSidebar'
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
  const selectedIds = useEditorStore((state) => state.selectedIds)
  const scene = useEditorStore((state) => state.scene)
  const initialize = useEditorStore((state) => state.initialize)
  const selectedElement = useMemo(
    () =>
      selectedIds.length === 1
        ? scene?.elements.find((item) => item.id === selectedId) ?? null
        : null,
    [scene, selectedId, selectedIds],
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
        <div className="left-panels">
          <CatalogSidebar catalog={sceneCatalog} />
          <GroundSidebar />
        </div>
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
