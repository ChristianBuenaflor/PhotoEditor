import { useEditor } from '../store/editor';
import { PanelHeader } from './PanelHeader';
import type { Adjustments } from '../lib/types';
import { defaultAdjustments } from '../lib/types';
import { RotateCcw, Check } from 'lucide-react';

interface Row {
  key: keyof Adjustments;
  label: string;
  min: number;
  max: number;
  default: number;
  suffix?: string;
}

const ROWS: Row[] = [
  { key: 'brightness', label: 'Brightness', min: 0, max: 200, default: 100, suffix: '%' },
  { key: 'contrast', label: 'Contrast', min: 0, max: 200, default: 100, suffix: '%' },
  { key: 'saturate', label: 'Saturation', min: 0, max: 200, default: 100, suffix: '%' },
  { key: 'hueRotate', label: 'Hue Shift', min: -180, max: 180, default: 0, suffix: '°' },
  { key: 'blur', label: 'Blur', min: 0, max: 20, default: 0, suffix: 'px' },
  { key: 'invert', label: 'Invert', min: 0, max: 100, default: 0, suffix: '%' },
  { key: 'sepia', label: 'Sepia', min: 0, max: 100, default: 0, suffix: '%' },
  { key: 'grayscale', label: 'Grayscale', min: 0, max: 100, default: 0, suffix: '%' },
];

export function AdjustmentsPanel() {
  const layers = useEditor((s) => s.layers);
  const activeId = useEditor((s) => s.activeLayerId);
  const updateLayer = useEditor((s) => s.updateLayer);
  const bake = useEditor((s) => s.bakeAdjustments);
  const active = layers.find((l) => l.id === activeId);

  if (!active) return null;

  return (
    <div className="border-b border-border">
      <PanelHeader
        title="Adjustments"
        actions={
          <>
            <button
              onClick={() => updateLayer(active.id, { adjustments: defaultAdjustments() })}
              title="Reset"
              className="p-1 hover:bg-panel rounded text-fg-dim hover:text-accent"
            >
              <RotateCcw size={12} />
            </button>
            <button
              onClick={() => bake(active.id)}
              title="Apply (bake)"
              className="p-1 hover:bg-panel rounded text-fg-dim hover:text-accent"
            >
              <Check size={12} />
            </button>
          </>
        }
      />
      <div className="px-3 py-2 space-y-1.5">
        {ROWS.map((r) => (
          <div key={r.key} className="flex items-center gap-2">
            <label className="text-[10px] font-mono text-fg-dim w-16 truncate">{r.label}</label>
            <input
              type="range"
              min={r.min}
              max={r.max}
              value={active.adjustments[r.key]}
              onChange={(e) =>
                updateLayer(active.id, {
                  adjustments: { ...active.adjustments, [r.key]: Number(e.target.value) },
                })
              }
              onDoubleClick={() =>
                updateLayer(active.id, {
                  adjustments: { ...active.adjustments, [r.key]: r.default },
                })
              }
            />
            <span className="text-[10px] font-mono text-fg w-12 text-right">
              {active.adjustments[r.key]}
              {r.suffix}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
