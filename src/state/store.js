const STORAGE_KEY = "turntable.editor.v2";
const MAX_HISTORY = 80;

export const DEFAULT_STATE = Object.freeze({
  version: 2,
  project: {
    name: "Untitled composition",
  },
  source: {
    name: "Starter artwork",
    width: 1000,
    height: 2000,
    aspect: 0.5,
    hasCustomImage: false,
    scale: 1,
    x: 0,
    y: 0,
  },
  camera: {
    angle: "Hero",
    rotation: { x: -4, y: 24, z: 0 },
  },
  device: {
    type: "phone",
    finish: "Natural titanium",
    glare: true,
  },
  environment: {
    lighting: "studio",
    intensity: 1,
    backgroundType: "flat",
    background: { tab: "studios", index: 0 },
    shadows: true,
    float: false,
    spin: false,
    wallGap: 1,
    keyLight: {
      x: 0,
      y: 0,
      z: 0,
      strength: 1,
      softness: 1,
      shadowDensity: 1,
    },
  },
  export: {
    format: "png",
    width: 2400,
    height: 1600,
    quality: 0.92,
    transparent: false,
  },
  ui: {
    panelOpen: true,
    openSections: {
      source: true,
      camera: true,
      device: false,
      environment: false,
      background: false,
    },
  },
});

function clone(value) {
  return structuredClone(value);
}

function isObject(value) {
  return value != null && typeof value === "object" && !Array.isArray(value);
}

function mergeDefaults(base, value) {
  if (!isObject(base)) return value === undefined ? base : value;
  const merged = {};
  for (const key of Object.keys(base)) {
    merged[key] = isObject(base[key])
      ? mergeDefaults(base[key], isObject(value?.[key]) ? value[key] : {})
      : value?.[key] === undefined ? base[key] : value[key];
  }
  return merged;
}

function loadState() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    return mergeDefaults(DEFAULT_STATE, saved);
  } catch {
    return clone(DEFAULT_STATE);
  }
}

function atPath(target, path) {
  const parts = Array.isArray(path) ? path : path.split(".");
  let cursor = target;
  for (let i = 0; i < parts.length - 1; i++) cursor = cursor[parts[i]];
  return { cursor, key: parts.at(-1) };
}

function same(a, b) {
  return JSON.stringify(a) === JSON.stringify(b);
}

let state = loadState();
let past = [];
let future = [];
let gestureStart = null;
let saveTimer = 0;
let saveStatus = "saved";
const listeners = new Set();

function emit(type, label = "") {
  const detail = { type, label, canUndo: past.length > 0, canRedo: future.length > 0, saveStatus };
  for (const listener of listeners) listener(state, detail);
}

function queueSave() {
  saveStatus = "saving";
  clearTimeout(saveTimer);
  saveTimer = window.setTimeout(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      saveStatus = "saved";
    } catch {
      saveStatus = "error";
    }
    emit("save");
  }, 320);
}

function pushHistory(snapshot) {
  past.push(snapshot);
  if (past.length > MAX_HISTORY) past.shift();
  future = [];
}

export const editorStore = {
  get() {
    return state;
  },

  subscribe(listener) {
    listeners.add(listener);
    listener(state, { type: "init", label: "", canUndo: past.length > 0, canRedo: future.length > 0, saveStatus });
    return () => listeners.delete(listener);
  },

  set(path, value, options = {}) {
    const before = clone(state);
    const next = clone(state);
    const { cursor, key } = atPath(next, path);
    if (same(cursor[key], value)) return;
    cursor[key] = clone(value);
    state = next;
    if (options.history !== false && !gestureStart) pushHistory(before);
    queueSave();
    emit(options.type || "change", options.label || "Edit");
  },

  patch(patch, options = {}) {
    const before = clone(state);
    const next = mergeDefaults(state, patch);
    if (same(state, next)) return;
    state = next;
    if (options.history !== false && !gestureStart) pushHistory(before);
    queueSave();
    emit(options.type || "change", options.label || "Edit");
  },

  beginGesture() {
    if (!gestureStart) gestureStart = clone(state);
  },

  endGesture(label = "Adjust value") {
    if (!gestureStart) return;
    if (!same(gestureStart, state)) pushHistory(gestureStart);
    gestureStart = null;
    emit("commit", label);
  },

  cancelGesture() {
    gestureStart = null;
  },

  undo() {
    const previous = past.pop();
    if (!previous) return;
    future.push(clone(state));
    state = previous;
    gestureStart = null;
    queueSave();
    emit("undo", "Undo");
  },

  redo() {
    const next = future.pop();
    if (!next) return;
    past.push(clone(state));
    state = next;
    gestureStart = null;
    queueSave();
    emit("redo", "Redo");
  },

  reset() {
    const before = clone(state);
    state = clone(DEFAULT_STATE);
    pushHistory(before);
    queueSave();
    emit("reset", "Reset project");
  },
};
