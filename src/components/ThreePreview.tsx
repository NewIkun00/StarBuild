import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import hdrEnvironmentSrc from '../../assets/hdr/ticknock_03_1k.hdr'
import yColumnModelSrc from '../../assets/ChePeng/Y_LiZhu.glb'
import yPanelModelSrc from '../../assets/ChePeng/YChePengBan.glb'
import { RGBELoader } from 'three/examples/jsm/loaders/RGBELoader.js'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { getCatalogItem, getTileCatalogItem } from '../lib/catalog'
import { normalizeParkingParams, normalizeSteelColor } from '../lib/parkingSlots'
import { getElementSceneSize } from '../lib/sceneGeometry'
import { metersToSceneUnits } from '../lib/units'
import { useEditorStore } from '../store/editorStore'
import type { ParkingParams } from '../types/scene'

function prepareModelForScene(root: THREE.Object3D) {
  root.traverse((child) => {
    if (child instanceof THREE.Mesh) {
      child.castShadow = true
      child.receiveShadow = true
    }
  })
}

function cloneTextureWithRepeat(
  texture: THREE.Texture | null,
  repeatX: number,
  repeatY: number,
) {
  if (!texture) {
    return null
  }

  const cloned = texture.clone()
  cloned.needsUpdate = true
  cloned.wrapS = THREE.RepeatWrapping
  cloned.wrapT = THREE.RepeatWrapping
  cloned.repeat.set(repeatX, repeatY)
  return cloned
}

function configureSolarPanelMaterial(root: THREE.Object3D) {
  root.traverse((child) => {
    if (!(child instanceof THREE.Mesh)) {
      return
    }

    const sourceMaterials = Array.isArray(child.material)
      ? child.material
      : [child.material]

    const configuredMaterials = sourceMaterials.map((material, index) => {
      if (!(material instanceof THREE.MeshStandardMaterial)) {
        return material
      }

      const shouldAdjust =
        material.name === '061_003.002' || (sourceMaterials.length > 1 && index === 1)

      if (!shouldAdjust) {
        return material
      }

      const configured = material.clone()
      configured.map = cloneTextureWithRepeat(configured.map, 30, 30)
      configured.normalMap = cloneTextureWithRepeat(configured.normalMap, 30, 30)
      configured.roughnessMap = cloneTextureWithRepeat(configured.roughnessMap, 30, 30)
      configured.metalnessMap = cloneTextureWithRepeat(configured.metalnessMap, 30, 30)
      configured.aoMap = cloneTextureWithRepeat(configured.aoMap, 30, 30)
      configured.emissiveMap = cloneTextureWithRepeat(configured.emissiveMap, 30, 30)
      configured.bumpMap = cloneTextureWithRepeat(configured.bumpMap, 30, 30)
      configured.alphaMap = cloneTextureWithRepeat(configured.alphaMap, 30, 30)
      configured.metalness = 0.9
      configured.roughness = 0.1
      configured.needsUpdate = true
      return configured
    })

    child.material = Array.isArray(child.material)
      ? configuredMaterials
      : configuredMaterials[0]
  })
}

function scaleModelToHeight(root: THREE.Object3D, targetHeight: number) {
  root.updateMatrixWorld(true)
  const bounds = new THREE.Box3().setFromObject(root)
  const sourceHeight = bounds.max.y - bounds.min.y
  if (sourceHeight <= 0) {
    return
  }

  const uniformScale = targetHeight / sourceHeight
  root.scale.multiplyScalar(uniformScale)
  root.updateMatrixWorld(true)
}

function scaleModelToWidth(root: THREE.Object3D, targetWidth: number) {
  root.updateMatrixWorld(true)
  const bounds = new THREE.Box3().setFromObject(root)
  const sourceWidth = bounds.max.x - bounds.min.x
  if (sourceWidth <= 0) {
    return
  }

  const uniformScale = targetWidth / sourceWidth
  root.scale.multiplyScalar(uniformScale)
  root.updateMatrixWorld(true)
}

