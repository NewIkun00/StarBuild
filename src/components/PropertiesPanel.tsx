import { useEffect, useMemo, useRef, useState } from 'react'
import selectArrowIcon from '../../assets/XiaLaaa.png'
import { getCatalogItem } from '../lib/catalog'
import {
  chargerModelOptions,
  chargerTypeOptions,
  normalizeChargerType,
} from '../lib/chargerCatalog'
import { normalizeParkingParams, normalizeSteelColor } from '../lib/parkingSlots'
import { normalizeStorageModel, storageModelOptions } from '../lib/storageCatalog'
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

function AutoSelectNumberInput(
  props: Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'>,
) {
  return (
    <input
      {...props}
      type="number"
      onFocus={(event) => {
        event.currentTarget.select()
        props.onFocus?.(event)
      }}
      onPointerUp={(event) => {
        window.requestAnimationFrame(() => event.currentTarget.select())
        props.onPointerUp?.(event)
      }}
    />
  )
}

export function PropertiesPanel({ element }: PropertiesPanelProps) {
  const scene = useEditorStore((state) => state.scene)
  const setSceneName = useEditorStore((state) => state.setSceneName)
  const moveElement = useEditorStore((state) => state.moveElement)
  const updateElementParams = useEditorStore((state) => state.updateElementParams)
  const updateElementRotation = useEditorStore((state) => state.updateElementRotation)

  if (!scene) {
    return null
  }

  return (
    <aside className="properties">
      <div className="properties-header">
        <h3>
          {element
            ? `属性面板-${getCatalogItem(element.type).title}`
            : '场景信息'}
        </h3>
      </div>
      <div className="properties-body">
        {!element ? (
          <section className="properties-section">
            <div className="properties-section-body">
              <div className="field">
                <label htmlFor="sceneName">项目名称</label>
                <input
                  id="sceneName"
                  value={scene.meta.name}
                  onChange={(event) => setSceneName(event.target.value)}
                />
              </div>
            </div>
          </section>
        ) : (
          <>
          <section className="properties-section">
            <div className="properties-section-header">
              <span>基本参数</span>
            </div>
            <div className="properties-section-body">
              <div className="field">
                <label>XY位置</label>
                <div className="field-row">
                  <AutoSelectNumberInput
                    aria-label="位置 X"
                    step="0.1"
                    value={Number(element.x.toFixed(2))}
                    onChange={(event) =>
                      moveElement(element.id, Number(event.target.value) || 0, element.y)
                    }
                  />
                  <AutoSelectNumberInput
                    aria-label="位置 Y"
                    step="0.1"
                    value={Number(element.y.toFixed(2))}
                    onChange={(event) =>
                      moveElement(element.id, element.x, Number(event.target.value) || 0)
                    }
                  />
                </div>
              </div>

              <div className="field">
                <label htmlFor="rotation">旋转角度</label>
                <AutoSelectNumberInput
                  id="rotation"
                  max={360}
                  min={0}
                  value={Math.round(element.rotation)}
                  onChange={(event) =>
                    updateElementRotation(element.id, Number(event.target.value) || 0)
                  }
                />
              </div>
            </div>
          </section>

          <section className="properties-section">
            <div className="properties-section-header">
              <span>
                {element.type === 'parking'
                  ? '车位参数'
                  : element.type === 'charger'
                    ? '充电桩参数'
                    : element.type === 'storage'
                      ? '储能柜参数'
                      : getCatalogItem(element.type).title}
              </span>
            </div>
            <div className="properties-section-body">
              {element.type === 'parking' && (
                <ParkingSizeFields
                  params={normalizeParkingParams(element.params as ParkingParams)}
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
          </section>
          {element.type === 'parking' && (
            <section className="properties-section">
              <div className="properties-section-header">
                <span>车棚参数</span>
              </div>
              <div className="properties-section-body">
                <ParkingCanopyFields
                  params={normalizeParkingParams(element.params as ParkingParams)}
                  onChange={(params) => updateElementParams(element.id, params)}
                />
              </div>
            </section>
          )}
          </>
        )}
      </div>
    </aside>
  )
}

function ParkingSizeFields({
  params,
  onChange,
}: {
  params: ParkingParams
  onChange: (params: Partial<ParkingParams>) => void
}) {
  return (
    <>
      <div className="field">
        <label>车位长宽尺寸(m)</label>
        <div className="field-row">
          <AutoSelectNumberInput
            aria-label="车位长度"
            value={params.lengthM ?? 5.5}
            onChange={(event) => onChange({ lengthM: Number(event.target.value) || 0 })}
          />
          <AutoSelectNumberInput
            aria-label="车位宽度"
            value={params.widthM ?? 2.5}
            onChange={(event) => onChange({ widthM: Number(event.target.value) || 0 })}
          />
        </div>
      </div>
      <div className="field">
        <label htmlFor="parkingCount">车位数量</label>
        <AutoSelectNumberInput
          id="parkingCount"
          min={1}
          step={1}
          value={Math.max(1, Math.round(params.count ?? 1))}
          onChange={(event) =>
            onChange({ count: Math.max(1, Math.round(Number(event.target.value) || 1)) })
          }
        />
      </div>
      <SelectField
        label="车位类型"
        value={normalizeParkingType(params.parkingType)}
        options={[
          { label: '普通车位', value: 'ordinary' },
          { label: '充电车位', value: 'charging' },
        ]}
        onChange={(value) =>
          onChange({ parkingType: value as ParkingParams['parkingType'] })
        }
      />
    </>
  )
}

function normalizeParkingType(type: ParkingParams['parkingType']) {
  if (type === 'charging') {
    return 'charging'
  }
  return 'ordinary'
}

function ParkingCanopyFields({
  params,
  onChange,
}: {
  params: ParkingParams
  onChange: (params: Partial<ParkingParams>) => void
}) {
  return (
    <>
      <SelectField
        label="车棚样式"
        value={params.canopyType}
        options={[
          { label: '无车棚', value: 'none' },
          { label: '光伏车棚', value: 'pv' },
          { label: '薄膜车棚', value: 'film' },
        ]}
        onChange={(value) => onChange({ canopyType: value as ParkingParams['canopyType'] })}
      />
      {params.canopyType === 'pv' && (
        <>
          <SelectField
            label="车棚造型"
            value={params.carportStyle ?? 'y'}
            options={[
              { label: 'Y字车棚', value: 'y' },
              { label: '7字车棚', value: 'seven' },
            ]}
            onChange={(value) =>
              onChange({ carportStyle: value as NonNullable<ParkingParams['carportStyle']> })
            }
          />
          <ColorField
            label="钢构颜色"
            value={normalizeSteelColor(params.steelColor)}
            onChange={(value) => onChange({ steelColor: value })}
          />
        </>
      )}
    </>
  )
}

function ColorField({
  label,
  value,
  onChange,
}: {
  label: string
  value: string
  onChange: (value: string) => void
}) {
  const [draft, setDraft] = useState(value)
  const pickerRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    setDraft(value)
  }, [value])

  return (
    <div className="field">
      <label>{label}</label>
      <div className="field-color-row">
        <input
          value={draft}
          onBlur={() => {
            const normalized = normalizeSteelColor(draft)
            setDraft(normalized)
            onChange(normalized)
          }}
          onChange={(event) => setDraft(event.target.value)}
        />
        <button
          aria-label={`${label}颜色选择器`}
          className="color-swatch-trigger"
          style={{ backgroundColor: normalizeSteelColor(draft) }}
          type="button"
          onClick={() => pickerRef.current?.click()}
        />
        <input
          ref={pickerRef}
          className="color-picker-native"
          type="color"
          value={normalizeSteelColor(draft)}
          onChange={(event) => {
            setDraft(event.target.value.toUpperCase())
            onChange(event.target.value.toUpperCase())
          }}
        />
      </div>
    </div>
  )
}

