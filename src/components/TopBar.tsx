import { useState, useRef } from 'react';
import { useEditor } from '../store/editor';
import { downloadCanvas, createLayerCanvas } from '../lib/utils';
import { Undo2, Redo2, Menu } from 'lucide-react';

const MENUS: { name: string; items: (string | '---')[] }[] = [
  { name: 'File', items: ['New…', 'Open…', 'Place Image…', '---', 'Export as PNG', 'Export as JPG', '---', 'Reset Workspace'] },
  { name: 'Edit', items: ['Undo', 'Redo', '---', 'Cut', 'Copy', 'Paste', '---', 'Fill Selection', 'Stroke Selection', 'Clear Selection'] },
  { name: 'Image', items: ['Canvas Size…', '---', 'Rotate 90° CW', 'Rotate 90° CCW', 'Rotate 180°', 'Flip Horizontal', 'Flip Vertical', '---', 'Trim Transparent'] },
  { name: 'Layer', items: ['New Layer', 'Duplicate Layer', 'Delete Layer', '---', 'Merge Down', 'Flatten Image', '---', 'Apply Adjustments'] },
  { name: 'Select', items: ['All', 'Deselect', 'Inverse', '---', 'Select Marquee', 'Select Ellipse'] },
  { name: 'Filter', items: ['Gaussian Blur', 'Sharpen', 'Edge Detect', 'Emboss', 'Noise', 'Pixelate', 'Posterize', 'Threshold', 'Invert', 'Vignette'] },
  { name: 'View', items: ['Zoom In', 'Zoom Out', 'Fit on Screen', 'Actual Size', '---', 'Toggle Rulers', 'Toggle Grid'] },
];

