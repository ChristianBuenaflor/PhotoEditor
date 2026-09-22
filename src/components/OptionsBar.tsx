import { useEditor } from '../store/editor';

const BLEND_MODES = [
  'source-over', 'multiply', 'screen', 'overlay',
  'darken', 'lighten', 'color-dodge', 'color-burn',
  'hard-light', 'soft-light', 'difference', 'exclusion',
  'hue', 'saturation', 'color', 'luminosity',
];

const TOOL_LABELS: Record<string, string> = {
  'move': 'Move',
  'marquee-rect': 'Rectangular Marquee',
  'marquee-ellipse': 'Elliptical Marquee',
  'lasso': 'Lasso',
  'wand': 'Magic Wand',
  'crop': 'Crop',
  'eyedropper': 'Eyedropper',
  'brush': 'Brush',
  'pencil': 'Pencil',
  'eraser': 'Eraser',
  'bucket': 'Paint Bucket',
  'text': 'Text',
  'shape-rect': 'Rectangle',
  'shape-ellipse': 'Ellipse',
  'shape-line': 'Line',
  'blur': 'Blur',
  'dodge': 'Dodge',
  'burn': 'Burn',
  'hand': 'Hand',
  'zoom': 'Zoom',
};

export function OptionsBar() {
  const tool = useEditor((s) => s.tool);
  const brush = useEditor((s) => s.brush);
  const setBrush = useEditor((s) => s.setBrush);

  const isPaint = ['brush', 'pencil', 'eraser', 'blur', 'dodge', 'burn'].includes(tool);
  const isShape = ['shape-rect', 'shape-ellipse', 'shape-line'].includes(tool);

  return (
    <div className="h-9 shrink-0 bg-panel-2 border-b border-border flex items-center gap-4 px-4 text-[11px] font-mono text-fg-dim">
      <div className="flex items-center gap-2">
        <div className="w-6 h-6 rounded bg-panel grid place-items-center text-accent">•</div>
        <span className="text-fg">{TOOL_LABELS[tool] ?? tool}</span>
      </div>
      <div className="w-px h-4 bg-border" />
      {isPaint && (
        <>
          <label className="flex items-center gap-2">
            <span>Size</span>
            <input
              type="number"
              min={1}
              max={500}
              value={brush.size}
              onChange={(e) => setBrush({ size: Number(e.target.value) })}
            />
            <span>px</span>
          </label>
          <label className="flex items-center gap-2">
            <span>Hardness</span>
            <input
              type="number"
              min={0}
              max={100}
              value={brush.hardness}
              onChange={(e) => setBrush({ hardness: Number(e.target.value) })}
            />
            <span>%</span>
          </label>
          <label className="flex items-center gap-2">
            <span>Opacity</span>
            <input
              type="number"
              min={0}
              max={100}
              value={brush.opacity}
              onChange={(e) => setBrush({ opacity: Number(e.target.value) })}
            />
            <span>%</span>
          </label>
          <label className="flex items-center gap-2">
            <span>Flow</span>
            <input
              type="number"
              min={0}
              max={100}
              value={brush.flow}
              onChange={(e) => setBrush({ flow: Number(e.target.value) })}
            />
            <span>%</span>
          </label>
          <label className="flex items-center gap-2">
            <span>Blend</span>
            <select className="w-32">
              {BLEND_MODES.map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </label>
        </>
      )}
      {isShape && (
        <>
          <label className="flex items-center gap-2">
            <span>Stroke</span>
            <input
              type="number"
              min={0}
              max={100}
              defaultValue={2}
            />
            <span>px</span>
          </label>
          <label className="flex items-center gap-2">
            <span>Fill</span>
            <input type="checkbox" defaultChecked className="accent-accent" />
          </label>
        </>
      )}
      {tool === 'text' && (
        <>
          <span>Click anywhere on canvas, type your text, press Enter to commit.</span>
        </>
      )}
      {tool.startsWith('marquee') && (
        <span>Drag to select. Hold Shift for square/circle. ⌘A selects all, ⌘D deselects.</span>
      )}
      {tool === 'bucket' && (
        <span>Click to fill. Uses foreground color with 32px tolerance.</span>
      )}
      <div className="flex-1" />
    </div>
  );
}
