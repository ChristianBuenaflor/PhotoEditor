# Pigment

Pigment is a Photoshop-inspired raster editor built with React, TypeScript, Vite, and Zustand. It includes a multi-document workflow, layered canvas editing, transform tools, filters, adjustment controls, and browser-local image export.

## Features

- Multiple independent canvases with tab switching
- Document sessions with unsaved-state indicators
- Layer-based editing workflow
- Move tool with drag-resize handles
- Shift-constrained resizing for proportional transforms
- Brush, eraser, bucket, text, marquee, crop, and hand tools
- Zoom and pan controls with Photoshop-like scroll behavior
- Color, adjustments, and filters panels
- Drag and drop image import
- Save As dialog with PNG/JPG/WEBP export
- Default naming based on the active document tab
- Browser-local editing only, with no cloud sync required

## Tech Stack

- React 19
- TypeScript
- Vite
- Zustand
- HTML5 Canvas

## Project Structure

```bash
src/
  App.tsx
  main.tsx
  index.css
  components/
    AdjustmentsPanel.tsx
    CanvasStage.tsx
    ColorPanel.tsx
    FilterDialog.tsx
    HistoryPanel.tsx
    LayersPanel.tsx
    NewDocDialog.tsx
    OptionsBar.tsx
    PanelHeader.tsx
    StatusBar.tsx
    Toolbar.tsx
    TopBar.tsx
  lib/
    filters.ts
    types.ts
    utils.ts
  store/
    editor.ts
```

## Getting Started

### Install dependencies

```bash
npm install
```

### Run the app

```bash
npm run dev
```

The app will start in development mode and be available in the browser via the local Vite URL.

### Build for production

```bash
npm run build
```

### Preview production build

```bash
npm run preview
```

## Default Keyboard Shortcuts

- Ctrl/Cmd + Wheel: zoom in and out
- Ctrl/Cmd + T: transform/resize selected layer by dragging
- Ctrl/Cmd + Shift + S: open Save As dialog
- Ctrl/Cmd + Z: undo
- Ctrl/Cmd + Shift + Z or Ctrl/Cmd + Y: redo
- V: move tool
- B: brush
- E: eraser
- G: bucket fill
- T: text tool
- M: marquee
- C: crop
- H: hand tool

## Exporting

Use the Save As dialog to choose:

- file name
- format: PNG, JPG, or WEBP
- quality level
- transparent background option
- save location
- save as copy mode

## Notes

This project is designed as a local browser-based editor and does not currently persist files to disk beyond browser export/download actions.