function ChargerFields({
  params,
  onChange,
}: {
  params: ChargerParams
  onChange: (params: Partial<ChargerParams>) => void
}) {
  const normalizedType = normalizeChargerType(params.chargerType, params.model)
  const modelOptions = chargerModelOptions[normalizedType]
  const normalizedModel = modelOptions.includes(params.model) ? params.model : modelOptions[0]

  return (
    <>
      <SelectField
        label="充电桩类型"
        value={normalizedType}
        options={chargerTypeOptions.map((option) => ({
          label: option.label,
          value: option.value,
        }))}
        onChange={(value) => {
          const nextType = value as NonNullable<ChargerParams['chargerType']>
          onChange({
            chargerType: nextType,
            model: chargerModelOptions[nextType][0],
          })
        }}
      />
      <SelectField
        label="充电桩型号"
        value={normalizedModel}
        options={modelOptions.map((option) => ({
          label: option,
          value: option,
        }))}
        onChange={(value) => onChange({ chargerType: normalizedType, model: value })}
      />
    </>
  )
}

function StorageFields({
  params,
  onChange,
}: {
  params: StorageParams
  onChange: (params: Partial<StorageParams>) => void
}) {
  const normalizedModel = normalizeStorageModel(params.model)

  return (
    <SelectField
      label="储能柜型号"
      value={normalizedModel}
      options={storageModelOptions.map((option) => ({
        label: option.label,
        value: option.value,
      }))}
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
  const [isOpen, setIsOpen] = useState(false)
  const [isOverflowing, setIsOverflowing] = useState(false)
  const fieldRef = useRef<HTMLDivElement | null>(null)
  const valueRef = useRef<HTMLSpanElement | null>(null)
  const selectedLabel = useMemo(
    () => options.find((option) => option.value === value)?.label ?? options[0]?.label ?? '',
    [options, value],
  )

  useEffect(() => {
    const handlePointerDown = (event: MouseEvent) => {
      if (!fieldRef.current?.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    window.addEventListener('mousedown', handlePointerDown)
    return () => window.removeEventListener('mousedown', handlePointerDown)
  }, [])

  useEffect(() => {
    const node = valueRef.current
    if (!node) {
      return
    }
    setIsOverflowing(node.scrollWidth > node.clientWidth)
  }, [selectedLabel])

  return (
    <div className="field" ref={fieldRef}>
      <label>{label}</label>
      <button
        aria-expanded={isOpen}
        className={`select-field-trigger ${isOpen ? 'is-open' : ''}`}
        type="button"
        onClick={() => setIsOpen((open) => !open)}
      >
        <span className="select-field-value-mask">
          <span
            className={`select-field-value ${isOverflowing ? 'is-overflowing' : ''}`}
            ref={valueRef}
          >
            {selectedLabel}
          </span>
        </span>
        <img alt="" className="select-field-arrow" src={selectArrowIcon} />
      </button>
      {isOpen && (
        <div className="select-field-menu">
          {options.map((option) => (
            <button
              key={option.value}
              className={`select-field-option ${option.value === value ? 'is-selected' : ''}`}
              type="button"
              onClick={() => {
                onChange(option.value)
                setIsOpen(false)
              }}
            >
              <span className="select-field-option-text">{option.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
