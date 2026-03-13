import { tileCatalog, type CatalogItem } from '../lib/catalog'
import { useEditorStore } from '../store/editorStore'

interface CatalogSidebarProps {
  catalog: CatalogItem[]
}

export function CatalogSidebar({ catalog }: CatalogSidebarProps) {
  const addElement = useEditorStore((state) => state.addElement)
  const activeTileBrush = useEditorStore((state) => state.activeTileBrush)
  const toggleTileBrush = useEditorStore((state) => state.toggleTileBrush)

  return (
    <aside className="sidebar">
      <p className="eyebrow">设备库</p>
      <h3>2D 组件面板</h3>
      <p className="panel-note">先放置设备，再用右侧参数面板调整型号、样式和角度。</p>

      <div className="catalog-list">
        {catalog.map((item) => (
          <article className="catalog-card" key={item.type}>
            <h4>{item.title}</h4>
            <p>{item.description}</p>
            <button type="button" onClick={() => addElement(item.type)}>
              添加到画布
            </button>
          </article>
        ))}
      </div>

      <div className="panel-section">
        <p className="eyebrow">地面网格</p>
        <h3>地面笔刷</h3>
        <p className="panel-note">点击选中笔刷后，在中间画布里直接点选网格。</p>
        <div className="tile-grid">
          {tileCatalog.map((tile) => (
            <button
              className={`tile-button ${activeTileBrush === tile.type ? 'active' : ''}`}
              key={tile.type}
              style={{ boxShadow: `inset 0 0 0 18px ${tile.color}22` }}
              type="button"
              onClick={() => toggleTileBrush(tile.type)}
            >
              {tile.title}
            </button>
          ))}
        </div>
      </div>
    </aside>
  )
}
