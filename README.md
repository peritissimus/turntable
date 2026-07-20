# Turntable

A photoreal 3D device mockup studio: drop in a design screenshot, spin the device on its turntable, light the scene, and export a high-res PNG.

Inspired by [@daniel__designs' tweet](https://x.com/daniel__designs/status/2077060057791856713).

## Stack

- **Three.js** — the 3D scene (`src/scene.js`), vanilla JS, no framework. Detailed iPhone Pro, iPad Pro, and MacBook Pro assemblies include layered bezels, device controls, cameras/lenses, ports, keyboard, speakers, hinge, and trackpad. Physical metal/glass materials are lit by broad area emitters, an environment map, and a VSM shadow key.
- **GLSL studio pipeline** — a vertex/fragment augmentation gives the receiving wall a subtle physical bow, restrained grain, and edge falloff while retaining Three.js shadow chunks. A second shader supplies distance-aware contact density, and a curved cyclorama receives the real projected device shadow without a wall/floor corner.
- **Performance-aware preview** — demand-driven idle rendering, instanced MacBook keys/speaker holes, capped preview pixel density, and a lightweight live shadow pass keep manipulation responsive; exports temporarily restore higher shadow quality.
- **Generated studio plates** — three image-generated, product-photography backgrounds (Alabaster, Midnight, and Terracotta) live under `public/backgrounds/` alongside the existing procedural presets.
- **Vanilla JS editor shell** (`src/ui.js`, `src/styles.css`) — command bar, collapsible inspector, accessible chip groups and drag scrubbers, responsive mobile drawer, composition presets, and a dedicated export dialog. No UI framework.
- **Editor state** (`src/state/`) — one serializable source of truth with undo/redo, debounced local settings persistence, and IndexedDB-backed source-image restoration.
- **Vite** — dev server and build.

## Run

```bash
npm install
npm run dev
```

## Use

- **Drop, paste, upload, or link to** a screenshot — direct image URLs are fetched into the project, cover-fit onto the active device screen, and restored after a refresh
- **Frame the source** with scale, horizontal, and vertical controls
- **Drag** to orbit, **scroll** to zoom
- **Undo/redo** edits with the command bar or `⌘Z` / `⇧⌘Z`
- **Start from a composition preset** without replacing the uploaded source image
- Inspector sections:
  - **Source image** — replace, clear, scale, and position the artwork
  - **Camera** — 12 composition angles plus X/Y/Z rotation
  - **Device** — iPhone Pro / iPad Pro 13″ / MacBook Pro 14″ / Browser Frame, finishes, and glare
  - **Light & environment** — Studio / Bright / Noir rigs, intensity, wall distance, shadows, float, and auto-rotate
  - **Background** — wall / cove / mirror / transparent surfaces with studio, procedural, artwork, and color libraries
  - **Export** — exact pixel dimensions, PNG / JPG / WebP, output presets, crop guide, and optional transparent canvas