export function TopBar({ onCommand }: { onCommand: (cmd: string) => void }) {
  const [open, setOpen] = useState<string | null>(null);
  const [closingTab, setClosingTab] = useState<string | null>(null);
  const undo = useEditor((s) => s.undo);
  const redo = useEditor((s) => s.redo);
  const historyIndex = useEditor((s) => s.historyIndex);
  const history = useEditor((s) => s.history);
  const zoom = useEditor((s) => s.zoom);
  const setZoom = useEditor((s) => s.setZoom);
  const layers = useEditor((s) => s.layers);
  const doc = useEditor((s) => s.doc);
  const documents = useEditor((s) => s.documents);
  const activeDocumentId = useEditor((s) => s.activeDocumentId);
  const switchDocument = useEditor((s) => s.switchDocument);
  const closeDocument = useEditor((s) => s.closeDocument);
  const renameDocument = useEditor((s) => s.renameDocument);
  const fileRef = useRef<HTMLInputElement>(null);
  const addLayer = useEditor((s) => s.addLayer);
  const createDocumentFromImage = useEditor((s) => s.createDocumentFromImage);

  const canUndo = historyIndex > 0;
  const canRedo = historyIndex < history.length - 1;

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const name = file.name.replace(/\.[^.]+$/, '');
      createDocumentFromImage(name, img);
      URL.revokeObjectURL(url);
    };
    img.onerror = () => URL.revokeObjectURL(url);
    img.src = url;
    e.target.value = '';
  };

  const exportImage = (type: 'png' | 'jpg') => {
    const c = createLayerCanvas(doc.width, doc.height);
    const ctx = c.getContext('2d')!;
    if (type === 'jpg') {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, doc.width, doc.height);
    }
    layers.forEach((l) => {
      if (!l.visible) return;
      ctx.save();
      ctx.globalAlpha = l.opacity / 100;
      ctx.globalCompositeOperation = l.blendMode;
      const a = l.adjustments;
      ctx.filter = [
        `brightness(${a.brightness}%)`,
        `contrast(${a.contrast}%)`,
        `saturate(${a.saturate}%)`,
        `hue-rotate(${a.hueRotate}deg)`,
        a.blur > 0 ? `blur(${a.blur}px)` : '',
        a.invert > 0 ? `invert(${a.invert}%)` : '',
        a.sepia > 0 ? `sepia(${a.sepia}%)` : '',
        a.grayscale > 0 ? `grayscale(${a.grayscale}%)` : '',
      ]
        .filter(Boolean)
        .join(' ');
      ctx.drawImage(l.canvas, l.x, l.y);
      ctx.restore();
    });
    downloadCanvas(c, `pigment.${type === 'jpg' ? 'jpg' : 'png'}`, type === 'jpg' ? 'image/jpeg' : 'image/png');
  };

  const handleItem = (menu: string, item: string) => {
    setOpen(null);
    if (menu === 'File') {
      if (item === 'New…') onCommand('file:new');
      else if (item === 'Open…' || item === 'Place Image…') fileRef.current?.click();
      else if (item === 'Export as PNG') exportImage('png');
      else if (item === 'Export as JPG') exportImage('jpg');
      else if (item === 'Reset Workspace') onCommand('file:reset');
    } else if (menu === 'Edit') {
      if (item === 'Undo') undo();
      else if (item === 'Redo') redo();
      else onCommand('edit:' + item.toLowerCase().replace(/\s+/g, '-'));
    } else if (menu === 'Image') {
      onCommand('image:' + item.toLowerCase().replace(/[°…]/g, '').trim().replace(/\s+/g, '-'));
    } else if (menu === 'Layer') {
      onCommand('layer:' + item.toLowerCase().replace(/…/g, '').trim().replace(/\s+/g, '-'));
    } else if (menu === 'Select') {
      onCommand('select:' + item.toLowerCase().replace(/\s+/g, '-'));
    } else if (menu === 'Filter') {
      onCommand('filter:' + item.toLowerCase().replace(/\s+/g, '-'));
    } else if (menu === 'View') {
      onCommand('view:' + item.toLowerCase().replace(/\s+/g, '-'));
    }
  };

  return (
    <div className="shrink-0 select-none">
      <div className="h-10 border-b border-border bg-panel flex items-center px-2 gap-2 overflow-x-auto no-scrollbar">
        <div className="flex items-center gap-2 min-w-0">
          {documents.map((docSession) => (
            <div
              key={docSession.id}
              className={`group relative flex items-center h-7 rounded-t-md border border-b-0 px-2 text-[11px] font-mono ${docSession.id === activeDocumentId ? 'bg-panel-2 text-fg border-accent/40' : 'bg-panel text-fg-dim border-border hover:text-fg'}`}
            >
              <button onClick={() => switchDocument(docSession.id)} className="max-w-[140px] truncate pr-2 flex items-center gap-1">
                <span
                  onDoubleClick={(e) => {
                    e.preventDefault();
                    const nextName = window.prompt('Rename document:', docSession.name);
                    if (nextName && nextName.trim()) renameDocument(docSession.id, nextName);
                  }}
                >
                  {docSession.name}
                </span>
                {docSession.unsaved && <span className="text-[9px] text-accent">•</span>}
              </button>
              {documents.length > 1 && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setClosingTab(docSession.id);
                  }}
                  className="opacity-0 group-hover:opacity-100 transition-opacity text-fg-dim hover:text-fg"
                  title="Close tab"
                >
                  ×
                </button>
              )}
            </div>
          ))}
          <button
            onClick={() => fileRef.current?.click()}
            className="px-2 h-7 rounded-md border border-border text-[11px] text-fg-dim hover:text-fg hover:bg-panel-2"
          >
            Open
          </button>
          <button
            onClick={() => onCommand('file:new')}
            className="w-7 h-7 rounded-md border border-border text-lg leading-none text-fg-dim hover:text-fg hover:bg-panel-2"
            title="New document"
          >
            +
          </button>
        </div>
      </div>

      {closingTab && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/60" onClick={() => setClosingTab(null)}>
          <div className="w-[360px] bg-panel border border-border-strong rounded-lg p-5" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-serif text-lg mb-3">Close document?</h3>
            <p className="text-sm text-fg-dim mb-5">Do you want to close this document tab?</p>
            <div className="flex justify-end gap-2">
              <button onClick={() => setClosingTab(null)} className="px-3 py-2 text-[11px] font-mono text-fg-dim hover:text-fg">Cancel</button>
              <button
                onClick={() => {
                  closeDocument(closingTab);
                  setClosingTab(null);
                }}
                className="px-3 py-2 text-[11px] font-mono bg-accent text-bg rounded hover:bg-accent-2 hover:text-fg"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="h-11 bg-panel border-b border-border flex items-stretch">
        <input ref={fileRef} type="file" accept="image/*" hidden onChange={handleImport} />
        <div className="flex items-center gap-2 px-4 border-r border-border">
          <div className="w-6 h-6 rounded bg-gradient-to-br from-accent to-accent-2 grid place-items-center text-bg font-serif font-bold">P</div>
          <span className="font-serif text-[15px] tracking-tight text-fg">Pigment</span>
        </div>
        <div className="flex items-stretch">
          {MENUS.map((m) => (
            <div key={m.name} className="relative">
              <button
                onClick={() => setOpen(open === m.name ? null : m.name)}
                onMouseEnter={() => open && setOpen(m.name)}
                className={`h-full px-3 text-[12px] tracking-wide hover:bg-panel-2 ${open === m.name ? 'bg-panel-2 text-accent' : 'text-fg-dim'}`}
              >
                {m.name}
              </button>
              {open === m.name && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setOpen(null)} />
                  <div className="absolute left-0 top-full min-w-[200px] bg-panel-2 border border-border-strong shadow-2xl z-50 py-1">
                    {m.items.map((it, i) =>
                      it === '---' ? (
                        <div key={i} className="h-px bg-border my-1" />
                      ) : (
                        <button
                          key={i}
                          onClick={() => handleItem(m.name, it)}
                          disabled={(m.name === 'Edit' && it === 'Undo' && !canUndo) || (m.name === 'Edit' && it === 'Redo' && !canRedo)}
                          className="w-full text-left px-3 py-1.5 text-[12px] text-fg hover:bg-accent hover:text-bg font-mono"
                        >
                          {it}
                        </button>
                      ),
                    )}
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
        <div className="flex-1" />
        <div className="flex items-center gap-2 px-3 border-l border-border">
          <button onClick={undo} disabled={!canUndo} title="Undo (⌘Z)" className="p-1.5 rounded hover:bg-panel-2 text-fg-dim disabled:opacity-30">
            <Undo2 size={14} />
          </button>
          <button onClick={redo} disabled={!canRedo} title="Redo (⌘⇧Z)" className="p-1.5 rounded hover:bg-panel-2 text-fg-dim disabled:opacity-30">
            <Redo2 size={14} />
          </button>
          <div className="w-px h-4 bg-border mx-1" />
          <button onClick={() => setZoom(zoom / 1.25)} className="px-2 py-0.5 text-[11px] text-fg-dim hover:text-fg font-mono">−</button>
          <span className="text-[11px] font-mono text-fg w-14 text-center">{Math.round(zoom * 100)}%</span>
          <button onClick={() => setZoom(zoom * 1.25)} className="px-2 py-0.5 text-[11px] text-fg-dim hover:text-fg font-mono">+</button>
          <div className="w-px h-4 bg-border mx-1" />
          <button className="p-1.5 rounded hover:bg-panel-2 text-fg-dim">
            <Menu size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}
