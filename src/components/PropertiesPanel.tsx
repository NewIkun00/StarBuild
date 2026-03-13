import type { ChangeEvent } from 'react'
import { getCatalogItem } from '../lib/catalog'
import { useEditorStore } from '../store/editorStore'
import type {
  ChargerParams,
  ParkingParams,
  SceneElement,
  StorageParams,
} from '../types/scene'

interface PropertiesPanelProps {
  element: SceneElement | null
}

export function PropertiesPanel({ element }: PropertiesPanelProps) {
  const scene = useEditorStore((state) => state.scene)
  const setSceneName = useEditorStore((state) => state.setSceneName)
  const updateElementParams = useEditorStore((state) => state.updateElementParams)
  const updateElementRotation = useEditorStore((state) => state.updateElementRotation)

  if (!scene) {
    return null
  }

  return (
    <aside className="properties">
      <p className="eyebrow">属性</p>
      <h3>场景与选中项</h3>

      <div className="field">
        <label htmlFor="sceneName">项目名称</label>
        <input
          id="sceneName"
          value={scene.meta.name}
          onChange={(event) => setSceneName(event.target.value)}
        />
      </div>

      {!element ? (
        <div className="empty-state panel-section">
          当前没有选中设备。可以从左侧添加一个设备，或者使用地面笔刷绘制网格元素。
        </div>
      ) : (
        <div className="panel-section">
          <h4>{getCatalogItem(element.type).title}</h4>
          <p className="panel-note">位置：({Math.round(element.x)}, {Math.round(element.y)})</p>

          <div className="field">
            <label htmlFor="rotation">旋转角度</label>
            <input
              id="rotation"
              max={360}
              min={0}
              type="number"
              value={Math.round(element.rotation)}
              onChange={(event) =>
                updateElementRotation(element.id, Number(event.target.value) || 0)
              }
            />
          </div>

          {element.type === 'parking' && (
            <ParkingFields
              params={element.params as ParkingParams}
              onChange={(params) => updateElementParams(element.id, params)}
            />
          )}
          {element.type === 'charger' && (
            <ChargerFields
              params={element.params as ChargerParams}
              onChange={(params) => updateElementParams(element.id, params)}
            />
          )}
          {element.type === 'storage' && (
            <StorageFields
              params={element.params as StorageParams}
              onChange={(params) => updateElementParams(element.id, params)}
            />
          )}
        </div>
      )}
    </aside>
  )
}

function ParkingFields({
  params,
  onChange,
}: {
  params: ParkingParams
  onChange: (params: Partial<ParkingParams>) => void
}) {
  return (
    <>
      <div className="field">
        <label className="inline-checkbox">
          <input
            checked={params.hasPvCanopy}
            type="checkbox"
            onChange={(event) => onChange({ hasPvCanopy: event.target.checked })}
          />
          带光伏车棚
        </label>
      </div>
      <SelectField
        label="车棚样式"
        value={params.canopyStyle}
        options={[
          { label: '平顶', value: 'flat' },
          { label: '弧形', value: 'curve' },
        ]}
        onChange={(value) => onChange({ canopyStyle: value as ParkingParams['canopyStyle'] })}
      />
      <SelectField
        label="车位类型"
        value={params.parkingType}
        options={[
          { label: '标准车位', value: 'standard' },
          { label: '无障碍车位', value: 'accessible' },
        ]}
        onChange={(value) =>
          onChange({ parkingType: value as ParkingParams['parkingType'] })
        }
      />
    </>
  )
}

function ChargerFields({
  params,
  onChange,
}: {
  params: ChargerParams
  onChange: (params: Partial<ChargerParams>) => void
}) {
  return (
    <SelectField
      label="充电桩型号"
      value={params.model}
      options={[
        { label: '120kW 一体桩', value: 'charger_120kw' },
        { label: '180kW 双枪桩', value: 'charger_180kw' },
      ]}
      onChange={(value) => onChange({ model: value as ChargerParams['model'] })}
    />
  )
}

function StorageFields({
  params,
  onChange,
}: {
  params: StorageParams
  onChange: (params: Partial<StorageParams>) => void
}) {
  return (
    <SelectField
      label="储能柜型号"
      value={params.model}
      options={[
        { label: '215kWh 标准柜', value: 'storage_215kwh' },
        { label: '372kWh 高配柜', value: 'storage_372kwh' },
      ]}
      onChange={(value) => onChange({ model: value as StorageParams['model'] })}
    />
  )
}

function SelectField({
  label,
  value,
  options,
  onChange,
}: {
  label: string
  value: string
  options: Array<{ label: string; value: string }>
  onChange: (value: string) => void
}) {
  return (
    <div className="field">
      <label>{label}</label>
      <select
        value={value}
        onChange={(event: ChangeEvent<HTMLSelectElement>) => onChange(event.target.value)}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  )
}
