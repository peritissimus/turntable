import * as THREE from "three";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { DRACOLoader } from "three/addons/loaders/DRACOLoader.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

const PANEL_W = 408;
const PREVIEW_PIXEL_RATIO = Math.min(devicePixelRatio, 1.5);
const PREVIEW_SHADOW_SIZE = 2048;
const EXPORT_SHADOW_SIZE = 4096;
let exportAspect = null; // width/height crop, null = full canvas

// ---------- renderer / scene ----------
const stage = document.getElementById("stage");
const deviceLoader = document.getElementById("deviceLoader");
const deviceLoaderTitle = document.getElementById("deviceLoaderTitle");
const deviceLoaderDetail = document.getElementById("deviceLoaderDetail");
let deviceLoaderEpoch = 0;
let deviceLoaderShownAt = 0;

function showDeviceLoader(modelName) {
  const label = modelName === "laptop" ? "MacBook" : "iPhone";
  deviceLoaderEpoch += 1;
  deviceLoaderShownAt = performance.now();
  deviceLoader.hidden = false;
  deviceLoader.classList.remove("is-leaving");
  deviceLoaderTitle.textContent = `Preparing ${label}`;
  deviceLoaderDetail.textContent = "Loading detailed 3D model";
  stage.setAttribute("aria-busy", "true");
}

function hideDeviceLoader(onReveal) {
  if (deviceLoader.hidden) {
    onReveal?.();
    return;
  }
  const epoch = ++deviceLoaderEpoch;
  const minimumDisplayDelay = Math.max(0, 520 - (performance.now() - deviceLoaderShownAt));
  window.setTimeout(() => {
    if (epoch !== deviceLoaderEpoch) return;
    onReveal?.();
    deviceLoader.classList.add("is-leaving");
    stage.setAttribute("aria-busy", "false");
    window.setTimeout(() => {
      if (epoch !== deviceLoaderEpoch) return;
      deviceLoader.hidden = true;
      deviceLoader.classList.remove("is-leaving");
    }, 190);
  }, minimumDisplayDelay);
}

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setPixelRatio(PREVIEW_PIXEL_RATIO);
renderer.shadowMap.enabled = true;
renderer.shadowMap.autoUpdate = false;
// VSM gives the wall shadow a broad, controllable penumbra. The map only
// refreshes while the composition changes, so we can afford a denser map
// than a typical continuously animated scene.
renderer.shadowMap.type = THREE.VSMShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.04;
renderer.outputColorSpace = THREE.SRGBColorSpace;
stage.appendChild(renderer.domElement);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 120);
let forceShadowRefresh = true;
let renderDirty = true;

function markRenderDirty() {
  renderDirty = true;
}

function markShadowDirty() {
  forceShadowRefresh = true;
  renderDirty = true;
}

// image-based lighting: without an environment the metal frame has
// nothing to reflect and reads as dead plastic
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
pmrem.dispose();

function layout() {
  const w = innerWidth, h = innerHeight;
  renderer.setSize(w, h);
  camera.aspect = w / h;
  // keep the device centered in the area left of the panel — except
  // when a crop guide is up, where preview must match the export frame
  if (w > 760 && !exportAspect) camera.setViewOffset(w, h, PANEL_W / 2, 0, w, h);
  else camera.clearViewOffset();
  camera.updateProjectionMatrix();
  markRenderDirty();
}
layout();
window.addEventListener("resize", layout);

// ---------- lights ----------
const hemi = new THREE.HemisphereLight(0xcdd3ff, 0x2b2620, 0.9);
scene.add(hemi);

const key = new THREE.DirectionalLight(0xffffff, 2.2);
key.position.set(3.2, 5.8, 8.5);
key.target.position.set(0, 1.85, 0);
const shadowRay = new THREE.Vector3();
key.castShadow = true;
key.shadow.mapSize.set(PREVIEW_SHADOW_SIZE, PREVIEW_SHADOW_SIZE);
key.shadow.camera.left = -5.25;
key.shadow.camera.right = 5.25;
key.shadow.camera.top = 6;
key.shadow.camera.bottom = -3;
key.shadow.camera.near = 0.5;
key.shadow.camera.far = 32;
key.shadow.blurSamples = 12;
key.shadow.bias = -0.00008;
key.shadow.normalBias = 0.004;
scene.add(key);
scene.add(key.target);

const rim = new THREE.DirectionalLight(0xd9a441, 0.8);
rim.position.set(-5, 3, -4);
scene.add(rim);

// Broad, physical emitters give the polished edges something convincing to
// reflect. The directional light remains the shadow caster; these act like
// the large softboxes used in a real product studio.
const softbox = new THREE.RectAreaLight(0xffffff, 3.6, 4.8, 5.5);
softbox.position.set(3.8, 5.5, 6.5);
softbox.lookAt(0, 1.7, 0);
scene.add(softbox);

const edgeStrip = new THREE.RectAreaLight(0x9fc4ff, 2.2, 1.1, 5.8);
edgeStrip.position.set(-4.5, 2.8, 2.2);
edgeStrip.lookAt(0, 1.8, 0);
scene.add(edgeStrip);

const LIGHTING = {
  studio: {
    key: { intensity: 2.2, color: 0xffffff, pos: [3.2, 5.8, 8.5] },
    hemi: 0.9,
    rim: { intensity: 0.8, color: 0xd9a441, pos: [-5, 3, -4] },
    softbox: { intensity: 3.6, color: 0xffffff },
    edge: { intensity: 2.2, color: 0x9fc4ff },
    env: 0.45,
  },
  bright: {
    key: { intensity: 3.4, color: 0xffffff, pos: [2.4, 7.5, 10] },
    hemi: 1.7,
    rim: { intensity: 1.3, color: 0xffffff, pos: [-6, 4, -2] },
    softbox: { intensity: 5.2, color: 0xffffff },
    edge: { intensity: 2.8, color: 0xe2edff },
    env: 0.85,
  },
  noir: {
    key: { intensity: 1.7, color: 0xc9d4f2, pos: [-4.5, 4.5, 7] },
    hemi: 0.18,
    rim: { intensity: 1.8, color: 0x8fa8ff, pos: [6, 2, -3] },
    softbox: { intensity: 1.4, color: 0xb9c8e8 },
    edge: { intensity: 3.8, color: 0x708cff },
    env: 0.12,
  },
};

let lightingName = "studio";
let lightMult = 1;
let keyLightControls = {
  x: 0,
  y: 0,
  z: 0,
  strength: 1,
  softness: 1,
  shadowDensity: 1,
};

function applyLighting() {
  const L = LIGHTING[lightingName];
  key.intensity = L.key.intensity * lightMult * keyLightControls.strength;
  key.color.set(L.key.color);
  key.position.set(
    L.key.pos[0] + keyLightControls.x,
    L.key.pos[1] + keyLightControls.y,
    L.key.pos[2] + keyLightControls.z,
  );
  hemi.intensity = L.hemi * lightMult;
  rim.intensity = L.rim.intensity * lightMult;
  rim.color.set(L.rim.color);
  rim.position.set(...L.rim.pos);
  softbox.intensity = L.softbox.intensity * lightMult;
  softbox.color.set(L.softbox.color);
  edgeStrip.intensity = L.edge.intensity * lightMult;
  edgeStrip.color.set(L.edge.color);
  scene.environmentIntensity = L.env * lightMult;
  markShadowDirty();
}
applyLighting();

// ---------- wall + floor ----------
const studioUniforms = {
  grain: { value: 0.018 },
  vignette: { value: 0.15 },
};

const wallMat = new THREE.MeshStandardMaterial({ roughness: 0.96, metalness: 0 });
// Keep the material in Three's physically based pipeline so it receives real
// VSM shadows, then augment that pipeline with a small GLSL studio pass. The
// vertex shader gently bows the outer backdrop; the fragment shader adds
// sub-pixel grain and a lens-like edge falloff without baking either into the
// generated background plates.
wallMat.onBeforeCompile = (shader) => {
  shader.uniforms.uStudioGrain = studioUniforms.grain;
  shader.uniforms.uStudioVignette = studioUniforms.vignette;
  shader.vertexShader = shader.vertexShader
    .replace("#include <common>", `#include <common>\nvarying vec2 vStudioUv;`)
    .replace("#include <uv_vertex>", `#include <uv_vertex>\nvStudioUv = uv;`)
    .replace("#include <begin_vertex>", `
      #include <begin_vertex>
      float studioEdge = pow(abs(uv.x - 0.5) * 2.0, 3.0);
      transformed.z -= studioEdge * 0.065;
    `);
  shader.fragmentShader = shader.fragmentShader
    .replace("#include <common>", `
      #include <common>
      varying vec2 vStudioUv;
      uniform float uStudioGrain;
      uniform float uStudioVignette;
      float studioHash(vec2 p) {
        p = fract(p * vec2(123.34, 456.21));
        p += dot(p, p + 45.32);
        return fract(p.x * p.y);
      }
    `)
    .replace("#include <map_fragment>", `
      #include <map_fragment>
      float edgeFalloff = smoothstep(0.28, 0.78, distance(vStudioUv, vec2(0.5, 0.48)));
      float grain = studioHash(gl_FragCoord.xy) - 0.5;
      diffuseColor.rgb *= 1.0 - edgeFalloff * uStudioVignette;
      diffuseColor.rgb += grain * uStudioGrain;
    `);
};
wallMat.customProgramCacheKey = () => "studio-wall-v2";

