import { useEditor } from '../store/editor';

export function StatusBar() {
  const doc = useEditor((s) => s.doc);
  const layers = useEditor((s) => s.layers);
  const zoom = useEditor((s) => s.zoom);
  const selection = useEditor((s) => s.selection);

  return (
    <div className="h-6 shrink-0 bg-panel-2 border-t border-border flex items-center px-3 gap-4 text-[10px] font-mono text-fg-mute">
      <span>
        <span className="text-fg-dim">Doc:</span> {doc.width}×{doc.height}
      </span>
      <span>
        <span className="text-fg-dim">Zoom:</span> {Math.round(zoom * 100)}%
      </span>
      <span>
        <span className="text-fg-dim">Layers:</span> {layers.length}
      </span>
      {selection && (
        <span className="text-accent">
          Sel: {Math.round(selection.w)}×{Math.round(selection.h)}
        </span>
      )}
      <div className="flex-1" />
      <span className="text-fg-mute">Pigment 1.0 · Local-only, no data leaves your browser</span>
    </div>
  );
}
