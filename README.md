# Turntable

A photoreal 3D device mockup studio: drop in a design screenshot, spin the device on its turntable, light the scene, and export a high-res PNG.

Inspired by [@daniel__designs' tweet](https://x.com/daniel__designs/status/2077060057791856713).

## Stack

- **Three.js** — the 3D scene (`src/scene.js`), vanilla JS, no framework. Detailed iPhone Pro, iPad Pro, and MacBook Pro assemblies include layered bezels, device controls, cameras/lenses, ports, keyboard, speakers, hinge, and trackpad. Physical metal/glass materials are lit by broad area emitters, an environment map, and a VSM shadow key.
- **GLSL studio pipeline** — a vertex/fragment augmentation gives the receiving wall a subtle physical bow, restrained grain, and edge falloff while retaining Three.js shadow chunks. A second shader supplies distance-aware contact density, and a curved cyclorama receives the real projected device shadow without a wall/floor corner.
- **Performance-aware preview** — demand-driven idle rendering, instanced MacBook keys/speaker holes, capped preview pixel density, and a lightweight live shadow pass keep manipulation responsive; exports temporarily restore higher shadow quality.
- **Generated studio plates** — three image-generated, product-photography backgrounds (Alabaster, Midnight, and Terracotta) live under `public/backgrounds/` alongside the existing procedural presets.
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
  - **Model** — iPhone Pro / iPad Pro 13″ / MacBook Pro 14″ / Browser Frame
  - **Finish** — Natural titanium / Silver / Space black / Desert
  - **Lighting** — Studio / Bright / Noir rigs
  - **Rotation** — X/Y/Z drag scrubbers in degrees (double-click to reset)
  - **Background type** — Wall / curved Cyclorama / Mirror / Transparent
  - **Background** — generated Studios, procedural Presets, Wallpapers, and solid Colors tabs
  - **Light & shadows** — shadows, float, auto-rotate, intensity
  - **Export** — 1–3× PNG; Transparent type exports with alpha
