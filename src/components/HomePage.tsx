import { useRef, useState, type ChangeEvent } from 'react'
import metaIcon from '../../assets/668ss.png'
import backgroundImage from '../../assets/Back999.png'
import logoImage from '../../assets/Logo.png'
import createIcon from '../../assets/XinJian2.png'
import sceneCardImage from '../../assets/ShouYEKAPian.png'
import { editorDb } from '../lib/db'
import { downloadScene, readSceneFile } from '../lib/file'
import { useEditorStore } from '../store/editorStore'

type RenameTarget = {
  id: string
  currentName: string
  nextName: string
}

type DeleteTarget = {
  id: string
  name: string
}

export function HomePage({
  status,
  onStatusChange,
}: {
  status: string
  onStatusChange: (message: string) => void
}) {
  void status
  const scenes = useEditorStore((state) => state.scenes)
  const templates = useEditorStore((state) => state.templates)
  const openScene = useEditorStore((state) => state.openScene)
  const createEmptyScene = useEditorStore((state) => state.createEmptyScene)
  const createSceneFromTemplate = useEditorStore(
    (state) => state.createSceneFromTemplate,
  )
  const importSceneToLibrary = useEditorStore((state) => state.importSceneToLibrary)
  const deleteScene = useEditorStore((state) => state.deleteScene)
  const renameScene = useEditorStore((state) => state.renameScene)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const [showCreatePanel, setShowCreatePanel] = useState(false)
  const [renameTarget, setRenameTarget] = useState<RenameTarget | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null)

  async function handleImport(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) {
      return
    }

    try {
      const scene = await readSceneFile(file)
      await importSceneToLibrary(scene)
      onStatusChange(`已导入 ${file.name}`)
      setShowCreatePanel(false)
    } catch (error) {
      onStatusChange(error instanceof Error ? error.message : '导入失败')
    } finally {
      event.target.value = ''
    }
  }

  async function handleDownload(id: string) {
    const record = await editorDb.scenes.get(id)
    if (!record) {
      onStatusChange('未找到要下载的场景')
      return
    }

    downloadScene(record.scene)
    onStatusChange(`已下载 ${record.scene.meta.name}`)
  }

  async function submitRename() {
    if (!renameTarget) {
      return
    }

    const nextName = renameTarget.nextName.trim()
    if (!nextName) {
      return
    }

    await renameScene(renameTarget.id, nextName)
    onStatusChange(`已重命名为 ${nextName}`)
    setRenameTarget(null)
  }

  async function submitDelete() {
    if (!deleteTarget) {
      return
    }

    await deleteScene(deleteTarget.id)
    onStatusChange(`已删除项目 ${deleteTarget.name}`)
    setDeleteTarget(null)
  }

  return (
    <main
      className="landing-shell"
      style={{ ['--landing-background' as string]: `url(${backgroundImage})` }}
    >
      <header className="landing-topbar">
        <div className="brand-lockup">
          <img alt="星搭 Logo" className="brand-logo" src={logoImage} />
          <div className="brand-wordmark">星 搭</div>
          <span className="brand-separator">|</span>
          <span className="brand-subtitle">无代码3D场景编辑器</span>
        </div>
      </header>

      <section className="landing-hero">
        <h1>快速搭建场景</h1>
        <p className="landing-copy">
          无脑搭建场景，但请注意本网站无服务器，因此每做一个场景、每编辑一段时间及时保存到本地，防止场景丢失。
        </p>
        <div className="landing-actions">
          <button
            className="landing-primary"
            type="button"
            onClick={() => setShowCreatePanel((value) => !value)}
          >
            <img alt="" className="landing-primary-icon" src={createIcon} />
            <span className="landing-primary-label">新建场景</span>
          </button>
          <div className="project-count">
            已有场景 <strong>{scenes.length}</strong> 个
          </div>
        </div>

        {showCreatePanel && (
          <div className="landing-create-panel">
            <div className="template-card">
              <h4>从模板新建</h4>
              <p>适合快速生成标准光储充站点布局。</p>
              {templates.map((template) => (
                <button
                  key={template.id}
                  type="button"
                  onClick={() => {
                    void createSceneFromTemplate(template.id)
                    onStatusChange(`已基于模板 ${template.name} 创建场景`)
                  }}
                >
                  使用 {template.name}
                </button>
              ))}
            </div>
            <div className="template-card">
              <h4>从本地文件导入</h4>
              <p>导入之前导出的 JSON 场景，并加入本地项目列表。</p>
              <button type="button" onClick={() => fileInputRef.current?.click()}>
                选择 JSON 文件
              </button>
              <input
                ref={fileInputRef}
                accept="application/json,.json"
                type="file"
                onChange={handleImport}
              />
            </div>
            <div className="template-card">
              <h4>新建空场景</h4>
              <p>从空白画布开始，自由搭建设备和地面元素。</p>
              <button
                type="button"
                onClick={() => {
                  void createEmptyScene()
                  onStatusChange('已创建空场景')
                }}
              >
                创建空场景
              </button>
            </div>
          </div>
        )}
      </section>

      <section className="scene-wall">
        {scenes.length === 0 && (
          <button
            className="scene-card scene-card-create"
            type="button"
            onClick={() => setShowCreatePanel(true)}
          >
            <div className="create-icon">+</div>
            <h3>创建新场景</h3>
            <span>Create New</span>
          </button>
        )}

        {scenes.map((scene) => (
          <article
            className="scene-card scene-card-project"
            key={scene.id}
            role="button"
            tabIndex={0}
            style={{ ['--scene-card-image' as string]: `url(${sceneCardImage})` }}
            onClick={() => void openScene(scene.id)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault()
                void openScene(scene.id)
              }
            }}
          >
            <div className="scene-card-meta">
              <img alt="" className="scene-card-meta-icon" src={metaIcon} />
              <span>
                上次修改时间：{new Date(scene.updatedAt).toLocaleString('zh-CN')}
              </span>
            </div>
            <h3>{scene.name}</h3>
            <div className="scene-card-overlay" onClick={(event) => event.stopPropagation()}>
              <button
                type="button"
                onClick={() =>
                  setRenameTarget({
                    id: scene.id,
                    currentName: scene.name,
                    nextName: '',
                  })
                }
              >
                重命名项目
              </button>
              <button
                type="button"
                onClick={() =>
                  setDeleteTarget({
                    id: scene.id,
                    name: scene.name,
                  })
                }
              >
                删除项目
              </button>
              <button type="button" onClick={() => void handleDownload(scene.id)}>
                下载项目
              </button>
            </div>
          </article>
        ))}
      </section>

      {renameTarget && (
        <div
          className="rename-modal-backdrop"
          role="presentation"
          onClick={() => setRenameTarget(null)}
        >
          <section
            className="rename-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="rename-title"
            onClick={(event) => event.stopPropagation()}
          >
            <h2 className="rename-modal-title" id="rename-title">
              重新命名项目
            </h2>
            <input
              autoFocus
              className="rename-input"
              maxLength={24}
              placeholder="请输入新的项目名称"
              value={renameTarget.nextName}
              onChange={(event) =>
                setRenameTarget((current) =>
                  current
                    ? {
                        ...current,
                        nextName: event.target.value,
                      }
                    : current,
                )
              }
            />
            <p className="rename-help">项目名称最多不可超过24个汉字</p>
            <div className="rename-actions">
              <button className="rename-confirm" type="button" onClick={() => void submitRename()}>
                确认修改
              </button>
              <button
                className="rename-cancel"
                type="button"
                onClick={() => setRenameTarget(null)}
              >
                取消修改
              </button>
            </div>
          </section>
        </div>
      )}

      {deleteTarget && (
        <div
          className="rename-modal-backdrop"
          role="presentation"
          onClick={() => setDeleteTarget(null)}
        >
          <section
            className="rename-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-title"
            onClick={(event) => event.stopPropagation()}
          >
            <h2 className="rename-modal-title" id="delete-title">
              删除项目
            </h2>
            <p className="delete-help">
              您是否确定删除此项目？删除后无法恢复，请谨慎操作，建议在删除之前先行备份。
            </p>
            <div className="rename-actions delete-actions">
              <button
                className="rename-confirm"
                type="button"
                onClick={() => setDeleteTarget(null)}
              >
                暂不删除
              </button>
              <button className="rename-cancel" type="button" onClick={() => void submitDelete()}>
                确认删除
              </button>
            </div>
          </section>
        </div>
      )}
    </main>
  )
}
