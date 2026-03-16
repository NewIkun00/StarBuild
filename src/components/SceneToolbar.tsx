import measureIcon from '../../assets/CeJu.png'
import deleteElementIcon from '../../assets/Shanccchu.png'
import saveStatusIcon from '../../assets/DuiGou.png'
import backHomeIcon from '../../assets/FanHuiShouYe.png'
import logoImage from '../../assets/Logo.png'
import hideGridIcon from '../../assets/YinCangGrid.png'
import showGridIcon from '../../assets/Xianshigrid.png'
import saveSceneIcon from '../../assets/XiaZai999.png'
import { downloadScene } from '../lib/file'
import { useEditorStore } from '../store/editorStore'

interface SceneToolbarProps {
  onStatusChange: (message: string) => void
}

function formatSavedTime(value: string) {
  const date = new Date(value)
  const year = date.getFullYear()
  const month = date.getMonth() + 1
  const day = date.getDate()
  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')
  return `${year}年${month}月${day}日 ${hours}:${minutes}`
}

export function SceneToolbar({ onStatusChange }: SceneToolbarProps) {
  const mode = useEditorStore((state) => state.mode)
  const scene = useEditorStore((state) => state.scene)
  const selectedIds = useEditorStore((state) => state.selectedIds)
  const showGrid = useEditorStore((state) => state.showGrid)
  const measureMode = useEditorStore((state) => state.measureMode)
  const setMode = useEditorStore((state) => state.setMode)
  const returnHome = useEditorStore((state) => state.returnHome)
  const deleteSelectedElement = useEditorStore((state) => state.deleteSelectedElement)
  const setShowGrid = useEditorStore((state) => state.setShowGrid)
  const setMeasureMode = useEditorStore((state) => state.setMeasureMode)

  if (!scene) {
    return null
  }

  const currentScene = scene

  function handleSaveScene() {
    downloadScene(currentScene)
    onStatusChange(`已下载 ${currentScene.meta.name}`)
  }

  function handleDeleteElement() {
    if (selectedIds.length === 0) {
      return
    }
    deleteSelectedElement()
    onStatusChange('已删除选中组件')
  }

  return (
    <header className="toolbar">
      <div className="toolbar-left">
        <div className="brand-lockup toolbar-logo-lockup">
          <img alt="星搭 Logo" className="brand-logo" src={logoImage} />
          <div className="brand-wordmark">星 搭</div>
        </div>
        <button className="toolbar-home" type="button" onClick={() => void returnHome()}>
          <img alt="" className="toolbar-home-icon" src={backHomeIcon} />
          <span>返回首页</span>
        </button>
        <span aria-hidden="true" className="toolbar-divider" />
        <div className="toolbar-scene-name">{currentScene.meta.name}</div>
        <div className="toolbar-save-status">
          <img alt="" className="toolbar-save-status-icon" src={saveStatusIcon} />
          <span>修改已保存 {formatSavedTime(currentScene.meta.updatedAt)}</span>
        </div>
      </div>

      {mode === '2d' && (
        <div className="toolbar-center">
          <div className="toolbar-tools" aria-label="2D功能区">
            <span className="toolbar-tool" data-tooltip="删除">
              <button
                className="toolbar-tool-button"
                disabled={selectedIds.length === 0}
                type="button"
                onClick={handleDeleteElement}
              >
                <img alt="" className="toolbar-tool-icon" src={deleteElementIcon} />
              </button>
            </span>
            <span className="toolbar-tool" data-tooltip="显示网格">
              <button
                className="toolbar-tool-button"
                disabled={showGrid}
                type="button"
                onClick={() => setShowGrid(true)}
              >
                <img alt="" className="toolbar-tool-icon" src={showGridIcon} />
              </button>
            </span>
            <span className="toolbar-tool" data-tooltip="隐藏网格">
              <button
                className="toolbar-tool-button"
                disabled={!showGrid}
                type="button"
                onClick={() => setShowGrid(false)}
              >
                <img alt="" className="toolbar-tool-icon" src={hideGridIcon} />
              </button>
            </span>
            <span className="toolbar-tool" data-tooltip="测距">
              <button
                className={`toolbar-tool-button ${measureMode ? 'is-active' : ''}`}
                type="button"
                onClick={() => setMeasureMode(!measureMode)}
              >
                <img alt="" className="toolbar-tool-icon" src={measureIcon} />
                {measureMode && <span aria-hidden="true" className="toolbar-tool-indicator" />}
              </button>
            </span>
          </div>
        </div>
      )}

      <div className="toolbar-right">
        <div className="mode-switch" role="tablist" aria-label="视图模式切换">
          <button
            className={`mode-switch-label ${mode === '2d' ? 'is-active' : ''}`}
            type="button"
            onClick={() => setMode('2d')}
          >
            2D模式
          </button>
          <button
            className={`mode-switch-track ${mode === '3d' ? 'is-3d' : ''}`}
            type="button"
            aria-label={mode === '2d' ? '切换到3D模式' : '切换到2D模式'}
            onClick={() => setMode(mode === '2d' ? '3d' : '2d')}
          >
            <span className="mode-switch-thumb" />
          </button>
          <button
            className={`mode-switch-label ${mode === '3d' ? 'is-active' : ''}`}
            type="button"
            onClick={() => setMode('3d')}
          >
            3D模式
          </button>
        </div>
        <button className="toolbar-save-button" type="button" onClick={handleSaveScene}>
          <img alt="" className="toolbar-save-button-icon" src={saveSceneIcon} />
          <span>保存场景</span>
        </button>
      </div>
    </header>
  )
}
