import { useState, useEffect, useCallback, useRef } from 'react';
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
import { hexToRgb, createLayerCanvas, downloadCanvas } from './lib/utils';
import type { FilterName } from './lib/filters';

export default function App() {
  const [showNewDoc, setShowNewDoc] = useState(false);
  const [filterDialog, setFilterDialog] = useState<FilterName | null>(null);
  const [showCanvasSize, setShowCanvasSize] = useState(false);
  const [showSaveAs, setShowSaveAs] = useState(false);
  const [showAbout, setShowAbout] = useState(true);
  const [isDraggingFile, setIsDraggingFile] = useState(false);

  const undo = useEditor((s) => s.undo);
  const redo = useEditor((s) => s.redo);
  const setTool = useEditor((s) => s.setTool);
  const swapColors = useEditor((s) => s.swapColors);
  const doc = useEditor((s) => s.doc);
  const activeDocumentId = useEditor((s) => s.activeDocumentId);
  const setZoom = useEditor((s) => s.setZoom);
  const setPan = useEditor((s) => s.setPan);
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

  const exportDocument = useCallback((type: 'png' | 'jpg' | 'webp', filename?: string, quality = 92, transparency = true, location?: string, saveAsCopy = false) => {
    const c = createLayerCanvas(doc.width, doc.height);
    const ctx = c.getContext('2d')!;

    if (type === 'jpg' || (!transparency && type !== 'png')) {
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
      ].filter(Boolean).join(' ');
      ctx.drawImage(l.canvas, l.x, l.y);
      ctx.restore();
    });

    const mime = type === 'jpg' ? 'image/jpeg' : type === 'webp' ? 'image/webp' : 'image/png';
    const ext = type === 'jpg' ? 'jpg' : type === 'webp' ? 'webp' : 'png';
    const safeName = (filename || 'pigment').trim() || 'pigment';
    const baseName = safeName.toLowerCase().endsWith(`.${ext}`) ? safeName.slice(0, -ext.length - 1) : safeName;
    const finalName = `${baseName}${saveAsCopy ? '-copy' : ''}.${ext}`;
    const exportQuality = type === 'jpg' || type === 'webp' ? Math.min(1, Math.max(0.1, quality / 100)) : undefined;

    if (location && location.trim()) {
      console.info(`Save location: ${location.trim()} / ${finalName}`);
    }

    downloadCanvas(c, finalName, mime, exportQuality);
  }, [doc.width, doc.height, layers]);

  const importImageFile = useCallback((file: File) => {
    if (!file.type.startsWith('image/')) return;
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      addLayer({ name: file.name.replace(/\.[^.]+$/, ''), fromImage: img });
      URL.revokeObjectURL(url);
    };
    img.onerror = () => URL.revokeObjectURL(url);
    img.src = url;
  }, [addLayer]);

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
        setShowCanvasSize(true);
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
      case 'view:zoom-out':
      case 'view:actual-size': {
        // Photoshop-style: keyboard/menu zoom keeps the viewport center stable.
        const el = (document.querySelector('[data-canvas-container] > div') ??
          document.querySelector('[data-canvas-container]')) as HTMLElement | null;
        const s = useEditor.getState();
        const targetZoom =
          cmd === 'view:zoom-in' ? s.zoom * 1.25 : cmd === 'view:zoom-out' ? s.zoom / 1.25 : 1;
        if (!el) {
          setZoom(targetZoom);
          break;
        }
        const cx = el.clientWidth / 2;
        const cy = el.clientHeight / 2;
        const dx = (cx - s.pan.x) / s.zoom;
        const dy = (cy - s.pan.y) / s.zoom;
        const newZoom = Math.max(0.05, Math.min(16, targetZoom));
        setZoom(newZoom);
        setPan({ x: cx - dx * newZoom, y: cy - dy * newZoom });
        break;
      }
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
  }, [layers, activeId, selection, doc, fg, bg, addLayer, duplicateLayer, deleteLayer, mergeDown, flattenAll, bakeAdjustments, updateLayer, setSelection, setZoom, setPan, setTool, toggleRulers, toggleGrid, pushHistory, bumpPaintTick]);

  // Keyboard shortcuts — Photoshop CS6 style tool keys + Ctrl/Cmd combos
  useEffect(() => {
    const zoomCentered = (factor: number) => {
      const el = (document.querySelector('[data-canvas-container] > div') ??
        document.querySelector('[data-canvas-container]')) as HTMLElement | null;
      const s = useEditor.getState();
      if (!el) {
        s.setZoom(s.zoom * factor);
        return;
      }
      const cx = el.clientWidth / 2;
      const cy = el.clientHeight / 2;
      const dx = (cx - s.pan.x) / s.zoom;
      const dy = (cy - s.pan.y) / s.zoom;
      const newZoom = Math.max(0.05, Math.min(16, s.zoom * factor));
      s.setZoom(newZoom);
      s.setPan({ x: cx - dx * newZoom, y: cy - dy * newZoom });
    };
    const cycleTool = (current: string, group: string[]) => {
      const s = useEditor.getState();
      if (!group.includes(s.tool)) return group[0];
      const idx = group.indexOf(s.tool as never);
      return group[(idx + 1) % group.length];
    };
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
        if (e.key === 'Escape') (target as HTMLInputElement).blur();
        return;
      }
      const mod = e.metaKey || e.ctrlKey;
      const k = e.key.toLowerCase();
      // --- Ctrl/Cmd combos (Photoshop parity) ---
      if (mod) {
        if (k === 'z' && !e.shiftKey) { e.preventDefault(); undo(); return; }
        if (k === 'y' || (k === 'z' && e.shiftKey)) { e.preventDefault(); redo(); return; }
        if (k === 'n') { e.preventDefault(); handleCommand('file:new'); return; }
        if (k === 'o') {
          e.preventDefault();
          (document.querySelector('input[type="file"][accept="image/*"]') as HTMLInputElement | null)?.click();
          return;
        }
        if (k === 's' && !e.shiftKey) { e.preventDefault(); setShowSaveAs(true); return; }
        if (k === 's' && e.shiftKey) { e.preventDefault(); setShowSaveAs(true); return; }
        if (k === 'a') { e.preventDefault(); handleCommand('select:all'); return; }
        if (k === 'd') { e.preventDefault(); handleCommand('select:deselect'); return; }
        if (k === 'i' && e.shiftKey) { e.preventDefault(); handleCommand('select:inverse'); return; }
        if (k === 'c' && !e.shiftKey) { e.preventDefault(); handleCommand('edit:copy'); return; }
        if (k === 'x' && !e.shiftKey) { e.preventDefault(); handleCommand('edit:cut'); return; }
        if (k === 'v' && !e.shiftKey) { e.preventDefault(); handleCommand('edit:paste'); return; }
        if (k === 't') { e.preventDefault(); setTool('move'); return; }
        if (k === 'e' && e.shiftKey) { e.preventDefault(); handleCommand('layer:flatten-image'); return; }
        if (k === 'e' && !e.shiftKey) { e.preventDefault(); handleCommand('layer:merge-down'); return; }
        if (k === 'j') {
          e.preventDefault();
          const st = useEditor.getState();
          const active = st.layers.find((l) => l.id === st.activeLayerId);
          if (active) st.duplicateLayer(active.id);
          return;
        }
        const isPlus = e.key === '+' || e.key === '=' || e.code === 'NumpadAdd' || e.code === 'Equal';
        const isMinus = e.key === '-' || e.key === '_' || e.code === 'NumpadSubtract' || e.code === 'Minus';
        const isZero = e.key === '0' || e.code === 'Numpad0' || e.code === 'Digit0';
        const isOne = e.key === '1' || e.code === 'Numpad1' || e.code === 'Digit1';
        if (isPlus || isMinus || isZero || isOne) {
          // Block the browser's own zoom (Ctrl+=/-/0) and apply canvas zoom instead.
          e.preventDefault();
          if (isPlus) { zoomCentered(1.25); }
          else if (isMinus) { zoomCentered(1 / 1.25); }
          else if (isZero) { handleCommand('view:fit-on-screen'); }
          else { handleCommand('view:actual-size'); }
          return;
        }
        return;
      }
      // --- Single-key tools (Photoshop letters, Shift cycles groups) ---
      const st = useEditor.getState();
      switch (k) {
        case 'v': setTool('move'); return;
        case 'm': setTool(cycleTool(st.tool, ['marquee-rect', 'marquee-ellipse']) as never); return;
        case 'l': setTool('lasso'); return;
        case 'w': setTool('wand'); return;
        case 'c': setTool('crop'); return;
        case 'i': setTool('eyedropper'); return;
        case 'b': setTool(cycleTool(st.tool, ['brush', 'pencil']) as never); return;
        case 'e': setTool('eraser'); return;
        case 'g': setTool(cycleTool(st.tool, ['bucket', 'gradient']) as never); return;
        case 'r': setTool(cycleTool(st.tool, ['blur', 'sharpen', 'smudge']) as never); return;
        case 'o': setTool(cycleTool(st.tool, ['dodge', 'burn']) as never); return;
        case 't': setTool('text'); return;
        case 'u': setTool(cycleTool(st.tool, ['shape-rect', 'shape-ellipse', 'shape-line']) as never); return;
        case 'h': setTool('hand'); return;
        case 'z': setTool('zoom'); return;
        case 'd':
          st.setForeground('#000000');
          st.setBackground('#ffffff');
          return;
        case 'x': swapColors(); return;
      }
      if (e.key === 'Backspace' || e.key === 'Delete') { e.preventDefault(); handleCommand('edit:clear-selection'); return; }
      if (e.key === 'Escape') { handleCommand('select:deselect'); return; }
      if (e.key === '[') {
        if (e.shiftKey) st.setBrush({ hardness: Math.max(0, st.brush.hardness - 10) });
        else st.setBrush({ size: Math.max(1, st.brush.size - 2) });
        return;
      }
      if (e.key === ']') {
        if (e.shiftKey) st.setBrush({ hardness: Math.min(100, st.brush.hardness + 10) });
        else st.setBrush({ size: Math.min(500, st.brush.size + 2) });
        return;
      }
      // Space = temporary hand pan handled by CanvasStage via tool switch is out of scope;
      // H remains the persistent Hand tool.
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [undo, redo, setTool, swapColors, handleCommand]);

  useEffect(() => {
    // Fallback guard: block the browser's own page zoom when Ctrl/Cmd+wheel
    // happens outside the canvas (over panels, menus, etc.). Zoom inside the
    // canvas is handled by CanvasStage's non-passive listener, which calls
    // stopPropagation so this handler won't double-fire there.
    const onWindowWheel = (e: WheelEvent) => {
      if (!(e.ctrlKey || e.metaKey)) return;
      e.preventDefault();
    };
    // Safari trackpad pinch fires gesture events that also zoom the page.
    const onGesture = (e: Event) => e.preventDefault();

    window.addEventListener('wheel', onWindowWheel, { passive: false });
    window.addEventListener('gesturestart', onGesture);
    window.addEventListener('gesturechange', onGesture);
    return () => {
      window.removeEventListener('wheel', onWindowWheel);
      window.removeEventListener('gesturestart', onGesture);
      window.removeEventListener('gesturechange', onGesture);
    };
  }, []);

  const handleDropFiles = useCallback((files: FileList | null) => {
    const file = files?.[0];
    if (!file) return;
    importImageFile(file);
  }, [importImageFile]);

  return (
    <div
      className={`h-screen w-screen flex flex-col overflow-hidden ${isDraggingFile ? 'ring-2 ring-accent ring-inset' : ''}`}
      onDragOver={(e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'copy';
        setIsDraggingFile(true);
      }}
      onDragLeave={(e) => {
        const related = e.relatedTarget as Node | null;
        if (!related || !e.currentTarget.contains(related)) {
          setIsDraggingFile(false);
        }
      }}
      onDrop={(e) => {
        e.preventDefault();
        setIsDraggingFile(false);
        handleDropFiles(e.dataTransfer.files);
      }}
    >
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
      {showCanvasSize && <CanvasSizeDialog onClose={() => setShowCanvasSize(false)} />}
      {showSaveAs && (
        <SaveAsDialog
          key={activeDocumentId ?? 'new-doc'}
          onClose={() => setShowSaveAs(false)}
          onExport={(format, filename, quality, transparency, location, saveAsCopy) => {
            exportDocument(format, filename, quality, transparency, location, saveAsCopy);
            setShowSaveAs(false);
          }}
        />
      )}
      {showAbout && <WelcomeOverlay onClose={() => setShowAbout(false)} onNew={() => { setShowAbout(false); setShowNewDoc(true); }} />}
    </div>
  );
}

