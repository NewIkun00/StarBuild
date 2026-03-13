import { useEffect } from 'react'
import { useEditorStore } from '../store/editorStore'

export function useAutosave() {
  const appView = useEditorStore((state) => state.appView)
  const scene = useEditorStore((state) => state.scene)
  const saveDraft = useEditorStore((state) => state.saveDraft)

  useEffect(() => {
    if (appView !== 'editor' || !scene) {
      return
    }

    const timer = window.setTimeout(() => {
      void saveDraft()
    }, 800)

    return () => window.clearTimeout(timer)
  }, [appView, saveDraft, scene])
}