const wall = new THREE.Mesh(new THREE.PlaneGeometry(90, 45, 48, 1), wallMat);
wall.position.set(0, 10, -1.0);
wall.receiveShadow = true;
scene.add(wall);

let currentWallGap = 1;
let renderedWallGap = 1;
let backgroundType = "flat";
let shadowsEnabled = true;

// Parallel-planes penumbra estimate (Fernando 2005 / PCSS):
//   wPenumbra = (dReceiver - dBlocker) * wLight / dBlocker
// Three's VSM radius is measured in shadow-map pixels, so convert the
// estimated world-space width through the directional shadow camera.
function tuneWallShadow(gap) {
  shadowRay.subVectors(key.target.position, key.position).normalize();
  const wallNormalComponent = Math.max(Math.abs(shadowRay.z), 0.0001);
  const blockerToReceiver = gap / wallNormalComponent;
  const lightToBlocker = Math.max(key.position.distanceTo(key.target.position), 0.0001);
  const penumbraWidth = blockerToReceiver * keyLightControls.softness / lightToBlocker;
  const shadowWidth = key.shadow.camera.right - key.shadow.camera.left;
  const shadowHeight = key.shadow.camera.top - key.shadow.camera.bottom;
  const texelWorldSize = Math.sqrt(shadowWidth * shadowHeight)
    / Math.sqrt(key.shadow.mapSize.x * key.shadow.mapSize.y);
  const radiusPixels = penumbraWidth / Math.max(2 * texelWorldSize, 0.0001);

  key.shadow.radius = THREE.MathUtils.clamp(radiusPixels, 0.75, 48);
  // VSM filtering already reduces the coverage of thin silhouettes as the
  // physical kernel widens. This remains only an artistic upper-limit trim.
  key.shadow.intensity = THREE.MathUtils.clamp(keyLightControls.shadowDensity, 0.05, 1);
  return penumbraWidth;
}

export function setWallGap(g) {
  currentWallGap = g;
  wall.position.z = -g;
  cove.position.z = -g;
  tuneWallShadow(g);
  markShadowDirty();
}

const floorMat = new THREE.MeshStandardMaterial({ color: 0xcfcac2, roughness: 0.9, metalness: 0 });
const floor = new THREE.Mesh(new THREE.PlaneGeometry(90, 46), floorMat);
floor.rotation.x = -Math.PI / 2;
floor.position.z = 20;
floor.receiveShadow = true;
scene.add(floor);

const coveMat = floorMat.clone();
coveMat.transparent = true;
coveMat.depthWrite = false;
coveMat.onBeforeCompile = (shader) => {
  shader.vertexShader = shader.vertexShader
    .replace("#include <common>", `#include <common>\nvarying vec2 vCoveUv;`)
    .replace("#include <uv_vertex>", `#include <uv_vertex>\nvCoveUv = uv;`);
  shader.fragmentShader = shader.fragmentShader
    .replace("#include <common>", `#include <common>\nvarying vec2 vCoveUv;`)
    .replace("#include <map_fragment>", `
      #include <map_fragment>
      diffuseColor.a *= 1.0 - smoothstep(0.62, 1.0, vCoveUv.y);
    `);
};
coveMat.customProgramCacheKey = () => "studio-cove-v1";

function coveGeometry(width = 90, radius = 0.82, segments = 32) {
  const geometry = new THREE.PlaneGeometry(width, radius, 1, segments);
  const pos = geometry.attributes.position;
  const uv = geometry.attributes.uv;
  for (let i = 0; i < pos.count; i++) {
    // uv.y = 1 is the vertical wall tangent; uv.y = 0 is the horizontal
    // floor tangent. The quarter-circle removes the visible studio seam.
    const t = (1 - uv.getY(i)) * Math.PI * 0.5;
    pos.setY(i, radius * (1 - Math.sin(t)));
    pos.setZ(i, radius * (1 - Math.cos(t)));
  }
  pos.needsUpdate = true;
  geometry.computeVertexNormals();
  return geometry;
}

const cove = new THREE.Mesh(coveGeometry(), coveMat);
cove.position.z = -1;
cove.receiveShadow = true;
cove.visible = false;
scene.add(cove);
setWallGap(1);

// ---------- geometry helpers ----------
function roundedRect(w, h, r) {
  const s = new THREE.Shape();
  const x = -w / 2, y = -h / 2;
  s.moveTo(x + r, y);
  s.lineTo(x + w - r, y);
  s.quadraticCurveTo(x + w, y, x + w, y + r);
  s.lineTo(x + w, y + h - r);
  s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  s.lineTo(x + r, y + h);
  s.quadraticCurveTo(x, y + h, x, y + h - r);
  s.lineTo(x, y + r);
  s.quadraticCurveTo(x, y, x + r, y);
  return s;
}

function slabGeo(w, h, d, r) {
  const g = new THREE.ExtrudeGeometry(roundedRect(w, h, r), {
    depth: d,
    bevelEnabled: true,
    bevelThickness: d * 0.18,
    bevelSize: d * 0.18,
    bevelSegments: 3,
    curveSegments: 16,
  });
  g.center();
  return g;
}

function screenGeo(w, h, r) {
  const g = new THREE.ShapeGeometry(roundedRect(w, h, r), 16);
  const uv = g.attributes.uv;
  for (let i = 0; i < uv.count; i++) {
    uv.setXY(i, uv.getX(i) / w + 0.5, uv.getY(i) / h + 0.5);
  }
  uv.needsUpdate = true;
  return g;
}

// ---------- canvas art ----------
function vGrad(g, w, h, top, bottom) {
  const grad = g.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0, top);
  grad.addColorStop(1, bottom);
  g.fillStyle = grad;
  g.fillRect(0, 0, w, h);
}

// studio wall finish: a soft light pool behind the device (vignette)
// plus film grain, which also kills gradient banding
function studioFinish(g, w, h) {
  const v = g.createRadialGradient(w / 2, h * 0.42, Math.min(w, h) * 0.22, w / 2, h * 0.42, Math.max(w, h) * 0.78);
  v.addColorStop(0, "rgba(0,0,0,0)");
  v.addColorStop(1, "rgba(0,0,0,0.32)");
  g.fillStyle = v;
  g.fillRect(0, 0, w, h);
  const img = g.getImageData(0, 0, w, h);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const n = (Math.random() - 0.5) * 9;
    d[i] += n;
    d[i + 1] += n;
    d[i + 2] += n;
  }
  g.putImageData(img, 0, 0);
}

function blob(g, w, h, cx, cy, cr, color, alpha) {
  const grad = g.createRadialGradient(cx * w, cy * h, 0, cx * w, cy * h, cr * w);
  grad.addColorStop(0, color);
  grad.addColorStop(1, color + "00");
  g.globalAlpha = alpha;
  g.fillStyle = grad;
  g.fillRect(0, 0, w, h);
  g.globalAlpha = 1;
}

// each background draws onto an arbitrary-size canvas so the same
// function makes both the wall texture and the panel thumbnail
const BACKGROUNDS = {
  studios: [
    {
      name: "Alabaster",
      floor: "#c8bca9",
      src: "/backgrounds/studio-alabaster.png",
    },
    {
      name: "Midnight",
      floor: "#070b18",
      src: "/backgrounds/studio-midnight.png",
    },
    {
      name: "Terracotta",
      floor: "#7c4339",
      src: "/backgrounds/studio-terracotta.png",
    },
  ],
  presets: [
    { name: "Graphite", floor: "#141417", draw: (g, w, h) => vGrad(g, w, h, "#2c2c34", "#101014") },
    { name: "Bone", floor: "#b9b2a4", draw: (g, w, h) => vGrad(g, w, h, "#f1eee7", "#c9c3b6") },
    { name: "Moss", floor: "#161d15", draw: (g, w, h) => vGrad(g, w, h, "#46543f", "#181f17") },
    { name: "Plum", floor: "#120e1b", draw: (g, w, h) => vGrad(g, w, h, "#52415c", "#151020") },
    { name: "Brass", floor: "#6e4b16", draw: (g, w, h) => vGrad(g, w, h, "#e2b565", "#8a5f1e") },
  ],
  wallpapers: [
    {
      name: "Meadow", floor: "#b9c2ae",
      draw: (g, w, h) => {
        vGrad(g, w, h, "#e6e0d4", "#d8d2c6");
        blob(g, w, h, 0.08, 0.18, 0.42, "#7ec3ea", 0.95);
        blob(g, w, h, 0.16, 0.62, 0.36, "#b7a7dd", 0.85);
        blob(g, w, h, 0.3, 0.98, 0.44, "#7cc98b", 0.9);
        blob(g, w, h, 0.9, 0.3, 0.5, "#f2d9c6", 0.8);
      },
    },
    {
      name: "Dawn", floor: "#2c2340",
      draw: (g, w, h) => {
        vGrad(g, w, h, "#33306b", "#191631");
        blob(g, w, h, 0.75, 0.2, 0.5, "#f2a65e", 0.8);
        blob(g, w, h, 0.35, 0.55, 0.45, "#d96a8b", 0.75);
        blob(g, w, h, 0.1, 0.9, 0.4, "#5b4a9e", 0.9);
      },
    },
    {
      name: "Aurora", floor: "#0c1517",
      draw: (g, w, h) => {
        vGrad(g, w, h, "#0e2224", "#080d12");
        blob(g, w, h, 0.25, 0.25, 0.45, "#2fbf9a", 0.75);
        blob(g, w, h, 0.7, 0.5, 0.5, "#3a6fd8", 0.6);
        blob(g, w, h, 0.5, 0.9, 0.4, "#7a4fd0", 0.55);
      },
    },
    {
      name: "Sorbet", floor: "#d6a9a4",
      draw: (g, w, h) => {
        vGrad(g, w, h, "#f7e8e0", "#efd3cc");
        blob(g, w, h, 0.2, 0.3, 0.45, "#f6a5b8", 0.85);
        blob(g, w, h, 0.8, 0.65, 0.5, "#f8c98e", 0.8);
        blob(g, w, h, 0.55, 0.05, 0.35, "#c9b6f0", 0.7);
      },
    },
    {
      name: "Ocean", floor: "#0e2233",
      draw: (g, w, h) => {
        vGrad(g, w, h, "#15466b", "#0a1d30");
        blob(g, w, h, 0.3, 0.2, 0.5, "#3d9fd6", 0.8);
        blob(g, w, h, 0.85, 0.7, 0.5, "#1f6f9e", 0.85);
        blob(g, w, h, 0.1, 0.85, 0.4, "#67c5e8", 0.5);
      },
    },
    {
      name: "Ink", floor: "#101013",
      draw: (g, w, h) => {
        vGrad(g, w, h, "#232327", "#0c0c0f");
        blob(g, w, h, 0.75, 0.25, 0.5, "#4a4a52", 0.9);
        blob(g, w, h, 0.2, 0.8, 0.45, "#333338", 0.9);
      },
    },
  ],
  colors: [
    { name: "White", hex: "#f4f2ee" },
    { name: "Sand", hex: "#e3dccb" },
    { name: "Sage", hex: "#b7c2ad" },
    { name: "Sky", hex: "#a9c8de" },
    { name: "Rose", hex: "#d9b3b6" },
    { name: "Slate", hex: "#5c626e" },
    { name: "Charcoal", hex: "#26262b" },
    { name: "Black", hex: "#0d0d0f" },
  ],
};

