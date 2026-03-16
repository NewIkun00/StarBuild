import { useRef, useState } from 'react'
import chargerPreviewImage from '../../assets/CDZ555.png'
import collapseArrow from '../../assets/XiaLaaa.png'
import parkingPreviewImage from '../../assets/TYxiaochechewei.png'
import previewTileImage from '../../assets/Tuyuan99.png'
import { tileCatalog, type CatalogItem } from '../lib/catalog'
import { useEditorStore } from '../store/editorStore'

interface CatalogSidebarProps {
  catalog: CatalogItem[]
}

export function CatalogSidebar({ catalog }: CatalogSidebarProps) {
  const activeTileBrush = useEditorStore((state) => state.activeTileBrush)
  const toggleTileBrush = useEditorStore((state) => state.toggleTileBrush)
  const isDraggingRef = useRef(false)
  const [openSection, setOpenSection] = useState<
    'parking' | 'equipment' | 'business' | 'ground' | null
  >('parking')

  const parkingItems = catalog.filter((item) => item.type === 'parking')
  const equipmentItems = catalog.filter((item) => item.type !== 'parking')

  function toggleSection(section: 'parking' | 'equipment' | 'business' | 'ground') {
    setOpenSection((current) => (current === section ? null : section))
  }

  function emitAddAtViewportCenter(type: CatalogItem['type']) {
    window.dispatchEvent(
      new CustomEvent('catalog-add-at-viewport-center', {
        detail: { type },
      }),
    )
  }

  function handleDragStart(
    event: React.DragEvent<HTMLButtonElement>,
    type: CatalogItem['type'],
  ) {
    isDraggingRef.current = true
    const payload = JSON.stringify({ type })
    event.dataTransfer.setData('application/x-starbuild-element', payload)
    event.dataTransfer.setData('text/plain', payload)
    event.dataTransfer.effectAllowed = 'copy'
    window.dispatchEvent(
      new CustomEvent('catalog-drag-start', {
        detail: { type },
      }),
    )

    const dragImage = document.createElement('canvas')
    dragImage.width = 1
    dragImage.height = 1
    event.dataTransfer.setDragImage(dragImage, 0, 0)
  }

  function handleDragEnd() {
    isDraggingRef.current = false
    window.dispatchEvent(new CustomEvent('catalog-drag-end'))
  }

  function handleItemClick(type: CatalogItem['type']) {
    if (isDraggingRef.current) {
      return
    }
    emitAddAtViewportCenter(type)
  }

  return (
    <aside className="sidebar">
      <header className="sidebar-header">
        <h3>2D组件面板</h3>
      </header>

      <div className="sidebar-sections">
        <section className="sidebar-section">
          <button className="sidebar-section-header" type="button" onClick={() => toggleSection('parking')}>
            <span>车位</span>
            <img
              alt=""
              className={`sidebar-section-arrow ${openSection === 'parking' ? 'is-open' : ''}`}
              src={collapseArrow}
            />
          </button>
          {openSection === 'parking' && (
            <div className="sidebar-section-body">
              <div className="catalog-grid">
                {parkingItems.map((item) => (
                  <button
                    key={item.type}
                    className="catalog-tile"
                    draggable
                    type="button"
                    onClick={() => handleItemClick(item.type)}
                    onDragStart={(event) => handleDragStart(event, item.type)}
                    onDragEnd={handleDragEnd}
                  >
                    <span
                      className="catalog-tile-preview"
                      style={{ ['--catalog-tile-image' as string]: `url(${previewTileImage})` }}
                    >
                      <img alt="" className="catalog-tile-icon" src={parkingPreviewImage} />
                    </span>
                    <span className="catalog-tile-label">小车车位</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </section>

        <section className="sidebar-section">
          <button className="sidebar-section-header" type="button" onClick={() => toggleSection('equipment')}>
            <span>设备</span>
            <img
              alt=""
              className={`sidebar-section-arrow ${openSection === 'equipment' ? 'is-open' : ''}`}
              src={collapseArrow}
            />
          </button>
          {openSection === 'equipment' && (
            <div className="sidebar-section-body">
              <div className="catalog-grid">
                {equipmentItems.map((item) => (
                  <button
                    key={item.type}
                    className="catalog-tile"
                    draggable
                    type="button"
                    onClick={() => handleItemClick(item.type)}
                    onDragStart={(event) => handleDragStart(event, item.type)}
                    onDragEnd={handleDragEnd}
                  >
                    <span
                      className="catalog-tile-preview"
                      style={{ ['--catalog-tile-image' as string]: `url(${previewTileImage})` }}
                    >
                      {item.type === 'charger' ? (
                        <img alt="" className="catalog-tile-icon" src={chargerPreviewImage} />
                      ) : (
                        <span
                          className="catalog-tile-chip"
                          style={{ background: item.color }}
                        />
                      )}
                    </span>
                    <span className="catalog-tile-label">{item.title}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </section>

        <section className="sidebar-section">
          <button className="sidebar-section-header" type="button" onClick={() => toggleSection('business')}>
            <span>其他业务元素</span>
            <img
              alt=""
              className={`sidebar-section-arrow ${openSection === 'business' ? 'is-open' : ''}`}
              src={collapseArrow}
            />
          </button>
          {openSection === 'business' && (
            <div className="sidebar-section-body sidebar-empty">
              暂无可用业务元素
            </div>
          )}
        </section>

        <section className="sidebar-section">
          <button className="sidebar-section-header" type="button" onClick={() => toggleSection('ground')}>
            <span>地面环境信息</span>
            <img
              alt=""
              className={`sidebar-section-arrow ${openSection === 'ground' ? 'is-open' : ''}`}
              src={collapseArrow}
            />
          </button>
          {openSection === 'ground' && (
            <div className="sidebar-section-body">
              <div className="catalog-grid">
                {tileCatalog.map((tile) => (
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
                ))}
              </div>
            </div>
          )}
        </section>
      </div>
    </aside>
  )
}
