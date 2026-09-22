import { useState, useEffect, useCallback } from 'react';
import { TopBar } from './components/TopBar';
import { Toolbar } from './components/Toolbar';
import { OptionsBar } from './components/OptionsBar';
import { CanvasStage } from './components/CanvasStage';
import { LayersPanel } from './components/LayersPanel';
import { AdjustmentsPanel } from './components/AdjustmentsPanel';
import { HistoryPanel } from './components/HistoryPanel';
import { ColorPanel } from './components/ColorPanel';
import { StatusBar } from './components/StatusBar';
import { NewDocDialog } from './components/NewDocDialog';
import { FilterDialog } from './components/FilterDialog';
import { useEditor } from './store/editor';
import { hexToRgb, createLayerCanvas } from './lib/utils';
import type { FilterName } from './lib/filters';

export default function App() {
  const [showNewDoc, setShowNewDoc] = useState(false);
  const [filterDialog, setFilterDialog] = useState<FilterName | null>(null);
  const [showAbout, setShowAbout] = useState(true);

  const undo = useEditor((s) => s.undo);
  const redo = useEditor((s) => s.redo);
  const setTool = useEditor((s) => s.setTool);
  const swapColors = useEditor((s) => s.swapColors);
  const doc = useEditor((s) => s.doc);
  const setZoom = useEditor((s) => s.setZoom);
  const setPan = useEditor((s) => s.setPan);
  const zoom = useEditor((s) => s.zoom);
  const toggleRulers = useEditor((s) => s.toggleRulers);
  const toggleGrid = useEditor((s) => s.toggleGrid);
  const setSelection = useEditor((s) => s.setSelection);
  const selection = useEditor((s) => s.selection);
  const layers = useEditor((s) => s.layers);
  const activeId = useEditor((s) => s.activeLayerId);
  const updateLayer = useEditor((s) => s.updateLayer);
  const pushHistory = useEditor((s) => s.pushHistory);
  const bumpPaintTick = useEditor((s) => s.bumpPaintTick);
  const fg = useEditor((s) => s.foreground);
  const bg = useEditor((s) => s.background);
  const addLayer = useEditor((s) => s.addLayer);
  const duplicateLayer = useEditor((s) => s.duplicateLayer);
  const deleteLayer = useEditor((s) => s.deleteLayer);
  const mergeDown = useEditor((s) => s.mergeDown);
  const flattenAll = useEditor((s) => s.flattenAll);
  const bakeAdjustments = useEditor((s) => s.bakeAdjustments);

  const handleCommand = useCallback((cmd: string) => {
    const active = layers.find((l) => l.id === activeId);
    switch (cmd) {
      case 'file:new':
        setShowNewDoc(true);
        break;
      case 'file:reset':
        setShowNewDoc(true);
        break;
      case 'edit:cut': {
        if (!active || !selection) return;
        const c = document.createElement('canvas');
        c.width = selection.w;
        c.height = selection.h;
        c.getContext('2d')!.drawImage(active.canvas, -selection.x + active.x, -selection.y + active.y);
        (window as unknown as { __clip: HTMLCanvasElement }).__clip = c;
        const ctx = active.canvas.getContext('2d')!;
        ctx.save();
        ctx.beginPath();
        if (selection.shape === 'rect') ctx.rect(selection.x, selection.y, selection.w, selection.h);
        else ctx.ellipse(selection.x + selection.w / 2, selection.y + selection.h / 2, selection.w / 2, selection.h / 2, 0, 0, Math.PI * 2);
        ctx.clip();
        ctx.clearRect(0, 0, active.canvas.width, active.canvas.height);
        ctx.restore();
        bumpPaintTick();
        pushHistory('Cut');
        break;
      }
      case 'edit:copy': {
        if (!active || !selection) return;
        const c = document.createElement('canvas');
        c.width = selection.w;
        c.height = selection.h;
        c.getContext('2d')!.drawImage(active.canvas, -selection.x + active.x, -selection.y + active.y);
        (window as unknown as { __clip: HTMLCanvasElement }).__clip = c;
        break;
      }
      case 'edit:paste': {
        const clip = (window as unknown as { __clip?: HTMLCanvasElement }).__clip;
        if (!clip) return;
        const layer = addLayer({ name: 'Pasted' });
        const ctx = layer.canvas.getContext('2d')!;
        ctx.drawImage(clip, (layer.canvas.width - clip.width) / 2, (layer.canvas.height - clip.height) / 2);
        bumpPaintTick();
        pushHistory('Paste');
        break;
      }
      case 'edit:fill-selection': {
        if (!active) return;
        const ctx = active.canvas.getContext('2d')!;
        ctx.save();
        if (selection) {
          ctx.beginPath();
          if (selection.shape === 'rect') ctx.rect(selection.x - active.x, selection.y - active.y, selection.w, selection.h);
          else ctx.ellipse(selection.x + selection.w / 2 - active.x, selection.y + selection.h / 2 - active.y, selection.w / 2, selection.h / 2, 0, 0, Math.PI * 2);
          ctx.clip();
        }
        ctx.fillStyle = fg;
        ctx.fillRect(0, 0, active.canvas.width, active.canvas.height);
        ctx.restore();
        bumpPaintTick();
        pushHistory('Fill');
        break;
      }
      case 'edit:stroke-selection': {
        if (!active || !selection) return;
        const ctx = active.canvas.getContext('2d')!;
        ctx.save();
        ctx.strokeStyle = fg;
        ctx.lineWidth = 3;
        if (selection.shape === 'rect') ctx.strokeRect(selection.x - active.x, selection.y - active.y, selection.w, selection.h);
        else {
          ctx.beginPath();
          ctx.ellipse(selection.x + selection.w / 2 - active.x, selection.y + selection.h / 2 - active.y, selection.w / 2, selection.h / 2, 0, 0, Math.PI * 2);
          ctx.stroke();
        }
        ctx.restore();
        bumpPaintTick();
        pushHistory('Stroke');
        break;
      }
      case 'edit:clear-selection': {
        if (!active) return;
        const ctx = active.canvas.getContext('2d')!;
        if (!selection) {
          if (active.isBackground) {
            const [r, g, b] = hexToRgb(bg);
            ctx.fillStyle = `rgb(${r},${g},${b})`;
            ctx.fillRect(0, 0, active.canvas.width, active.canvas.height);
          } else {
            ctx.clearRect(0, 0, active.canvas.width, active.canvas.height);
          }
        } else {
          ctx.save();
          ctx.beginPath();
          if (selection.shape === 'rect') ctx.rect(selection.x - active.x, selection.y - active.y, selection.w, selection.h);
          else ctx.ellipse(selection.x + selection.w / 2 - active.x, selection.y + selection.h / 2 - active.y, selection.w / 2, selection.h / 2, 0, 0, Math.PI * 2);
          ctx.clip();
          ctx.clearRect(0, 0, active.canvas.width, active.canvas.height);
          ctx.restore();
        }
        bumpPaintTick();
        pushHistory('Clear');
        break;
      }
      case 'image:rotate-90-cw':
      case 'image:rotate-90-ccw':
      case 'image:rotate-180': {
        const angle = cmd === 'image:rotate-90-cw' ? 90 : cmd === 'image:rotate-90-ccw' ? -90 : 180;
        const state = useEditor.getState();
        const newW = angle === 180 ? state.doc.width : state.doc.height;
        const newH = angle === 180 ? state.doc.height : state.doc.width;
        const newLayers = state.layers.map((l) => {
          const c = createLayerCanvas(newW, newH);
          const ctx = c.getContext('2d')!;
          ctx.translate(newW / 2, newH / 2);
          ctx.rotate((angle * Math.PI) / 180);
          ctx.drawImage(l.canvas, -l.canvas.width / 2, -l.canvas.height / 2);
          return { ...l, canvas: c, x: 0, y: 0 };
        });
        useEditor.setState({
          doc: { ...state.doc, width: newW, height: newH },
          layers: newLayers,
        });
        pushHistory('Rotate ' + angle + '°');
        break;
      }
      case 'image:flip-horizontal':
      case 'image:flip-vertical': {
        if (!active) return;
        const horiz = cmd === 'image:flip-horizontal';
        const c = createLayerCanvas(active.canvas.width, active.canvas.height);
        const ctx = c.getContext('2d')!;
        ctx.translate(horiz ? c.width : 0, horiz ? 0 : c.height);
        ctx.scale(horiz ? -1 : 1, horiz ? 1 : -1);
        ctx.drawImage(active.canvas, 0, 0);
        updateLayer(active.id, { canvas: c });
        bumpPaintTick();
        pushHistory('Flip ' + (horiz ? 'Horizontal' : 'Vertical'));
        break;
      }
      case 'image:canvas-size': {
        const w = prompt('New width (px):', String(doc.width));
        const h = prompt('New height (px):', String(doc.height));
        if (w && h) {
          const nw = Math.max(1, Number(w));
          const nh = Math.max(1, Number(h));
          useEditor.getState().resizeDocument(nw, nh);
        }
        break;
      }
      case 'image:trim-transparent': {
        // Trim doc to bounding box of visible pixels across all layers
        const state = useEditor.getState();
        let minX = state.doc.width, minY = state.doc.height, maxX = 0, maxY = 0;
        let found = false;
        state.layers.forEach((l) => {
          if (!l.visible) return;
          try {
            const ctx = l.canvas.getContext('2d')!;
            const img = ctx.getImageData(0, 0, l.canvas.width, l.canvas.height);
            for (let y = 0; y < l.canvas.height; y++) {
              for (let x = 0; x < l.canvas.width; x++) {
                if (img.data[(y * l.canvas.width + x) * 4 + 3] > 5) {
                  found = true;
                  if (x + l.x < minX) minX = x + l.x;
                  if (y + l.y < minY) minY = y + l.y;
                  if (x + l.x > maxX) maxX = x + l.x;
                  if (y + l.y > maxY) maxY = y + l.y;
                }
              }
            }
          } catch { /* ignore */ }
        });
        if (!found) return;
        const w = maxX - minX + 1;
        const h = maxY - minY + 1;
        const newLayers = state.layers.map((l) => {
          const c = createLayerCanvas(w, h);
          c.getContext('2d')!.drawImage(l.canvas, -minX + l.x, -minY + l.y);
          return { ...l, canvas: c, x: 0, y: 0 };
        });
        useEditor.setState({ doc: { ...state.doc, width: w, height: h }, layers: newLayers });
        pushHistory('Trim');
        break;
      }
      case 'layer:new-layer':
        addLayer();
        break;
      case 'layer:duplicate-layer':
        active && duplicateLayer(active.id);
        break;
      case 'layer:delete-layer':
        active && deleteLayer(active.id);
        break;
      case 'layer:merge-down':
        active && mergeDown(active.id);
        break;
      case 'layer:flatten-image':
        flattenAll();
        break;
      case 'layer:apply-adjustments':
        active && bakeAdjustments(active.id);
        break;
      case 'select:all':
        setSelection({ x: 0, y: 0, w: doc.width, h: doc.height, shape: 'rect' });
        break;
      case 'select:deselect':
        setSelection(null);
        break;
      case 'select:inverse':
        // Not truly inverse (would need mask), so just toggle to full-canvas
        setSelection(selection ? null : { x: 0, y: 0, w: doc.width, h: doc.height, shape: 'rect' });
        break;
      case 'select:select-marquee':
        setTool('marquee-rect');
        break;
      case 'select:select-ellipse':
        setTool('marquee-ellipse');
        break;
      case 'view:zoom-in':
        setZoom(zoom * 1.25);
        break;
      case 'view:zoom-out':
        setZoom(zoom / 1.25);
        break;
      case 'view:actual-size':
        setZoom(1);
        break;
      case 'view:fit-on-screen': {
        const container = document.querySelector('[data-canvas-container]') as HTMLElement | null;
        const el = container ?? document.body;
        const availW = el.clientWidth - 80;
        const availH = el.clientHeight - 80;
        const z = Math.min(availW / doc.width, availH / doc.height, 1);
        setZoom(z);
        setPan({ x: (el.clientWidth - doc.width * z) / 2, y: (el.clientHeight - doc.height * z) / 2 });
        break;
      }
      case 'view:toggle-rulers':
        toggleRulers();
        break;
      case 'view:toggle-grid':
        toggleGrid();
        break;
      default:
        if (cmd.startsWith('filter:')) {
          const name = cmd.replace('filter:', '') as FilterName;
          setFilterDialog(name);
        }
    }
  }, [layers, activeId, selection, doc, fg, bg, zoom, addLayer, duplicateLayer, deleteLayer, mergeDown, flattenAll, bakeAdjustments, updateLayer, setSelection, setZoom, setPan, setTool, toggleRulers, toggleGrid, pushHistory, bumpPaintTick]);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) return;
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key === 'z' && !e.shiftKey) { e.preventDefault(); undo(); return; }
      if (mod && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) { e.preventDefault(); redo(); return; }
      if (mod && e.key === 'a') { e.preventDefault(); handleCommand('select:all'); return; }
      if (mod && e.key === 'd') { e.preventDefault(); handleCommand('select:deselect'); return; }
      if (mod && e.key === '+') { e.preventDefault(); setZoom(zoom * 1.25); return; }
      if (mod && e.key === '-') { e.preventDefault(); setZoom(zoom / 1.25); return; }
      if (mod && e.key === '0') { e.preventDefault(); handleCommand('view:fit-on-screen'); return; }
      if (mod) return;
      const map: Record<string, string> = {
        v: 'move', m: 'marquee-rect', l: 'lasso', w: 'wand', c: 'crop',
        i: 'eyedropper', b: 'brush', n: 'pencil', e: 'eraser', g: 'bucket',
        t: 'text', u: 'shape-rect', h: 'hand', z: 'zoom', r: 'blur',
      };
      if (map[e.key]) setTool(map[e.key] as never);
      if (e.key === 'x') swapColors();
      if (e.key === 'Backspace' || e.key === 'Delete') { e.preventDefault(); handleCommand('edit:clear-selection'); }
      if (e.key === '[') useEditor.getState().setBrush({ size: Math.max(1, useEditor.getState().brush.size - 2) });
      if (e.key === ']') useEditor.getState().setBrush({ size: Math.min(500, useEditor.getState().brush.size + 2) });
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [undo, redo, setTool, swapColors, setZoom, zoom, handleCommand]);

  return (
    <div className="h-screen w-screen flex flex-col overflow-hidden">
      <TopBar onCommand={handleCommand} />
      <OptionsBar />
      <div className="flex-1 flex overflow-hidden">
        <Toolbar onColorClick={() => { /* handled inline */ }} />
        <div className="flex-1 flex flex-col overflow-hidden" data-canvas-container>
          <CanvasStage />
        </div>
        <div className="w-72 shrink-0 bg-panel border-l border-border flex flex-col">
          <ColorPanel />
          <AdjustmentsPanel />
          <LayersPanel />
          <HistoryPanel />
        </div>
      </div>
      <StatusBar />
      {showNewDoc && <NewDocDialog onClose={() => setShowNewDoc(false)} />}
      {filterDialog && <FilterDialog filter={filterDialog} onClose={() => setFilterDialog(null)} />}
      {showAbout && <WelcomeOverlay onClose={() => setShowAbout(false)} onNew={() => { setShowAbout(false); setShowNewDoc(true); }} />}
    </div>
  );
}

