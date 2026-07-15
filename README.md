# Turntable

A 3D device mockup tool: drop in a design screenshot, spin the device on its turntable, and export a high-res PNG.

Inspired by [@daniel__designs' tweet](https://x.com/daniel__designs/status/2077060057791856713).

## Stack

- **Three.js** — the 3D scene (`src/scene.js`), vanilla JS, no framework. Extruded rounded-slab device bodies with Dynamic Island and side buttons, a backdrop wall that catches the soft key-light shadow, canvas-generated wallpaper art, and a mirrored-clone reflection for the Mirror floor.
- **Vanilla JS panel** (`src/ui.js`) — chip groups, drag scrubbers, tabbed thumbnail pickers, toggles. No UI framework.
- **Vite** — dev server and build.

## Run

```bash
npm install
npm run dev
```

## Use

- **Drop, paste, or upload** a screenshot — it cover-fits onto the active device screen
- **Drag** to orbit, **scroll** to zoom
- Panel sections:
  - **Angle** — 12 camera + device-rotation presets (Front, Hero, Isometric, Top down, …)
  - **Model** — Phone / Tablet / Laptop / Browser Frame
  - **Lighting** — Studio / Bright / Noir rigs
  - **Rotation** — X/Y/Z drag scrubbers in degrees (double-click to reset)
  - **Background type** — Flat wall / Stage (wall + floor) / Mirror (reflective floor) / Transparent
  - **Background** — Presets, generated Wallpapers, and solid Colors tabs
  - **Light & shadows** — shadows, float, auto-rotate, intensity
  - **Export** — 1–3× PNG; Transparent type exports with alpha
