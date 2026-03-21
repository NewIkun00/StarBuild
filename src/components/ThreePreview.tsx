import { useEffect, useRef, useCallback } from 'react'
import * as THREE from 'three'
import grassBaseColorSrc from '../../assets/basecolorcaodi.png'
import grassNormalSrc from '../../assets/caodinormal.png'
import asphaltBaseColorSrc from '../../assets/Liqingcolorrr.png'
import asphaltNormalSrc from '../../assets/Liqingnormalll.png'
import hdrEnvironmentSrc from '../../assets/hdr/ticknock_03_1k.hdr'
import carModelSrc from '../../assets/2024_xiaomi_su7_max.glb'
import yColumnModelSrc from '../../assets/ChePeng/Y_LiZhu.glb'
import yPanelModelSrc from '../../assets/ChePeng/YChePengBan.glb'
import chargerJiaoLiuWanYueSrc from '../../assets/ChongDian/JiaoLiuWanYue.glb'
import chargerJiaoLiuJiGuangSrc from '../../assets/ChongDian/JiaoLiuJiGuang.glb'
import chargerYITIshuangzizuo2d3040Src from '../../assets/ChongDian/YITIshuangzizuo2d3040.glb'
import chargerXingChi300400ASrc from '../../assets/ChongDian/XingChi300400A.glb'
import chargerXingHai600ASrc from '../../assets/ChongDian/XingHai600A.glb'
import chargerXingHai1200ASrc from '../../assets/ChongDian/XingHai1200A.glb'
import chargerV2G30Src from '../../assets/ChongDian/V2G30.glb'
import chargerV2G120Src from '../../assets/ChongDian/V2G120.glb'
import storage261Src from '../../assets/GongShangChu/261.glb'
import storage418Src from '../../assets/GongShangChu/418.glb'
import { RGBELoader } from 'three/examples/jsm/loaders/RGBELoader.js'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { Sky } from 'three/examples/jsm/objects/Sky.js'
import { getCatalogItem, getTileCatalogItem } from '../lib/catalog'
import { normalizeParkingParams, normalizeSteelColor } from '../lib/parkingSlots'
import { getElementSceneSize } from '../lib/sceneGeometry'
import { metersToSceneUnits } from '../lib/units'
import { useEditorStore } from '../store/editorStore'
import type { ParkingParams, TileType, ChargerParams, StorageParams } from '../types/scene'

// Charger model name -> GLB source mapping
const CHARGER_MODEL_GLB_MAP: Record<string, string> = {
  '\u5f2f\u6708': chargerJiaoLiuWanYueSrc, // 弯月
  '\u6781\u5149': chargerJiaoLiuJiGuangSrc, // 极光
  '\u53cc\u5b50\u5ea72\u4ee330/40kW': chargerYITIshuangzizuo2d3040Src, // 双子座2代30/40kW
  '\u661f\u8dc3': chargerXingChi300400ASrc, // 星驰
  '\u661f\u9a70300/400A': chargerXingChi300400ASrc, // 星海300/400A (分体桩星驰)
  '\u661f\u6d77600A': chargerXingHai600ASrc, // 星海600A
  '\u661f\u6d771200A': chargerXingHai1200ASrc, // 星海1200A
  '\u53cc\u5b50\u5ea73\u4ee330kW': chargerV2G30Src, // 双子座3代30kW (V2G)
  '\u53cc\u5b50\u5ea73\u4ee3Pro 120kW': chargerV2G120Src, // 双子座3代Pro 120kW (V2G)
}

// Storage model -> GLB source mapping
const STORAGE_MODEL_GLB_MAP: Record<string, string> = {
  'storage_261': storage261Src,
  'storage_418': storage418Src,
}

const MATERIAL_TEXTURE_KEYS = [
  'map',
  'alphaMap',
  'aoMap',
  'bumpMap',
  'displacementMap',
  'emissiveMap',
  'metalnessMap',
  'normalMap',
  'roughnessMap',
] as const

const CAMERA_MIN_HEIGHT = 8
const FOG_START_DISTANCE = 100
const FOG_END_DISTANCE = 4200

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

