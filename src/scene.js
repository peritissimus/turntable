import * as THREE from "three";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";

const PANEL_W = 376;
const PREVIEW_PIXEL_RATIO = Math.min(devicePixelRatio, 1.5);
const PREVIEW_SHADOW_SIZE = 1024;
const EXPORT_SHADOW_SIZE = 2048;
let exportAspect = null; // width/height crop, null = full canvas

// ---------- renderer / scene ----------
const stage = document.getElementById("stage");
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setPixelRatio(PREVIEW_PIXEL_RATIO);
renderer.shadowMap.enabled = true;
renderer.shadowMap.autoUpdate = false;
// VSM: the only built-in type where shadow.radius gives a real,
// dialable penumbra (PCFSoft ignores radius)
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
key.castShadow = true;
key.shadow.mapSize.set(PREVIEW_SHADOW_SIZE, PREVIEW_SHADOW_SIZE);
key.shadow.camera.left = -6;
key.shadow.camera.right = 6;
key.shadow.camera.top = 7;
key.shadow.camera.bottom = -4;
key.shadow.camera.far = 40;
key.shadow.blurSamples = 8;
key.shadow.bias = -0.00015;
key.shadow.normalBias = 0.012;
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

function applyLighting() {
  const L = LIGHTING[lightingName];
  key.intensity = L.key.intensity * lightMult;
  key.color.set(L.key.color);
  key.position.set(...L.key.pos);
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

// VSM gives us the real silhouette, while this low-contrast contact layer
// restores the near-field density that soft shadow maps tend to wash out.
// It is deliberately neutral black so colorful backgrounds do not tint it.
const contactShadowMat = new THREE.ShaderMaterial({
  transparent: true,
  opacity: 0.2,
  depthWrite: false,
  toneMapped: false,
  uniforms: {
    uOpacity: { value: 0.15 },
    uSoftness: { value: 0.32 },
    uSkew: { value: 0 },
  },
  vertexShader: `
    varying vec2 vUv;
    uniform float uSkew;
    void main() {
      vUv = uv;
      vec3 p = position;
      p.x += (uv.y - 0.5) * uSkew;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
    }
  `,
  fragmentShader: `
    varying vec2 vUv;
    uniform float uOpacity;
    uniform float uSoftness;
    float roundedBoxSdf(vec2 p, vec2 b, float r) {
      vec2 q = abs(p) - b + r;
      return min(max(q.x, q.y), 0.0) + length(max(q, 0.0)) - r;
    }
    void main() {
      vec2 p = (vUv - 0.5) * 2.0;
      float d = roundedBoxSdf(p, vec2(0.42, 0.68), 0.22);
      float core = 1.0 - smoothstep(-0.16, 0.16 + uSoftness * 0.2, d);
      float ambient = 1.0 - smoothstep(-0.04, 0.5 + uSoftness, d);
      float falloff = smoothstep(0.0, 0.14, vUv.y) * smoothstep(0.0, 0.12, 1.0 - vUv.y);
      float alpha = (core * 0.48 + ambient * 0.52) * falloff * uOpacity;
      gl_FragColor = vec4(0.0, 0.0, 0.0, alpha);
    }
  `,
});
const contactShadow = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), contactShadowMat);
contactShadow.renderOrder = 1;
scene.add(contactShadow);

let currentWallGap = 1;
let backgroundType = "flat";
let shadowsEnabled = true;
let contactBaseOpacity = 0.15;

function syncShadowVisibility() {
  contactShadow.visible = shadowsEnabled && backgroundType !== "transparent";
}