function drawToTexture(draw, w, h) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  draw(c.getContext("2d"), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function thumbFor(tab, i) {
  if (tab === "studios") return BACKGROUNDS.studios[i].src;
  const c = document.createElement("canvas");
  c.width = 112;
  c.height = 70;
  const g = c.getContext("2d");
  const item = BACKGROUNDS[tab][i];
  if (tab === "colors") {
    g.fillStyle = item.hex;
    g.fillRect(0, 0, 112, 70);
  } else {
    item.draw(g, 112, 70);
  }
  return c.toDataURL();
}

export const backgroundNames = {
  studios: BACKGROUNDS.studios.map((b) => b.name),
  presets: BACKGROUNDS.presets.map((b) => b.name),
  wallpapers: BACKGROUNDS.wallpapers.map((b) => b.name),
  colors: BACKGROUNDS.colors.map((b) => b.name),
};

const wallTexCache = {};
const wallTextureLoader = new THREE.TextureLoader();
let bgRequest = 0;
let bgSel = { tab: "studios", index: 0 };

function configureWallTexture(t) {
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = renderer.capabilities.getMaxAnisotropy();
  t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
  // The central 20 × 12.5 world-unit window maps to the complete plate.
  // Beyond it, clamped pixels extend quietly across the overscan wall.
  const u0 = 0.5 - 10 / 90, uw = 20 / 90;
  const v0 = (2.2 - 6.25 + 12.5) / 45, vw = 12.5 / 45;
  t.repeat.set(1 / uw, 1 / vw);
  t.offset.set(-u0 / uw, -v0 / vw);
  t.needsUpdate = true;
  return t;
}

function applyWallTexture(t) {
  wallMat.map = t;
  wallMat.color.set(0xffffff);
  wallMat.needsUpdate = true;
  markRenderDirty();
}

function syncCoveColor() {
  coveMat.color.copy(floorMat.color);
  markRenderDirty();
}

export function setBackground(tab, index) {
  bgSel = { tab, index };
  const item = BACKGROUNDS[tab][index];
  const k = tab + index;
  const request = ++bgRequest;

  if (tab === "studios") {
    studioUniforms.grain.value = 0.009;
    studioUniforms.vignette.value = 0.08;
    floorMat.color.set(item.floor);
    syncCoveColor();
    if (wallTexCache[k]) {
      applyWallTexture(wallTexCache[k]);
      return;
    }
    wallTextureLoader.load(item.src, (texture) => {
      wallTexCache[k] = configureWallTexture(texture);
      if (request === bgRequest) applyWallTexture(wallTexCache[k]);
    });
    return;
  }

  studioUniforms.grain.value = 0.018;
  studioUniforms.vignette.value = 0.15;
  if (!wallTexCache[k]) {
    const art = tab === "colors"
      ? (g, w, h) => { g.fillStyle = item.hex; g.fillRect(0, 0, w, h); }
      : item.draw;
    const t = drawToTexture((g, w, h) => { art(g, w, h); studioFinish(g, w, h); }, 1024, 640);
    // show the full artwork in a ~20x12.5 world-unit window around the
    // device; clamped edges extend outward across the rest of the wall.
    // uv_tex = uv_wall * repeat + offset, so repeat = 1/window, and the
    // window in wall-uv space is u 0.389..0.611, v 0.188..0.466
    wallTexCache[k] = configureWallTexture(t);
  }
  applyWallTexture(wallTexCache[k]);
  if (tab === "colors") floorMat.color.set(item.hex).multiplyScalar(0.82);
  else floorMat.color.set(item.floor);
  syncCoveColor();
}

export function setBackgroundType(type) {
  backgroundType = type;
  wall.visible = type !== "transparent";
  floor.visible = type === "stage" || type === "mirror";
  cove.visible = type === "stage";
  if (type === "mirror") {
    floorMat.roughness = 0.14;
    floorMat.metalness = 0.55;
    // let the mirrored clone below the floor show through: the floor
    // must neither hide it via alpha nor occlude it via the depth buffer
    floorMat.transparent = true;
    floorMat.opacity = 0.3;
    floorMat.depthWrite = false;
  } else {
    floorMat.roughness = 0.9;
    floorMat.metalness = 0;
    floorMat.transparent = false;
    floorMat.opacity = 1;
    floorMat.depthWrite = true;
  }
  floorMat.needsUpdate = true;
  mirrorRoot.visible = type === "mirror";
  markShadowDirty();
}

// ---------- materials ----------
const bodyMat = new THREE.MeshPhysicalMaterial({
  color: 0x8c8a84,
  metalness: 0.96,
  roughness: 0.24,
  clearcoat: 0.48,
  clearcoatRoughness: 0.18,
  sheen: 0.08,
  sheenRoughness: 0.35,
});
const darkMat = new THREE.MeshPhysicalMaterial({
  color: 0x07080a,
  metalness: 0.25,
  roughness: 0.3,
  clearcoat: 0.78,
  clearcoatRoughness: 0.12,
});
const keyMat = new THREE.MeshStandardMaterial({ color: 0x141518, metalness: 0.15, roughness: 0.62 });
const lensMat = new THREE.MeshPhysicalMaterial({
  color: 0x08121f,
  metalness: 0.35,
  roughness: 0.12,
  clearcoat: 1,
  clearcoatRoughness: 0.04,
  iridescence: 0.38,
  iridescenceIOR: 1.55,
  iridescenceThicknessRange: [120, 360],
});
const detailMat = new THREE.MeshStandardMaterial({ color: 0x1b1c1f, metalness: 0.45, roughness: 0.42 });
const trackpadMat = new THREE.MeshPhysicalMaterial({ color: 0x777873, metalness: 0.82, roughness: 0.3, clearcoat: 0.22 });
const flashMat = new THREE.MeshBasicMaterial({ color: 0xfff4d8, toneMapped: false });

function defaultScreen(g, w, h) {
  vGrad(g, w, h, "#5f9de0", "#eef0f4");
  // glossy spheres, iOS-wallpaper style
  const s1 = g.createRadialGradient(w * 0.42, h * 0.3, w * 0.04, w * 0.5, h * 0.34, w * 0.36);
  s1.addColorStop(0, "#f4f8fd");
  s1.addColorStop(0.55, "#a9c6ee");
  s1.addColorStop(1, "#4a72cc");
  g.fillStyle = s1;
  g.beginPath();
  g.arc(w * 0.5, h * 0.34, w * 0.34, 0, Math.PI * 2);
  g.fill();
  const s2 = g.createRadialGradient(w * 0.46, h * 0.52, w * 0.03, w * 0.52, h * 0.56, w * 0.3);
  s2.addColorStop(0, "#e8ddf2cc");
  s2.addColorStop(0.6, "#b9a6d9aa");
  s2.addColorStop(1, "#7d6bb066");
  g.fillStyle = s2;
  g.beginPath();
  g.arc(w * 0.52, h * 0.56, w * 0.29, 0, Math.PI * 2);
  g.fill();
}

const defaultScreenTexture = drawToTexture(defaultScreen, 1000, 2000);
let current = {
  tex: defaultScreenTexture,
  aspect: 0.5,
};
let sourceTransform = { scale: 1, x: 0, y: 0 };
let sourcePreviewUrl = defaultScreenTexture.image.toDataURL("image/png");
let sourceHook = null;
const screenMat = new THREE.MeshBasicMaterial({ map: current.tex, toneMapped: false });
const mirrorScreenMat = new THREE.MeshBasicMaterial({
  map: current.tex,
  toneMapped: false,
  transparent: true,
  opacity: 0.5,
  side: THREE.DoubleSide,
});

const mirrorBodyMat = bodyMat.clone();
const mirrorDarkMat = darkMat.clone();
[mirrorBodyMat, mirrorDarkMat].forEach((m) => {
  m.transparent = true;
  m.opacity = 0.45;
  m.side = THREE.DoubleSide;
});

// glass: a faint diagonal light sweep floating just above the screen
function glareTexture() {
  const c = document.createElement("canvas");
  c.width = 512;
  c.height = 1024;
  const g = c.getContext("2d");
  const grad = g.createLinearGradient(0, 1024, 512, 0);
  grad.addColorStop(0.38, "rgba(255,255,255,0)");
  grad.addColorStop(0.46, "rgba(255,255,255,0.30)");
  grad.addColorStop(0.52, "rgba(255,255,255,0.05)");
  grad.addColorStop(0.6, "rgba(255,255,255,0.2)");
  grad.addColorStop(0.68, "rgba(255,255,255,0)");
  g.fillStyle = grad;
  g.fillRect(0, 0, 512, 1024);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

const glareMat = new THREE.MeshBasicMaterial({
  map: glareTexture(),
  transparent: true,
  opacity: 0.35,
  blending: THREE.AdditiveBlending,
  toneMapped: false,
  depthWrite: false,
});
const glareMeshes = [];

export function setGlare(on) {
  glareMeshes.forEach((m) => { m.visible = on; });
  markRenderDirty();
}

function fitCover() {
  const t = current.tex;
  const imgA = current.aspect;
  const scrA = devices[activeDevice].aspect;
  const scale = THREE.MathUtils.clamp(sourceTransform.scale, 1, 3);
  t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
  let repeatX;
  let repeatY;
  if (imgA > scrA) {
    repeatX = scrA / imgA;
    repeatY = 1;
  } else {
    repeatX = 1;
    repeatY = imgA / scrA;
  }
  repeatX /= scale;
  repeatY /= scale;
  const roomX = 1 - repeatX;
  const roomY = 1 - repeatY;
  t.repeat.set(repeatX, repeatY);
  t.offset.set(
    roomX * (0.5 + THREE.MathUtils.clamp(sourceTransform.x, -1, 1) * 0.5),
    roomY * (0.5 + THREE.MathUtils.clamp(sourceTransform.y, -1, 1) * 0.5),
  );
  t.needsUpdate = true;
  markRenderDirty();
}

export function setSourceTransform(transform) {
  sourceTransform = {
    scale: transform.scale ?? sourceTransform.scale,
    x: transform.x ?? sourceTransform.x,
    y: transform.y ?? sourceTransform.y,
  };
  fitCover();
}

export function onSourceChange(fn) {
  sourceHook = fn;
}

export function getSourcePreview() {
  return sourcePreviewUrl;
}

// ---------- devices ----------
function shadowed(mesh) {
  mesh.castShadow = true;
  return mesh;
}

function roundedPart(w, h, d, r, material) {
  return new THREE.Mesh(slabGeo(w, h, d, r), material);
}

function addFrontGlass(group, w, h, r, mats, z) {
  const scr = new THREE.Mesh(screenGeo(w, h, r), mats.screen);
  scr.position.z = z;
  group.add(scr);
  if (mats.glare) {
    const gl = new THREE.Mesh(screenGeo(w, h, r), mats.glare);
    gl.position.z = z + 0.004;
    group.add(gl);
    glareMeshes.push(gl);
  }
  return scr;
}

function addSideButton(group, x, y, w, h, depth, material) {
  const b = roundedPart(w, h, depth, Math.min(w, h) * 0.45, material);
  b.position.set(x, y, 0.005);
  b.castShadow = true;
  group.add(b);
}

function addCameraLens(group, x, y, z, radius, mats) {
  const ring = new THREE.Mesh(new THREE.CylinderGeometry(radius * 1.18, radius * 1.18, 0.035, 32), mats.body);
  ring.rotation.x = Math.PI / 2;
  ring.position.set(x, y, z);
  ring.castShadow = true;
  group.add(ring);
  const glass = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, 0.042, 32), mats.lens);
  glass.rotation.x = Math.PI / 2;
  glass.position.set(x, y, z - 0.026);
  group.add(glass);
}

