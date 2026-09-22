import { useEditor } from '../store/editor';
import { PanelHeader } from './PanelHeader';
import { Eye, EyeOff, Lock, LockOpen, Plus, Trash2, Copy, ChevronsDownUp, Layers, ArrowUp, ArrowDown } from 'lucide-react';
import { useEffect, useRef } from 'react';

export function LayersPanel() {
  const layers = useEditor((s) => s.layers);
  const activeId = useEditor((s) => s.activeLayerId);
  const setActive = useEditor((s) => s.setActiveLayer);
  const updateLayer = useEditor((s) => s.updateLayer);
  const addLayer = useEditor((s) => s.addLayer);
  const deleteLayer = useEditor((s) => s.deleteLayer);
  const duplicate = useEditor((s) => s.duplicateLayer);
  const moveLayer = useEditor((s) => s.moveLayer);
  const mergeDown = useEditor((s) => s.mergeDown);
  const flatten = useEditor((s) => s.flattenAll);
  const paintTick = useEditor((s) => s.paintTick);
  const active = layers.find((l) => l.id === activeId);

  return (
    <div className="flex-1 flex flex-col min-h-0 border-b border-border">
      <PanelHeader
        title="Layers"
        actions={
          <>
            <button onClick={() => addLayer()} title="New layer" className="p-1 hover:bg-panel rounded text-fg-dim hover:text-accent">
              <Plus size={12} />
            </button>
            <button onClick={() => active && duplicate(active.id)} title="Duplicate" className="p-1 hover:bg-panel rounded text-fg-dim hover:text-accent">
              <Copy size={12} />
            </button>
            <button onClick={() => active && mergeDown(active.id)} title="Merge down" className="p-1 hover:bg-panel rounded text-fg-dim hover:text-accent">
              <ChevronsDownUp size={12} />
            </button>
            <button onClick={flatten} title="Flatten" className="p-1 hover:bg-panel rounded text-fg-dim hover:text-accent">
              <Layers size={12} />
            </button>
            <button onClick={() => active && deleteLayer(active.id)} title="Delete" className="p-1 hover:bg-panel rounded text-fg-dim hover:text-danger">
              <Trash2 size={12} />
            </button>
          </>
        }
      />
      {active && (
        <div className="px-3 py-2 border-b border-border space-y-2">
          <div className="flex items-center gap-2">
            <label className="text-[10px] font-mono text-fg-dim w-14">Blend</label>
            <select
              className="flex-1"
              value={active.blendMode}
              onChange={(e) => updateLayer(active.id, { blendMode: e.target.value as never })}
            >
              {['source-over', 'multiply', 'screen', 'overlay', 'darken', 'lighten', 'color-dodge', 'color-burn', 'hard-light', 'soft-light', 'difference', 'exclusion', 'hue', 'saturation', 'color', 'luminosity'].map((m) => (
                <option key={m} value={m}>{m === 'source-over' ? 'Normal' : m}</option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-[10px] font-mono text-fg-dim w-14">Opacity</label>
            <input
              type="range"
              min={0}
              max={100}
              value={active.opacity}
              onChange={(e) => updateLayer(active.id, { opacity: Number(e.target.value) })}
            />
            <span className="text-[10px] font-mono text-fg w-8 text-right">{active.opacity}%</span>
          </div>
        </div>
      )}
      <div className="flex-1 overflow-auto thin-scroll">
        {[...layers].reverse().map((l) => (
          <LayerRow key={l.id + paintTick} layer={l} active={l.id === activeId} onSelect={() => setActive(l.id)} />
        ))}
      </div>
      <div className="h-7 flex items-center justify-between px-2 border-t border-border bg-panel-2">
        <div className="flex items-center gap-1">
          <button onClick={() => active && moveLayer(active.id, 'up')} title="Bring forward" className="p-1 hover:bg-panel rounded text-fg-dim hover:text-accent"><ArrowUp size={12} /></button>
          <button onClick={() => active && moveLayer(active.id, 'down')} title="Send back" className="p-1 hover:bg-panel rounded text-fg-dim hover:text-accent"><ArrowDown size={12} /></button>
        </div>
        <span className="text-[10px] font-mono text-fg-mute">{layers.length} layer{layers.length !== 1 ? 's' : ''}</span>
      </div>
    </div>
  );
}

function LayerRow({ layer, active, onSelect }: { layer: ReturnType<typeof useEditor.getState>['layers'][number]; active: boolean; onSelect: () => void }) {
  const updateLayer = useEditor((s) => s.updateLayer);
  const thumbRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = thumbRef.current;
    if (!c) return;
    const ctx = c.getContext('2d')!;
    ctx.clearRect(0, 0, c.width, c.height);
    const scale = Math.min(c.width / layer.canvas.width, c.height / layer.canvas.height);
    const w = layer.canvas.width * scale;
    const h = layer.canvas.height * scale;
    ctx.drawImage(layer.canvas, (c.width - w) / 2, (c.height - h) / 2, w, h);
  }, [layer]);

  return (
    <div
      onClick={onSelect}
      className={`flex items-center gap-2 px-2 py-1.5 border-b border-border/70 cursor-pointer group ${
        active ? 'bg-accent/15 border-l-2 border-l-accent' : 'hover:bg-panel-2 border-l-2 border-l-transparent'
      }`}
    >
      <button
        onClick={(e) => {
          e.stopPropagation();
          updateLayer(layer.id, { visible: !layer.visible });
        }}
        className="text-fg-dim hover:text-fg"
      >
        {layer.visible ? <Eye size={13} /> : <EyeOff size={13} />}
      </button>
      <div className="w-10 h-10 checker rounded border border-border-strong overflow-hidden shrink-0">
        <canvas ref={thumbRef} width={40} height={40} />
      </div>
      <div className="flex-1 min-w-0">
        <input
          value={layer.name}
          onChange={(e) => updateLayer(layer.id, { name: e.target.value })}
          onClick={(e) => e.stopPropagation()}
          className="w-full !p-0 !border-0 !bg-transparent !font-sans !text-[12px] !text-fg"
        />
        <div className="text-[9px] font-mono text-fg-mute">
          {layer.blendMode === 'source-over' ? 'Normal' : layer.blendMode} · {layer.opacity}%
        </div>
      </div>
      <button
        onClick={(e) => {
          e.stopPropagation();
          updateLayer(layer.id, { locked: !layer.locked });
        }}
        className="text-fg-dim hover:text-fg opacity-0 group-hover:opacity-100"
      >
        {layer.locked ? <Lock size={12} /> : <LockOpen size={12} />}
      </button>
    </div>
  );
}
