import * as THREE from "three";

const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
const PANEL_W = 300;

// ---------- renderer / scene ----------
const stage = document.getElementById("stage");
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
// VSM: the only built-in type where shadow.radius gives a real,
// dialable penumbra (PCFSoft ignores radius)
renderer.shadowMap.type = THREE.VSMShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
stage.appendChild(renderer.domElement);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 120);

function layout() {
  const w = innerWidth, h = innerHeight;
  renderer.setSize(w, h);
  camera.aspect = w / h;
  // keep the device centered in the area left of the panel
  if (w > 760) camera.setViewOffset(w, h, PANEL_W / 2, 0, w, h);
  else camera.clearViewOffset();
  camera.updateProjectionMatrix();
}
layout();
window.addEventListener("resize", layout);

// ---------- lights ----------
const hemi = new THREE.HemisphereLight(0xcdd3ff, 0x2b2620, 0.9);
scene.add(hemi);

const key = new THREE.DirectionalLight(0xffffff, 2.2);
key.position.set(5, 6.5, 6.5);
key.castShadow = true;
key.shadow.mapSize.set(2048, 2048);
key.shadow.camera.left = -9;
key.shadow.camera.right = 9;
key.shadow.camera.top = 9;
key.shadow.camera.bottom = -5;
key.shadow.camera.far = 40;
key.shadow.blurSamples = 16;
key.shadow.bias = -0.0004;
scene.add(key);

const rim = new THREE.DirectionalLight(0xd9a441, 0.8);
rim.position.set(-5, 3, -4);
scene.add(rim);

const LIGHTING = {
  studio: {
    key: { intensity: 2.2, color: 0xffffff, pos: [4, 5.5, 7.5] },
    hemi: 0.9,
    rim: { intensity: 0.8, color: 0xd9a441, pos: [-5, 3, -4] },
  },
  bright: {
    key: { intensity: 3.4, color: 0xffffff, pos: [3, 7, 9] },
    hemi: 1.7,
    rim: { intensity: 1.3, color: 0xffffff, pos: [-6, 4, -2] },
  },
  noir: {
    key: { intensity: 1.7, color: 0xc9d4f2, pos: [-6, 5, 4] },
    hemi: 0.18,
    rim: { intensity: 1.8, color: 0x8fa8ff, pos: [6, 2, -3] },
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
}
applyLighting();

// ---------- wall + floor ----------
const wallMat = new THREE.MeshStandardMaterial({ roughness: 1, metalness: 0 });
const wall = new THREE.Mesh(new THREE.PlaneGeometry(90, 45), wallMat);
wall.position.set(0, 10, -1.0);
wall.receiveShadow = true;
scene.add(wall);

// the device ↔ wall gap drives the whole shadow character, like a real
// studio wall: the lateral offset comes free from light projection, the
// penumbra widens with the gap, and the shadow fades as the device
// moves away from the surface
export function setWallGap(g) {
  wall.position.z = -g;
  key.shadow.radius = 2 + g * 7;
  key.shadow.intensity = Math.max(0.3, 1.05 - g * 0.16);
}
setWallGap(1);

const floorMat = new THREE.MeshStandardMaterial({ color: 0xcfcac2, roughness: 0.9, metalness: 0 });
const floor = new THREE.Mesh(new THREE.PlaneGeometry(90, 46), floorMat);
floor.rotation.x = -Math.PI / 2;
floor.position.z = 20;
floor.receiveShadow = true;
scene.add(floor);

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
  presets: BACKGROUNDS.presets.map((b) => b.name),
  wallpapers: BACKGROUNDS.wallpapers.map((b) => b.name),
  colors: BACKGROUNDS.colors.map((b) => b.name),
};

const wallTexCache = {};
let bgSel = { tab: "wallpapers", index: 0 };

