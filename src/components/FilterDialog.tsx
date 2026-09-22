import { useState, useEffect, useRef } from 'react';
import { useEditor } from '../store/editor';
import { applyFilter, type FilterName } from '../lib/filters';
import { X } from 'lucide-react';

const FILTER_META: Record<FilterName, { title: string; params: { key: string; label: string; min: number; max: number; default: number }[] }> = {
  'gaussian-blur': { title: 'Gaussian Blur', params: [{ key: 'radius', label: 'Radius', min: 0, max: 40, default: 4 }] },
  'sharpen': { title: 'Sharpen', params: [{ key: 'amount', label: 'Amount', min: 0, max: 5, default: 1 }] },
  'edge-detect': { title: 'Edge Detect', params: [] },
  'emboss': { title: 'Emboss', params: [] },
  'noise': { title: 'Add Noise', params: [{ key: 'amount', label: 'Amount', min: 0, max: 100, default: 30 }] },
  'pixelate': { title: 'Pixelate', params: [{ key: 'size', label: 'Cell Size', min: 2, max: 64, default: 8 }] },
  'posterize': { title: 'Posterize', params: [{ key: 'levels', label: 'Levels', min: 2, max: 16, default: 4 }] },
  'threshold': { title: 'Threshold', params: [{ key: 'amount', label: 'Threshold', min: 0, max: 255, default: 128 }] },
  'invert': { title: 'Invert Colors', params: [] },
  'vignette': { title: 'Vignette', params: [{ key: 'amount', label: 'Strength', min: 0, max: 1.5, default: 0.7 }] },
};

export function FilterDialog({ filter, onClose }: { filter: FilterName; onClose: () => void }) {
  const meta = FILTER_META[filter];
  const initialParams: Record<string, number> = {};
  meta.params.forEach((p) => (initialParams[p.key] = p.default));
  const [params, setParams] = useState(initialParams);

  const activeId = useEditor((s) => s.activeLayerId);
  const layers = useEditor((s) => s.layers);
  const pushHistory = useEditor((s) => s.pushHistory);
  const bumpPaintTick = useEditor((s) => s.bumpPaintTick);
  const active = layers.find((l) => l.id === activeId);
  const previewRef = useRef<HTMLCanvasElement>(null);
  const originalRef = useRef<HTMLCanvasElement | null>(null);

  // Save original
  useEffect(() => {
    if (!active) return;
    const orig = document.createElement('canvas');
    orig.width = active.canvas.width;
    orig.height = active.canvas.height;
    orig.getContext('2d')!.drawImage(active.canvas, 0, 0);
    originalRef.current = orig;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Live preview onto small canvas
  useEffect(() => {
    if (!active || !originalRef.current) return;
    const c = previewRef.current;
    if (!c) return;
    const orig = originalRef.current;
    const maxW = 400, maxH = 260;
    const scale = Math.min(maxW / orig.width, maxH / orig.height, 1);
    c.width = orig.width * scale;
    c.height = orig.height * scale;
    const ctx = c.getContext('2d')!;
    ctx.drawImage(orig, 0, 0, c.width, c.height);
    applyFilter(ctx, filter, params);
  }, [params, active, filter]);

  const apply = () => {
    if (!active || !originalRef.current) return onClose();
    const ctx = active.canvas.getContext('2d')!;
    ctx.clearRect(0, 0, active.canvas.width, active.canvas.height);
    ctx.drawImage(originalRef.current, 0, 0);
    applyFilter(ctx, filter, params);
    bumpPaintTick();
    pushHistory(meta.title);
    onClose();
  };

  const cancel = () => {
    if (active && originalRef.current) {
      const ctx = active.canvas.getContext('2d')!;
      ctx.clearRect(0, 0, active.canvas.width, active.canvas.height);
      ctx.drawImage(originalRef.current, 0, 0);
      bumpPaintTick();
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 grid place-items-center" onClick={cancel}>
      <div
        className="w-[520px] bg-panel border border-border-strong rounded-md shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="h-10 px-4 flex items-center justify-between border-b border-border">
          <h2 className="font-serif text-[16px]">{meta.title}</h2>
          <button onClick={cancel} className="p-1 hover:bg-panel-2 rounded text-fg-dim">
            <X size={14} />
          </button>
        </div>
        <div className="p-4 space-y-3">
          <div className="checker rounded overflow-hidden border border-border-strong grid place-items-center min-h-[280px]">
            <canvas ref={previewRef} />
          </div>
          {meta.params.map((p) => (
            <div key={p.key} className="flex items-center gap-3">
              <label className="text-[11px] font-mono text-fg-dim w-20">{p.label}</label>
              <input
                type="range"
                min={p.min}
                max={p.max}
                step={p.max - p.min > 10 ? 1 : 0.1}
                value={params[p.key]}
                onChange={(e) => setParams({ ...params, [p.key]: Number(e.target.value) })}
              />
              <span className="text-[11px] font-mono text-fg w-14 text-right">{params[p.key]}</span>
            </div>
          ))}
          {meta.params.length === 0 && (
            <p className="text-[11px] font-mono text-fg-dim text-center">This filter has no parameters. Click Apply to commit.</p>
          )}
          <div className="pt-2 flex justify-end gap-2 border-t border-border">
            <button
              onClick={cancel}
              className="px-3 py-1.5 text-[11px] font-mono text-fg-dim hover:text-fg"
            >
              Cancel
            </button>
            <button
              onClick={apply}
              className="px-4 py-1.5 text-[11px] font-mono bg-accent text-bg rounded hover:bg-accent-2 hover:text-fg transition-colors"
            >
              Apply
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
