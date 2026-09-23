import { useEditor } from '../store/editor';
import type { Tool } from '../lib/types';
import {
  Move, Square, Circle, Lasso, Wand2, Crop, Pipette,
  Brush, Pencil, Eraser, PaintBucket, Type,
  Slash, Hand, ZoomIn, Droplet, Sun, Moon, ArrowLeftRight,
  Blend, Sparkles, Fingerprint,
} from 'lucide-react';

interface ToolDef { id: Tool; label: string; icon: React.ReactNode; shortcut?: string; group?: string; }

const TOOLS: (ToolDef | 'divider')[] = [
  { id: 'move', label: 'Move Tool', icon: <Move size={16} />, shortcut: 'V' },
  'divider',
  { id: 'marquee-rect', label: 'Rectangular Marquee Tool', icon: <Square size={16} />, shortcut: 'M', group: 'marquee' },
  { id: 'marquee-ellipse', label: 'Elliptical Marquee Tool', icon: <Circle size={16} />, shortcut: 'M', group: 'marquee' },
  { id: 'lasso', label: 'Lasso Tool', icon: <Lasso size={16} />, shortcut: 'L' },
  { id: 'wand', label: 'Magic Wand Tool', icon: <Wand2 size={16} />, shortcut: 'W' },
  'divider',
  { id: 'crop', label: 'Crop Tool', icon: <Crop size={16} />, shortcut: 'C' },
  { id: 'eyedropper', label: 'Eyedropper Tool', icon: <Pipette size={16} />, shortcut: 'I' },
  'divider',
  { id: 'brush', label: 'Brush Tool', icon: <Brush size={16} />, shortcut: 'B', group: 'paint' },
  { id: 'pencil', label: 'Pencil Tool', icon: <Pencil size={16} />, shortcut: 'B', group: 'paint' },
  { id: 'eraser', label: 'Eraser Tool', icon: <Eraser size={16} />, shortcut: 'E' },
  { id: 'bucket', label: 'Paint Bucket Tool', icon: <PaintBucket size={16} />, shortcut: 'G', group: 'fill' },
  { id: 'gradient', label: 'Gradient Tool', icon: <Blend size={16} />, shortcut: 'G', group: 'fill' },
  'divider',
  { id: 'blur', label: 'Blur Tool', icon: <Droplet size={16} />, shortcut: 'R', group: 'retouch' },
  { id: 'sharpen', label: 'Sharpen Tool', icon: <Sparkles size={16} />, shortcut: 'R', group: 'retouch' },
  { id: 'smudge', label: 'Smudge Tool', icon: <Fingerprint size={16} />, shortcut: 'R', group: 'retouch' },
  { id: 'dodge', label: 'Dodge Tool', icon: <Sun size={16} />, shortcut: 'O', group: 'tone' },
  { id: 'burn', label: 'Burn Tool', icon: <Moon size={16} />, shortcut: 'O', group: 'tone' },
  'divider',
  { id: 'text', label: 'Horizontal Type Tool', icon: <Type size={16} />, shortcut: 'T' },
  { id: 'shape-rect', label: 'Rectangle Tool', icon: <Square size={16} />, shortcut: 'U', group: 'shape' },
  { id: 'shape-ellipse', label: 'Ellipse Tool', icon: <Circle size={16} />, shortcut: 'U', group: 'shape' },
  { id: 'shape-line', label: 'Line Tool', icon: <Slash size={16} />, shortcut: 'U', group: 'shape' },
  'divider',
  { id: 'hand', label: 'Hand Tool', icon: <Hand size={16} />, shortcut: 'H' },
  { id: 'zoom', label: 'Zoom Tool', icon: <ZoomIn size={16} />, shortcut: 'Z' },
];

export function Toolbar({ onColorClick }: { onColorClick: () => void }) {
  const tool = useEditor((s) => s.tool);
  const setTool = useEditor((s) => s.setTool);
  const fg = useEditor((s) => s.foreground);
  const bg = useEditor((s) => s.background);
  const swap = useEditor((s) => s.swapColors);
  const setFg = useEditor((s) => s.setForeground);
  const setBg = useEditor((s) => s.setBackground);

  return (
    <div className="w-12 shrink-0 bg-panel border-r border-border flex flex-col items-center py-2 gap-0.5">
      {TOOLS.map((t, i) =>
        t === 'divider' ? (
          <div key={i} className="w-6 h-px bg-border my-1.5" />
        ) : (
          <button
            key={t.id}
            onClick={() => setTool(t.id)}
            title={`${t.label}${t.shortcut ? ` (${t.shortcut})` : ''}`}
            className={`w-9 h-9 grid place-items-center rounded transition-colors ${
              tool === t.id
                ? 'bg-accent text-bg'
                : 'text-fg-dim hover:bg-panel-2 hover:text-fg'
            }`}
          >
            {t.icon}
          </button>
        ),
      )}
      <div className="mt-auto flex flex-col items-center gap-2 pb-1">
        <div className="relative w-10 h-10">
          <button
            onClick={onColorClick}
            title="Foreground color — click to edit"
            className="absolute top-0 left-0 w-7 h-7 rounded-sm border-2 border-fg/70 shadow-lg"
            style={{ background: fg }}
          >
            <input
              type="color"
              value={fg}
              onChange={(e) => setFg(e.target.value)}
              className="opacity-0 absolute inset-0 w-full h-full cursor-pointer"
            />
          </button>
          <button
            title="Background color — click to edit"
            className="absolute bottom-0 right-0 w-7 h-7 rounded-sm border-2 border-fg/70"
            style={{ background: bg }}
          >
            <input
              type="color"
              value={bg}
              onChange={(e) => setBg(e.target.value)}
              className="opacity-0 absolute inset-0 w-full h-full cursor-pointer"
            />
          </button>
          <button
            title="Default Foreground/Background colors (D)"
            onClick={() => { setFg('#000000'); setBg('#ffffff'); }}
            className="absolute -bottom-1 -left-1 w-4 h-4 rounded-[3px] border border-fg-dim bg-black overflow-hidden"
          >
            <span className="block w-full h-1/2 bg-black" />
            <span className="block w-full h-1/2 bg-white" />
          </button>
        </div>
        <button onClick={swap} title="Swap Foreground/Background (X)" className="text-fg-dim hover:text-accent">
          <ArrowLeftRight size={12} />
        </button>
      </div>
    </div>
  );
}
