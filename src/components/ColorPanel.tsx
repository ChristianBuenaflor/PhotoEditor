import { useEditor } from '../store/editor';
import { PanelHeader } from './PanelHeader';

const SWATCHES = [
  '#000000', '#ffffff', '#e8873b', '#c94f1d', '#dc2626', '#f59e0b',
  '#eab308', '#84cc16', '#10b981', '#06b6d4', '#3b82f6', '#8b5cf6',
  '#ec4899', '#78716c', '#44403c', '#292524',
];

export function ColorPanel() {
  const fg = useEditor((s) => s.foreground);
  const setFg = useEditor((s) => s.setForeground);

  return (
    <div className="border-b border-border">
      <PanelHeader title="Color / Swatches" />
      <div className="px-3 py-2 space-y-2">
        <div className="flex items-center gap-2">
          <div
            className="w-10 h-10 rounded border-2 border-border-strong"
            style={{ background: fg }}
          />
          <div className="flex-1 space-y-1">
            <input
              type="text"
              value={fg}
              onChange={(e) => setFg(e.target.value)}
              className="w-full"
            />
            <input
              type="color"
              value={fg}
              onChange={(e) => setFg(e.target.value)}
              className="w-full h-6 rounded cursor-pointer bg-transparent border border-border"
            />
          </div>
        </div>
        <div className="grid grid-cols-8 gap-1">
          {SWATCHES.map((c) => (
            <button
              key={c}
              onClick={() => setFg(c)}
              title={c}
              className={`aspect-square rounded-sm border ${
                fg === c ? 'border-accent ring-1 ring-accent' : 'border-border'
              }`}
              style={{ background: c }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
