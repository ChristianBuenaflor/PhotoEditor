import { create } from 'zustand';
import type {
  Adjustments,
  BlendMode,
  Document,
  Layer,
  Selection,
  Tool,
} from '../lib/types';
import { defaultAdjustments } from '../lib/types';
import { createLayerCanvas, uid } from '../lib/utils';

interface BrushSettings {
  size: number;
  hardness: number; // 0..100
  opacity: number; // 0..100
  flow: number; // 0..100
}

interface HistorySnapshot {
  label: string;
  docWidth: number;
  docHeight: number;
  activeId: string | null;
  selection: Selection | null;
  layers: {
    id: string;
    name: string;
    visible: boolean;
    locked: boolean;
    opacity: number;
    blendMode: BlendMode;
    x: number;
    y: number;
    adjustments: Adjustments;
    isBackground?: boolean;
    dataUrl: string;
  }[];
}

interface EditorState {
  doc: Document;
  layers: Layer[];
  activeLayerId: string | null;

  tool: Tool;
  foreground: string;
  background: string;
  brush: BrushSettings;

  zoom: number;
  pan: { x: number; y: number };

  selection: Selection | null;

  history: HistorySnapshot[];
  historyIndex: number;

  showRulers: boolean;
  showGrid: boolean;

  // actions
  setTool: (t: Tool) => void;
  setForeground: (c: string) => void;
  setBackground: (c: string) => void;
  swapColors: () => void;
  setBrush: (b: Partial<BrushSettings>) => void;
  setZoom: (z: number) => void;
  setPan: (p: { x: number; y: number }) => void;
  setSelection: (s: Selection | null) => void;
  toggleRulers: () => void;
  toggleGrid: () => void;

  newDocument: (w: number, h: number, bg: string) => void;
  resizeDocument: (w: number, h: number) => void;

  addLayer: (opts?: { name?: string; fromImage?: HTMLImageElement }) => Layer;
  deleteLayer: (id: string) => void;
  duplicateLayer: (id: string) => void;
  setActiveLayer: (id: string) => void;
  updateLayer: (id: string, patch: Partial<Layer>) => void;
  moveLayer: (id: string, dir: 'up' | 'down') => void;
  mergeDown: (id: string) => void;
  flattenAll: () => void;
  bakeAdjustments: (id: string) => void;

  pushHistory: (label: string) => void;
  undo: () => void;
  redo: () => void;

  notifyLayerChanged: () => void;

  // internal counter to force re-renders when a layer canvas is drawn into
  paintTick: number;
  bumpPaintTick: () => void;
}

function snapshot(state: {
  doc: Document;
  layers: Layer[];
  activeLayerId: string | null;
  selection: Selection | null;
}, label: string): HistorySnapshot {
  return {
    label,
    docWidth: state.doc.width,
    docHeight: state.doc.height,
    activeId: state.activeLayerId,
    selection: state.selection,
    layers: state.layers.map((l) => ({
      id: l.id,
      name: l.name,
      visible: l.visible,
      locked: l.locked,
      opacity: l.opacity,
      blendMode: l.blendMode,
      x: l.x,
      y: l.y,
      adjustments: { ...l.adjustments },
      isBackground: l.isBackground,
      dataUrl: l.canvas.toDataURL('image/png'),
    })),
  };
}

function restore(snap: HistorySnapshot): Promise<{
  doc: Document;
  layers: Layer[];
  activeLayerId: string | null;
  selection: Selection | null;
}> {
  return new Promise((resolve) => {
    const layers: Layer[] = [];
    let remaining = snap.layers.length;
    if (remaining === 0) {
      resolve({
        doc: { width: snap.docWidth, height: snap.docHeight, background: '#ffffff' },
        layers: [],
        activeLayerId: null,
        selection: snap.selection,
      });
      return;
    }
    snap.layers.forEach((ls, index) => {
      const c = createLayerCanvas(snap.docWidth, snap.docHeight);
      const img = new Image();
      img.onload = () => {
        c.getContext('2d')!.drawImage(img, 0, 0);
        layers[index] = {
          id: ls.id,
          name: ls.name,
          visible: ls.visible,
          locked: ls.locked,
          opacity: ls.opacity,
          blendMode: ls.blendMode,
          x: ls.x,
          y: ls.y,
          adjustments: { ...ls.adjustments },
          isBackground: ls.isBackground,
          canvas: c,
        };
        if (--remaining === 0) {
          resolve({
            doc: { width: snap.docWidth, height: snap.docHeight, background: '#ffffff' },
            layers,
            activeLayerId: snap.activeId,
            selection: snap.selection,
          });
        }
      };
      img.src = ls.dataUrl;
    });
  });
}