function getYParkingBoundaries(slotCount: number) {
  const boundaries: number[] = [0]
  let currentBoundary = 0

  while (slotCount - currentBoundary > 3) {
    currentBoundary += 2
    boundaries.push(currentBoundary)
  }

  boundaries.push(slotCount)
  return boundaries
}

function addYParkingColumns(
  group: THREE.Group,
  template: THREE.Object3D,
  slotCount: number,
  width: number,
  height: number,
  steelColor: string,
) {
  const slotWidth = width / slotCount
  const rearEdgeZ = -height / 2
  const columnBoundaries = getYParkingBoundaries(slotCount)

  for (const boundaryIndex of columnBoundaries) {
    const column = template.clone(true)
    tintAllMeshMaterials(column, steelColor)
    column.rotation.y = Math.PI
    column.position.set(
      -width / 2 + slotWidth * boundaryIndex,
      0,
      rearEdgeZ,
    )
    group.add(column)
  }
}

function addYParkingPanels(
  group: THREE.Group,
  template: THREE.Object3D,
  width: number,
  height: number,
  steelColor: string,
) {
  const rearEdgeZ = -height / 2
  const panelWidth = metersToSceneUnits(1.2)
  const panelCount = Math.max(1, Math.ceil(width / panelWidth) + 2)
  const panelStartX = -width / 2 - panelWidth

  for (let panelIndex = 0; panelIndex < panelCount; panelIndex += 1) {
    const panel = template.clone(true)
    tintMeshMaterialsByName(panel, ['光伏边缘颜色.002'], steelColor)
    panel.rotation.y = Math.PI
    panel.position.set(
      panelStartX + panelWidth * panelIndex + panelWidth / 2,
      0,
      rearEdgeZ,
    )
    group.add(panel)
  }
}

function tintAllMeshMaterials(root: THREE.Object3D, color: string) {
  root.traverse((child) => {
    if (!(child instanceof THREE.Mesh)) {
      return
    }

    const sourceMaterials = Array.isArray(child.material) ? child.material : [child.material]
    const tintedMaterials = sourceMaterials.map((material) => {
      if (!(material instanceof THREE.MeshStandardMaterial)) {
        return material
      }

      const cloned = material.clone()
      cloned.color.set(color)
      return cloned
    })

    child.material = Array.isArray(child.material) ? tintedMaterials : tintedMaterials[0]
  })
}

