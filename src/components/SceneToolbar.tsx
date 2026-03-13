import type { ChangeEvent } from 'react'
import { downloadScene, readSceneFile } from '../lib/file'
import { useEditorStore } from '../store/editorStore'

interface SceneToolbarProps {
  status: string
  onStatusChange: (message: string) => void
}

export function SceneToolbar({
  status,
  onStatusChange,
}: SceneToolbarProps) {
  const mode = useEditorStore((state) => state.mode)
  const scene = useEditorStore((state) => state.scene)
  const setMode = useEditorStore((state) => state.setMode)
  const saveDraft = useEditorStore((state) => state.saveDraft)
  const returnHome = useEditorStore((state) => state.returnHome)

  async function handleImport(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) {
      return
    }

    try {
      const imported = await readSceneFile(file)
      const importSceneToLibrary = useEditorStore.getState().importSceneToLibrary
      await importSceneToLibrary(imported)
      onStatusChange(`已导入 ${file.name}`)
    } catch (error) {
      onStatusChange(error instanceof Error ? error.message : '导入失败')
    } finally {
      event.target.value = ''
    }
  }

  async function handleSaveDraft() {
    await saveDraft()
    onStatusChange('草稿已保存到本机 IndexedDB')
  }

  return (
    <header className="toolbar">
      <div className="toolbar-brand">
        <div>
          <h2>新能源站点场景编辑器</h2>
          <p>2D 编排、JSON 存档、本地草稿恢复、ThreeJS 预览入口</p>
        </div>
        <span className="toolbar-status">{status}</span>
      </div>

      <div className="toolbar-actions">
        <button type="button" onClick={() => void returnHome()}>
          返回首页
        </button>
        <button type="button" onClick={handleSaveDraft}>
          立即缓存
        </button>
        <button type="button" onClick={() => scene && downloadScene(scene)}>
          导出 JSON
        </button>
        <label className="button-like">
          导入 JSON
          <input accept="application/json,.json" type="file" onChange={handleImport} />
        </label>
        <button
          className="mode-button"
          type="button"
          onClick={() => setMode(mode === '2d' ? '3d' : '2d')}
        >
          切换到 {mode === '2d' ? '3D 预览' : '2D 编辑'}
        </button>
        <button className="primary" type="button" onClick={() => setMode('3d')}>
          进入 ThreeJS 预览
        </button>
      </div>
    </header>
  )
}