function WelcomeOverlay({ onClose, onNew }: { onClose: () => void; onNew: () => void }) {
  return (
    <div className="fixed inset-0 z-40 grid place-items-center bg-black/70 backdrop-blur-sm">
      <div className="w-[640px] bg-panel border border-border-strong rounded-lg shadow-2xl overflow-hidden">
        <div className="p-8 border-b border-border">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-md bg-gradient-to-br from-accent to-accent-2 grid place-items-center font-serif font-bold text-bg text-xl">P</div>
            <div>
              <h1 className="font-serif text-3xl leading-none tracking-tight">Pigment</h1>
              <p className="text-fg-dim text-xs font-mono mt-1">A Photoshop-style raster editor for the web</p>
            </div>
          </div>
          <p className="text-fg-dim text-sm leading-relaxed max-w-lg">
            All your work stays in this browser tab — nothing is uploaded. Layers, adjustments, filters,
            brushes, selections, transforms and export are all fully local.
          </p>
        </div>
        <div className="grid grid-cols-3 gap-4 p-6 text-xs font-mono text-fg-dim">
          <div><span className="text-accent">V</span> Move</div>
          <div><span className="text-accent">M</span> Marquee</div>
          <div><span className="text-accent">L</span> Lasso</div>
          <div><span className="text-accent">B</span> Brush</div>
          <div><span className="text-accent">E</span> Eraser</div>
          <div><span className="text-accent">G</span> Bucket</div>
          <div><span className="text-accent">T</span> Text</div>
          <div><span className="text-accent">U</span> Shape</div>
          <div><span className="text-accent">I</span> Eyedropper</div>
          <div><span className="text-accent">Z</span> Zoom</div>
          <div><span className="text-accent">⌘Z</span> Undo</div>
          <div><span className="text-accent">⌘⇧Z</span> Redo</div>
        </div>
        <div className="px-6 pb-6 flex gap-2 justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-mono text-fg-dim hover:text-fg"
          >
            Open blank canvas
          </button>
          <button
            onClick={onNew}
            className="px-5 py-2 text-xs font-mono bg-accent text-bg rounded hover:bg-accent-2 hover:text-fg transition-colors"
          >
            New Document →
          </button>
        </div>
      </div>
    </div>
  );
}
