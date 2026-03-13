import { useMemo } from 'react'
import { Layer, Line, Rect, Stage, Text } from 'react-konva'
import { getCatalogItem, getTileCatalogItem } from '../lib/catalog'
import { useEditorStore } from '../store/editorStore'

export function EditorCanvas2D() {
  const scene = useEditorStore((state) => state.scene)
  const selectedId = useEditorStore((state) => state.selectedId)
  const activeTileBrush = useEditorStore((state) => state.activeTileBrush)
  const moveElement = useEditorStore((state) => state.moveElement)
  const selectElement = useEditorStore((state) => state.selectElement)
  const paintTile = useEditorStore((state) => state.paintTile)
  const clearTile = useEditorStore((state) => state.clearTile)
  if (!scene) {
    return null
  }
  const cols = Math.floor(scene.canvas.width / scene.canvas.gridSize)
  const rows = Math.floor(scene.canvas.height / scene.canvas.gridSize)

  const gridLines = useMemo(() => {
    const lines: Array<number[]> = []

    for (let col = 0; col <= cols; col += 1) {
      const x = col * scene.canvas.gridSize
      lines.push([x, 0, x, scene.canvas.height])
    }

    for (let row = 0; row <= rows; row += 1) {
      const y = row * scene.canvas.gridSize
      lines.push([0, y, scene.canvas.width, y])
    }

    return lines
  }, [cols, rows, scene.canvas.gridSize, scene.canvas.height, scene.canvas.width])

  return (
    <div className="canvas-wrap">
      <div className="canvas-surface">
        <Stage
          height={scene.canvas.height}
          width={scene.canvas.width}
          onClick={(event) => {
            if (event.target === event.target.getStage()) {
              selectElement(null)
            }
          }}
        >
          <Layer>
            <Rect
              fill="#f8fafc"
              height={scene.canvas.height}
              width={scene.canvas.width}
            />
            {scene.tiles.map((tile) => {
              const info = getTileCatalogItem(tile.tileType)
              return (
                <Rect
                  key={tile.id}
                  fill={info.color}
                  height={scene.canvas.gridSize}
                  opacity={0.7}
                  width={scene.canvas.gridSize}
                  x={tile.col * scene.canvas.gridSize}
                  y={tile.row * scene.canvas.gridSize}
                  onClick={() => {
                    if (activeTileBrush) {
                      paintTile(tile.col, tile.row)
                    } else {
                      clearTile(tile.col, tile.row)
                    }
                  }}
                />
              )
            })}
            {gridLines.map((points, index) => (
              <Line
                key={index}
                opacity={0.26}
                points={points}
                stroke="#94a3b8"
                strokeWidth={1}
              />
            ))}
            {Array.from({ length: cols * rows }, (_, index) => {
              const col = index % cols
              const row = Math.floor(index / cols)
              return (
                <Rect
                  key={`grid-${col}-${row}`}
                  fill="transparent"
                  height={scene.canvas.gridSize}
                  width={scene.canvas.gridSize}
                  x={col * scene.canvas.gridSize}
                  y={row * scene.canvas.gridSize}
                  onClick={() => {
                    if (activeTileBrush) {
                      paintTile(col, row)
                    }
                  }}
                />
              )
            })}
          </Layer>

          <Layer>
            {scene.elements.map((element) => {
              const item = getCatalogItem(element.type)
              const isSelected = selectedId === element.id
              return (
                <Rect
                  key={element.id}
                  cornerRadius={14}
                  draggable
                  fill={item.color}
                  height={item.size.height}
                  offsetX={item.size.width / 2}
                  offsetY={item.size.height / 2}
                  opacity={0.9}
                  rotation={element.rotation}
                  shadowBlur={isSelected ? 16 : 6}
                  shadowColor={item.color}
                  stroke={isSelected ? '#0f172a' : '#ffffff'}
                  strokeWidth={isSelected ? 4 : 2}
                  width={item.size.width}
                  x={element.x}
                  y={element.y}
                  onClick={() => selectElement(element.id)}
                  onDragEnd={(event) =>
                    moveElement(element.id, event.target.x(), event.target.y())
                  }
                />
              )
            })}

            {scene.elements.map((element) => {
              const item = getCatalogItem(element.type)
              return (
                <Text
                  key={`${element.id}-label`}
                  align="center"
                  fill="#0f172a"
                  fontSize={14}
                  offsetX={item.size.width / 2}
                  text={item.title}
                  width={item.size.width}
                  x={element.x}
                  y={element.y - 8}
                />
              )
            })}
          </Layer>
        </Stage>
      </div>
      <div className="legend">
        <span>
          <i className="legend-swatch" style={{ background: '#38bdf8' }} />
          车位
        </span>
        <span>
          <i className="legend-swatch" style={{ background: '#fb7185' }} />
          充电桩
        </span>
        <span>
          <i className="legend-swatch" style={{ background: '#34d399' }} />
          储能柜
        </span>
      </div>
    </div>
  )
}
