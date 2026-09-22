// Destructive filters that operate on a canvas via ImageData.
// Applied to the active layer or selection region.

export type FilterName =
  | 'gaussian-blur'
  | 'sharpen'
  | 'edge-detect'
  | 'emboss'
  | 'noise'
  | 'pixelate'
  | 'posterize'
  | 'threshold'
  | 'invert'
  | 'vignette';

export interface FilterOptions {
  radius?: number;
  amount?: number;
  levels?: number;
  size?: number;
}

function convolve(
  src: ImageData,
  kernel: number[],
  divisor = 1,
  bias = 0,
): ImageData {
  const w = src.width;
  const h = src.height;
  const size = Math.sqrt(kernel.length) | 0;
  const half = size >> 1;
  const out = new ImageData(w, h);
  const s = src.data;
  const d = out.data;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let r = 0,
        g = 0,
        b = 0;
      for (let ky = 0; ky < size; ky++) {
        for (let kx = 0; kx < size; kx++) {
          const px = Math.min(w - 1, Math.max(0, x + kx - half));
          const py = Math.min(h - 1, Math.max(0, y + ky - half));
          const idx = (py * w + px) * 4;
          const k = kernel[ky * size + kx];
          r += s[idx] * k;
          g += s[idx + 1] * k;
          b += s[idx + 2] * k;
        }
      }
      const idx = (y * w + x) * 4;
      d[idx] = Math.max(0, Math.min(255, r / divisor + bias));
      d[idx + 1] = Math.max(0, Math.min(255, g / divisor + bias));
      d[idx + 2] = Math.max(0, Math.min(255, b / divisor + bias));
      d[idx + 3] = s[idx + 3];
    }
  }
  return out;
}

