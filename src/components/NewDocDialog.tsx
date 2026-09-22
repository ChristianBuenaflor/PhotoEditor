import { useState } from 'react';
import { useEditor } from '../store/editor';
import { X } from 'lucide-react';

interface Preset { name: string; w: number; h: number; }
const PRESETS: Preset[] = [
  { name: 'Custom', w: 1200, h: 800 },
  { name: 'HD 1920×1080', w: 1920, h: 1080 },
  { name: '4K UHD', w: 3840, h: 2160 },
  { name: 'Square 1080', w: 1080, h: 1080 },
  { name: 'Story 1080×1920', w: 1080, h: 1920 },
  { name: 'A4 300dpi', w: 2480, h: 3508 },
  { name: 'Twitter Header', w: 1500, h: 500 },
];

export function NewDocDialog({ onClose }: { onClose: () => void }) {
  const [width, setWidth] = useState(1200);
  const [height, setHeight] = useState(800);
  const [bg, setBg] = useState<'white' | 'transparent' | 'black' | 'custom'>('white');
  const [customBg, setCustomBg] = useState('#f0f0f0');
  const newDoc = useEditor((s) => s.newDocument);

  const create = () => {
    const bgVal =
      bg === 'white' ? '#ffffff' : bg === 'black' ? '#000000' : bg === 'transparent' ? 'transparent' : customBg;
    newDoc(width, height, bgVal);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 grid place-items-center" onClick={onClose}>
      <div
        className="w-[560px] bg-panel border border-border-strong rounded-md shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="h-10 px-4 flex items-center justify-between border-b border-border">
          <h2 className="font-serif text-[16px]">New Document</h2>
          <button onClick={onClose} className="p-1 hover:bg-panel-2 rounded text-fg-dim">
            <X size={14} />
          </button>
        </div>
        <div className="grid grid-cols-[180px_1fr]">
          <div className="border-r border-border py-2">
            {PRESETS.map((p) => (
              <button
                key={p.name}
                onClick={() => {
                  setWidth(p.w);
                  setHeight(p.h);
                }}
                className={`w-full text-left px-3 py-1.5 text-[11px] font-mono ${
                  width === p.w && height === p.h ? 'bg-accent/15 text-accent' : 'text-fg-dim hover:text-fg hover:bg-panel-2'
                }`}
              >
                {p.name}
              </button>
            ))}
          </div>
          <div className="p-4 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <label className="space-y-1">
                <div className="text-[10px] uppercase tracking-wider text-fg-dim font-mono">Width</div>
                <div className="flex gap-1">
                  <input type="number" value={width} onChange={(e) => setWidth(Number(e.target.value))} className="flex-1" />
                  <span className="text-[10px] font-mono text-fg-mute self-center">px</span>
                </div>
              </label>
              <label className="space-y-1">
                <div className="text-[10px] uppercase tracking-wider text-fg-dim font-mono">Height</div>
                <div className="flex gap-1">
                  <input type="number" value={height} onChange={(e) => setHeight(Number(e.target.value))} className="flex-1" />
                  <span className="text-[10px] font-mono text-fg-mute self-center">px</span>
                </div>
              </label>
            </div>
            <label className="space-y-1 block">
              <div className="text-[10px] uppercase tracking-wider text-fg-dim font-mono">Background</div>
              <div className="grid grid-cols-4 gap-1">
                {(['white', 'black', 'transparent', 'custom'] as const).map((b) => (
                  <button
                    key={b}
                    onClick={() => setBg(b)}
                    className={`h-9 rounded border-2 text-[10px] font-mono ${
                      bg === b ? 'border-accent' : 'border-border'
                    }`}
                    style={{
                      background: b === 'white' ? '#fff' : b === 'black' ? '#000' : b === 'custom' ? customBg : undefined,
                    }}
                  >
                    {b === 'transparent' ? <span className="text-fg-dim">alpha</span> : b === 'custom' ? '' : ''}
                    {b === 'transparent' && <div className="checker w-full h-full" />}
                  </button>
                ))}
              </div>
              {bg === 'custom' && (
                <input
                  type="color"
                  value={customBg}
                  onChange={(e) => setCustomBg(e.target.value)}
                  className="w-full h-8 rounded cursor-pointer bg-transparent border border-border"
                />
              )}
            </label>
            <div className="pt-2 flex justify-end gap-2">
              <button
                onClick={onClose}
                className="px-3 py-1.5 text-[11px] font-mono text-fg-dim hover:text-fg"
              >
                Cancel
              </button>
              <button
                onClick={create}
                className="px-4 py-1.5 text-[11px] font-mono bg-accent text-bg rounded hover:bg-accent-2 hover:text-fg transition-colors"
              >
                Create
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