export function setBackground(tab, index) {
  bgSel = { tab, index };
  const item = BACKGROUNDS[tab][index];
  if (tab === "colors") {
    wallMat.map = null;
    wallMat.color.set(item.hex);
    floorMat.color.set(item.hex).multiplyScalar(0.82);
  } else {
    const k = tab + index;
    if (!wallTexCache[k]) {
      const t = drawToTexture(item.draw, 1024, 640);
      // show the full artwork in a ~20x12.5 world-unit window around the
      // device; clamped edges extend outward across the rest of the wall.
      // uv_tex = uv_wall * repeat + offset, so repeat = 1/window, and the
      // window in wall-uv space is u 0.389..0.611, v 0.188..0.466
      t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
      const u0 = 0.5 - 10 / 90, uw = 20 / 90;
      const v0 = (2.2 - 6.25 + 12.5) / 45, vw = 12.5 / 45;
      t.repeat.set(1 / uw, 1 / vw);
      t.offset.set(-u0 / uw, -v0 / vw);
      wallTexCache[k] = t;
    }
    wallMat.map = wallTexCache[k];
    wallMat.color.set(0xffffff);
    floorMat.color.set(item.floor);
  }
  wallMat.needsUpdate = true;
}

export function setBackgroundType(type) {
  wall.visible = type !== "transparent";
  floor.visible = type === "stage" || type === "mirror";
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
}

// ---------- materials ----------
const bodyMat = new THREE.MeshPhysicalMaterial({
  color: 0x3a3a3e,
  metalness: 0.85,
  roughness: 0.32,
  clearcoat: 0.6,
  clearcoatRoughness: 0.25,
});
const darkMat = new THREE.MeshStandardMaterial({ color: 0x0c0c0f, metalness: 0.3, roughness: 0.5 });

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
}

// ---------- devices ----------
function shadowed(mesh) {
  mesh.castShadow = true;
  return mesh;
}

function buildPhone(mats) {
  const g = new THREE.Group();
  g.add(shadowed(new THREE.Mesh(slabGeo(1.45, 3.0, 0.1, 0.24), mats.body)));
  const scr = new THREE.Mesh(screenGeo(1.39, 2.94, 0.21), mats.screen);
  scr.position.z = 0.075;
  g.add(scr);
  // dynamic island
  const island = new THREE.Mesh(screenGeo(0.36, 0.1, 0.05), mats.dark);
  island.position.set(0, 1.3, 0.077);
  g.add(island);
  // side buttons: action + volumes (left), power (right)
  const btn = (wd, x, y) => {
    const b = new THREE.Mesh(new THREE.BoxGeometry(0.035, wd, 0.045), mats.body);
    b.position.set(x, y, 0);
    g.add(b);
  };
  btn(0.12, -0.745, 1.05);
  btn(0.22, -0.745, 0.78);
  btn(0.22, -0.745, 0.5);
  btn(0.3, 0.745, 0.75);
  g.position.y = 1.85;
  return { group: g, aspect: 1.39 / 2.94 };
}

function buildTablet(mats) {
  const g = new THREE.Group();
  g.add(shadowed(new THREE.Mesh(slabGeo(2.35, 3.15, 0.1, 0.16), mats.body)));
  const scr = new THREE.Mesh(screenGeo(2.19, 2.99, 0.1), mats.screen);
  scr.position.z = 0.075;
  g.add(scr);
  g.position.y = 1.85;
  return { group: g, aspect: 2.19 / 2.99 };
}

function buildLaptop(mats) {
  const g = new THREE.Group();
  const lid = new THREE.Group();
  const lidBody = shadowed(new THREE.Mesh(slabGeo(4.0, 2.55, 0.08, 0.1), mats.body));
  lidBody.position.y = 1.275;
  lid.add(lidBody);
  const scr = new THREE.Mesh(screenGeo(3.78, 2.33, 0.05), mats.screen);
  scr.position.set(0, 1.275, 0.062);
  lid.add(scr);
  lid.rotation.x = -0.16;
  g.add(lid);

  const base = shadowed(new THREE.Mesh(slabGeo(4.0, 2.6, 0.1, 0.1), mats.body));
  base.rotation.x = -Math.PI / 2;
  base.position.set(0, -0.03, 1.3);
  g.add(base);
  const kb = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 1.5), mats.dark);
  kb.rotation.x = -Math.PI / 2;
  kb.position.set(0, 0.045, 1.05);
  g.add(kb);

  g.position.set(0, 1.0, -0.2);
  return { group: g, aspect: 3.78 / 2.33 };
}

