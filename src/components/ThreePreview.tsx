import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { getCatalogItem, getTileCatalogItem } from '../lib/catalog'
import { normalizeParkingParams } from '../lib/parkingSlots'
import { getElementSceneSize } from '../lib/sceneGeometry'
import { useEditorStore } from '../store/editorStore'
import type { ParkingParams } from '../types/scene'

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
    const elementCenter =
      sceneData.elements.length > 0
        ? sceneData.elements.reduce(
            (acc, element) => {
              acc.x += element.x
              acc.z += element.y
              return acc
            },
            { x: 0, z: 0 },
          )
        : null
    const initialTarget = new THREE.Vector3(
      elementCenter ? elementCenter.x / sceneData.elements.length : sceneData.canvas.width / 2,
      80,
      elementCenter ? elementCenter.z / sceneData.elements.length : sceneData.canvas.height / 2,
    )
    const initialOffset = new THREE.Vector3().setFromSpherical(
      new THREE.Spherical(920, 1.05, 0.62),
    )
    camera.position.copy(initialTarget.clone().add(initialOffset))

    const initialDirection = initialTarget.clone().sub(camera.position).normalize()
    let yaw = Math.atan2(initialDirection.x, initialDirection.z)
    let pitch = Math.asin(THREE.MathUtils.clamp(initialDirection.y, -1, 1))

    function syncCamera() {
      camera.rotation.order = 'YXZ'
      camera.rotation.y = yaw
      camera.rotation.x = pitch
      camera.rotation.z = 0
      camera.updateMatrixWorld()
    }

    syncCamera()

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
      const elementSize = getElementSceneSize(element)
      const group = new THREE.Group()

      if (element.type === 'parking') {
        const parkingParams = normalizeParkingParams(element.params as ParkingParams)
        const parkingCount = parkingParams.slots.length
        const slotWidth = elementSize.width / parkingCount
        for (const slot of parkingParams.slots) {
          const body = new THREE.Mesh(
            new THREE.BoxGeometry(slotWidth, 32, elementSize.height),
            new THREE.MeshStandardMaterial({ color: item.color }),
          )
          body.castShadow = true
          body.position.set(
            -elementSize.width / 2 + slotWidth * slot.index + slotWidth / 2,
            16,
            0,
          )
          group.add(body)
        }
        const canopyColor =
          parkingParams.canopyType === 'film' ? '#64748b' : '#1e293b'
        const canopy = new THREE.Mesh(
          new THREE.BoxGeometry(elementSize.width + 18, 6, elementSize.height + 10),
          new THREE.MeshStandardMaterial({ color: canopyColor }),
        )
        canopy.visible = parkingParams.canopyType !== 'none'
        canopy.position.y = 52
        group.add(canopy)
      } else {
        const body = new THREE.Mesh(
          new THREE.BoxGeometry(elementSize.width, 32, elementSize.height),
          new THREE.MeshStandardMaterial({ color: item.color }),
        )
        body.castShadow = true
        body.position.y = 16
        group.add(body)
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

    const pointerState = {
      isDown: false,
      button: -1,
      lastX: 0,
      lastY: 0,
    }
    const keyState = {
      KeyW: false,
      KeyA: false,
      KeyS: false,
      KeyD: false,
      KeyE: false,
      KeyQ: false,
      Space: false,
      ShiftLeft: false,
    }

    function panCamera(deltaX: number, deltaY: number) {
      const panStrength = 0.9
      const right = new THREE.Vector3().setFromMatrixColumn(camera.matrix, 0).normalize()
      const up = new THREE.Vector3(0, 1, 0)
      const move = new THREE.Vector3()
        .addScaledVector(right, -deltaX * panStrength)
        .addScaledVector(up, deltaY * panStrength)
      camera.position.add(move)
    }

    function rotateCamera(deltaX: number, deltaY: number) {
      yaw -= deltaX * 0.005
      pitch = THREE.MathUtils.clamp(
        pitch - deltaY * 0.005,
        -Math.PI / 2 + 0.05,
        Math.PI / 2 - 0.05,
      )
      syncCamera()
    }

    function zoomCamera(deltaY: number) {
      const forward = new THREE.Vector3()
      camera.getWorldDirection(forward)
      const zoomStep = deltaY > 0 ? -36 : 36
      camera.position.addScaledVector(forward, zoomStep)
    }

    function moveCameraByKeys() {
      const forward = new THREE.Vector3()
      camera.getWorldDirection(forward)
      if (forward.lengthSq() === 0) {
        return false
      }
      forward.normalize()
      const right = new THREE.Vector3().setFromMatrixColumn(camera.matrix, 0).normalize()
      const delta = new THREE.Vector3()
      const speed = 8

      if (keyState.KeyW) {
        delta.addScaledVector(forward, speed)
      }
      if (keyState.KeyS) {
        delta.addScaledVector(forward, -speed)
      }
      if (keyState.KeyA) {
        delta.addScaledVector(right, -speed)
      }
      if (keyState.KeyD) {
        delta.addScaledVector(right, speed)
      }
      if (keyState.Space) {
        delta.y += speed
      }
      if (keyState.KeyE) {
        delta.y += speed
      }
      if (keyState.ShiftLeft) {
        delta.y -= speed
      }
      if (keyState.KeyQ) {
        delta.y -= speed
      }

      if (delta.lengthSq() === 0) {
        return false
      }

      camera.position.add(delta)
      return true
    }

    const domElement = renderer.domElement
    domElement.tabIndex = 0
    domElement.style.outline = 'none'

    function handlePointerDown(event: PointerEvent) {
      pointerState.isDown = true
      pointerState.button = event.button
      pointerState.lastX = event.clientX
      pointerState.lastY = event.clientY
      domElement.setPointerCapture(event.pointerId)
      domElement.focus()
    }

    function handlePointerMove(event: PointerEvent) {
      if (!pointerState.isDown) {
        return
      }

      const deltaX = event.clientX - pointerState.lastX
      const deltaY = event.clientY - pointerState.lastY
      pointerState.lastX = event.clientX
      pointerState.lastY = event.clientY

      if (pointerState.button === 0) {
        panCamera(deltaX, deltaY)
      } else if (pointerState.button === 2) {
        rotateCamera(deltaX, deltaY)
      }
    }

    function handlePointerUp(event: PointerEvent) {
      pointerState.isDown = false
      pointerState.button = -1
      if (domElement.hasPointerCapture(event.pointerId)) {
        domElement.releasePointerCapture(event.pointerId)
      }
    }

    function handleWheel(event: WheelEvent) {
      event.preventDefault()
      zoomCamera(event.deltaY)
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.code in keyState) {
        keyState[event.code as keyof typeof keyState] = true
        event.preventDefault()
      }
    }

    function handleKeyUp(event: KeyboardEvent) {
      if (event.code in keyState) {
        keyState[event.code as keyof typeof keyState] = false
        event.preventDefault()
      }
    }

    function handleContextMenu(event: MouseEvent) {
      event.preventDefault()
    }

    domElement.addEventListener('pointerdown', handlePointerDown)
    domElement.addEventListener('pointermove', handlePointerMove)
    domElement.addEventListener('pointerup', handlePointerUp)
    domElement.addEventListener('pointerleave', handlePointerUp)
    domElement.addEventListener('wheel', handleWheel, { passive: false })
    domElement.addEventListener('contextmenu', handleContextMenu)
    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)

    let frameId = 0
    const renderLoop = () => {
      frameId = window.requestAnimationFrame(renderLoop)
      moveCameraByKeys()
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
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
      domElement.removeEventListener('pointerdown', handlePointerDown)
      domElement.removeEventListener('pointermove', handlePointerMove)
      domElement.removeEventListener('pointerup', handlePointerUp)
      domElement.removeEventListener('pointerleave', handlePointerUp)
      domElement.removeEventListener('wheel', handleWheel)
      domElement.removeEventListener('contextmenu', handleContextMenu)
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