function tintMeshMaterialsByName(root: THREE.Object3D, materialNames: string[], color: string) {
  const materialNameSet = new Set(materialNames)

  root.traverse((child) => {
    if (!(child instanceof THREE.Mesh)) {
      return
    }

    if (!Array.isArray(child.material)) {
      if (!('color' in child.material) || !materialNameSet.has(child.material.name)) {
        return
      }

      const cloned = child.material.clone()
      cloned.color.set(color)
      child.material = cloned
      return
    }

    const tintedMaterials = child.material.map((material) => {
      if (!('color' in material) || !materialNameSet.has(material.name)) {
        return material
      }

      const cloned = material.clone()
      cloned.color.set(color)
      return cloned
    })

    child.material = tintedMaterials
  })
}

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
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.setSize(mount.clientWidth, mount.clientHeight)
    renderer.outputColorSpace = THREE.SRGBColorSpace
    renderer.toneMapping = THREE.ACESFilmicToneMapping
    renderer.toneMappingExposure = 1.15
    renderer.shadowMap.enabled = true
    renderer.shadowMap.type = THREE.PCFSoftShadowMap
    mount.innerHTML = ''
    mount.appendChild(renderer.domElement)

    const scene = new THREE.Scene()
    scene.background = new THREE.Color('#d5dde6')
    scene.fog = null

    const pmremGenerator = new THREE.PMREMGenerator(renderer)
    pmremGenerator.compileEquirectangularShader()
    let environmentMap: THREE.Texture | null = null
    let hdrTexture: THREE.DataTexture | null = null
    let disposed = false
    new RGBELoader().load(hdrEnvironmentSrc, (texture) => {
      if (disposed) {
        texture.dispose()
        return
      }
      texture.mapping = THREE.EquirectangularReflectionMapping
      hdrTexture = texture
      const environment = pmremGenerator.fromEquirectangular(texture)
      environmentMap = environment.texture
      scene.environment = environmentMap
      scene.background = texture
      scene.backgroundBlurriness = 0
      scene.backgroundIntensity = 1
    })

    const yParkingTargets: Array<{
      group: THREE.Group
      slotCount: number
      width: number
      height: number
      steelColor: string
    }> = []
    let yColumnTemplate: THREE.Object3D | null = null
    let yPanelTemplate: THREE.Object3D | null = null
    new GLTFLoader().load(yColumnModelSrc, (gltf) => {
      if (disposed) {
        return
      }

      yColumnTemplate = gltf.scene
      prepareModelForScene(yColumnTemplate)
      scaleModelToHeight(yColumnTemplate, metersToSceneUnits(3.8))

      yParkingTargets.forEach((target) => {
        addYParkingColumns(
          target.group,
          yColumnTemplate as THREE.Object3D,
          target.slotCount,
          target.width,
          target.height,
          target.steelColor,
        )
      })
    })

    new GLTFLoader().load(yPanelModelSrc, (gltf) => {
      if (disposed) {
        return
      }

      yPanelTemplate = gltf.scene
      prepareModelForScene(yPanelTemplate)
      configureSolarPanelMaterial(yPanelTemplate)
      scaleModelToWidth(yPanelTemplate, metersToSceneUnits(1.2))

      yParkingTargets.forEach((target) => {
          addYParkingPanels(
            target.group,
            yPanelTemplate as THREE.Object3D,
            target.width,
            target.height,
            target.steelColor,
          )
      })
    })

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

    const hemisphereLight = new THREE.HemisphereLight('#dce9f6', '#5a6168', 1.8)
    scene.add(hemisphereLight)

    const sun = new THREE.DirectionalLight('#fff4d6', 4.8)
    sun.position.set(680, 1100, 420)
    sun.castShadow = true
    sun.shadow.mapSize.set(2048, 2048)
    sun.shadow.bias = -0.00012
    sun.shadow.normalBias = 0.18
    sun.shadow.camera.near = 80
    sun.shadow.camera.far = 2600
    sun.shadow.camera.left = -1200
    sun.shadow.camera.right = 1200
    sun.shadow.camera.top = 1200
    sun.shadow.camera.bottom = -1200
    scene.add(sun)

    const fillLight = new THREE.DirectionalLight('#c7e2ff', 1.15)
    fillLight.position.set(-520, 380, -260)
    scene.add(fillLight)

    sceneData.tiles.forEach((tile) => {
      const tileInfo = getTileCatalogItem(tile.tileType)
      const material = new THREE.MeshStandardMaterial({
        color: tileInfo.color,
        roughness: tile.tileType === 'green' ? 1 : 0.92,
        metalness: 0.01,
        envMapIntensity: tile.tileType === 'green' ? 0.08 : 0.18,
      })
      const mesh = new THREE.Mesh(
        new THREE.BoxGeometry(
          sceneData.canvas.gridSize,
          tile.tileType === 'green' ? 5 : 2,
          sceneData.canvas.gridSize,
        ),
        material,
      )
      mesh.receiveShadow = true
      mesh.castShadow = tile.tileType === 'green'
      mesh.position.set(
        tile.col * sceneData.canvas.gridSize + sceneData.canvas.gridSize / 2,
        tile.tileType === 'green' ? 2.5 : 1,
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
        const steelColor = normalizeSteelColor(parkingParams.steelColor)
        const slotWidth = elementSize.width / parkingCount
        const parkingBorderInset = metersToSceneUnits(0.1)
        const parkingBorderHeight = metersToSceneUnits(0.01)
        for (const slot of parkingParams.slots) {
          const outlineShape = new THREE.Shape()
          outlineShape.moveTo(-slotWidth / 2, -elementSize.height / 2)
          outlineShape.lineTo(slotWidth / 2, -elementSize.height / 2)
          outlineShape.lineTo(slotWidth / 2, elementSize.height / 2)
          outlineShape.lineTo(-slotWidth / 2, elementSize.height / 2)
          outlineShape.closePath()

          const innerWidth = Math.max(slotWidth - parkingBorderInset * 2, parkingBorderInset)
          const innerHeight = Math.max(
            elementSize.height - parkingBorderInset * 2,
            parkingBorderInset,
          )
          const innerHole = new THREE.Path()
          innerHole.moveTo(-innerWidth / 2, -innerHeight / 2)
          innerHole.lineTo(-innerWidth / 2, innerHeight / 2)
          innerHole.lineTo(innerWidth / 2, innerHeight / 2)
          innerHole.lineTo(innerWidth / 2, -innerHeight / 2)
          innerHole.closePath()
          outlineShape.holes.push(innerHole)

          const body = new THREE.Mesh(
            new THREE.ExtrudeGeometry(outlineShape, {
              depth: parkingBorderHeight,
              bevelEnabled: false,
            }),
            new THREE.MeshStandardMaterial({
              color: '#ffffff',
              roughness: 0.72,
              metalness: 0,
              envMapIntensity: 0.35,
            }),
          )
          body.castShadow = true
          body.receiveShadow = true
          body.rotation.x = -Math.PI / 2
          body.position.set(
            -elementSize.width / 2 + slotWidth * slot.index + slotWidth / 2,
            parkingBorderHeight,
            0,
          )
          group.add(body)
        }
        if (parkingParams.canopyType === 'pv' && parkingParams.carportStyle === 'y') {
          if (yColumnTemplate) {
            addYParkingColumns(
              group,
              yColumnTemplate,
              parkingCount,
              elementSize.width,
              elementSize.height,
              steelColor,
            )
          }
          if (yPanelTemplate) {
            addYParkingPanels(
              group,
              yPanelTemplate,
              elementSize.width,
              elementSize.height,
              steelColor,
            )
          }
          if (!yColumnTemplate || !yPanelTemplate) {
            yParkingTargets.push({
              group,
              slotCount: parkingCount,
              width: elementSize.width,
              height: elementSize.height,
              steelColor,
            })
          }
        }
      } else {
        const body = new THREE.Mesh(
          new THREE.BoxGeometry(elementSize.width, 32, elementSize.height),
          new THREE.MeshStandardMaterial({
            color: item.color,
            roughness: element.type === 'storage' ? 0.38 : 0.5,
            metalness: element.type === 'storage' ? 0.22 : 0.08,
            envMapIntensity: 0.55,
          }),
        )
        body.castShadow = true
        body.receiveShadow = true
        body.position.y = 16
        group.add(body)
      }

      if (element.type === 'charger') {
        const top = new THREE.Mesh(
          new THREE.CylinderGeometry(10, 10, 26, 24),
          new THREE.MeshStandardMaterial({
            color: '#f8fafc',
            roughness: 0.22,
            metalness: 0.35,
            envMapIntensity: 0.85,
          }),
        )
        top.position.y = 42
        top.castShadow = true
        group.add(top)
      }

      if (element.type === 'storage') {
        const accent = new THREE.Mesh(
          new THREE.BoxGeometry(item.size.width - 12, 8, item.size.height - 12),
          new THREE.MeshStandardMaterial({
            color: '#ecfeff',
            roughness: 0.18,
            metalness: 0.28,
            envMapIntensity: 0.9,
          }),
        )
        accent.position.y = 38
        accent.castShadow = true
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
      disposed = true
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
      environmentMap?.dispose()
      hdrTexture?.dispose()
      pmremGenerator.dispose()
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
