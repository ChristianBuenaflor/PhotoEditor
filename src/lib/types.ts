export type Tool =
  | 'move'
  | 'marquee-rect'
  | 'marquee-ellipse'
  | 'lasso'
  | 'wand'
  | 'crop'
  | 'eyedropper'
  | 'brush'
  | 'pencil'
  | 'eraser'
  | 'bucket'
  | 'gradient'
  | 'blur'
  | 'sharpen'
  | 'smudge'
  | 'dodge'
  | 'burn'
  | 'text'
  | 'shape-rect'
  | 'shape-ellipse'
  | 'shape-line'
  | 'hand'
  | 'zoom';

export type BlendMode =
  | 'source-over'
  | 'multiply'
  | 'screen'
  | 'overlay'
  | 'darken'
  | 'lighten'
  | 'color-dodge'
  | 'color-burn'
  | 'hard-light'
  | 'soft-light'
  | 'difference'
  | 'exclusion'
  | 'hue'
  | 'saturation'
  | 'color'
  | 'luminosity';

export interface Adjustments {
  brightness: number; // 0..200 (100 default)
  contrast: number;   // 0..200
  saturate: number;   // 0..200
  hueRotate: number;  // -180..180
  blur: number;       // 0..20 px
  invert: number;     // 0..100
  sepia: number;      // 0..100
  grayscale: number;  // 0..100
}

export const defaultAdjustments = (): Adjustments => ({
  brightness: 100,
  contrast: 100,
  saturate: 100,
  hueRotate: 0,
  blur: 0,
  invert: 0,
  sepia: 0,
  grayscale: 0,
});

export interface Layer {
  id: string;
  name: string;
  visible: boolean;
  locked: boolean;
  opacity: number; // 0..100
  blendMode: BlendMode;
  canvas: HTMLCanvasElement; // per-layer canvas, docWidth x docHeight
  x: number; // translation offset (move tool)
  y: number;
  adjustments: Adjustments;
  isBackground?: boolean;
}

export interface Selection {
  x: number;
  y: number;
  w: number;
  h: number;
  shape: 'rect' | 'ellipse';
}

export interface HistoryEntry {
  label: string;
  snapshot: string; // serialized layers state
}

export interface Document {
  width: number;
  height: number;
  background: string;
}