function buildPhone(mats) {
  const g = new THREE.Group();
  const bodyW = 1.43, bodyH = 3.0;
  g.add(shadowed(roundedPart(bodyW, bodyH, 0.125, 0.245, mats.body)));

  // A separate polished black bezel gives the glass a believable layered
  // edge when the phone is turned away from a perfectly frontal view.
  const bezel = roundedPart(1.39, 2.96, 0.024, 0.225, mats.dark);
  bezel.position.z = 0.07;
  g.add(bezel);
  addFrontGlass(g, 1.365, 2.925, 0.205, mats, 0.095);

  const island = roundedPart(0.39, 0.112, 0.012, 0.055, mats.dark);
  island.position.set(0, 1.305, 0.104);
  g.add(island);
  const islandLens = new THREE.Mesh(new THREE.CircleGeometry(0.022, 20), mats.lens);
  islandLens.position.set(0.115, 1.305, 0.112);
  g.add(islandLens);

  // Action, volume, power and camera-control buttons use real rounded solids.
  addSideButton(g, -0.732, 1.06, 0.035, 0.14, 0.055, mats.body);
  addSideButton(g, -0.732, 0.79, 0.035, 0.25, 0.055, mats.body);
  addSideButton(g, -0.732, 0.47, 0.035, 0.25, 0.055, mats.body);
  addSideButton(g, 0.732, 0.73, 0.035, 0.34, 0.055, mats.body);
  addSideButton(g, 0.732, -0.72, 0.035, 0.22, 0.055, mats.body);

  // Back camera plateau and three optically coated lenses remain convincing
  // when users orbit all the way around the model.
  const bump = roundedPart(0.58, 0.61, 0.055, 0.15, mats.body);
  bump.position.set(-0.38, 1.01, -0.082);
  bump.castShadow = true;
  g.add(bump);
  addCameraLens(g, -0.50, 1.17, -0.122, 0.118, mats);
  addCameraLens(g, -0.25, 1.17, -0.122, 0.118, mats);
  addCameraLens(g, -0.50, 0.90, -0.122, 0.118, mats);
  const flash = new THREE.Mesh(new THREE.CircleGeometry(0.052, 24), mats.flash);
  flash.position.set(-0.25, 0.91, -0.154);
  flash.rotation.y = Math.PI;
  g.add(flash);

  // USB-C and the paired speaker/microphone perforations.
  const port = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.022, 0.052), mats.dark);
  port.position.set(0, -1.505, 0);
  g.add(port);
  for (const side of [-1, 1]) {
    for (let i = 0; i < 4; i++) {
      const hole = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.022, 12), mats.dark);
      hole.position.set(side * (0.28 + i * 0.065), -1.508, 0);
      g.add(hole);
    }
  }
  g.position.y = 1.85;
  return { group: g, aspect: 1.365 / 2.925 };
}

function buildTablet(mats) {
  const g = new THREE.Group();
  g.add(shadowed(roundedPart(2.52, 3.36, 0.09, 0.15, mats.body)));
  const bezel = roundedPart(2.47, 3.31, 0.018, 0.135, mats.dark);
  bezel.position.z = 0.052;
  g.add(bezel);
  addFrontGlass(g, 2.41, 3.23, 0.095, mats, 0.071);

  const frontCamera = new THREE.Mesh(new THREE.CircleGeometry(0.025, 20), mats.lens);
  frontCamera.position.set(0, 1.605, 0.08);
  g.add(frontCamera);
  addSideButton(g, 1.276, 1.22, 0.035, 0.3, 0.045, mats.body);
  addSideButton(g, 1.276, 0.87, 0.035, 0.25, 0.045, mats.body);
  addSideButton(g, 0.94, 1.706, 0.28, 0.025, 0.045, mats.body);

  const cameraPlate = roundedPart(0.32, 0.34, 0.045, 0.09, mats.body);
  cameraPlate.position.set(-0.95, 1.42, -0.065);
  cameraPlate.castShadow = true;
  g.add(cameraPlate);
  addCameraLens(g, -0.95, 1.43, -0.095, 0.09, mats);
  const lidar = new THREE.Mesh(new THREE.CircleGeometry(0.035, 18), mats.dark);
  lidar.position.set(-0.85, 1.31, -0.126);
  lidar.rotation.y = Math.PI;
  g.add(lidar);
  g.position.y = 1.85;
  return { group: g, aspect: 2.41 / 3.23 };
}

