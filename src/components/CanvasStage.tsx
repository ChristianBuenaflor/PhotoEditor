import { useEffect, useRef, useState, useCallback } from 'react';
import { useEditor } from '../store/editor';
import { cssFilterFor, hexToRgb, rgbToHex } from '../lib/utils';
import { floodFill } from '../lib/filters';
import type { Selection } from '../lib/types';

interface DragState {
  startX: number;
  startY: number;
  lastX: number;
  lastY: number;
  layerStartX?: number;
  layerStartY?: number;
  points?: { x: number; y: number }[];
}

type ResizeHandle = 'nw' | 'ne' | 'sw' | 'se';

interface TransformDragState {
  handle: ResizeHandle;
  source: HTMLCanvasElement;
  originX: number;
  originY: number;
  originW: number;
  originH: number;
}

export function CanvasStage() {
  const doc = useEditor((s) => s.doc);
  const layers = useEditor((s) => s.layers);
  const activeId = useEditor((s) => s.activeLayerId);
  const tool = useEditor((s) => s.tool);
  const zoom = useEditor((s) => s.zoom);
  const pan = useEditor((s) => s.pan);
  const setPan = useEditor((s) => s.setPan);
  const setZoom = useEditor((s) => s.setZoom);
  const brush = useEditor((s) => s.brush);
  const fg = useEditor((s) => s.foreground);
  const bg = useEditor((s) => s.background);
  const setFg = useEditor((s) => s.setForeground);
  const selection = useEditor((s) => s.selection);
  const setSelection = useEditor((s) => s.setSelection);
  const updateLayer = useEditor((s) => s.updateLayer);
  const pushHistory = useEditor((s) => s.pushHistory);
  const paintTick = useEditor((s) => s.paintTick);
  const bumpPaintTick = useEditor((s) => s.bumpPaintTick);
  const showRulers = useEditor((s) => s.showRulers);
  const showGrid = useEditor((s) => s.showGrid);

  const containerRef = useRef<HTMLDivElement>(null);
  const displayCanvasRef = useRef<HTMLCanvasElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);

  const [drag, setDrag] = useState<DragState | null>(null);
  const [transformDrag, setTransformDrag] = useState<TransformDragState | null>(null);
  const [pendingSel, setPendingSel] = useState<Selection | null>(null);
  const [textEdit, setTextEdit] = useState<{ x: number; y: number; value: string } | null>(null);
  const [cursorPos, setCursorPos] = useState<{ x: number; y: number } | null>(null);

  // Fit on mount / when doc changes (pan is the canvas screen offset)
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const pad = 64;
    const availW = el.clientWidth - pad;
    const availH = el.clientHeight - pad;
    const z = Math.min(1, Math.min(availW / doc.width, availH / doc.height));
    setZoom(z);
    setPan({
      x: (el.clientWidth - doc.width * z) / 2,
      y: (el.clientHeight - doc.height * z) / 2,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doc.width, doc.height]);

  // Photoshop-style wheel: Ctrl/Cmd (+ Alt) + wheel = zoom at cursor,
  // plain wheel = pan, Shift + wheel = horizontal pan.
  // Pan is applied to canvas offset state only (container is overflow-hidden,
  // not natively scrolled) so scroll position can never fight the pan offset.
  // Must be a native non-passive listener — React's onWheel is passive and
  // preventDefault() inside it cannot reliably take over scrolling.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const handleNativeWheel = (e: WheelEvent) => {
      const s = useEditor.getState();
      if (e.ctrlKey || e.metaKey || e.altKey) {
        e.preventDefault();
        e.stopPropagation();
        const factor = e.deltaY < 0 ? 1.15 : 1 / 1.15;
        const rect = el.getBoundingClientRect();
        const cx = e.clientX - rect.left;
        const cy = e.clientY - rect.top;
        const dx = (cx - s.pan.x) / s.zoom;
        const dy = (cy - s.pan.y) / s.zoom;
        const newZoom = Math.max(0.05, Math.min(16, s.zoom * factor));
        s.setZoom(newZoom);
        s.setPan({ x: cx - dx * newZoom, y: cy - dy * newZoom });
        return;
      }
      // Viewport pan only — never move layer content (Photoshop behavior).
      e.preventDefault();
      e.stopPropagation();
      let dx = e.deltaX;
      let dy = e.deltaY;
      if (e.deltaMode === 1) {
        dx *= 16;
        dy *= 16;
      } else if (e.deltaMode === 2) {
        dx *= 400;
        dy *= 400;
      }
      if (e.shiftKey && Math.abs(e.deltaX) < Math.abs(e.deltaY)) {
        // Vertical wheel + Shift => horizontal pan (trackpads may already
        // report horizontal deltas, in which case keep them as-is).
        dx = dy;
        dy = 0;
      }
      // Match native scroll direction: wheel down moves the viewport down,
      // so the canvas screen offset moves up.
      s.setPan({ x: s.pan.x - dx, y: s.pan.y - dy });
    };
    el.addEventListener('wheel', handleNativeWheel, { passive: false });
    return () => el.removeEventListener('wheel', handleNativeWheel);
  }, []);

  // Composite all layers to display canvas
  useEffect(() => {
    const c = displayCanvasRef.current;
    if (!c) return;
    c.width = doc.width;
    c.height = doc.height;
    const ctx = c.getContext('2d')!;
    ctx.clearRect(0, 0, c.width, c.height);
    layers.forEach((l) => {
      if (!l.visible) return;
      ctx.save();
      ctx.globalAlpha = l.opacity / 100;
      ctx.globalCompositeOperation = l.blendMode;
      ctx.filter = cssFilterFor(l.adjustments);
      ctx.drawImage(l.canvas, l.x, l.y);
      ctx.restore();
    });
  }, [layers, doc.width, doc.height, paintTick]);

  // Draw overlay (selection marching ants + drag preview)
  useEffect(() => {
    const c = overlayRef.current;
    if (!c) return;
    c.width = doc.width;
    c.height = doc.height;
    const ctx = c.getContext('2d')!;
    ctx.clearRect(0, 0, c.width, c.height);

    const drawSel = (s: Selection, dashed = true) => {
      ctx.save();
      ctx.strokeStyle = '#000';
      ctx.lineWidth = 1 / zoom;
      if (dashed) ctx.setLineDash([6 / zoom, 4 / zoom]);
      if (s.shape === 'rect') {
        ctx.strokeRect(s.x + 0.5, s.y + 0.5, s.w, s.h);
        ctx.strokeStyle = '#fff';
        ctx.lineDashOffset = 3 / zoom;
        ctx.strokeRect(s.x + 0.5, s.y + 0.5, s.w, s.h);
      } else {
        ctx.beginPath();
        ctx.ellipse(s.x + s.w / 2, s.y + s.h / 2, Math.abs(s.w / 2), Math.abs(s.h / 2), 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.strokeStyle = '#fff';
        ctx.lineDashOffset = 3 / zoom;
        ctx.stroke();
      }
      ctx.restore();
    };

    if (selection) drawSel(selection);
    if (pendingSel) drawSel(pendingSel, false);
  }, [selection, pendingSel, doc.width, doc.height, zoom]);

  // Convert screen coords to document coords
  const toDoc = useCallback(
    (clientX: number, clientY: number) => {
      const el = containerRef.current;
      if (!el) return { x: 0, y: 0 };
      const rect = el.getBoundingClientRect();
      const x = (clientX - rect.left - pan.x) / zoom;
      const y = (clientY - rect.top - pan.y) / zoom;
      return { x, y };
    },
    [pan, zoom],
  );

  const activeLayer = layers.find((l) => l.id === activeId);

  const beginTransformResize = useCallback((handle: ResizeHandle, e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    const layer = useEditor.getState().layers.find((l) => l.id === activeId);
    if (!layer || layer.locked) return;
    setTransformDrag({
      handle,
      source: layer.canvas,
      originX: layer.x,
      originY: layer.y,
      originW: layer.canvas.width,
      originH: layer.canvas.height,
    });
  }, [activeId]);

  const drawBrushStroke = useCallback(
    (from: { x: number; y: number }, to: { x: number; y: number }, erase: boolean) => {
      if (!activeLayer || activeLayer.locked) return;
      const ctx = activeLayer.canvas.getContext('2d')!;
      ctx.save();
      if (selection) {
        ctx.beginPath();
        if (selection.shape === 'rect') {
          ctx.rect(selection.x, selection.y, selection.w, selection.h);
        } else {
          ctx.ellipse(
            selection.x + selection.w / 2,
            selection.y + selection.h / 2,
            Math.abs(selection.w / 2),
            Math.abs(selection.h / 2),
            0,
            0,
            Math.PI * 2,
          );
        }
        ctx.clip();
      }
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.strokeStyle = fg;
      ctx.lineWidth = brush.size;
      ctx.globalAlpha = brush.opacity / 100;
      if (erase) ctx.globalCompositeOperation = 'destination-out';
      // Soft brush using shadow blur simulation
      if (!erase && brush.hardness < 100 && tool !== 'pencil') {
        ctx.shadowColor = fg;
        ctx.shadowBlur = ((100 - brush.hardness) / 100) * brush.size * 0.35;
      }
      ctx.beginPath();
      ctx.moveTo(from.x - activeLayer.x, from.y - activeLayer.y);
      ctx.lineTo(to.x - activeLayer.x, to.y - activeLayer.y);
      ctx.stroke();
      ctx.restore();
      bumpPaintTick();
    },
    [activeLayer, fg, brush, selection, bumpPaintTick, tool],
  );

  const drawEffectStroke = useCallback(
    (from: { x: number; y: number }, to: { x: number; y: number }, kind: 'blur' | 'sharpen' | 'smudge' | 'dodge' | 'burn') => {
      if (!activeLayer || activeLayer.locked) return;
      const ctx = activeLayer.canvas.getContext('2d')!;
      const r = brush.size / 2;
      const strength = Math.max(0.05, Math.min(1, brush.opacity / 100));
      const steps = Math.max(1, Math.ceil(Math.hypot(to.x - from.x, to.y - from.y) / (r * 0.5)));
      for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        const cx = from.x + (to.x - from.x) * t - activeLayer.x;
        const cy = from.y + (to.y - from.y) * t - activeLayer.y;
        const x = Math.floor(cx - r);
        const y = Math.floor(cy - r);
        const w = Math.ceil(brush.size);
        const h = Math.ceil(brush.size);
        if (x + w < 0 || y + h < 0 || x > ctx.canvas.width || y > ctx.canvas.height) continue;
        try {
          const img = ctx.getImageData(x, y, w, h);
          const d = img.data;
          if (kind === 'blur' || kind === 'sharpen' || kind === 'smudge') {
            // simple box blur
            const src = new Uint8ClampedArray(d);
            const iw = w;
            for (let py = 1; py < h - 1; py++) {
              for (let px = 1; px < iw - 1; px++) {
                for (let ch = 0; ch < 3; ch++) {
                  let sum = 0;
                  for (let ky = -1; ky <= 1; ky++)
                    for (let kx = -1; kx <= 1; kx++)
                      sum += src[((py + ky) * iw + (px + kx)) * 4 + ch];
                  const blurred = sum / 9;
                  const origIdx = (py * iw + px) * 4 + ch;
                  const orig = src[origIdx];
                  let next = orig;
                  if (kind === 'blur') next = orig + (blurred - orig) * strength;
                  else if (kind === 'sharpen') next = orig + (orig - blurred) * strength * 1.5;
                  else next = orig + (blurred - orig) * strength * 0.6; // smudge: gentle blend
                  d[origIdx] = Math.max(0, Math.min(255, next));
                }
              }
            }
          } else {
            const base = kind === 'dodge' ? 10 : -10;
            const amt = base * strength;
            for (let p = 0; p < d.length; p += 4) {
              if (d[p + 3] === 0) continue;
              d[p] = Math.max(0, Math.min(255, d[p] + amt));
              d[p + 1] = Math.max(0, Math.min(255, d[p + 1] + amt));
              d[p + 2] = Math.max(0, Math.min(255, d[p + 2] + amt));
            }
          }
          ctx.putImageData(img, x, y);
        } catch { /* out of bounds */ }
      }
      bumpPaintTick();
    },
    [activeLayer, brush.size, brush.opacity, bumpPaintTick],
  );

  const drawGradient = useCallback((
    start: { x: number; y: number },
    end: { x: number; y: number },
  ) => {
    if (!activeLayer || activeLayer.locked) return;
    if (Math.hypot(end.x - start.x, end.y - start.y) < 2) return;
    const ctx = activeLayer.canvas.getContext('2d')!;
    ctx.save();
    if (selection) {
      ctx.beginPath();
      if (selection.shape === 'rect') ctx.rect(selection.x, selection.y, selection.w, selection.h);
      else ctx.ellipse(selection.x + selection.w / 2, selection.y + selection.h / 2, Math.abs(selection.w / 2), Math.abs(selection.h / 2), 0, 0, Math.PI * 2);
      ctx.clip();
    }
    ctx.globalAlpha = brush.opacity / 100;
    const g = ctx.createLinearGradient(start.x - activeLayer.x, start.y - activeLayer.y, end.x - activeLayer.x, end.y - activeLayer.y);
    const s = useEditor.getState();
    g.addColorStop(0, s.foreground);
    g.addColorStop(1, s.background);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    ctx.restore();
    bumpPaintTick();
    pushHistory('Gradient');
  }, [activeLayer, selection, brush.opacity, bumpPaintTick, pushHistory]);

  const sampleColor = useCallback((x: number, y: number) => {
    const c = displayCanvasRef.current;
    if (!c) return;
    const ctx = c.getContext('2d')!;
    try {
      const pix = ctx.getImageData(Math.floor(x), Math.floor(y), 1, 1).data;
      setFg(rgbToHex(pix[0], pix[1], pix[2]));
    } catch { /* out of bounds */ }
  }, [setFg]);

  const drawShape = useCallback((
    start: { x: number; y: number },
    end: { x: number; y: number },
    commit: boolean,
  ) => {
    if (!activeLayer || activeLayer.locked) return;
    const ctx = activeLayer.canvas.getContext('2d')!;
    if (commit) {
      ctx.save();
      ctx.fillStyle = fg;
      ctx.strokeStyle = bg;
      ctx.lineWidth = 2;
      const x = Math.min(start.x, end.x) - activeLayer.x;
      const y = Math.min(start.y, end.y) - activeLayer.y;
      const w = Math.abs(end.x - start.x);
      const h = Math.abs(end.y - start.y);
      if (tool === 'shape-rect') {
        ctx.fillRect(x, y, w, h);
      } else if (tool === 'shape-ellipse') {
        ctx.beginPath();
        ctx.ellipse(x + w / 2, y + h / 2, w / 2, h / 2, 0, 0, Math.PI * 2);
        ctx.fill();
      } else if (tool === 'shape-line') {
        ctx.beginPath();
        ctx.strokeStyle = fg;
        ctx.lineWidth = brush.size;
        ctx.lineCap = 'round';
        ctx.moveTo(start.x - activeLayer.x, start.y - activeLayer.y);
        ctx.lineTo(end.x - activeLayer.x, end.y - activeLayer.y);
        ctx.stroke();
      }
      ctx.restore();
      bumpPaintTick();
    }
  }, [activeLayer, tool, fg, bg, brush.size, bumpPaintTick]);

  const onPointerDown = (e: React.PointerEvent) => {
    if (e.button === 1 || e.button === 2 || tool === 'hand') {
      // pan
      (e.target as Element).setPointerCapture(e.pointerId);
      setDrag({ startX: e.clientX, startY: e.clientY, lastX: pan.x, lastY: pan.y });
      return;
    }
    const p = toDoc(e.clientX, e.clientY);
    (e.target as Element).setPointerCapture(e.pointerId);

    if (tool === 'zoom') {
      setZoom(e.altKey ? zoom / 1.5 : zoom * 1.5);
      return;
    }

    if (tool === 'eyedropper') {
      sampleColor(p.x, p.y);
      return;
    }

    if (tool === 'bucket') {
      if (!activeLayer || activeLayer.locked) return;
      const ctx = activeLayer.canvas.getContext('2d')!;
      const [r, g, b] = hexToRgb(fg);
      floodFill(ctx, Math.floor(p.x - activeLayer.x), Math.floor(p.y - activeLayer.y), [r, g, b, 255], 32);
      bumpPaintTick();
      pushHistory('Paint Bucket');
      return;
    }

    if (tool === 'text') {
      setTextEdit({ x: p.x, y: p.y, value: '' });
      return;
    }

    if (tool === 'move' && activeLayer) {
      setDrag({
        startX: p.x,
        startY: p.y,
        lastX: p.x,
        lastY: p.y,
        layerStartX: activeLayer.x,
        layerStartY: activeLayer.y,
      });
      return;
    }

    if (tool.startsWith('marquee')) {
      setPendingSel({
        x: p.x,
        y: p.y,
        w: 0,
        h: 0,
        shape: tool === 'marquee-ellipse' ? 'ellipse' : 'rect',
      });
      setDrag({ startX: p.x, startY: p.y, lastX: p.x, lastY: p.y });
      return;
    }

    if (tool === 'lasso') {
      setDrag({ startX: p.x, startY: p.y, lastX: p.x, lastY: p.y, points: [{ x: p.x, y: p.y }] });
      return;
    }

    if (tool === 'crop') {
      setPendingSel({ x: p.x, y: p.y, w: 0, h: 0, shape: 'rect' });
      setDrag({ startX: p.x, startY: p.y, lastX: p.x, lastY: p.y });
      return;
    }

    if (tool === 'brush' || tool === 'pencil' || tool === 'eraser') {
      drawBrushStroke(p, p, tool === 'eraser');
      setDrag({ startX: p.x, startY: p.y, lastX: p.x, lastY: p.y });
      return;
    }

    if (tool === 'blur' || tool === 'sharpen' || tool === 'smudge' || tool === 'dodge' || tool === 'burn') {
      drawEffectStroke(p, p, tool);
      setDrag({ startX: p.x, startY: p.y, lastX: p.x, lastY: p.y });
      return;
    }

    if (tool === 'gradient') {
      setDrag({ startX: p.x, startY: p.y, lastX: p.x, lastY: p.y });
      setPendingSel({ x: p.x, y: p.y, w: 0, h: 0, shape: 'rect' });
      return;
    }

    if (tool === 'shape-rect' || tool === 'shape-ellipse' || tool === 'shape-line') {
      setPendingSel({ x: p.x, y: p.y, w: 0, h: 0, shape: 'rect' });
      setDrag({ startX: p.x, startY: p.y, lastX: p.x, lastY: p.y });
      return;
    }
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const p = toDoc(e.clientX, e.clientY);
    setCursorPos(p);

    if (transformDrag && activeLayer) {
      const { handle, source, originX, originY, originW, originH } = transformDrag;
      const anchorX = handle.includes('w') ? originX + originW : originX;
      const anchorY = handle.includes('n') ? originY + originH : originY;
      const rawW = Math.abs(handle.includes('w') ? anchorX - p.x : p.x - anchorX);
      const rawH = Math.abs(handle.includes('n') ? anchorY - p.y : p.y - anchorY);
      const minSize = 10;

      let nextW = Math.max(minSize, rawW);
      let nextH = Math.max(minSize, rawH);

      if (e.shiftKey) {
        const aspect = originW / originH;
        const scale = Math.max(nextW / originW, nextH / originH);
        nextW = Math.max(minSize, originW * scale);
        nextH = Math.max(minSize, originH * scale);
        if (aspect >= 1) {
          nextH = nextW / aspect;
        } else {
          nextW = nextH * aspect;
        }
      }

      const nextX = handle.includes('w') ? anchorX - nextW : anchorX;
      const nextY = handle.includes('n') ? anchorY - nextH : anchorY;

      const nextCanvas = document.createElement('canvas');
      nextCanvas.width = nextW;
      nextCanvas.height = nextH;
      const ctx = nextCanvas.getContext('2d')!;
      ctx.clearRect(0, 0, nextW, nextH);
      ctx.imageSmoothingEnabled = true;
      ctx.drawImage(source, 0, 0, originW, originH, 0, 0, nextW, nextH);

      updateLayer(activeLayer.id, {
        x: nextX,
        y: nextY,
        canvas: nextCanvas,
      });
      return;
    }

    if (!drag) return;

    if (tool === 'hand' || e.buttons === 4) {
      setPan({
        x: drag.lastX + (e.clientX - drag.startX),
        y: drag.lastY + (e.clientY - drag.startY),
      });
      return;
    }

    if (tool === 'move' && activeLayer) {
      updateLayer(activeLayer.id, {
        x: (drag.layerStartX ?? 0) + (p.x - drag.startX),
        y: (drag.layerStartY ?? 0) + (p.y - drag.startY),
      });
      return;
    }

    if (tool.startsWith('marquee') || tool === 'crop') {
      let w = p.x - drag.startX;
      let h = p.y - drag.startY;
      if (e.shiftKey) {
        const m = Math.min(Math.abs(w), Math.abs(h));
        w = Math.sign(w) * m;
        h = Math.sign(h) * m;
      }
      setPendingSel({
        x: Math.min(drag.startX, drag.startX + w),
        y: Math.min(drag.startY, drag.startY + h),
        w: Math.abs(w),
        h: Math.abs(h),
        shape: tool === 'marquee-ellipse' ? 'ellipse' : 'rect',
      });
      return;
    }

    if (tool === 'lasso' && drag.points) {
      drag.points.push({ x: p.x, y: p.y });
      // Draw preview onto overlay
      const c = overlayRef.current!;
      const ctx = c.getContext('2d')!;
      ctx.clearRect(0, 0, c.width, c.height);
      ctx.strokeStyle = '#e8873b';
      ctx.lineWidth = 1 / zoom;
      ctx.beginPath();
      drag.points.forEach((pt, i) => (i === 0 ? ctx.moveTo(pt.x, pt.y) : ctx.lineTo(pt.x, pt.y)));
      ctx.stroke();
      return;
    }

    if (tool === 'brush' || tool === 'pencil' || tool === 'eraser') {
      drawBrushStroke({ x: drag.lastX, y: drag.lastY }, p, tool === 'eraser');
      setDrag({ ...drag, lastX: p.x, lastY: p.y });
      return;
    }

    if (tool === 'blur' || tool === 'sharpen' || tool === 'smudge' || tool === 'dodge' || tool === 'burn') {
      drawEffectStroke({ x: drag.lastX, y: drag.lastY }, p, tool);
      setDrag({ ...drag, lastX: p.x, lastY: p.y });
      return;
    }

    if (tool === 'gradient') {
      setPendingSel({
        x: Math.min(drag.startX, p.x),
        y: Math.min(drag.startY, p.y),
        w: Math.abs(p.x - drag.startX),
        h: Math.abs(p.y - drag.startY),
        shape: 'rect',
      });
      setDrag({ ...drag, lastX: p.x, lastY: p.y });
      return;
    }

    if (tool === 'shape-rect' || tool === 'shape-ellipse' || tool === 'shape-line') {
      setPendingSel({
        x: Math.min(drag.startX, p.x),
        y: Math.min(drag.startY, p.y),
        w: Math.abs(p.x - drag.startX),
        h: Math.abs(p.y - drag.startY),
        shape: tool === 'shape-ellipse' ? 'ellipse' : 'rect',
      });
      return;
    }
  };

  const onPointerUp = (e: React.PointerEvent) => {
    const p = toDoc(e.clientX, e.clientY);
    if (transformDrag) {
      pushHistory('Resize Layer');
      setTransformDrag(null);
      return;
    }
    if (drag) {
      if (tool === 'move' && activeLayer) {
        pushHistory('Move Layer');
      } else if (tool.startsWith('marquee') && pendingSel && pendingSel.w > 2 && pendingSel.h > 2) {
        setSelection(pendingSel);
      } else if (tool === 'lasso' && drag.points && drag.points.length > 3) {
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        drag.points.forEach((pt) => {
          minX = Math.min(minX, pt.x); maxX = Math.max(maxX, pt.x);
          minY = Math.min(minY, pt.y); maxY = Math.max(maxY, pt.y);
        });
        setSelection({ x: minX, y: minY, w: maxX - minX, h: maxY - minY, shape: 'rect' });
      } else if (tool === 'crop' && pendingSel && pendingSel.w > 4 && pendingSel.h > 4) {
        // Perform crop: reduce doc to selection area
        const { x, y, w, h } = pendingSel;
        const state = useEditor.getState();
        const newLayers = state.layers.map((l) => {
          const c = document.createElement('canvas');
          c.width = w;
          c.height = h;
          c.getContext('2d')!.drawImage(l.canvas, -x + l.x, -y + l.y);
          return { ...l, canvas: c, x: 0, y: 0 };
        });
        useEditor.setState({
          doc: { ...state.doc, width: w, height: h },
          layers: newLayers,
        });
        pushHistory('Crop');
      } else if (['brush', 'pencil', 'eraser', 'blur', 'sharpen', 'smudge', 'dodge', 'burn'].includes(tool)) {
        pushHistory(tool.charAt(0).toUpperCase() + tool.slice(1) + ' Stroke');
      } else if (tool === 'gradient') {
        drawGradient({ x: drag.startX, y: drag.startY }, p);
      } else if (['shape-rect', 'shape-ellipse', 'shape-line'].includes(tool)) {
        drawShape({ x: drag.startX, y: drag.startY }, p, true);
        pushHistory('Draw Shape');
      }
    }
    setDrag(null);
    setPendingSel(null);
  };

  const commitText = () => {
    if (!textEdit || !activeLayer || !textEdit.value) {
      setTextEdit(null);
      return;
    }
    const ctx = activeLayer.canvas.getContext('2d')!;
    ctx.save();
    ctx.fillStyle = fg;
    ctx.font = `${brush.size * 1.5}px 'IBM Plex Sans', sans-serif`;
    ctx.textBaseline = 'top';
    ctx.fillText(textEdit.value, textEdit.x - activeLayer.x, textEdit.y - activeLayer.y);
    ctx.restore();
    bumpPaintTick();
    pushHistory('Add Text');
    setTextEdit(null);
  };

  const cursorMap: Partial<Record<typeof tool, string>> = {
    move: 'move',
    hand: 'grab',
    zoom: 'zoom-in',
    text: 'text',
  };
  const cursor = cursorMap[tool] ?? 'crosshair';

  return (
    <div
      ref={containerRef}
      className="flex-1 relative overflow-hidden bg-[#282828]"
      style={{ cursor, touchAction: 'none', scrollbarWidth: 'none', backgroundColor: '#282828' }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onContextMenu={(e) => e.preventDefault()}
    >
      {/* Rulers */}
      {showRulers && (
        <>
          <div className="absolute top-0 left-0 right-0 h-5 bg-panel-2 border-b border-border pointer-events-none z-10" />
          <div className="absolute top-0 left-0 bottom-0 w-5 bg-panel-2 border-r border-border pointer-events-none z-10" />
          <div className="absolute top-0 left-0 w-5 h-5 bg-panel-2 border-r border-b border-border z-10" />
        </>
      )}

      {/* Scrollable document background — Photoshop-style dark pasteboard */}
      <div
        className="absolute left-0 top-0"
        style={{
          width: Math.max(doc.width + 1600, 1800),
          height: Math.max(doc.height + 1200, 1200),
          background: '#282828',
        }}
      />

      {/* Canvas surface */}
      <div
        className="absolute origin-top-left"
        style={{
          left: pan.x,
          top: pan.y,
          width: doc.width,
          height: doc.height,
          transform: `scale(${zoom})`,
          transformOrigin: 'top left',
        }}
      >
        {/* Drop shadow */}
        <div
          className="absolute inset-0 shadow-[0_20px_60px_rgba(0,0,0,0.6)]"
          style={{ transform: `scale(${1 / zoom})`, transformOrigin: 'top left', width: doc.width * zoom, height: doc.height * zoom }}
        />
        <div className="absolute inset-0 checker" />
        <canvas ref={displayCanvasRef} className="absolute inset-0" style={{ width: doc.width, height: doc.height, imageRendering: zoom > 4 ? 'pixelated' : 'auto' }} />
        <canvas ref={overlayRef} className="absolute inset-0 pointer-events-none" style={{ width: doc.width, height: doc.height }} />
        {showGrid && (
          <svg className="absolute inset-0 pointer-events-none" width={doc.width} height={doc.height}>
            <defs>
              <pattern id="grid" width={50} height={50} patternUnits="userSpaceOnUse">
                <path d={`M 50 0 L 0 0 0 50`} fill="none" stroke="#ffffff22" strokeWidth={1 / zoom} />
              </pattern>
            </defs>
            <rect width={doc.width} height={doc.height} fill="url(#grid)" />
          </svg>
        )}

        {/* Text edit overlay */}
        {textEdit && (
          <input
            autoFocus
            value={textEdit.value}
            onChange={(e) => setTextEdit({ ...textEdit, value: e.target.value })}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commitText();
              else if (e.key === 'Escape') setTextEdit(null);
            }}
            onBlur={commitText}
            className="absolute bg-transparent outline-2 outline-accent outline-dashed p-0 m-0"
            style={{
              left: textEdit.x,
              top: textEdit.y,
              color: fg,
              fontSize: brush.size * 1.5,
              fontFamily: "'IBM Plex Sans', sans-serif",
              lineHeight: 1,
              width: `${Math.max(200, textEdit.value.length * brush.size)}px`,
              border: 'none',
              background: 'transparent',
              padding: 0,
            }}
          />
        )}
      </div>

      {/* Layer resize handles */}
      {tool === 'move' && activeLayer && !activeLayer.locked && (
        <>
          <div
            className="absolute border border-[#e8873b] pointer-events-none"
            style={{
              left: activeLayer.x * zoom + pan.x,
              top: activeLayer.y * zoom + pan.y,
              width: activeLayer.canvas.width * zoom,
              height: activeLayer.canvas.height * zoom,
            }}
          />
          {(['nw', 'ne', 'sw', 'se'] as ResizeHandle[]).map((handle) => {
            const x = activeLayer.x + (handle.includes('e') ? activeLayer.canvas.width : 0);
            const y = activeLayer.y + (handle.includes('s') ? activeLayer.canvas.height : 0);
            const px = x * zoom + pan.x;
            const py = y * zoom + pan.y;
            return (
              <div
                key={handle}
                data-handle={handle}
                onPointerDown={(e) => beginTransformResize(handle, e)}
                className="absolute w-3 h-3 border-2 border-[#151515] bg-[#e8873b] shadow-[0_0_0_1px_rgba(255,255,255,0.6)] z-10 cursor-nwse-resize"
                style={{
                  left: px - 6,
                  top: py - 6,
                  cursor: handle.includes('n') ? (handle.includes('w') ? 'nw-resize' : 'ne-resize') : (handle.includes('w') ? 'sw-resize' : 'se-resize'),
                }}
              />
            );
          })}
        </>
      )}

      {/* Brush cursor preview */}
      {cursorPos && ['brush', 'eraser', 'pencil', 'blur', 'sharpen', 'smudge', 'dodge', 'burn'].includes(tool) && (
        <div
          className="absolute pointer-events-none border border-fg mix-blend-difference rounded-full"
          style={{
            width: brush.size * zoom,
            height: brush.size * zoom,
            left: cursorPos.x * zoom + pan.x - (brush.size * zoom) / 2,
            top: cursorPos.y * zoom + pan.y - (brush.size * zoom) / 2,
          }}
        />
      )}

      {/* Coord readout */}
      {cursorPos && (
        <div className="absolute bottom-2 left-2 text-[10px] font-mono text-fg-dim bg-panel/80 px-2 py-0.5 rounded pointer-events-none">
          X: {Math.round(cursorPos.x)}  Y: {Math.round(cursorPos.y)}
        </div>
      )}
    </div>
  );
}
