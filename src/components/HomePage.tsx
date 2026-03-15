import { useRef, useState, type ChangeEvent } from 'react'
import metaIcon from '../../assets/668ss.png'
import backgroundImage from '../../assets/Back999.png'
import deleteSceneIcon from '../../assets/SCXM.png'
import renameSceneIcon from '../../assets/CXMM.png'
import createCardImage from '../../assets/ChuangJian.png'
import logoImage from '../../assets/Logo.png'
import createIcon from '../../assets/XinJian2.png'
import sceneCardImage from '../../assets/ShouYEKAPian.png'
import downloadSceneIcon from '../../assets/XZXM.png'
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

type CreateTarget = {
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
  const [createTarget, setCreateTarget] = useState<CreateTarget | null>(null)
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
      setCreateTarget(null)
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

  async function submitCreateEmpty() {
    if (!createTarget) {
      return
    }

    const nextName = createTarget.name.trim() || '新建站点方案'
    await createEmptyScene(createTarget.name)
    onStatusChange(`已创建场景 ${nextName}`)
    setCreateTarget(null)
  }

  async function submitCreateFromTemplate(templateId: string, templateName: string) {
    if (!createTarget?.name.trim()) {
      return
    }

    await createSceneFromTemplate(templateId, createTarget.name)
    onStatusChange(`已基于模板 ${templateName} 创建场景 ${createTarget.name.trim()}`)
    setCreateTarget(null)
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
            onClick={() => setCreateTarget({ name: '' })}
          >
            <img alt="" className="landing-primary-icon" src={createIcon} />
            <span className="landing-primary-label">新建场景</span>
          </button>
          <div className="project-count">
            已有场景 <strong>{scenes.length}</strong> 个
          </div>
        </div>
      </section>

      <section className="scene-wall">
        {scenes.length === 0 && (
          <button
            className="scene-card scene-card-create"
            type="button"
            aria-label="创建新场景"
            style={{ ['--create-card-image' as string]: `url(${createCardImage})` }}
            onClick={() => setCreateTarget({ name: '' })}
          />
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
              <div className="scene-card-actions">
                <button
                  className="scene-card-action"
                  type="button"
                  onClick={() =>
                    setRenameTarget({
                      id: scene.id,
                      currentName: scene.name,
                      nextName: '',
                    })
                  }
                >
                  <img alt="" className="scene-card-action-icon" src={renameSceneIcon} />
                  <span>重命名项目</span>
                </button>
                <button
                  className="scene-card-action"
                  type="button"
                  onClick={() =>
                    setDeleteTarget({
                      id: scene.id,
                      name: scene.name,
                    })
                  }
                >
                  <img alt="" className="scene-card-action-icon" src={deleteSceneIcon} />
                  <span>删除项目</span>
                </button>
                <button
                  className="scene-card-action"
                  type="button"
                  onClick={() => void handleDownload(scene.id)}
                >
                  <img alt="" className="scene-card-action-icon" src={downloadSceneIcon} />
                  <span>下载项目</span>
                </button>
              </div>
              <button className="scene-card-enter" type="button" onClick={() => void openScene(scene.id)}>
                进&nbsp;&nbsp;入
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

      {createTarget && (
        <div
          className="rename-modal-backdrop"
          role="presentation"
          onClick={() => setCreateTarget(null)}
        >
          <section
            className="rename-modal create-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="create-title"
            onClick={(event) => event.stopPropagation()}
          >
            <h2 className="rename-modal-title" id="create-title">
              新建场景
            </h2>
            <p className="delete-help create-help">
              请输入场景名称，然后选择创建方式。弹窗样式与删除项目保持一致。
            </p>
            <input
              autoFocus
              className="rename-input"
              maxLength={24}
              placeholder="请输入场景名称"
              value={createTarget.name}
              onChange={(event) =>
                setCreateTarget((current) =>
                  current
                    ? {
                        ...current,
                        name: event.target.value,
                      }
                    : current,
                )
              }
            />
            <p className="rename-help">场景名称最多不可超过24个汉字</p>
            <div className="landing-create-panel create-modal-grid">
              <div className="template-card">
                <h4>从模板新建</h4>
                <p>模板功能暂未开放，后续完善后再开放使用。</p>
                {templates.map((template) => (
                  <button
                    key={template.id}
                    disabled
                    type="button"
                    onClick={() => void submitCreateFromTemplate(template.id, template.name)}
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
                  onClick={() => void submitCreateEmpty()}
                >
                  创建空场景
                </button>
              </div>
            </div>
            <div className="rename-actions">
              <button className="rename-confirm" type="button" onClick={() => setCreateTarget(null)}>
                暂不创建
              </button>
              <button
                className="rename-cancel"
                type="button"
                onClick={() => void submitCreateEmpty()}
              >
                直接创建空场景
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