function buildCard(mats) {
  const g = new THREE.Group();
  g.add(shadowed(new THREE.Mesh(slabGeo(3.7, 2.45, 0.07, 0.12), mats.body)));
  const scr = new THREE.Mesh(screenGeo(3.58, 2.33, 0.08), mats.screen);
  scr.position.z = 0.055;
  g.add(scr);
  g.position.y = 1.85;
  return { group: g, aspect: 3.58 / 2.33 };
}

const realMats = { body: bodyMat, dark: darkMat, screen: screenMat };
const mirrorMats = { body: mirrorBodyMat, dark: mirrorDarkMat, screen: mirrorScreenMat };
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
const baseRot = { x: 0, y: 0, z: 0 }; // degrees

export function setRotation(axis, deg) {
  baseRot[axis] = deg;
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
  baseRot.y = wrap180(baseRot.y + (e.clientX - px) * 0.35);
  baseRot.x = wrap180(baseRot.x + (e.clientY - py) * 0.35);
  px = e.clientX;
  py = e.clientY;
  if (rotationHook) rotationHook({ ...baseRot }, true);
});
stage.addEventListener("pointerup", () => {
  dragging = false;
  stage.classList.remove("dragging");
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
  baseRot.x = a.rot[0];
  baseRot.y = a.rot[1];
  baseRot.z = a.rot[2];
  return { ...baseRot };
}

export function resetCamera() {
  return setAngle("Hero");
}

// ---------- public controls ----------
const state = { float: !reducedMotion, spin: false };
let exportScale = 2;

export function setDevice(name) {
  if (!devices[name] || name === activeDevice) return;
  devices[activeDevice].group.visible = false;
  mirrors[activeDevice].group.visible = false;
  activeDevice = name;
  devices[activeDevice].group.visible = true;
  mirrors[activeDevice].group.visible = true;
  view.tRadius = devices[activeDevice].radius;
  fitCover();
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
  key.castShadow = on;
}

export function setFloat(on) {
  state.float = on;
}

export function setSpin(on) {
  state.spin = on;
}

export function setExportScale(n) {
  exportScale = n;
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
export function exportPNG() {
  const w = innerWidth, h = innerHeight;
  camera.clearViewOffset();
  camera.updateProjectionMatrix();
  renderer.setPixelRatio(1);
  renderer.setSize(w * exportScale, h * exportScale, false);
  renderer.render(scene, camera);
  const url = renderer.domElement.toDataURL("image/png");
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.setSize(w, h, false);
  layout();
  const a = document.createElement("a");
  a.href = url;
  a.download = `turntable-${activeDevice}-${exportScale}x.png`;
  a.click();
}

// ---------- loop ----------
const D2R = Math.PI / 180;
const clock = new THREE.Clock();

function tick() {
  requestAnimationFrame(tick);
  const t = clock.getElapsedTime();
  if (state.spin && !dragging) {
    baseRot.y = wrap180(baseRot.y + 0.2);
    if (rotationHook) rotationHook({ ...baseRot }, false);
  }
  view.radius += (view.tRadius - view.radius) * 0.12;
  applyCamera();

  const d = devices[activeDevice];
  const g = d.group;
  const floatY = state.float ? Math.sin(t * 1.1) * 0.06 : 0;
  const floatZ = state.float ? Math.sin(t * 0.6) * 0.012 : 0;
  g.position.y = d.baseY + floatY;
  g.rotation.set(baseRot.x * D2R, baseRot.y * D2R, baseRot.z * D2R + floatZ);

  if (mirrorRoot.visible) {
    const m = mirrors[activeDevice].group;
    m.position.copy(g.position);
    m.rotation.copy(g.rotation);
  }
  renderer.render(scene, camera);
}
setAngle("Hero");
tick();
