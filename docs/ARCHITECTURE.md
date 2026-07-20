# Turntable architecture

Turntable is a static Astro application with a client-side Three.js editor.

## Layers

- `src/pages/index.astro` is the route entry point.
- `src/layouts/AppLayout.astro` owns document metadata and global styles.
- `src/components/` contains the server-rendered editor shell. Components keep stable, accessible markup out of JavaScript controllers.
- `src/main.js` starts the client runtime.
- `src/ui.js` binds editor behavior to the rendered shell and builds controls whose options are driven by runtime scene data.
- `src/scene.js` owns Three.js rendering, device models, image loading, and export.
- `src/state/` owns serializable editor state and persisted source images.

## Design rules

1. Astro components own stable markup; controller code owns interaction.
2. The store is the source of truth. UI and scene code subscribe to it rather than mutating each other.
3. Three.js objects stay inside `scene.js`; serializable settings stay in the store.
4. New editor panels should use a dedicated Astro component when their markup is static, or a focused controller module when their options depend on runtime scene data.
5. Preserve element IDs used by the client runtime unless the matching controller is updated in the same change.

## Commands

- `npm run dev` starts Astro locally.
- `npm run check` validates Astro and TypeScript.
- `npm run build` checks the project and creates the static production build.
- `npm run preview` serves the production build.