function getDefaultExportName(name?: string) {
  const safeName = (name ?? 'pigment').trim() || 'pigment';
  return safeName.replace(/\.[^.]+$/, '');
}

function SaveAsDialog({ onClose, onExport }: { onClose: () => void; onExport: (format: 'png' | 'jpg' | 'webp', filename: string, quality: number, transparency: boolean, location: string, saveAsCopy: boolean) => void }) {
  const activeDocument = useEditor((s) => s.documents.find((d) => d.id === s.activeDocumentId));
  const [format, setFormat] = useState<'png' | 'jpg' | 'webp'>('png');
  const [fileName, setFileName] = useState(() => getDefaultExportName(activeDocument?.name));
  const [quality, setQuality] = useState(92);
  const [transparent, setTransparent] = useState(true);
  const [saveLocation, setSaveLocation] = useState('exports');
  const [saveAsCopy, setSaveAsCopy] = useState(false);
  const locationInputRef = useRef<HTMLInputElement | null>(null);

  const onSave = () => {
    onExport(
      format,
      fileName.trim() || 'pigment',
      quality,
      transparent && format !== 'jpg',
      saveLocation.trim() || 'exports',
      saveAsCopy,
    );
  };

  const chooseLocation = async () => {
    if ('showDirectoryPicker' in window) {
      try {
        const dir = await (window as typeof window & { showDirectoryPicker?: () => Promise<{ name: string }> }).showDirectoryPicker?.();
        if (dir?.name) setSaveLocation(dir.name);
        return;
      } catch {
        // ignore browser rejection and fall back to text entry
      }
    }
    locationInputRef.current?.focus();
    locationInputRef.current?.select();
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div
        className="w-[500px] bg-panel border border-border-strong rounded-xl shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-6 py-5 border-b border-border">
          <h2 className="font-serif text-[20px] leading-none">Save As</h2>
        </div>
        <div className="p-6 space-y-5">
          <label className="block space-y-2">
            <span className="text-[10px] uppercase tracking-wider text-fg-dim font-mono">File name</span>
            <input
              autoFocus
              value={fileName}
              onChange={(e) => setFileName(e.target.value)}
              className="w-full h-11 rounded-md border border-border bg-transparent px-3 text-base outline-none focus:border-accent"
            />
          </label>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-[10px] uppercase tracking-wider text-fg-dim font-mono">Format</p>
              <span className="text-[11px] font-mono text-fg-dim">{`.${format}`}</span>
            </div>
            <select
              value={format}
              onChange={(e) => {
                const next = e.target.value as 'png' | 'jpg' | 'webp';
                setFormat(next);
                if (next === 'jpg') setTransparent(false);
              }}
              className="w-full h-11 rounded-md border border-border bg-transparent px-3 text-base outline-none focus:border-accent"
            >
              <option value="png">PNG</option>
              <option value="jpg">JPG</option>
              <option value="webp">WEBP</option>
            </select>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between text-[10px] uppercase tracking-wider text-fg-dim font-mono">
              <span>Quality</span>
              <span>{quality}%</span>
            </div>
            <input
              type="range"
              min={10}
              max={100}
              value={quality}
              onChange={(e) => setQuality(Number(e.target.value))}
              className="w-full accent-accent"
            />
          </div>

          <div className="space-y-2">
            <span className="text-[10px] uppercase tracking-wider text-fg-dim font-mono">Save location</span>
            <div className="flex gap-2">
              <input
                ref={locationInputRef}
                value={saveLocation}
                onChange={(e) => setSaveLocation(e.target.value)}
                className="flex-1 h-11 rounded-md border border-border bg-transparent px-3 text-base outline-none focus:border-accent"
                placeholder="exports"
              />
              <button
                type="button"
                onClick={chooseLocation}
                className="px-4 h-11 rounded-md border border-border text-[11px] font-mono text-fg-dim hover:text-fg hover:bg-panel-2"
              >
                Browse
              </button>
            </div>
          </div>

          <label className="flex items-center justify-between gap-3 text-sm text-fg-dim">
            <span>Transparent background</span>
            <input
              type="checkbox"
              checked={transparent && format !== 'jpg'}
              disabled={format === 'jpg'}
              onChange={(e) => setTransparent(e.target.checked)}
              className="h-4 w-4 accent-accent"
            />
          </label>

          <label className="flex items-center justify-between gap-3 text-sm text-fg-dim">
            <span>Save as copy</span>
            <input
              type="checkbox"
              checked={saveAsCopy}
              onChange={(e) => setSaveAsCopy(e.target.checked)}
              className="h-4 w-4 accent-accent"
            />
          </label>

          <div className="flex justify-end gap-3 pt-2">
            <button onClick={onClose} className="px-5 py-2.5 rounded-full text-sm font-mono text-fg-dim hover:text-fg transition-colors">Cancel</button>
            <button onClick={onSave} className="px-5 py-2.5 rounded-full text-sm font-mono bg-accent text-bg hover:bg-accent-2 hover:text-fg transition-colors">Save</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function CanvasSizeDialog({ onClose }: { onClose: () => void }) {
  const doc = useEditor((s) => s.doc);
  const resizeDocument = useEditor((s) => s.resizeDocument);
  const [width, setWidth] = useState(doc.width);
  const [height, setHeight] = useState(doc.height);

  const apply = () => {
    const nw = Math.max(1, Number(width) || doc.width);
    const nh = Math.max(1, Number(height) || doc.height);
    resizeDocument(nw, nh);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div
        className="w-[540px] bg-panel border border-border-strong rounded-xl shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-6 py-5 border-b border-border">
          <h2 className="font-serif text-[20px] leading-none">Canvas Size</h2>
        </div>
        <div className="p-6 space-y-5">
          <label className="block space-y-2">
            <span className="text-[10px] uppercase tracking-wider text-fg-dim font-mono">New width (px)</span>
            <input
              autoFocus
              type="number"
              min={1}
              value={width}
              onChange={(e) => setWidth(Number(e.target.value))}
              className="w-full h-12 rounded-md border border-border bg-transparent px-3 text-lg outline-none focus:border-accent"
            />
          </label>
          <label className="block space-y-2">
            <span className="text-[10px] uppercase tracking-wider text-fg-dim font-mono">New height (px)</span>
            <input
              type="number"
              min={1}
              value={height}
              onChange={(e) => setHeight(Number(e.target.value))}
              className="w-full h-12 rounded-md border border-border bg-transparent px-3 text-lg outline-none focus:border-accent"
            />
          </label>
          <div className="flex justify-end gap-3 pt-2">
            <button
              onClick={onClose}
              className="px-5 py-2.5 rounded-full text-sm font-mono text-fg-dim hover:text-fg transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={apply}
              className="px-5 py-2.5 rounded-full text-sm font-mono bg-accent text-bg hover:bg-accent-2 hover:text-fg transition-colors"
            >
              OK
            </button>
          </div>
        </div>
      </div>
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
          <div><span className="text-accent">V</span> Move / Ctrl+T transform</div>
          <div><span className="text-accent">M / Shift+M</span> Marquee rect/ellipse</div>
          <div><span className="text-accent">L</span> Lasso / <span className="text-accent">W</span> Wand</div>
          <div><span className="text-accent">C</span> Crop / <span className="text-accent">I</span> Eyedropper</div>
          <div><span className="text-accent">B / Shift+B</span> Brush / Pencil</div>
          <div><span className="text-accent">E</span> Eraser</div>
          <div><span className="text-accent">G / Shift+G</span> Bucket / Gradient</div>
          <div><span className="text-accent">R + Shift</span> Blur / Sharpen / Smudge</div>
          <div><span className="text-accent">O + Shift</span> Dodge / Burn</div>
          <div><span className="text-accent">T</span> Type / <span className="text-accent">U</span> Shapes</div>
          <div><span className="text-accent">D / X</span> Default / Swap colors</div>
          <div><span className="text-accent">[ ]</span> Brush size / <span className="text-accent">Shift+[ ]</span> Hardness</div>
          <div><span className="text-accent">H / Space</span> Hand / <span className="text-accent">Z</span> Zoom</div>
          <div><span className="text-accent">Ctrl+N / O / S</span> New / Open / Save</div>
          <div><span className="text-accent">Ctrl+A / D</span> Select / Deselect</div>
          <div><span className="text-accent">Ctrl+C / X / V</span> Copy / Cut / Paste</div>
          <div><span className="text-accent">Ctrl+J / E</span> Duplicate / Merge</div>
          <div><span className="text-accent">Ctrl+Z</span> Undo / <span className="text-accent">Ctrl+Shift+Z</span> Redo</div>
          <div><span className="text-accent">Ctrl++ / −</span> Zoom in/out</div>
          <div><span className="text-accent">Ctrl+0 / 1</span> Fit / 100%</div>
          <div><span className="text-accent">Del</span> Clear / <span className="text-accent">Esc</span> Deselect</div>
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
