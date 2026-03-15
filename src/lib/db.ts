import Dexie, { type Table } from 'dexie'
import type { SceneDocument } from '../types/scene'

export interface SceneRecord {
  id: string
  scene: SceneDocument
  updatedAt: string
}

class EditorDatabase extends Dexie {
  scenes!: Table<SceneRecord, string>

  constructor() {
    super('starbuild-editor')
    this.version(1).stores({
      scenes: 'id, updatedAt',
    })
  }
}

export const editorDb = new EditorDatabase()
