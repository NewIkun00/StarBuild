import createIcon from '../../assets/ChuangJiannnn.png'
import deleteIcon from '../../assets/ShanChuuuu.png'
import pointIcon from '../../assets/DianXuana.png'
import marqueeIcon from '../../assets/kuangxuana.png'
import brushIcon from '../../assets/ShuaXuanaa.png'
import { useEditorStore } from '../store/editorStore'

const actionOptions = [
  { key: 'create', label: '创建', icon: createIcon },
  { key: 'delete', label: '删除', icon: deleteIcon },
] as const

const modeOptions = [
  { key: 'point', label: '点选', icon: pointIcon },
  { key: 'marquee', label: '框选', icon: marqueeIcon },
  { key: 'brush', label: '刷选', icon: brushIcon },
] as const

export function GroundToolPanel() {
  const activeTileBrush = useEditorStore((state) => state.activeTileBrush)
  const groundEditAction = useEditorStore((state) => state.groundEditAction)
  const groundEditMode = useEditorStore((state) => state.groundEditMode)
  const setGroundEditAction = useEditorStore((state) => state.setGroundEditAction)
  const setGroundEditMode = useEditorStore((state) => state.setGroundEditMode)

  if (!activeTileBrush) {
    return null
  }

  return (
    <div className="ground-tool-panel">
      <div className="ground-tool-panel-group">
        {actionOptions.map((option) => {
          const isActive = option.key === groundEditAction
          return (
            <button
              key={option.key}
              className={`ground-tool-button ${isActive ? 'is-active' : 'is-inactive'}`}
              type="button"
              onClick={() => setGroundEditAction(option.key)}
            >
              <img alt="" className="ground-tool-button-icon" src={option.icon} />
              <span className="ground-tool-button-label">{option.label}</span>
            </button>
          )
        })}
      </div>
      <div className="ground-tool-panel-divider" />
      <div className="ground-tool-panel-group">
        {modeOptions.map((option) => {
          const isActive = option.key === groundEditMode
          return (
            <button
              key={option.key}
              className={`ground-tool-button ${isActive ? 'is-active' : 'is-inactive'}`}
              type="button"
              onClick={() => setGroundEditMode(option.key)}
            >
              <img alt="" className="ground-tool-button-icon" src={option.icon} />
              <span className="ground-tool-button-label">{option.label}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
