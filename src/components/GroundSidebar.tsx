import previewTileImage from '../../assets/Tuyuan99.png'
import { getTileCatalogItem } from '../lib/catalog'
import { useEditorStore } from '../store/editorStore'
import type { TileType } from '../types/scene'

const groundPalette: TileType[] = ['road', 'concrete', 'green', 'water', 'path']

export function GroundSidebar() {
  const activeTileBrush = useEditorStore((state) => state.activeTileBrush)
  const toggleTileBrush = useEditorStore((state) => state.toggleTileBrush)

  return (
    <aside className="sidebar">
      <header className="sidebar-header">
        <h3>地面环境信息</h3>
      </header>

      <div className="sidebar-sections">
        <div className="sidebar-section-body">
          <div className="catalog-grid">
            {groundPalette.map((tileType) => {
              const tile = getTileCatalogItem(tileType)
              return (
                <button
                  key={tile.type}
                  className={`catalog-tile ${activeTileBrush === tile.type ? 'is-active' : ''}`}
                  type="button"
                  onClick={() => toggleTileBrush(tile.type)}
                >
                  <span
                    className="catalog-tile-preview"
                    style={{ ['--catalog-tile-image' as string]: `url(${previewTileImage})` }}
                  >
                    <span
                      className="catalog-tile-chip"
                      style={{ background: tile.color }}
                    />
                  </span>
                  <span className="catalog-tile-label">{tile.title}</span>
                </button>
              )
            })}
          </div>
        </div>
      </div>
    </aside>
  )
}
