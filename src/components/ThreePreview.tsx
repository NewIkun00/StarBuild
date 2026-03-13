import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { getCatalogItem, getTileCatalogItem } from '../lib/catalog'
import { useEditorStore } from '../store/editorStore'

export function ThreePreview() {
  const sceneData = useEditorStore((state) => state.scene)
  const mountRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!sceneData) {
      return
    }

    const mount = mountRef.current
    if (!mount) {
      return
    }

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
    renderer.setPixelRatio(window.devicePixelRatio)
    renderer.setSize(mount.clientWidth, mount.clientHeight)
    renderer.shadowMap.enabled = true
    mount.innerHTML = ''
    mount.appendChild(renderer.domElement)

    const scene = new THREE.Scene()
    scene.background = new THREE.Color('#eaf2fb')

    const camera = new THREE.PerspectiveCamera(
      46,
      mount.clientWidth / mount.clientHeight,
      1,
      5000,
    )
    camera.position.set(600, 720, 860)
    camera.lookAt(sceneData.canvas.width / 2, 0, sceneData.canvas.height / 2)

    const ambientLight = new THREE.AmbientLight('#ffffff', 1.6)
    scene.add(ambientLight)

    const sun = new THREE.DirectionalLight('#fff8db', 2.2)
    sun.position.set(600, 900, 300)
    sun.castShadow = true
    scene.add(sun)

    const ground = new THREE.Mesh(
      new THREE.BoxGeometry(sceneData.canvas.width, 8, sceneData.canvas.height),
      new THREE.MeshStandardMaterial({ color: '#d9e6f2' }),
    )
    ground.position.set(sceneData.canvas.width / 2, -4, sceneData.canvas.height / 2)
    ground.receiveShadow = true
    scene.add(ground)

    sceneData.tiles.forEach((tile) => {
      const tileInfo = getTileCatalogItem(tile.tileType)
      const material = new THREE.MeshStandardMaterial({
        color: tileInfo.color,
      })
      const mesh = new THREE.Mesh(
        new THREE.BoxGeometry(
          sceneData.canvas.gridSize,
          4,
          sceneData.canvas.gridSize,
        ),
        material,
      )
      mesh.position.set(
        tile.col * sceneData.canvas.gridSize + sceneData.canvas.gridSize / 2,
        2,
        tile.row * sceneData.canvas.gridSize + sceneData.canvas.gridSize / 2,
      )
      scene.add(mesh)
    })

    sceneData.elements.forEach((element) => {
      const item = getCatalogItem(element.type)
      const group = new THREE.Group()
      const body = new THREE.Mesh(
        new THREE.BoxGeometry(item.size.width, 32, item.size.height),
        new THREE.MeshStandardMaterial({ color: item.color }),
      )
      body.castShadow = true
      body.position.y = 16
      group.add(body)

      if (element.type === 'parking') {
        const canopy = new THREE.Mesh(
          new THREE.BoxGeometry(item.size.width + 18, 6, item.size.height + 10),
          new THREE.MeshStandardMaterial({ color: '#1e293b' }),
        )
        const hasCanopy = 'hasPvCanopy' in element.params && element.params.hasPvCanopy
        canopy.visible = hasCanopy
        canopy.position.y = 52
        group.add(canopy)
      }

      if (element.type === 'charger') {
        const top = new THREE.Mesh(
          new THREE.CylinderGeometry(10, 10, 26, 24),
          new THREE.MeshStandardMaterial({ color: '#ffffff' }),
        )
        top.position.y = 42
        group.add(top)
      }

      if (element.type === 'storage') {
        const accent = new THREE.Mesh(
          new THREE.BoxGeometry(item.size.width - 12, 8, item.size.height - 12),
          new THREE.MeshStandardMaterial({ color: '#ecfeff' }),
        )
        accent.position.y = 38
        group.add(accent)
      }

      group.position.set(element.x, 0, element.y)
      group.rotation.y = THREE.MathUtils.degToRad(-element.rotation)
      scene.add(group)
    })

    let frameId = 0
    const renderLoop = () => {
      frameId = window.requestAnimationFrame(renderLoop)
      scene.rotation.y += 0.0015
      renderer.render(scene, camera)
    }
    renderLoop()

    const handleResize = () => {
      if (!mountRef.current) {
        return
      }
      const { clientWidth, clientHeight } = mountRef.current
      renderer.setSize(clientWidth, clientHeight)
      camera.aspect = clientWidth / clientHeight
      camera.updateProjectionMatrix()
    }

    window.addEventListener('resize', handleResize)

    return () => {
      window.cancelAnimationFrame(frameId)
      window.removeEventListener('resize', handleResize)
      renderer.dispose()
      mount.innerHTML = ''
    }
  }, [sceneData])

  if (!sceneData) {
    return null
  }

  return (
    <div className="preview-wrap">
      <p className="preview-note">
        这里先用基础几何体代替真实 GLB 预制体。后续只要把 `type + params` 映射到模型加载器即可。
      </p>
      <div className="preview-surface" ref={mountRef} />
    </div>
  )
}