function fitModelToFootprint(
  root: THREE.Object3D,
  _targetWidth: number,
  _targetDepth: number,
) {
  root.updateMatrixWorld(true)
  root.scale.multiplyScalar(10)
  root.updateMatrixWorld(true)
  let bounds = new THREE.Box3().setFromObject(root)

  const centerX = (bounds.min.x + bounds.max.x) / 2
  const centerZ = (bounds.min.z + bounds.max.z) / 2
  root.position.x -= centerX
  root.position.z -= centerZ
  root.position.y -= bounds.min.y
  root.updateMatrixWorld(true)
}

function logModelBounds(_label: string, _root: THREE.Object3D) {}

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

function disposeMaterialResources(material: THREE.Material, textures: Set<THREE.Texture>) {
  MATERIAL_TEXTURE_KEYS.forEach((key) => {
    const texture = (material as THREE.Material & Partial<Record<(typeof MATERIAL_TEXTURE_KEYS)[number], THREE.Texture>>)[key]
    if (texture) {
      textures.add(texture)
    }
  })
}

function disposeObjectResources(root: THREE.Object3D) {
  const geometries = new Set<THREE.BufferGeometry>()
  const materials = new Set<THREE.Material>()
  const textures = new Set<THREE.Texture>()

  root.traverse((child) => {
    if (!(child instanceof THREE.Mesh)) {
      return
    }

    geometries.add(child.geometry)

    if (Array.isArray(child.material)) {
      child.material.forEach((material) => {
        materials.add(material)
        disposeMaterialResources(material, textures)
      })
      return
    }

    materials.add(child.material)
    disposeMaterialResources(child.material, textures)
  })

  geometries.forEach((geometry) => geometry.dispose())
  materials.forEach((material) => material.dispose())
  textures.forEach((texture) => texture.dispose())
}

function createMistTexture() {
  const canvas = document.createElement('canvas')
  canvas.width = 256
  canvas.height = 256
  const context = canvas.getContext('2d')
  if (!context) {
    return null
  }

  const gradient = context.createRadialGradient(128, 128, 8, 128, 128, 128)
  gradient.addColorStop(0, 'rgba(255,255,255,0)')
  gradient.addColorStop(0.08, 'rgba(255,255,255,0)')
  gradient.addColorStop(0.22, 'rgba(255,255,255,0.2)')
  gradient.addColorStop(0.58, 'rgba(255,255,255,0.08)')
  gradient.addColorStop(1, 'rgba(255,255,255,0)')
  context.fillStyle = gradient
  context.fillRect(0, 0, canvas.width, canvas.height)

  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.wrapS = THREE.ClampToEdgeWrapping
  texture.wrapT = THREE.ClampToEdgeWrapping
  return texture
}

