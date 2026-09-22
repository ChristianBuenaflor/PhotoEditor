export function uid() {
  return Math.random().toString(36).slice(2, 10);
}

export function clamp(v: number, a: number, b: number) {
  return Math.max(a, Math.min(b, v));
}

export function createLayerCanvas(w: number, h: number): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

export function cssFilterFor(a: {
  brightness: number;
  contrast: number;
  saturate: number;
  hueRotate: number;
  blur: number;
  invert: number;
  sepia: number;
  grayscale: number;
}) {
  return [
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
}

export function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  const n = parseInt(
    h.length === 3
      ? h
          .split('')
          .map((c) => c + c)
          .join('')
      : h,
    16,
  );
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function rgbToHex(r: number, g: number, b: number) {
  return (
    '#' +
    [r, g, b]
      .map((v) => Math.round(v).toString(16).padStart(2, '0'))
      .join('')
  );
}

export function downloadCanvas(canvas: HTMLCanvasElement, filename: string, type = 'image/png', quality = 0.92) {
  const url = canvas.toDataURL(type, quality);
  const a = document.createElement('a');
  a.download = filename;
  a.href = url;
  a.click();
}