// the device ↔ wall gap drives the whole shadow character, like a real
// studio wall: the lateral offset comes free from light projection, the
// penumbra widens with the gap, and the shadow fades as the device
// moves away from the surface
export function setWallGap(g) {
  currentWallGap = g;
  wall.position.z = -g;
  cove.position.z = -g;
  contactShadow.position.z = -g + 0.012;
  key.shadow.radius = 2.4 + g * 3;
  key.shadow.intensity = Math.max(0.56, 0.94 - g * 0.09);
  const proximity = THREE.MathUtils.clamp((4.25 - g) / 3.95, 0, 1);
  contactBaseOpacity = 0.18 * proximity;
  contactShadowMat.uniforms.uOpacity.value = contactBaseOpacity;
  contactShadowMat.uniforms.uSoftness.value = 0.22 + g * 0.12;
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
  syncShadowVisibility();
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

let current = {
  tex: drawToTexture(defaultScreen, 1000, 2000),
  aspect: 0.5,
};
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
  t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
  if (imgA > scrA) {
    t.repeat.set(scrA / imgA, 1);
    t.offset.set((1 - scrA / imgA) / 2, 0);
  } else {
    t.repeat.set(1, imgA / scrA);
    t.offset.set(0, (1 - imgA / scrA) / 2);
  }
  t.needsUpdate = true;
  markRenderDirty();
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
  addFrontGlass(g, 1.345, 2.885, 0.195, mats, 0.095);

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
  return { group: g, aspect: 1.345 / 2.885 };
}

function buildTablet(mats) {
  const g = new THREE.Group();
  g.add(shadowed(roundedPart(2.52, 3.36, 0.09, 0.15, mats.body)));
  const bezel = roundedPart(2.47, 3.31, 0.018, 0.135, mats.dark);
  bezel.position.z = 0.052;
  g.add(bezel);
  addFrontGlass(g, 2.34, 3.12, 0.075, mats, 0.071);

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
  return { group: g, aspect: 2.34 / 3.12 };
}

function buildLaptop(mats) {
  const g = new THREE.Group();
  const lid = new THREE.Group();
  const lidBody = shadowed(roundedPart(4.22, 2.72, 0.085, 0.13, mats.body));
  lidBody.position.y = 1.36;
  lid.add(lidBody);
  const displayBezel = roundedPart(4.13, 2.63, 0.024, 0.095, mats.dark);
  displayBezel.position.set(0, 1.36, 0.055);
  lid.add(displayBezel);
  const scr = addFrontGlass(lid, 3.94, 2.43, 0.045, mats, 0.078);
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
  return { group: g, aspect: 3.94 / 2.43 };
}