function buildLaptop(mats) {
  const g = new THREE.Group();
  const lid = new THREE.Group();
  const lidBody = shadowed(roundedPart(4.22, 2.72, 0.085, 0.13, mats.body));
  lidBody.position.y = 1.36;
  lid.add(lidBody);
  const displayBezel = roundedPart(4.15, 2.65, 0.024, 0.095, mats.dark);
  displayBezel.position.set(0, 1.36, 0.055);
  lid.add(displayBezel);
  const scr = addFrontGlass(lid, 4.08, 2.56, 0.06, mats, 0.078);
  scr.position.y = 1.32;
  if (mats.glare) lid.children[lid.children.length - 1].position.y = 1.32;
  const notch = roundedPart(0.46, 0.115, 0.012, 0.045, mats.dark);
  notch.position.set(0, 2.575, 0.09);
  lid.add(notch);
  const webcam = new THREE.Mesh(new THREE.CircleGeometry(0.018, 18), mats.lens);
  webcam.position.set(0, 2.575, 0.098);
  lid.add(webcam);
  lid.rotation.x = -0.13;
  g.add(lid);

  const base = shadowed(roundedPart(4.22, 2.7, 0.12, 0.12, mats.body));
  base.rotation.x = -Math.PI / 2;
  base.position.set(0, -0.04, 1.35);
  g.add(base);

  const keyGeo = new THREE.BoxGeometry(0.205, 0.035, 0.17);
  const keyRows = [14, 14, 13, 12, 8];
  const keys = new THREE.InstancedMesh(keyGeo, mats.key, keyRows.reduce((sum, count) => sum + count, 0));
  const instanceMatrix = new THREE.Matrix4();
  let keyIndex = 0;
  keyRows.forEach((count, row) => {
    const z = 0.35 + row * 0.215;
    const span = (count - 1) * 0.235;
    for (let i = 0; i < count; i++) {
      instanceMatrix.makeTranslation(i * 0.235 - span / 2, 0.095, z);
      keys.setMatrixAt(keyIndex++, instanceMatrix);
    }
  });
  keys.instanceMatrix.setUsage(THREE.StaticDrawUsage);
  keys.instanceMatrix.needsUpdate = true;
  keys.castShadow = Boolean(mats.glare);
  keys.receiveShadow = true;
  g.add(keys);

  const trackpad = roundedPart(1.55, 0.86, 0.012, 0.055, mats.trackpad);
  trackpad.rotation.x = -Math.PI / 2;
  trackpad.position.set(0, 0.094, 2.02);
  g.add(trackpad);

  const holeGeo = new THREE.CylinderGeometry(0.012, 0.012, 0.012, 8);
  const speakerHoles = new THREE.InstancedMesh(holeGeo, mats.detail, 72);
  let holeIndex = 0;
  for (const x of [-1.72, 1.72]) {
    for (let row = 0; row < 9; row++) {
      for (let col = 0; col < 4; col++) {
        instanceMatrix.makeTranslation(x + (col - 1.5) * 0.06, 0.098, 0.36 + row * 0.13);
        speakerHoles.setMatrixAt(holeIndex++, instanceMatrix);
      }
    }
  }
  speakerHoles.instanceMatrix.setUsage(THREE.StaticDrawUsage);
  speakerHoles.instanceMatrix.needsUpdate = true;
  g.add(speakerHoles);

  const hinge = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 3.55, 20), mats.detail);
  hinge.rotation.z = Math.PI / 2;
  hinge.position.set(0, 0.025, 0.04);
  g.add(hinge);

  g.position.set(0, 0.92, -0.22);
  return { group: g, aspect: 4.08 / 2.56 };
}

function buildCard(mats) {
  const g = new THREE.Group();
  g.add(shadowed(new THREE.Mesh(slabGeo(3.7, 2.45, 0.07, 0.12), mats.body)));
  const scr = new THREE.Mesh(screenGeo(3.62, 2.37, 0.085), mats.screen);
  scr.position.z = 0.055;
  g.add(scr);
  if (mats.glare) {
    const gl = new THREE.Mesh(screenGeo(3.62, 2.37, 0.085), mats.glare);
    gl.position.z = 0.059;
    g.add(gl);
    glareMeshes.push(gl);
  }
  g.position.y = 1.85;
  return { group: g, aspect: 3.62 / 2.37 };
}

const realMats = {
  body: bodyMat,
  dark: darkMat,
  key: keyMat,
  lens: lensMat,
  detail: detailMat,
  trackpad: trackpadMat,
  flash: flashMat,
  screen: screenMat,
  glare: glareMat,
};
const mirrorKeyMat = keyMat.clone();
const mirrorLensMat = lensMat.clone();
const mirrorDetailMat = detailMat.clone();
const mirrorTrackpadMat = trackpadMat.clone();
const mirrorFlashMat = flashMat.clone();
[mirrorKeyMat, mirrorLensMat, mirrorDetailMat, mirrorTrackpadMat, mirrorFlashMat].forEach((m) => {
  m.transparent = true;
  m.opacity = 0.45;
  m.side = THREE.DoubleSide;
});
const mirrorMats = {
  body: mirrorBodyMat,
  dark: mirrorDarkMat,
  key: mirrorKeyMat,
  lens: mirrorLensMat,
  detail: mirrorDetailMat,
  trackpad: mirrorTrackpadMat,
  flash: mirrorFlashMat,
  screen: mirrorScreenMat,
};
const builders = { phone: buildPhone, tablet: buildTablet, laptop: buildLaptop, card: buildCard };
const importedDeviceState = { phone: "loading", tablet: "ready", laptop: "loading", card: "ready" };
const importedFinishMaterials = { real: [], mirror: [] };
let currentFinishName = "Natural titanium";

const DEVICE_WALL_CLEARANCE = 0.08;
const clearancePoint = new THREE.Vector3();
const projectedCorner = new THREE.Vector3();
let shadowGeometry = {
  wallDistance: 1,
  lightAngle: 0,
  shadowOffset: 0,
  penumbraWidth: 0,
  projectedWidth: 0,
  projectedHeight: 0,
};
let shadowGeometryHook = null;

export function onShadowGeometry(fn) {
  shadowGeometryHook = fn;
  fn(shadowGeometry);
  return () => {
    if (shadowGeometryHook === fn) shadowGeometryHook = null;
  };
}

function projectedShadowCrossSection(device, group, wallZ) {
  group.updateWorldMatrix(true, false);
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;

  for (const corner of device.boundsCorners) {
    projectedCorner.copy(corner).applyMatrix4(group.matrixWorld);
    const rayDistance = (wallZ - projectedCorner.z) / shadowRay.z;
    projectedCorner.addScaledVector(shadowRay, rayDistance);
    minX = Math.min(minX, projectedCorner.x);
    maxX = Math.max(maxX, projectedCorner.x);
    minY = Math.min(minY, projectedCorner.y);
    maxY = Math.max(maxY, projectedCorner.y);
  }

  return { width: maxX - minX, height: maxY - minY };
}

function updateShadowGeometry(wallDistance, device, group, penumbraWidth) {
  shadowRay.subVectors(key.target.position, key.position).normalize();
  const lateral = Math.hypot(shadowRay.x, shadowRay.y);
  const normal = Math.max(Math.abs(shadowRay.z), 0.0001);
  const crossSection = projectedShadowCrossSection(device, group, wall.position.z);
  const next = {
    wallDistance,
    lightAngle: THREE.MathUtils.radToDeg(Math.atan2(lateral, normal)),
    shadowOffset: wallDistance * lateral / normal,
    penumbraWidth,
    projectedWidth: crossSection.width,
    projectedHeight: crossSection.height,
  };
  const changed = Object.keys(next).some((keyName) => (
    Math.abs(next[keyName] - shadowGeometry[keyName]) > 0.0005
  ));
  if (changed) {
    shadowGeometry = next;
    shadowGeometryHook?.(shadowGeometry);
  }
}

function localBoundsCorners(group) {
  group.updateWorldMatrix(true, true);
  const bounds = new THREE.Box3().setFromObject(group);
  bounds.min.sub(group.position);
  bounds.max.sub(group.position);
  const { min, max } = bounds;
  return [
    new THREE.Vector3(min.x, min.y, min.z),
    new THREE.Vector3(min.x, min.y, max.z),
    new THREE.Vector3(min.x, max.y, min.z),
    new THREE.Vector3(min.x, max.y, max.z),
    new THREE.Vector3(max.x, min.y, min.z),
    new THREE.Vector3(max.x, min.y, max.z),
    new THREE.Vector3(max.x, max.y, min.z),
    new THREE.Vector3(max.x, max.y, max.z),
  ];
}

function placeBackdropBehindDevice(device, group) {
  group.position.z = device.baseZ;

  let rotatedMinZ = Infinity;
  for (const corner of device.boundsCorners) {
    clearancePoint.copy(corner).applyEuler(group.rotation);
    rotatedMinZ = Math.min(rotatedMinZ, clearancePoint.z);
  }

  const deepestDeviceZ = device.baseZ + rotatedMinZ;
  const backdropZ = backgroundType === "transparent"
    ? -currentWallGap
    : Math.min(-currentWallGap, deepestDeviceZ - DEVICE_WALL_CLEARANCE);

  wall.position.z = backdropZ;
  cove.position.z = backdropZ;
  const nextPivotWallDistance = Math.abs(backdropZ - group.position.z);
  return nextPivotWallDistance;
}

const devices = {};
const mirrors = {};
const mirrorRoot = new THREE.Group();
mirrorRoot.scale.y = -1;
mirrorRoot.visible = false;
scene.add(mirrorRoot);

