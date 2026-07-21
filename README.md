# Turntable

Turntable is a browser-based 3D device mockup studio. Add a screenshot, compose it on a detailed device model, light the scene, choose a studio background, and export a high-resolution image without leaving the browser.

[Open the live studio](https://turntable-three.vercel.app)

Inspired by [@daniel__designs' concept](https://x.com/daniel__designs/status/2077060057791856713).

## Features

- Four device models: iPhone Pro, iPad Pro 13″, MacBook Pro 14″, and Browser Frame
- File upload, drag and drop, clipboard paste, and direct image URL import
- Source-image scale and horizontal/vertical framing controls
- Twelve camera presets with direct X/Y/Z rotation and scroll-to-zoom
- Natural titanium, silver, space black, and desert finishes
- Studio, bright, and noir lighting rigs with adjustable intensity
- Wall, cyclorama, mirror, and transparent scene surfaces
- Studio plates, procedural artwork, and solid-color background libraries
- Distance-aware shadows and automatic backdrop clearance for tilted devices
- Undo/redo, local project persistence, and restored source images
- PNG, JPEG, and WebP export with exact dimensions and composition presets
- Responsive desktop and mobile editor layouts

## Technology

- [Astro](https://astro.build/) renders the static application shell and reusable UI components.
- [Three.js](https://threejs.org/) powers the device geometry, materials, lighting, shadows, image textures, and export renderer.
- Vanilla JavaScript controllers connect the Astro markup to the editor store and Three.js scene.
- GLSL extensions add studio-wall grain, vignette, curvature, and soft contact shadows while retaining Three.js lighting.
- IndexedDB stores uploaded source images; local storage persists serializable editor settings and history state.

No server or database is required. The production output is a static site.

## Getting started

Requirements:

- Node.js 20 or newer
- npm

```bash
git clone git@github.com:peritissimus/turntable.git
cd turntable
npm install
npm run dev
```

The development server runs at [http://127.0.0.1:5173](http://127.0.0.1:5173).

## Commands

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start the Astro development server |
| `npm run check` | Validate Astro components and TypeScript configuration |
| `npm run build` | Run validation and create the static production build in `dist/` |
| `npm run preview` | Serve the production build locally |

## Using the editor

1. Upload, drop, paste, or link to an image.
2. Select a device and adjust the source framing.
3. Choose a camera preset or drag the device to compose a custom angle.
4. Pick the finish, lighting, background surface, and shadow treatment.
5. Open Export, select the format and dimensions, and render the final image.

Changes are saved locally. Uploaded images remain on the device and are not sent to an application server. Importing a remote image URL still depends on that image host allowing cross-origin access.

## Project structure

```text
src/
├── components/       Astro editor-shell components
├── layouts/          Document metadata and global layout
├── lib/              Shared UI assets such as icons
├── pages/            Astro routes
├── state/            Editor store and persisted source images
├── main.js           Client runtime entry point
├── scene.js          Three.js scene, models, rendering, and export
├── styles.css        Global editor and responsive styles
└── ui.js             Editor controls and store bindings

public/backgrounds/   Generated studio background plates
docs/ARCHITECTURE.md  Architectural boundaries and contribution rules
```

For implementation boundaries and design rules, see [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## Rendering notes

The preview renderer is demand-driven when idle, caps preview pixel density, and uses instanced MacBook keys and speaker holes. Export temporarily raises render and shadow quality. Device rotation also recalculates backdrop depth so tilted geometry stays in front of the wall without changing camera framing.