function makeBackgroundLayer(w: number, h: number, bg: string): Layer {
  const c = createLayerCanvas(w, h);
  const ctx = c.getContext('2d')!;
  if (bg !== 'transparent') {
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);
  }
  return {
    id: uid(),
    name: 'Background',
    visible: true,
    locked: false,
    opacity: 100,
    blendMode: 'source-over',
    canvas: c,
    x: 0,
    y: 0,
    adjustments: defaultAdjustments(),
    isBackground: true,
  };
}

const INITIAL_W = 1200;
const INITIAL_H = 800;

export const useEditor = create<EditorState>((set, get) => {
  const bgLayer = makeBackgroundLayer(INITIAL_W, INITIAL_H, '#ffffff');
  return {
    doc: { width: INITIAL_W, height: INITIAL_H, background: '#ffffff' },
    layers: [bgLayer],
    activeLayerId: bgLayer.id,

    tool: 'move',
    foreground: '#e8873b',
    background: '#14110c',
    brush: { size: 24, hardness: 80, opacity: 100, flow: 100 },

    zoom: 1,
    pan: { x: 0, y: 0 },

    selection: null,

    history: [],
    historyIndex: -1,

    showRulers: true,
    showGrid: false,
    paintTick: 0,

    setTool: (t) => set({ tool: t }),
    setForeground: (c) => set({ foreground: c }),
    setBackground: (c) => set({ background: c }),
    swapColors: () =>
      set((s) => ({ foreground: s.background, background: s.foreground })),
    setBrush: (b) => set((s) => ({ brush: { ...s.brush, ...b } })),
    setZoom: (z) => set({ zoom: Math.max(0.05, Math.min(16, z)) }),
    setPan: (p) => set({ pan: p }),
    setSelection: (s) => set({ selection: s }),
    toggleRulers: () => set((s) => ({ showRulers: !s.showRulers })),
    toggleGrid: () => set((s) => ({ showGrid: !s.showGrid })),

    bumpPaintTick: () => set((s) => ({ paintTick: s.paintTick + 1 })),

    newDocument: (w, h, bg) => {
      const layer = makeBackgroundLayer(w, h, bg);
      set({
        doc: { width: w, height: h, background: bg },
        layers: [layer],
        activeLayerId: layer.id,
        selection: null,
        history: [],
        historyIndex: -1,
        zoom: 1,
        pan: { x: 0, y: 0 },
      });
      get().pushHistory('New Document');
    },

    resizeDocument: (w, h) => {
      const state = get();
      const newLayers = state.layers.map((l) => {
        const c = createLayerCanvas(w, h);
        c.getContext('2d')!.drawImage(l.canvas, 0, 0);
        return { ...l, canvas: c };
      });
      set({
        doc: { ...state.doc, width: w, height: h },
        layers: newLayers,
      });
      get().pushHistory('Resize Canvas');
    },

    addLayer: (opts) => {
      const { doc } = get();
      const c = createLayerCanvas(doc.width, doc.height);
      if (opts?.fromImage) {
        const img = opts.fromImage;
        const ctx = c.getContext('2d')!;
        // Fit inside if larger
        const scale = Math.min(1, doc.width / img.width, doc.height / img.height);
        const w = img.width * scale;
        const h = img.height * scale;
        ctx.drawImage(img, (doc.width - w) / 2, (doc.height - h) / 2, w, h);
      }
      const layer: Layer = {
        id: uid(),
        name: opts?.name ?? `Layer ${get().layers.length}`,
        visible: true,
        locked: false,
        opacity: 100,
        blendMode: 'source-over',
        canvas: c,
        x: 0,
        y: 0,
        adjustments: defaultAdjustments(),
      };
      set((s) => ({ layers: [...s.layers, layer], activeLayerId: layer.id }));
      get().pushHistory('New Layer');
      return layer;
    },

    deleteLayer: (id) => {
      set((s) => {
        if (s.layers.length <= 1) return s;
        const layers = s.layers.filter((l) => l.id !== id);
        const activeLayerId =
          s.activeLayerId === id ? layers[layers.length - 1].id : s.activeLayerId;
        return { layers, activeLayerId };
      });
      get().pushHistory('Delete Layer');
    },

    duplicateLayer: (id) => {
      const s = get();
      const l = s.layers.find((x) => x.id === id);
      if (!l) return;
      const c = createLayerCanvas(s.doc.width, s.doc.height);
      c.getContext('2d')!.drawImage(l.canvas, 0, 0);
      const copy: Layer = {
        ...l,
        id: uid(),
        name: l.name + ' copy',
        canvas: c,
        isBackground: false,
        adjustments: { ...l.adjustments },
      };
      const idx = s.layers.findIndex((x) => x.id === id);
      const layers = [...s.layers];
      layers.splice(idx + 1, 0, copy);
      set({ layers, activeLayerId: copy.id });
      get().pushHistory('Duplicate Layer');
    },

    setActiveLayer: (id) => set({ activeLayerId: id }),

    updateLayer: (id, patch) =>
      set((s) => ({
        layers: s.layers.map((l) => (l.id === id ? { ...l, ...patch } : l)),
      })),

    moveLayer: (id, dir) => {
      set((s) => {
        const idx = s.layers.findIndex((l) => l.id === id);
        if (idx < 0) return s;
        const to = dir === 'up' ? idx + 1 : idx - 1;
        if (to < 0 || to >= s.layers.length) return s;
        const layers = [...s.layers];
        [layers[idx], layers[to]] = [layers[to], layers[idx]];
        return { layers };
      });
      get().pushHistory('Reorder Layer');
    },

    mergeDown: (id) => {
      const s = get();
      const idx = s.layers.findIndex((l) => l.id === id);
      if (idx <= 0) return;
      const upper = s.layers[idx];
      const lower = s.layers[idx - 1];
      const ctx = lower.canvas.getContext('2d')!;
      ctx.save();
      ctx.globalAlpha = upper.opacity / 100;
      ctx.globalCompositeOperation = upper.blendMode;
      ctx.drawImage(upper.canvas, upper.x, upper.y);
      ctx.restore();
      const layers = s.layers.filter((_, i) => i !== idx);
      set({ layers, activeLayerId: lower.id });
      get().pushHistory('Merge Down');
    },

    flattenAll: () => {
      const s = get();
      const c = createLayerCanvas(s.doc.width, s.doc.height);
      const ctx = c.getContext('2d')!;
      if (s.doc.background && s.doc.background !== 'transparent') {
        ctx.fillStyle = s.doc.background;
        ctx.fillRect(0, 0, s.doc.width, s.doc.height);
      }
      s.layers.forEach((l) => {
        if (!l.visible) return;
        ctx.save();
        ctx.globalAlpha = l.opacity / 100;
        ctx.globalCompositeOperation = l.blendMode;
        ctx.drawImage(l.canvas, l.x, l.y);
        ctx.restore();
      });
      const flat: Layer = {
        id: uid(),
        name: 'Background',
        visible: true,
        locked: false,
        opacity: 100,
        blendMode: 'source-over',
        canvas: c,
        x: 0,
        y: 0,
        adjustments: defaultAdjustments(),
        isBackground: true,
      };
      set({ layers: [flat], activeLayerId: flat.id });
      get().pushHistory('Flatten Image');
    },

    bakeAdjustments: (id) => {
      const s = get();
      const l = s.layers.find((x) => x.id === id);
      if (!l) return;
      const c = createLayerCanvas(s.doc.width, s.doc.height);
      const ctx = c.getContext('2d')!;
      const a = l.adjustments;
      const filter = [
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
      ctx.filter = filter;
      ctx.drawImage(l.canvas, 0, 0);
      ctx.filter = 'none';
      get().updateLayer(id, { canvas: c, adjustments: defaultAdjustments() });
      get().pushHistory('Apply Adjustments');
    },

    notifyLayerChanged: () => {
      set((s) => ({ paintTick: s.paintTick + 1 }));
    },

    pushHistory: (label) => {
      const s = get();
      const snap = snapshot(s, label);
      const trimmed = s.history.slice(0, s.historyIndex + 1);
      trimmed.push(snap);
      const MAX = 40;
      const overflow = trimmed.length - MAX;
      const final = overflow > 0 ? trimmed.slice(overflow) : trimmed;
      set({ history: final, historyIndex: final.length - 1 });
    },

    undo: async () => {
      const s = get();
      if (s.historyIndex <= 0) return;
      const idx = s.historyIndex - 1;
      const snap = s.history[idx];
      const restored = await restore(snap);
      set({ ...restored, historyIndex: idx, paintTick: s.paintTick + 1 });
    },

    redo: async () => {
      const s = get();
      if (s.historyIndex >= s.history.length - 1) return;
      const idx = s.historyIndex + 1;
      const snap = s.history[idx];
      const restored = await restore(snap);
      set({ ...restored, historyIndex: idx, paintTick: s.paintTick + 1 });
    },
  };
});

// Seed initial history
useEditor.getState().pushHistory('Open');
