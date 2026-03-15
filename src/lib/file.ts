import type { SceneDocument } from '../types/scene'

export function downloadScene(scene: SceneDocument) {
  const blob = new Blob([JSON.stringify(scene, null, 2)], {
    type: 'application/json',
  })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = `${scene.meta.name || 'scene'}.json`
  anchor.click()
  URL.revokeObjectURL(url)
}

export function readSceneFile(file: File): Promise<SceneDocument> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(new Error('文件读取失败'))
    reader.onload = () => {
      try {
        resolve(JSON.parse(String(reader.result)) as SceneDocument)
      } catch {
        reject(new Error('JSON 解析失败'))
      }
    }
    reader.readAsText(file, 'utf-8')
  })
}