export function applyFilter(
  ctx: CanvasRenderingContext2D,
  name: FilterName,
  opts: FilterOptions = {},
) {
  const w = ctx.canvas.width;
  const h = ctx.canvas.height;
  if (!w || !h) return;

  if (name === 'gaussian-blur') {
    const r = opts.radius ?? 3;
    // Use native canvas blur for speed
    const off = document.createElement('canvas');
    off.width = w;
    off.height = h;
    const octx = off.getContext('2d')!;
    octx.filter = `blur(${r}px)`;
    octx.drawImage(ctx.canvas, 0, 0);
    ctx.clearRect(0, 0, w, h);
    ctx.drawImage(off, 0, 0);
    return;
  }

  const src = ctx.getImageData(0, 0, w, h);
  let out: ImageData = src;

  switch (name) {
    case 'sharpen': {
      const a = opts.amount ?? 1;
      out = convolve(src, [
        0, -a, 0,
        -a, 1 + 4 * a, -a,
        0, -a, 0,
      ]);
      break;
    }
    case 'edge-detect':
      out = convolve(src, [
        -1, -1, -1,
        -1, 8, -1,
        -1, -1, -1,
      ]);
      break;
    case 'emboss':
      out = convolve(
        src,
        [
          -2, -1, 0,
          -1, 1, 1,
          0, 1, 2,
        ],
        1,
        128,
      );
      break;
    case 'noise': {
      const a = opts.amount ?? 30;
      const d = new Uint8ClampedArray(src.data);
      for (let i = 0; i < d.length; i += 4) {
        const n = (Math.random() - 0.5) * a * 2;
        d[i] = Math.max(0, Math.min(255, d[i] + n));
        d[i + 1] = Math.max(0, Math.min(255, d[i + 1] + n));
        d[i + 2] = Math.max(0, Math.min(255, d[i + 2] + n));
      }
      out = new ImageData(d, w, h);
      break;
    }
    case 'pixelate': {
      const s = Math.max(2, opts.size ?? 8);
      const off = document.createElement('canvas');
      off.width = Math.max(1, Math.floor(w / s));
      off.height = Math.max(1, Math.floor(h / s));
      const octx = off.getContext('2d')!;
      octx.imageSmoothingEnabled = false;
      octx.drawImage(ctx.canvas, 0, 0, off.width, off.height);
      ctx.imageSmoothingEnabled = false;
      ctx.clearRect(0, 0, w, h);
      ctx.drawImage(off, 0, 0, w, h);
      ctx.imageSmoothingEnabled = true;
      return;
    }
    case 'posterize': {
      const levels = Math.max(2, opts.levels ?? 4);
      const step = 255 / (levels - 1);
      const d = new Uint8ClampedArray(src.data);
      for (let i = 0; i < d.length; i += 4) {
        d[i] = Math.round(d[i] / step) * step;
        d[i + 1] = Math.round(d[i + 1] / step) * step;
        d[i + 2] = Math.round(d[i + 2] / step) * step;
      }
      out = new ImageData(d, w, h);
      break;
    }
    case 'threshold': {
      const t = opts.amount ?? 128;
      const d = new Uint8ClampedArray(src.data);
      for (let i = 0; i < d.length; i += 4) {
        const l = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
        const v = l >= t ? 255 : 0;
        d[i] = d[i + 1] = d[i + 2] = v;
      }
      out = new ImageData(d, w, h);
      break;
    }
    case 'invert': {
      const d = new Uint8ClampedArray(src.data);
      for (let i = 0; i < d.length; i += 4) {
        d[i] = 255 - d[i];
        d[i + 1] = 255 - d[i + 1];
        d[i + 2] = 255 - d[i + 2];
      }
      out = new ImageData(d, w, h);
      break;
    }
    case 'vignette': {
      const a = opts.amount ?? 0.7;
      const d = new Uint8ClampedArray(src.data);
      const cx = w / 2;
      const cy = h / 2;
      const maxD = Math.sqrt(cx * cx + cy * cy);
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          const dx = x - cx;
          const dy = y - cy;
          const dist = Math.sqrt(dx * dx + dy * dy) / maxD;
          const f = 1 - Math.pow(dist, 2) * a;
          const i = (y * w + x) * 4;
          d[i] *= f;
          d[i + 1] *= f;
          d[i + 2] *= f;
        }
      }
      out = new ImageData(d, w, h);
      break;
    }
  }

  ctx.putImageData(out, 0, 0);
}

// Flood fill (bucket)
export function floodFill(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  fill: [number, number, number, number],
  tolerance = 32,
) {
  const w = ctx.canvas.width;
  const h = ctx.canvas.height;
  if (x < 0 || y < 0 || x >= w || y >= h) return;
  const img = ctx.getImageData(0, 0, w, h);
  const d = img.data;
  const start = (y * w + x) * 4;
  const sr = d[start],
    sg = d[start + 1],
    sb = d[start + 2],
    sa = d[start + 3];
  const [fr, fg, fb, fa] = fill;
  if (sr === fr && sg === fg && sb === fb && sa === fa) return;
  const stack: number[] = [x, y];
  const visited = new Uint8Array(w * h);
  while (stack.length) {
    const cy = stack.pop()!;
    const cx = stack.pop()!;
    if (cx < 0 || cy < 0 || cx >= w || cy >= h) continue;
    const pi = cy * w + cx;
    if (visited[pi]) continue;
    visited[pi] = 1;
    const i = pi * 4;
    const dr = d[i] - sr;
    const dg = d[i + 1] - sg;
    const db = d[i + 2] - sb;
    const da = d[i + 3] - sa;
    const diff = Math.sqrt(dr * dr + dg * dg + db * db + da * da);
    if (diff > tolerance) continue;
    d[i] = fr;
    d[i + 1] = fg;
    d[i + 2] = fb;
    d[i + 3] = fa;
    stack.push(cx + 1, cy);
    stack.push(cx - 1, cy);
    stack.push(cx, cy + 1);
    stack.push(cx, cy - 1);
  }
  ctx.putImageData(img, 0, 0);
}