function buildCard(mats) {
  const g = new THREE.Group();
  g.add(shadowed(new THREE.Mesh(slabGeo(3.7, 2.45, 0.07, 0.12), mats.body)));
  const scr = new THREE.Mesh(screenGeo(3.58, 2.33, 0.08), mats.screen);
  scr.position.z = 0.055;
  g.add(scr);
  if (mats.glare) {
    const gl = new THREE.Mesh(screenGeo(3.58, 2.33, 0.08), mats.glare);
    gl.position.z = 0.059;
    g.add(gl);
    glareMeshes.push(gl);
  }
  g.position.y = 1.85;
  return { group: g, aspect: 3.58 / 2.33 };
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

const devices = {};
const mirrors = {};
const mirrorRoot = new THREE.Group();
mirrorRoot.scale.y = -1;
mirrorRoot.visible = false;
scene.add(mirrorRoot);

for (const k of Object.keys(builders)) {
  devices[k] = builders[k](realMats);
  devices[k].baseY = devices[k].group.position.y;
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
  devices[k].group.visible = k === activeDevice;
  mirrors[k].group.visible = k === activeDevice;
}
fitCover();
setBackground(bgSel.tab, bgSel.index);
setBackgroundType("flat");

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
});
stage.addEventListener("pointermove", (e) => {
  if (!dragging) return;
  baseRot.y = tRot.y = wrap180(baseRot.y + (e.clientX - px) * 0.35);
  baseRot.x = tRot.x = wrap180(baseRot.x + (e.clientY - py) * 0.35);
  px = e.clientX;
  py = e.clientY;
  if (rotationHook) rotationHook({ ...baseRot }, true);
});
stage.addEventListener("pointerup", () => {
  dragging = false;
  stage.classList.remove("dragging");
  markShadowDirty();
});
stage.addEventListener("pointercancel", () => {
  dragging = false;
  stage.classList.remove("dragging");
  markShadowDirty();
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
  bodyMat.color.set(finish.color);
  bodyMat.roughness = finish.roughness;
  mirrorBodyMat.color.set(finish.color);
  mirrorBodyMat.roughness = finish.roughness;
  trackpadMat.color.set(finish.trackpad);
  mirrorTrackpadMat.color.set(finish.trackpad);
  markRenderDirty();
}

export function setDevice(name) {
  if (!devices[name] || name === activeDevice) return;
  devices[activeDevice].group.visible = false;
  mirrors[activeDevice].group.visible = false;
  activeDevice = name;
  devices[activeDevice].group.visible = true;
  mirrors[activeDevice].group.visible = true;
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

export function setShadows(on) {
  shadowsEnabled = on;
  key.castShadow = on;
  syncShadowVisibility();
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

// ---------- image loading ----------
const fileInput = document.getElementById("fileInput");

export function openUpload() {
  fileInput.click();
}

function loadImageFile(file) {
  if (!file || !/^image\//.test(file.type)) return;
  const url = URL.createObjectURL(file);
  const img = new Image();
  img.onload = () => {
    const t = new THREE.Texture(img);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = renderer.capabilities.getMaxAnisotropy();
    t.needsUpdate = true;
    if (current.tex) current.tex.dispose();
    current = { tex: t, aspect: img.naturalWidth / img.naturalHeight };
    screenMat.map = t;
    mirrorScreenMat.map = t;
    screenMat.needsUpdate = true;
    mirrorScreenMat.needsUpdate = true;
    fitCover();
    URL.revokeObjectURL(url);
  };
  img.src = url;
}

fileInput.addEventListener("change", () => loadImageFile(fileInput.files[0]));
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
  renderer.shadowMap.needsUpdate = true;
  markShadowDirty();
}

export function exportPNG() {
  const w = innerWidth, h = innerHeight;
  camera.clearViewOffset();
  camera.updateProjectionMatrix();
  setShadowQuality(EXPORT_SHADOW_SIZE, 16);
  renderer.setPixelRatio(1);
  renderer.setSize(w * exportScale, h * exportScale, false);
  renderer.render(scene, camera);
  let url;
  if (exportAspect) {
    // crop the largest centered window matching the chosen aspect
    const cw = renderer.domElement.width, ch = renderer.domElement.height;
    let tw = cw, th = Math.round(cw / exportAspect);
    if (th > ch) { th = ch; tw = Math.round(ch * exportAspect); }
    const c = document.createElement("canvas");
    c.width = tw;
    c.height = th;
    c.getContext("2d").drawImage(renderer.domElement, (cw - tw) / 2, (ch - th) / 2, tw, th, 0, 0, tw, th);
    url = c.toDataURL("image/png");
  } else {
    url = renderer.domElement.toDataURL("image/png");
  }
  setShadowQuality(PREVIEW_SHADOW_SIZE, 8);
  renderer.setPixelRatio(PREVIEW_PIXEL_RATIO);
  renderer.setSize(w, h, false);
  layout();
  const a = document.createElement("a");
  a.href = url;
  a.download = `turntable-${activeDevice}-${exportScale}x.png`;
  a.click();
}

// ---------- loop ----------
const D2R = Math.PI / 180;
const startedAt = performance.now();
let shadowFrame = 0;
const SHADOW_PROFILES = {
  phone: { size: [2.9, 4.5], centerY: 1.85, opacity: 1 },
  tablet: { size: [4.8, 4.7], centerY: 1.85, opacity: 0.86 },
  laptop: { size: [8.1, 4.1], centerY: 2.1, opacity: 0.56 },
  card: { size: [7.5, 3.7], centerY: 1.85, opacity: 0.72 },
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

  const shadowProfile = SHADOW_PROFILES[activeDevice];
  key.target.position.y = shadowProfile.centerY;
  const spread = 1 + currentWallGap * 0.075;
  contactShadow.scale.set(shadowProfile.size[0] * spread, shadowProfile.size[1] * spread, 1);
  contactShadow.position.x = -currentWallGap * 0.05;
  contactShadow.position.y = shadowProfile.centerY + floatY - currentWallGap * 0.035;
  contactShadow.rotation.z = baseRot.z * D2R * 0.12;
  contactShadowMat.uniforms.uOpacity.value = contactBaseOpacity * shadowProfile.opacity;
  contactShadowMat.uniforms.uSkew.value = Math.sin(baseRot.y * D2R) * 0.22;

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