for (const k of Object.keys(builders)) {
  devices[k] = builders[k](realMats);
  devices[k].baseY = devices[k].group.position.y;
  devices[k].baseZ = devices[k].group.position.z;
  devices[k].boundsCorners = localBoundsCorners(devices[k].group);
  scene.add(devices[k].group);
  const m = builders[k](mirrorMats);
  m.group.traverse((o) => { o.castShadow = false; });
  mirrors[k] = m;
  mirrorRoot.add(m.group);
}
devices.phone.radius = 8.5;
devices.tablet.radius = 9.5;
devices.laptop.radius = 12;
devices.card.radius = 10;

let activeDevice = "phone";
for (const k of Object.keys(devices)) {
  const visible = k === activeDevice && importedDeviceState[k] !== "loading";
  devices[k].group.visible = visible;
  mirrors[k].group.visible = visible;
}
showDeviceLoader(activeDevice);
fitCover();
setBackground(bgSel.tab, bgSel.index);
setBackgroundType("flat");

// The phone and laptop use compact, licensed GLBs. Procedural versions remain
// hidden during decoding and appear only as a reliable fallback if an asset
// cannot load. The screen material is swapped for the editor's live
// texture while every physical mesh keeps its authored PBR material.
const publicBase = import.meta.env.BASE_URL || "/";
const dracoLoader = new DRACOLoader();
dracoLoader.setDecoderPath(`${publicBase}draco/`);
const deviceModelLoader = new GLTFLoader();
deviceModelLoader.setDRACOLoader(dracoLoader);

function mapMaterials(mesh, mapper) {
  if (Array.isArray(mesh.material)) mesh.material = mesh.material.map(mapper);
  else if (mesh.material) mesh.material = mapper(mesh.material);
}

function isTintableDeviceMaterial(material, modelName) {
  if (!material?.isMeshStandardMaterial || material.emissiveMap) return false;
  if (modelName === "laptop") return material.name.toLowerCase() === "aluminium";
  return material.metalness >= 0.65 && material.opacity > 0.5;
}

function prepareImportedModel(model, modelName, screenMaterial, mirror = false) {
  model.traverse((child) => {
    if (!child.isMesh) return;
    child.castShadow = !mirror;
    child.receiveShadow = !mirror;
    mapMaterials(child, (sourceMaterial) => {
      const isScreen = child.userData.turntableScreen || (modelName === "phone"
        ? Boolean(sourceMaterial.emissiveMap)
        : child.name.toLowerCase() === "matte");
      if (isScreen) {
        child.userData.turntableScreen = true;
        return screenMaterial;
      }

      const tintable = isTintableDeviceMaterial(sourceMaterial, modelName);
      const material = sourceMaterial.clone();
      if (mirror) {
        material.transparent = true;
        material.opacity = Math.min(material.opacity, 1) * 0.42;
        material.depthWrite = false;
        material.side = THREE.DoubleSide;
      }
      if (tintable) {
        importedFinishMaterials[mirror ? "mirror" : "real"].push(material);
      }
      return material;
    });
  });
}

function discardProceduralGeometry(group) {
  for (let index = glareMeshes.length - 1; index >= 0; index -= 1) {
    if (group.getObjectById(glareMeshes[index].id)) glareMeshes.splice(index, 1);
  }
  group.traverse((child) => {
    if (child.isMesh || child.isInstancedMesh) child.geometry?.dispose();
  });
  group.clear();
}

function applyFinishToImportedModels() {
  const finish = FINISHES[currentFinishName];
  if (!finish) return;
  for (const material of [...importedFinishMaterials.real, ...importedFinishMaterials.mirror]) {
    material.color.set(finish.color);
    material.roughness = finish.roughness;
    material.needsUpdate = true;
  }
}

async function installImportedDevice(modelName, fileName, config) {
  const gltf = await deviceModelLoader.loadAsync(`${publicBase}models/${fileName}`);
  const model = gltf.scene;
  model.rotation.y = config.rotationY || 0;
  model.updateWorldMatrix(true, true);

  const bounds = new THREE.Box3().setFromObject(model);
  const size = bounds.getSize(new THREE.Vector3());
  const scale = config.height
    ? config.height / size.y
    : config.span / Math.max(size.x, size.z);
  model.scale.setScalar(scale);
  model.updateWorldMatrix(true, true);
  bounds.setFromObject(model);
  model.position.sub(bounds.getCenter(new THREE.Vector3()));
  prepareImportedModel(model, modelName, screenMat, false);

  const mirrorModel = model.clone(true);
  prepareImportedModel(mirrorModel, modelName, mirrorScreenMat, true);

  const device = devices[modelName];
  discardProceduralGeometry(device.group);
  device.group.add(model);
  device.group.position.set(0, config.centerY, config.baseZ || 0);
  device.baseY = device.group.position.y;
  device.baseZ = device.group.position.z;
  device.aspect = config.aspect;
  const renderedRotation = device.group.rotation.clone();
  device.group.rotation.set(0, 0, 0);
  device.boundsCorners = localBoundsCorners(device.group);
  device.group.rotation.copy(renderedRotation);

  const mirror = mirrors[modelName];
  discardProceduralGeometry(mirror.group);
  mirror.group.add(mirrorModel);
  mirror.group.position.copy(device.group.position);

  applyFinishToImportedModels();
  importedDeviceState[modelName] = "ready";
  if (activeDevice === modelName) {
    fitCover();
    hideDeviceLoader(() => {
      if (activeDevice !== modelName || importedDeviceState[modelName] !== "ready") return;
      device.group.visible = true;
      mirror.group.visible = true;
      markShadowDirty();
    });
  }
  markShadowDirty();
}

Promise.allSettled([
  installImportedDevice("phone", "iphone.glb", {
    height: 3,
    centerY: 1.85,
    rotationY: Math.PI,
    aspect: 1290 / 2796,
  }),
  installImportedDevice("laptop", "macbook.glb", {
    span: 4.5,
    centerY: 2.1,
    aspect: 16 / 10,
  }),
]).then((results) => {
  results.forEach((result, index) => {
    if (result.status === "rejected") {
      const modelName = index === 0 ? "phone" : "laptop";
      const label = modelName === "phone" ? "iPhone" : "MacBook";
      importedDeviceState[modelName] = "fallback";
      if (activeDevice === modelName) {
        hideDeviceLoader(() => {
          if (activeDevice !== modelName) return;
          devices[modelName].group.visible = true;
          mirrors[modelName].group.visible = true;
          markShadowDirty();
        });
      }
      console.warn(`${label} GLB failed to load; using the procedural fallback.`, result.reason);
    }
  });
  dracoLoader.dispose();
});

// ---------- rotation ----------
// baseRot is what renders; tRot is the target it eases toward, so
// angle presets glide instead of snapping. Direct input (drag,
// scrubbers) writes both for zero-lag manipulation.
const baseRot = { x: 0, y: 0, z: 0 }; // degrees
const tRot = { x: 0, y: 0, z: 0 };

export function setRotation(axis, deg) {
  baseRot[axis] = deg;
  tRot[axis] = deg;
  markShadowDirty();
}

// ui hook: fires when the scene itself changes rotation (drag, spin,
// presets) so the scrubbers can follow. `fromUser` marks direct drags.
let rotationHook = null;
export function onRotationInput(fn) {
  rotationHook = fn;
}

function wrap180(v) {
  return ((v + 180) % 360 + 360) % 360 - 180;
}

// ---------- camera (fixed — the device rotates, not the view, so the
// backdrop stays pinned like a studio wall) ----------
const view = { radius: 8.5, tRadius: 8.5, target: new THREE.Vector3(0, 1.75, 0) };

function applyCamera() {
  camera.position.set(0, view.target.y + view.radius * 0.14, view.radius);
  camera.lookAt(view.target);
}

let dragging = false, px = 0, py = 0;
stage.addEventListener("pointerdown", (e) => {
  dragging = true;
  px = e.clientX;
  py = e.clientY;
  stage.classList.add("dragging");
  stage.setPointerCapture(e.pointerId);
  if (rotationHook) rotationHook({ ...baseRot }, true, "start");
});
stage.addEventListener("pointermove", (e) => {
  if (!dragging) return;
  baseRot.y = tRot.y = wrap180(baseRot.y + (e.clientX - px) * 0.35);
  baseRot.x = tRot.x = wrap180(baseRot.x + (e.clientY - py) * 0.35);
  px = e.clientX;
  py = e.clientY;
  if (rotationHook) rotationHook({ ...baseRot }, true, "update");
});
stage.addEventListener("pointerup", () => {
  dragging = false;
  stage.classList.remove("dragging");
  markShadowDirty();
  if (rotationHook) rotationHook({ ...baseRot }, true, "commit");
});
stage.addEventListener("pointercancel", () => {
  dragging = false;
  stage.classList.remove("dragging");
  markShadowDirty();
  if (rotationHook) rotationHook({ ...baseRot }, true, "commit");
});
stage.addEventListener("wheel", (e) => {
  e.preventDefault();
  view.tRadius = Math.min(18, Math.max(3.2, view.tRadius + e.deltaY * 0.01));
}, { passive: false });