export function ThreePreview() {
  const sceneData = useEditorStore((state) => state.scene)
  const mountRef = useRef<HTMLDivElement | null>(null)

  const loadAllModels = useCallback(() => {
    return new Promise<{
      chargerTemplates: Map<string, THREE.Object3D>
      storageTemplates: Map<string, THREE.Object3D>
      yColumnTemplate: THREE.Object3D | null
      yPanelTemplate: THREE.Object3D | null
      carTemplate: THREE.Object3D | null
    }>((resolve) => {
      const chargerTemplates = new Map<string, THREE.Object3D>()
      const storageTemplates = new Map<string, THREE.Object3D>()
      const gltfLoader = new GLTFLoader()
      let yColumnTemplate: THREE.Object3D | null = null
      let yPanelTemplate: THREE.Object3D | null = null
      let carTemplate: THREE.Object3D | null = null
      let loadedCount = 0
      const totalCount = Object.keys(CHARGER_MODEL_GLB_MAP).length +
        Object.keys(STORAGE_MODEL_GLB_MAP).length + 3

      const checkAllLoaded = () => {
        loadedCount++
        if (loadedCount >= totalCount) {
          resolve({
            chargerTemplates,
            storageTemplates,
            yColumnTemplate,
            yPanelTemplate,
            carTemplate,
          })
        }
      }

      // Pre-load charger GLB models
      Object.entries(CHARGER_MODEL_GLB_MAP).forEach(([modelName, src]) => {
        gltfLoader.load(src, (gltf) => {
          const scene = gltf.scene.clone()
          prepareModelForScene(scene)
          chargerTemplates.set(modelName, scene)
          checkAllLoaded()
        })
      })

      // Pre-load storage GLB models
      Object.entries(STORAGE_MODEL_GLB_MAP).forEach(([modelName, src]) => {
        gltfLoader.load(src, (gltf) => {
          const scene = gltf.scene.clone()
          prepareModelForScene(scene)
          storageTemplates.set(modelName, scene)
          checkAllLoaded()
        })
      })

      // Load Y parking column model
      gltfLoader.load(yColumnModelSrc, (gltf) => {
        yColumnTemplate = gltf.scene.clone()
        prepareModelForScene(yColumnTemplate)
        scaleModelToHeight(yColumnTemplate, metersToSceneUnits(3.8))
        checkAllLoaded()
      })

      // Load Y parking panel model
      gltfLoader.load(yPanelModelSrc, (gltf) => {
        yPanelTemplate = gltf.scene.clone()
        prepareModelForScene(yPanelTemplate)
        configureSolarPanelMaterial(yPanelTemplate)
        scaleModelToWidth(yPanelTemplate, metersToSceneUnits(1.2))
        checkAllLoaded()
      })

      // Load car model
      gltfLoader.load(carModelSrc, (gltf) => {
        carTemplate = gltf.scene.clone()
        prepareModelForScene(carTemplate)
        checkAllLoaded()
      })
    })
  }, [])

  useEffect(() => {
    if (!sceneData) {
      return
    }

    const mount = mountRef.current
    if (!mount) {
      return
    }

    // Load all models first, then build the scene
    loadAllModels().then(({
      chargerTemplates,
      storageTemplates,
      yColumnTemplate,
      yPanelTemplate,
      carTemplate,
    }) => {
      const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
      renderer.setSize(mount.clientWidth, mount.clientHeight)
      renderer.outputColorSpace = THREE.SRGBColorSpace
      renderer.toneMapping = THREE.ACESFilmicToneMapping
      renderer.toneMappingExposure = 1.02
      renderer.shadowMap.enabled = true
      renderer.shadowMap.type = THREE.PCFSoftShadowMap
      renderer.shadowMap.autoUpdate = false
      mount.innerHTML = ''
      mount.appendChild(renderer.domElement)

      const scene = new THREE.Scene()
      scene.background = new THREE.Color('#c7d6e6')
      scene.fog = new THREE.Fog('#cfdae6', FOG_START_DISTANCE, FOG_END_DISTANCE)

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
      })

      const yParkingTargets: Array<{
        group: THREE.Group
        slotCount: number
        width: number
        height: number
        steelColor: string
      }> = []
      const carTargets: Array<{
        group: THREE.Group
        width: number
        depth: number
      }> = []

      // Apply columns and panels to queued targets
      yParkingTargets.forEach((target) => {
        if (yColumnTemplate) {
          addYParkingColumns(
            target.group,
            yColumnTemplate,
            target.slotCount,
            target.width,
            target.height,
            target.steelColor,
          )
        }
        if (yPanelTemplate) {
          addYParkingPanels(
            target.group,
            yPanelTemplate,
            target.width,
            target.height,
            target.steelColor,
          )
        }
      })

      // Apply car model to queued targets
      carTargets.forEach((target) => {
        if (carTemplate) {
          const car = carTemplate.clone(true)
          fitModelToFootprint(car, target.width, target.depth)
          target.group.add(car)
        }
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
    camera.position.y = Math.max(camera.position.y, CAMERA_MIN_HEIGHT)

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

    function clampCameraHeight() {
      camera.position.y = Math.max(camera.position.y, CAMERA_MIN_HEIGHT)
    }

    syncCamera()

    const sky = new Sky()
    sky.scale.setScalar(180000)
    scene.add(sky)

    const skyUniforms = sky.material.uniforms
    skyUniforms.turbidity.value = 8
    skyUniforms.rayleigh.value = 1.65
    skyUniforms.mieCoefficient.value = 0.008
    skyUniforms.mieDirectionalG.value = 0.84

    const sunElevation = 32
    const sunAzimuth = 138
    const skySunDirection = new THREE.Vector3().setFromSphericalCoords(
      1,
      THREE.MathUtils.degToRad(90 - sunElevation),
      THREE.MathUtils.degToRad(sunAzimuth),
    )
    skyUniforms.sunPosition.value.copy(skySunDirection)

    const hemisphereLight = new THREE.HemisphereLight('#e8f1ff', '#57606a', 1.25)
    scene.add(hemisphereLight)

    const sun = new THREE.DirectionalLight('#ffe8c2', 4.2)
    sun.position.copy(skySunDirection.clone().multiplyScalar(1800))
    sun.castShadow = true
    sun.shadow.mapSize.set(3072, 3072)
    sun.shadow.bias = -0.00008
    sun.shadow.normalBias = 0.12
    sun.shadow.radius = 2.6
    sun.shadow.camera.near = 80
    sun.shadow.camera.far = 3200
    sun.shadow.camera.left = -1400
    sun.shadow.camera.right = 1400
    sun.shadow.camera.top = 1400
    sun.shadow.camera.bottom = -1400
    sun.target.position.copy(initialTarget)
    scene.add(sun)
    scene.add(sun.target)

    const fillLight = new THREE.DirectionalLight('#bcdcff', 0.95)
    fillLight.position.set(-760, 460, -520)
    scene.add(fillLight)

    const rimLight = new THREE.DirectionalLight('#ffdcb2', 0.42)
    rimLight.position.set(540, 240, -860)
    scene.add(rimLight)

    const mistTexture = createMistTexture()
    const mistGroup = new THREE.Group()
    const mistLayers = [
      { size: 4200, height: 12, opacity: 0.15 },
      { size: 5600, height: 26, opacity: 0.1 },
      { size: 7200, height: 42, opacity: 0.06 },
    ]
    mistLayers.forEach((layer) => {
      const mist = new THREE.Mesh(
        new THREE.PlaneGeometry(layer.size, layer.size),
        new THREE.MeshBasicMaterial({
          color: '#edf5ff',
          map: mistTexture,
          transparent: true,
          opacity: layer.opacity,
          depthWrite: false,
          depthTest: false,
          fog: false,
        }),
      )
      mist.rotation.x = -Math.PI / 2
      mist.position.y = layer.height
      mist.renderOrder = -1
      mistGroup.add(mist)
    })
    mistGroup.position.set(initialTarget.x, 0, initialTarget.z)
    scene.add(mistGroup)

    const textureLoader = new THREE.TextureLoader()
    const grassBaseColor = textureLoader.load(grassBaseColorSrc)
    grassBaseColor.wrapS = THREE.RepeatWrapping
    grassBaseColor.wrapT = THREE.RepeatWrapping
    grassBaseColor.repeat.set(1, 1)
    grassBaseColor.colorSpace = THREE.SRGBColorSpace
    grassBaseColor.anisotropy = 8

    const grassNormal = textureLoader.load(grassNormalSrc)
    grassNormal.wrapS = THREE.RepeatWrapping
    grassNormal.wrapT = THREE.RepeatWrapping
    grassNormal.repeat.set(1, 1)
    grassNormal.anisotropy = 8

    const asphaltBaseColor = textureLoader.load(asphaltBaseColorSrc)
    asphaltBaseColor.wrapS = THREE.RepeatWrapping
    asphaltBaseColor.wrapT = THREE.RepeatWrapping
    asphaltBaseColor.repeat.set(1, 1)
    asphaltBaseColor.colorSpace = THREE.SRGBColorSpace
    asphaltBaseColor.anisotropy = 8

    const asphaltNormal = textureLoader.load(asphaltNormalSrc)
    asphaltNormal.wrapS = THREE.RepeatWrapping
    asphaltNormal.wrapT = THREE.RepeatWrapping
    asphaltNormal.repeat.set(1, 1)
    asphaltNormal.anisotropy = 8

    if (sceneData.tiles.length > 0) {
      const tileGeometry = new THREE.PlaneGeometry(
        sceneData.canvas.gridSize,
        sceneData.canvas.gridSize,
      )
      tileGeometry.rotateX(-Math.PI / 2)

      const tileBatches = new Map<TileType, typeof sceneData.tiles>()
      sceneData.tiles.forEach((tile) => {
        const existingBatch = tileBatches.get(tile.tileType)
        if (existingBatch) {
          existingBatch.push(tile)
          return
        }
        tileBatches.set(tile.tileType, [tile])
      })

      const dummy = new THREE.Object3D()

      tileBatches.forEach((tiles, tileType) => {
        const tileInfo = getTileCatalogItem(tileType)
        const isGreenTile = tileInfo.category === 'green'
        const isRoadTile = tileType === 'road'
        const isWaterTile = tileInfo.category === 'water'
        const material = isGreenTile
          ? new THREE.MeshStandardMaterial({
              color: '#ffffff',
              map: grassBaseColor,
              normalMap: grassNormal,
              roughness: 1,
              metalness: 0,
              envMapIntensity: 0.08,
            })
          : isRoadTile
            ? new THREE.MeshStandardMaterial({
                color: '#ffffff',
                map: asphaltBaseColor,
                normalMap: asphaltNormal,
                roughness: 0.92,
                metalness: 0.04,
                envMapIntensity: 0.12,
              })
          : new THREE.MeshStandardMaterial({
              color: tileInfo.color,
              roughness: isWaterTile ? 0.1 : 0.92,
              metalness: isWaterTile ? 0.18 : 0.01,
              envMapIntensity: isWaterTile ? 0.65 : 0.18,
            })

        const mesh = new THREE.InstancedMesh(tileGeometry, material, tiles.length)
        mesh.receiveShadow = true

        tiles.forEach((tile, index) => {
          dummy.position.set(
            tile.col * sceneData.canvas.gridSize + sceneData.canvas.gridSize / 2,
            0,
            tile.row * sceneData.canvas.gridSize + sceneData.canvas.gridSize / 2,
          )
          dummy.rotation.set(0, 0, 0)
          dummy.scale.set(1, 1, 1)
          dummy.updateMatrix()
          mesh.setMatrixAt(index, dummy.matrix)
        })

        mesh.instanceMatrix.needsUpdate = true
        scene.add(mesh)
      })
    }

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
      } else if (element.type === 'charger') {
        const chargerParams = element.params as ChargerParams
        const modelKey = CHARGER_MODEL_GLB_MAP[chargerParams.model]

        if (modelKey && chargerTemplates.has(chargerParams.model)) {
          const chargerModel = chargerTemplates.get(chargerParams.model)!.clone(true)
          chargerModel.rotateY(-Math.PI / 2)
          fitModelToFootprint(chargerModel, elementSize.width, elementSize.height)
          chargerModel.position.y = 0
          group.add(chargerModel)
        } else {
          // Fallback placeholder if model not yet loaded
          const body = new THREE.Mesh(
            new THREE.BoxGeometry(elementSize.width, 32, elementSize.height),
            new THREE.MeshStandardMaterial({
              color: item.color,
              roughness: 0.5,
              metalness: 0.08,
              envMapIntensity: 0.55,
            }),
          )
          body.castShadow = true
          body.receiveShadow = true
          body.position.y = 16
          group.add(body)

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
      } else if (element.type === 'storage') {
        const storageParams = element.params as StorageParams
        const modelKey = STORAGE_MODEL_GLB_MAP[storageParams.model]

        if (modelKey && storageTemplates.has(storageParams.model)) {
          const storageModel = storageTemplates.get(storageParams.model)!.clone(true)
          storageModel.rotateY(-Math.PI / 2)
          fitModelToFootprint(storageModel, elementSize.width, elementSize.height)
          storageModel.position.y = 0
          group.add(storageModel)
        } else {
          // Fallback placeholder if model not yet loaded
          const body = new THREE.Mesh(
            new THREE.BoxGeometry(elementSize.width, 32, elementSize.height),
            new THREE.MeshStandardMaterial({
              color: item.color,
              roughness: 0.38,
              metalness: 0.22,
              envMapIntensity: 0.55,
            }),
          )
          body.castShadow = true
          body.receiveShadow = true
          body.position.y = 16
          group.add(body)

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
      }

      if (element.type === 'car') {
        if (carTemplate) {
          const car = carTemplate.clone(true)
          fitModelToFootprint(car, elementSize.width, elementSize.height)
          group.add(car)
        } else {
          carTargets.push({
            group,
            width: elementSize.width,
            depth: elementSize.height,
          })
        }
      }

      group.position.set(element.x, 0, element.y)
      group.rotation.y = THREE.MathUtils.degToRad(-element.rotation)
      scene.add(group)
    })

    renderer.shadowMap.needsUpdate = true

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
      clampCameraHeight()
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
      clampCameraHeight()
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
      clampCameraHeight()
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
      clampCameraHeight()
      mistGroup.position.x = camera.position.x
      mistGroup.position.z = camera.position.z
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
      disposeObjectResources(scene)
      renderer.dispose()
      environmentMap?.dispose()
      hdrTexture?.dispose()
      pmremGenerator.dispose()
      mount.innerHTML = ''
    } // close cleanup return
    }) // close loadAllModels().then()
  }, [sceneData])

  if (!sceneData) {
    return null
  }

    return (
    <div className="preview-surface" ref={mountRef} />
  )
}