// device-rotation presets; zoom is tuned for the phone and scaled by
// the active device's own framing radius
export const ANGLES = {
  Front: { rot: [0, 12, 0], zoom: 9 },
  Hero: { rot: [-4, 24, 0], zoom: 8.5 },
  Flat: { rot: [0, 0, 0], zoom: 9.5 },
  "Low angle": { rot: [14, 0, 0], zoom: 8.5 },
  Isometric: { rot: [-16, 38, 0], zoom: 11 },
  Stand: { rot: [0, -22, 0], zoom: 10 },
  Centered: { rot: [0, 0, 0], zoom: 7 },
  "Close-up": { rot: [0, 14, 0], zoom: 5 },
  Float: { rot: [-10, 22, 10], zoom: 8.5 },
  "Top down": { rot: [-68, 0, 15], zoom: 9.5 },
  "Left tilt": { rot: [0, -28, -8], zoom: 8.5 },
  Detail: { rot: [0, 12, 0], zoom: 4.2 },
};

export function setAngle(name) {
  const a = ANGLES[name];
  if (!a) return;
  view.tRadius = a.zoom * (devices[activeDevice].radius / 8.5);
  tRot.x = a.rot[0];
  tRot.y = a.rot[1];
  tRot.z = a.rot[2];
  markShadowDirty();
  return { ...tRot };
}

export function resetCamera() {
  return setAngle("Hero");
}

// ---------- public controls ----------
const state = { float: false, spin: false };
let exportScale = 2;

export const FINISHES = {
  "Natural titanium": { color: 0x8c8a84, trackpad: 0x777873, roughness: 0.24 },
  Silver: { color: 0xc7c8c4, trackpad: 0xb7b8b4, roughness: 0.2 },
  "Space black": { color: 0x292b2d, trackpad: 0x343638, roughness: 0.28 },
  Desert: { color: 0xa38c72, trackpad: 0x8e7862, roughness: 0.26 },
};

export function setFinish(name) {
  const finish = FINISHES[name];
  if (!finish) return;
  currentFinishName = name;
  bodyMat.color.set(finish.color);
  bodyMat.roughness = finish.roughness;
  mirrorBodyMat.color.set(finish.color);
  mirrorBodyMat.roughness = finish.roughness;
  trackpadMat.color.set(finish.trackpad);
  mirrorTrackpadMat.color.set(finish.trackpad);
  applyFinishToImportedModels();
  markRenderDirty();
}

export function setDevice(name) {
  if (!devices[name] || name === activeDevice) return;
  devices[activeDevice].group.visible = false;
  mirrors[activeDevice].group.visible = false;
  activeDevice = name;
  const loading = importedDeviceState[activeDevice] === "loading";
  devices[activeDevice].group.visible = !loading;
  mirrors[activeDevice].group.visible = !loading;
  if (loading) showDeviceLoader(activeDevice);
  else hideDeviceLoader();
  view.tRadius = devices[activeDevice].radius;
  fitCover();
  markShadowDirty();
}

export function setLighting(name) {
  lightingName = name;
  applyLighting();
}

export function setLightMult(v) {
  lightMult = v;
  applyLighting();
}

export function setKeyLightControls(values) {
  keyLightControls = { ...keyLightControls, ...values };
  applyLighting();
  tuneWallShadow(renderedWallGap);
  markShadowDirty();
}

export function setShadows(on) {
  shadowsEnabled = on;
  key.castShadow = on;
  markShadowDirty();
}

export function setFloat(on) {
  state.float = on;
  markShadowDirty();
}

export function setSpin(on) {
  state.spin = on;
  markShadowDirty();
}

export function setExportScale(n) {
  exportScale = n;
}

export function setExportAspect(a) {
  exportAspect = a;
  layout();
}

export const defaults = {
  float: state.float,
};

let appliedEditorState = {};

export function applyEditorState(editor) {
  const previous = appliedEditorState;
  const device = editor.device;
  const environment = editor.environment;
  const cameraState = editor.camera;
  const source = editor.source;

  if (previous.device?.type !== device.type) setDevice(device.type);
  if (previous.device?.finish !== device.finish) setFinish(device.finish);
  if (previous.device?.glare !== device.glare) setGlare(device.glare);

  if (previous.environment?.lighting !== environment.lighting) setLighting(environment.lighting);
  if (previous.environment?.intensity !== environment.intensity) setLightMult(environment.intensity);
  if (JSON.stringify(previous.environment?.keyLight) !== JSON.stringify(environment.keyLight)) {
    setKeyLightControls(environment.keyLight);
  }
  if (previous.environment?.backgroundType !== environment.backgroundType) setBackgroundType(environment.backgroundType);
  if (
    previous.environment?.background?.tab !== environment.background.tab ||
    previous.environment?.background?.index !== environment.background.index
  ) setBackground(environment.background.tab, environment.background.index);
  if (previous.environment?.shadows !== environment.shadows) setShadows(environment.shadows);
  if (previous.environment?.float !== environment.float) setFloat(environment.float);
  if (previous.environment?.spin !== environment.spin) setSpin(environment.spin);
  if (previous.environment?.wallGap !== environment.wallGap) setWallGap(environment.wallGap);

  if (previous.camera?.angle !== cameraState.angle && cameraState.angle) setAngle(cameraState.angle);
  for (const axis of ["x", "y", "z"]) {
    if (previous.camera?.rotation?.[axis] !== cameraState.rotation[axis]) {
      setRotation(axis, cameraState.rotation[axis]);
    }
  }

  if (
    previous.source?.scale !== source.scale ||
    previous.source?.x !== source.x ||
    previous.source?.y !== source.y
  ) setSourceTransform(source);

  appliedEditorState = structuredClone(editor);
}

// ---------- image loading ----------
const fileInput = document.getElementById("fileInput");

export function openUpload() {
  fileInput.click();
}

export function loadImageFile(file, options = {}) {
  if (!file || !/^image\//.test(file.type)) return Promise.resolve(null);
  const url = URL.createObjectURL(file);
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const t = new THREE.Texture(img);
      t.colorSpace = THREE.SRGBColorSpace;
      t.anisotropy = renderer.capabilities.getMaxAnisotropy();
      t.needsUpdate = true;
      if (current.tex && current.tex !== defaultScreenTexture) current.tex.dispose();
      if (sourcePreviewUrl && sourcePreviewUrl.startsWith("blob:")) URL.revokeObjectURL(sourcePreviewUrl);
      sourcePreviewUrl = url;
      current = { tex: t, aspect: img.naturalWidth / img.naturalHeight };
      screenMat.map = t;
      mirrorScreenMat.map = t;
      screenMat.needsUpdate = true;
      mirrorScreenMat.needsUpdate = true;
      fitCover();
      const detail = {
        file,
        name: options.name || file.name || "Pasted image",
        width: img.naturalWidth,
        height: img.naturalHeight,
        aspect: current.aspect,
        previewUrl: sourcePreviewUrl,
        kind: options.kind || "image",
        sourceUrl: options.sourceUrl || null,
      };
      if (options.notify !== false && sourceHook) sourceHook(detail);
      resolve(detail);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("The selected image could not be decoded."));
    };
    img.src = url;
  });
}

function parseHttpUrl(value, subject) {
  const candidate = /^https?:\/\//i.test(value) ? value : `https://${value}`;
  let sourceUrl;
  try {
    sourceUrl = new URL(candidate);
  } catch {
    throw new Error(`Enter a valid ${subject} URL.`);
  }
  if (!['http:', 'https:'].includes(sourceUrl.protocol)) {
    throw new Error(`Only http:// and https:// ${subject} URLs are supported.`);
  }
  return sourceUrl;
}

export async function loadImageUrl(value, options = {}) {
  const sourceUrl = parseHttpUrl(value, "image");

  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), options.timeout || 20000);
  let response;
  try {
    response = await fetch(sourceUrl.href, { mode: "cors", signal: controller.signal });
  } catch (error) {
    if (error.name === "AbortError") throw new Error("The image URL took too long to respond.");
    throw new Error("That host blocked browser access. Download the image and use Replace instead.");
  } finally {
    window.clearTimeout(timeout);
  }
  if (!response.ok) throw new Error(`The image URL returned ${response.status}.`);

  const blob = await response.blob();
  if (!/^image\//.test(blob.type)) throw new Error("That URL does not point to a supported image.");
  const fallbackExtension = blob.type.split("/")[1]?.replace("jpeg", "jpg") || "png";
  const pathName = decodeURIComponent(sourceUrl.pathname.split("/").pop() || "");
  const fileName = options.fileName || (/\.[a-z0-9]{2,5}$/i.test(pathName) ? pathName : `remote-image.${fallbackExtension}`);
  const file = new File([blob], fileName, { type: blob.type });
  return loadImageFile(file, {
    name: options.name || fileName,
    kind: options.kind || "image",
    sourceUrl: options.sourceUrl || sourceUrl.href,
  });
}

function isPrivateWebsite(hostname) {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (host === "localhost" || host.endsWith(".local") || host.endsWith(".internal")) return true;
  if (host === "::1" || (host.includes(":") && (host.startsWith("fc") || host.startsWith("fd") || host.startsWith("fe80:")))) return true;
  const octets = host.split(".").map(Number);
  if (octets.length !== 4 || octets.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) return false;
  return octets[0] === 10
    || octets[0] === 127
    || (octets[0] === 169 && octets[1] === 254)
    || (octets[0] === 172 && octets[1] >= 16 && octets[1] <= 31)
    || (octets[0] === 192 && octets[1] === 168)
    || (octets[0] === 100 && octets[1] >= 64 && octets[1] <= 127);
}

export async function loadWebpageUrl(value) {
  const webpageUrl = parseHttpUrl(value, "website");
  if (webpageUrl.username || webpageUrl.password) {
    throw new Error("Website URLs containing usernames or passwords cannot be captured.");
  }
  if (isPrivateWebsite(webpageUrl.hostname)) {
    throw new Error("Website capture only supports public URLs. Upload a screenshot for local or private sites.");
  }

  const captureUrl = new URL("https://api.microlink.io/");
  const viewportByDevice = {
    phone: { width: 430, height: 932 },
    tablet: { width: 1024, height: 1366 },
    laptop: { width: 1440, height: 900 },
    card: { width: 1440, height: 943 },
  };
  const viewport = viewportByDevice[activeDevice] || viewportByDevice.card;
  captureUrl.searchParams.set("url", webpageUrl.href);
  captureUrl.searchParams.set("screenshot", "true");
  captureUrl.searchParams.set("screenshot.fullPage", "false");
  captureUrl.searchParams.set("screenshot.type", "png");
  captureUrl.searchParams.set("viewport.width", String(viewport.width));
  captureUrl.searchParams.set("viewport.height", String(viewport.height));
  captureUrl.searchParams.set("viewport.deviceScaleFactor", "2");
  captureUrl.searchParams.set("viewport.isMobile", String(activeDevice === "phone" || activeDevice === "tablet"));
  captureUrl.searchParams.set("viewport.hasTouch", String(activeDevice === "phone" || activeDevice === "tablet"));
  captureUrl.searchParams.set("meta", "false");
  captureUrl.searchParams.set("embed", "screenshot.url");

  const hostname = webpageUrl.hostname.replace(/^www\./i, "");
  const slug = hostname.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "") || "website";
  try {
    return await loadImageUrl(captureUrl.href, {
      timeout: 45000,
      fileName: `${slug}-preview.png`,
      name: `${hostname} website`,
      kind: "website",
      sourceUrl: webpageUrl.href,
    });
  } catch (error) {
    if (/returned 429/.test(error.message)) {
      throw new Error("The website capture limit has been reached. Try again later or upload a screenshot.");
    }
    if (/too long/.test(error.message)) throw new Error("The website took too long to capture. Try again or upload a screenshot.");
    throw new Error("The website could not be captured. Confirm it is public and reachable, then try again.");
  }
}

export function resetSource(options = {}) {
  if (current.tex && current.tex !== defaultScreenTexture) current.tex.dispose();
  if (sourcePreviewUrl && sourcePreviewUrl.startsWith("blob:")) URL.revokeObjectURL(sourcePreviewUrl);
  sourcePreviewUrl = defaultScreenTexture.image.toDataURL("image/png");
  current = { tex: defaultScreenTexture, aspect: 0.5 };
  screenMat.map = defaultScreenTexture;
  mirrorScreenMat.map = defaultScreenTexture;
  screenMat.needsUpdate = true;
  mirrorScreenMat.needsUpdate = true;
  sourceTransform = { scale: 1, x: 0, y: 0 };
  fitCover();
  if (options.notify !== false && sourceHook) sourceHook(null);
}

fileInput.addEventListener("change", async () => {
  try {
    await loadImageFile(fileInput.files[0]);
  } finally {
    // Allow selecting the same file again after clearing or reframing it.
    fileInput.value = "";
  }
});
window.addEventListener("dragover", (e) => {
  e.preventDefault();
  stage.classList.add("dropping");
});
window.addEventListener("dragleave", (e) => {
  if (e.relatedTarget === null) stage.classList.remove("dropping");
});
window.addEventListener("drop", (e) => {
  e.preventDefault();
  stage.classList.remove("dropping");
  if (e.dataTransfer.files.length) loadImageFile(e.dataTransfer.files[0]);
});
window.addEventListener("paste", (e) => {
  const items = e.clipboardData && e.clipboardData.items;
  if (!items) return;
  for (let i = 0; i < items.length; i++) {
    if (/^image\//.test(items[i].type)) {
      loadImageFile(items[i].getAsFile());
      break;
    }
  }
});

// ---------- export ----------
function setShadowQuality(size, blurSamples) {
  if (key.shadow.mapSize.x !== size) {
    key.shadow.mapSize.set(size, size);
    if (key.shadow.map) {
      key.shadow.map.dispose();
      key.shadow.map = null;
    }
    if (key.shadow.mapPass) {
      key.shadow.mapPass.dispose();
      key.shadow.mapPass = null;
    }
  }
  key.shadow.blurSamples = blurSamples;
  tuneWallShadow(renderedWallGap);
  renderer.shadowMap.needsUpdate = true;
  markShadowDirty();
}

export async function exportImage(options = {}) {
  const format = ["png", "jpeg", "webp"].includes(options.format) ? options.format : "png";
  const width = Math.max(320, Math.min(7680, Math.round(options.width || 2400)));
  const height = Math.max(320, Math.min(7680, Math.round(options.height || 1600)));
  const quality = THREE.MathUtils.clamp(options.quality ?? 0.92, 0.1, 1);
  const transparent = Boolean(options.transparent && format !== "jpeg");
  const viewportWidth = innerWidth;
  const viewportHeight = innerHeight;
  const visibleState = {
    wall: wall.visible,
    floor: floor.visible,
    cove: cove.visible,
    mirror: mirrorRoot.visible,
  };

  let blob;
  try {
    camera.clearViewOffset();
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    setShadowQuality(EXPORT_SHADOW_SIZE, 20);
    renderer.setPixelRatio(1);
    renderer.setSize(width, height, false);
    if (transparent) {
      wall.visible = false;
      floor.visible = false;
      cove.visible = false;
      mirrorRoot.visible = false;
      renderer.setClearColor(0x000000, 0);
    }
    renderer.render(scene, camera);
    const mime = `image/${format}`;
    blob = await new Promise((resolve, reject) => {
      renderer.domElement.toBlob((value) => value ? resolve(value) : reject(new Error("Export failed.")), mime, quality);
    });
  } finally {
    wall.visible = visibleState.wall;
    floor.visible = visibleState.floor;
    cove.visible = visibleState.cove;
    mirrorRoot.visible = visibleState.mirror;
    setShadowQuality(PREVIEW_SHADOW_SIZE, 12);
    renderer.setPixelRatio(PREVIEW_PIXEL_RATIO);
    renderer.setSize(viewportWidth, viewportHeight, false);
    layout();
  }
  const extension = format === "jpeg" ? "jpg" : format;
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `turntable-${activeDevice}-${width}x${height}.${extension}`;
  a.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  return { width, height, format, bytes: blob.size };
}

export function exportPNG() {
  return exportImage({
    format: "png",
    width: innerWidth * exportScale,
    height: innerHeight * exportScale,
  });
}

// ---------- loop ----------
const D2R = Math.PI / 180;
const startedAt = performance.now();
let shadowFrame = 0;
const SHADOW_TARGETS = {
  phone: 1.85,
  tablet: 1.85,
  laptop: 2.1,
  card: 1.85,
};

function tick() {
  requestAnimationFrame(tick);
  const t = (performance.now() - startedAt) * 0.001;
  if (state.spin && !dragging) {
    baseRot.y = tRot.y = wrap180(baseRot.y + 0.2);
    if (rotationHook) rotationHook({ ...baseRot }, false);
  }
  baseRot.x += (tRot.x - baseRot.x) * 0.1;
  baseRot.y += (tRot.y - baseRot.y) * 0.1;
  baseRot.z += (tRot.z - baseRot.z) * 0.1;
  view.radius += (view.tRadius - view.radius) * 0.12;
  applyCamera();

  const d = devices[activeDevice];
  const g = d.group;
  const floatY = state.float ? Math.sin(t * 1.1) * 0.06 : 0;
  const floatZ = state.float ? Math.sin(t * 0.6) * 0.012 : 0;
  g.position.y = d.baseY + floatY;
  g.rotation.set(baseRot.x * D2R, baseRot.y * D2R, baseRot.z * D2R + floatZ);
  const effectiveWallGap = placeBackdropBehindDevice(d, g);
  renderedWallGap = effectiveWallGap;

  key.target.position.y = SHADOW_TARGETS[activeDevice];
  const penumbraWidth = tuneWallShadow(effectiveWallGap);
  updateShadowGeometry(effectiveWallGap, d, g, penumbraWidth);

  if (mirrorRoot.visible) {
    const m = mirrors[activeDevice].group;
    m.position.copy(g.position);
    m.rotation.copy(g.rotation);
  }
  const rotationsSettling = Math.abs(tRot.x - baseRot.x) + Math.abs(tRot.y - baseRot.y) + Math.abs(tRot.z - baseRot.z) > 0.02;
  const cameraSettling = Math.abs(view.tRadius - view.radius) > 0.002;
  const sceneAnimated = state.float || state.spin || dragging || rotationsSettling || cameraSettling;
  if (!sceneAnimated && !renderDirty) return;
  const shadowIsMoving = state.float || state.spin || dragging || rotationsSettling;
  renderer.shadowMap.needsUpdate = shadowsEnabled && (forceShadowRefresh || (shadowIsMoving && shadowFrame % 2 === 0));
  forceShadowRefresh = false;
  shadowFrame++;
  renderer.render(scene, camera);
  renderDirty = false;
}
setAngle("Hero");
tick();
