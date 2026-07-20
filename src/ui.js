import * as scene from "./scene.js";
import { DEFAULT_STATE, editorStore } from "./state/store.js";
import { clearStoredSource, restoreSource, saveSource } from "./state/source-storage.js";

const controls = document.getElementById("controls");
const inspectorPanel = document.getElementById("panel");
const popoverLayer = document.getElementById("popoverLayer");
const toastRegion = document.getElementById("toastRegion");
const frameGuide = document.getElementById("frameGuide");
const syncers = [];

const ICONS = {
  undo: '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M9 7 5 11l4 4" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/><path d="M6 11h7.5a5 5 0 0 1 5 5v1" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>',
  redo: '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="m15 7 4 4-4 4" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/><path d="M18 11h-7.5a5 5 0 0 0-5 5v1" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>',
  sliders: '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M4 7h10M18 7h2M4 17h2M10 17h10M14 4v6M7 14v6" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>',
  export: '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 15V4m0 0L8 8m4-4 4 4M5 13v5a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-5" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  sparkles: '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="m12 3 .8 2.2A5.3 5.3 0 0 0 16 8.3l2.2.8-2.2.8a5.3 5.3 0 0 0-3.2 3.2l-.8 2.2-.8-2.2A5.3 5.3 0 0 0 8 9.9l-2.2-.8L8 8.3a5.3 5.3 0 0 0 3.2-3.1L12 3ZM18.5 14.5l.4 1.1a2.7 2.7 0 0 0 1.5 1.5l1.1.4-1.1.4a2.7 2.7 0 0 0-1.5 1.5l-.4 1.1-.4-1.1a2.7 2.7 0 0 0-1.5-1.5l-1.1-.4 1.1-.4a2.7 2.7 0 0 0 1.5-1.5l.4-1.1Z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/></svg>',
  close: '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="m7 7 10 10M17 7 7 17" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>',
  chevron: '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="m7 10 5 5 5-5" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  image: '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><rect x="3.5" y="4" width="17" height="16" rx="3" stroke="currentColor" stroke-width="1.6"/><circle cx="8.5" cy="9" r="1.4" stroke="currentColor" stroke-width="1.4"/><path d="m5.5 17 4.2-4.2 3.1 3.1 2.1-2.1 3.6 3.2" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  camera: '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><rect x="3" y="6.5" width="18" height="13" rx="3" stroke="currentColor" stroke-width="1.6"/><path d="m8 6.5 1.2-2h5.6l1.2 2" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><circle cx="12" cy="13" r="3.5" stroke="currentColor" stroke-width="1.6"/></svg>',
  device: '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><rect x="6" y="2.5" width="12" height="19" rx="3.5" stroke="currentColor" stroke-width="1.6"/><path d="M10 5.5h4M11 18.5h2" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>',
  sun: '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="12" cy="12" r="3.8" stroke="currentColor" stroke-width="1.6"/><path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M18.7 5.3l-1.4 1.4M6.7 17.3l-1.4 1.4" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>',
  layers: '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="m12 3 9 5-9 5-9-5 9-5Z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><path d="m5 12 7 4 7-4M5 16l7 4 7-4" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  upload: '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 15V5m0 0L8.5 8.5M12 5l3.5 3.5M5 14v4a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-4" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  link: '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="m9.5 14.5 5-5M7.8 16.2l-1 1a3.5 3.5 0 1 1-5-5l3.4-3.4a3.5 3.5 0 0 1 5 0M16.2 7.8l1-1a3.5 3.5 0 1 1 5 5l-3.4 3.4a3.5 3.5 0 0 1-5 0" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>',
  trash: '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M5 7h14M9 4h6l1 3M8 10v7M12 10v7M16 10v7M7 7l1 14h8l1-14" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  reset: '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M6.3 7.2A8 8 0 1 1 4 12M6.3 7.2V3.5m0 3.7H10" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  check: '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="m6 12.5 4 4 8-9" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/></svg>',
};

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}

function addLabel(parent, title, detail = "") {
  const label = el("div", "control-label");
  label.append(el("span", null, title), el("span", null, detail));
  parent.appendChild(label);
  return label;
}

function stack(parent, title, detail = "") {
  const wrap = el("div", "control-stack");
  addLabel(wrap, title, detail);
  parent.appendChild(wrap);
  return wrap;
}

function accordion({ id, title, icon, summary }) {
  const root = el("section", "accordion");
  root.dataset.open = "false";
  const trigger = el("button", "accordion__trigger");
  trigger.type = "button";
  trigger.setAttribute("aria-expanded", "false");
  const contentId = `accordion-${id}`;
  trigger.setAttribute("aria-controls", contentId);
  const iconWrap = el("span", "accordion__icon");
  iconWrap.innerHTML = ICONS[icon];
  const titleNode = el("span", "accordion__title", title);
  const summaryNode = el("span", "accordion__summary");
  const chevron = el("span", "accordion__chevron");
  chevron.innerHTML = ICONS.chevron;
  trigger.append(iconWrap, titleNode, summaryNode, chevron);
  const collapsible = el("div", "accordion__collapsible");
  collapsible.id = contentId;
  const clip = el("div", "accordion__clip");
  const body = el("div", "accordion__body");
  clip.appendChild(body);
  collapsible.appendChild(clip);
  root.append(trigger, collapsible);
  controls.appendChild(root);

  trigger.addEventListener("click", () => {
    editorStore.set(`ui.openSections.${id}`, !editorStore.get().ui.openSections[id], { history: false, label: `${title} section` });
  });
  syncers.push((state) => {
    const open = Boolean(state.ui.openSections[id]);
    root.dataset.open = String(open);
    trigger.setAttribute("aria-expanded", String(open));
    collapsible.setAttribute("aria-hidden", String(!open));
    clip.inert = !open;
    summaryNode.textContent = summary(state);
  });
  return body;
}

function chipGroup(parent, { items, value, onPick, columns = 3 }) {
  const wrap = el("div", "chips");
  wrap.dataset.columns = String(columns);
  const options = items.map((item) => typeof item === "string" ? { value: item, label: item } : item);
  const buttons = options.map((item) => {
    const button = el("button", "chip", item.label);
    button.type = "button";
    button.setAttribute("aria-pressed", "false");
    button.addEventListener("click", () => onPick(item.value));
    wrap.appendChild(button);
    return { button, item };
  });
  parent.appendChild(wrap);
  const sync = (state) => {
    const active = value(state);
    for (const { button, item } of buttons) button.setAttribute("aria-pressed", String(item.value === active));
  };
  syncers.push(sync);
  return sync;
}

function scrubber(parent, { label, min, max, step, initial, format, value, onInput, commitLabel }) {
  const scrub = el("div", "scrub");
  scrub.tabIndex = 0;
  scrub.setAttribute("role", "slider");
  scrub.setAttribute("aria-label", label);
  scrub.setAttribute("aria-valuemin", String(min));
  scrub.setAttribute("aria-valuemax", String(max));
  const fill = el("div", "scrub__fill");
  const labelNode = el("span", "scrub__label", label);
  const valueNode = el("span", "scrub__value");
  scrub.append(fill, labelNode, valueNode);
  parent.appendChild(scrub);

  let current = initial;
  let dragging = false;
  let startX = 0;
  let startValue = current;
  const setVisual = (next) => {
    current = Number(next);
    fill.style.width = `${((current - min) / (max - min)) * 100}%`;
    valueNode.textContent = format ? format(current) : String(current);
    scrub.setAttribute("aria-valuenow", String(current));
  };
  const update = (next) => {
    const clamped = Math.min(max, Math.max(min, Math.round(next / step) * step));
    onInput(+clamped.toFixed(4));
  };
  const finish = () => {
    if (!dragging) return;
    dragging = false;
    editorStore.endGesture(commitLabel || `Adjust ${label}`);
  };
  scrub.addEventListener("pointerdown", (event) => {
    dragging = true;
    startX = event.clientX;
    startValue = current;
    editorStore.beginGesture();
    scrub.setPointerCapture(event.pointerId);
  });
  scrub.addEventListener("pointermove", (event) => {
    if (dragging) update(startValue + ((event.clientX - startX) / scrub.clientWidth) * (max - min));
  });
  scrub.addEventListener("pointerup", finish);
  scrub.addEventListener("pointercancel", finish);
  scrub.addEventListener("dblclick", () => {
    editorStore.beginGesture();
    update(initial);
    editorStore.endGesture(`Reset ${label}`);
  });
  scrub.addEventListener("keydown", (event) => {
    const direction = (event.key === "ArrowRight" || event.key === "ArrowUp") ? 1 : (event.key === "ArrowLeft" || event.key === "ArrowDown") ? -1 : 0;
    if (!direction) return;
    event.preventDefault();
    editorStore.beginGesture();
    update(current + step * direction);
    editorStore.endGesture(commitLabel || `Adjust ${label}`);
  });
  const sync = (state) => setVisual(value(state));
  syncers.push(sync);
  return { set: setVisual, sync };
}

let toggleId = 0;
function toggleRow(parent, { label, description, value, onChange, disabled = () => false }) {
  const row = el("div", "toggle-row");
  const copy = el("label", "toggle-row__copy");
  const id = `toggle-${++toggleId}`;
  copy.htmlFor = id;
  copy.append(el("strong", null, label), el("span", null, description));
  const control = el("span", "switch");
  const input = document.createElement("input");
  input.type = "checkbox";
  input.id = id;
  const track = el("span", "switch__track");
  control.append(input, track);
  row.append(copy, control);
  parent.appendChild(row);
  input.addEventListener("change", () => onChange(input.checked));
  syncers.push((state) => {
    input.checked = Boolean(value(state));
    input.disabled = Boolean(disabled(state));
  });
  return input;
}

function selectControl(parent, { options, value, onChange }) {
  const wrap = el("div", "select-wrap");
  const select = document.createElement("select");
  for (const option of options) {
    const item = document.createElement("option");
    item.value = option.value;
    item.textContent = option.label;
    select.appendChild(item);
  }
  select.addEventListener("change", () => onChange(select.value));
  wrap.appendChild(select);
  parent.appendChild(wrap);
  syncers.push((state) => { select.value = value(state); });
  return select;
}

function toast(message) {
  toastRegion.textContent = "";
  const node = el("div", "toast");
  node.innerHTML = `${ICONS.check}<span>${message}</span>`;
  toastRegion.appendChild(node);
  window.setTimeout(() => node.remove(), 3000);
}

// Source
const sourceBody = accordion({
  id: "source",
  title: "Source image",
  icon: "image",
  summary: (state) => state.source.name,
});
const sourceCard = el("div", "source-card");
const sourcePreview = el("div", "source-preview");
const sourceCopy = el("div", "source-copy");
const sourceName = el("strong");
const sourceDimensions = el("span");
const sourceActions = el("div", "source-actions");
const replaceSource = el("button", "source-action");
replaceSource.type = "button";
replaceSource.innerHTML = `${ICONS.upload}<span>Replace</span>`;
replaceSource.addEventListener("click", scene.openUpload);
const urlSource = el("button", "source-action");
urlSource.type = "button";
urlSource.setAttribute("aria-expanded", "false");
urlSource.innerHTML = `${ICONS.link}<span>From URL</span>`;
const clearSource = el("button", "source-action source-action--icon");
clearSource.type = "button";
clearSource.title = "Clear source image";
clearSource.setAttribute("aria-label", "Clear source image");
clearSource.innerHTML = ICONS.trash;
clearSource.addEventListener("click", async () => {
  scene.resetSource({ notify: false });
  await clearStoredSource();
  editorStore.patch({ source: { ...DEFAULT_STATE.source } }, { history: false, label: "Clear source image" });
  sourcePreview.style.backgroundImage = `url(${scene.getSourcePreview()})`;
  toast("Source image cleared");
});
sourceActions.append(replaceSource, urlSource, clearSource);
sourceCopy.append(sourceName, sourceDimensions, sourceActions);
sourceCard.append(sourcePreview, sourceCopy);
sourceBody.appendChild(sourceCard);

const sourceUrlForm = el("form", "source-url-form");
sourceUrlForm.hidden = true;
const sourceUrlInput = el("input", "source-url-input");
sourceUrlInput.type = "url";
sourceUrlInput.inputMode = "url";
sourceUrlInput.autocomplete = "url";
sourceUrlInput.placeholder = "https://example.com/image.png";
sourceUrlInput.setAttribute("aria-label", "Image URL");
const sourceUrlSubmit = el("button", "source-action source-action--primary", "Add image");
sourceUrlSubmit.type = "submit";
const sourceUrlMessage = el("p", "source-url-message");
sourceUrlMessage.setAttribute("role", "status");
sourceUrlForm.append(sourceUrlInput, sourceUrlSubmit, sourceUrlMessage);
sourceBody.appendChild(sourceUrlForm);

urlSource.addEventListener("click", () => {
  sourceUrlForm.hidden = !sourceUrlForm.hidden;
  urlSource.setAttribute("aria-expanded", String(!sourceUrlForm.hidden));
  sourceUrlMessage.textContent = "";
  if (!sourceUrlForm.hidden) sourceUrlInput.focus();
});

sourceUrlForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const url = sourceUrlInput.value.trim();
  if (!url) {
    sourceUrlMessage.textContent = "Paste a direct link to an image.";
    sourceUrlInput.focus();
    return;
  }
  sourceUrlSubmit.disabled = true;
  sourceUrlSubmit.textContent = "Loading…";
  sourceUrlMessage.textContent = "Fetching image…";
  try {
    await scene.loadImageUrl(url);
    sourceUrlInput.value = "";
    sourceUrlMessage.textContent = "";
    sourceUrlForm.hidden = true;
    urlSource.setAttribute("aria-expanded", "false");
  } catch (error) {
    sourceUrlMessage.textContent = error.message || "The image could not be loaded.";
  } finally {
    sourceUrlSubmit.disabled = false;
    sourceUrlSubmit.textContent = "Add image";
  }
});

const sourceFraming = stack(sourceBody, "Framing", "Double-click a value to reset");
scrubber(sourceFraming, {
  label: "Scale", min: 1, max: 3, step: 0.02, initial: 1,
  format: (v) => `${v.toFixed(2)}×`, value: (state) => state.source.scale,
  onInput: (v) => editorStore.set("source.scale", v, { history: false }),
});
scrubber(sourceFraming, {
  label: "Horizontal", min: -1, max: 1, step: 0.02, initial: 0,
  format: (v) => `${Math.round(v * 100)}%`, value: (state) => state.source.x,
  onInput: (v) => editorStore.set("source.x", v, { history: false }),
});
scrubber(sourceFraming, {
  label: "Vertical", min: -1, max: 1, step: 0.02, initial: 0,
  format: (v) => `${Math.round(v * 100)}%`, value: (state) => state.source.y,
  onInput: (v) => editorStore.set("source.y", v, { history: false }),
});
syncers.push((state) => {
  sourceName.textContent = state.source.name;
  sourceDimensions.textContent = `${state.source.width} × ${state.source.height}px`;
  clearSource.disabled = !state.source.hasCustomImage;
});

// Camera
const cameraBody = accordion({
  id: "camera",
  title: "Camera",
  icon: "camera",
  summary: (state) => state.camera.angle || "Custom angle",
});
const angleStack = stack(cameraBody, "Composition angles");
chipGroup(angleStack, {
  items: Object.keys(scene.ANGLES),
  value: (state) => state.camera.angle,
  onPick: (name) => {
    const angle = scene.ANGLES[name];
    editorStore.patch({
      camera: { angle: name, rotation: { x: angle.rot[0], y: angle.rot[1], z: angle.rot[2] } },
    }, { label: `Set ${name} angle` });
  },
});
const rotationStack = stack(cameraBody, "Rotation", "Degrees");
const rotationScrubbers = {};
for (const axis of ["x", "y", "z"]) {
  rotationScrubbers[axis] = scrubber(rotationStack, {
    label: axis.toUpperCase(), min: -180, max: 180, step: 1, initial: axis === "x" ? -4 : axis === "y" ? 24 : 0,
    format: (v) => `${Math.round(v)}°`, value: (state) => state.camera.rotation[axis],
    onInput: (v) => editorStore.patch({
      camera: { angle: null, rotation: { ...editorStore.get().camera.rotation, [axis]: v } },
    }, { history: false }),
    commitLabel: `Rotate ${axis.toUpperCase()}`,
  });
}
const resetCamera = el("button", "plain-button section-action");
resetCamera.type = "button";
resetCamera.innerHTML = `${ICONS.reset}<span>Reset camera</span>`;
resetCamera.addEventListener("click", () => {
  const angle = scene.ANGLES.Hero;
  editorStore.patch({ camera: { angle: "Hero", rotation: { x: angle.rot[0], y: angle.rot[1], z: angle.rot[2] } } }, { label: "Reset camera" });
});
cameraBody.appendChild(resetCamera);

// Device
const DEVICE_OPTIONS = [
  { value: "phone", label: "iPhone Pro" },
  { value: "tablet", label: "iPad Pro 13″" },
  { value: "laptop", label: "MacBook Pro 14″" },
  { value: "card", label: "Browser Frame" },
];
const deviceBody = accordion({
  id: "device",
  title: "Device",
  icon: "device",
  summary: (state) => DEVICE_OPTIONS.find((item) => item.value === state.device.type)?.label || state.device.type,
});
const modelStack = stack(deviceBody, "Model");
selectControl(modelStack, {
  options: DEVICE_OPTIONS,
  value: (state) => state.device.type,
  onChange: (value) => editorStore.set("device.type", value, { label: "Change device" }),
});
const finishStack = stack(deviceBody, "Finish");
chipGroup(finishStack, {
  items: Object.keys(scene.FINISHES),
  value: (state) => state.device.finish,
  onPick: (value) => editorStore.set("device.finish", value, { label: "Change finish" }),
  columns: 2,
});
const deviceToggles = el("div", "control-stack");
toggleRow(deviceToggles, {
  label: "Glass glare", description: "Add a polished light sweep",
  value: (state) => state.device.glare,
  onChange: (value) => editorStore.set("device.glare", value, { label: "Toggle glass glare" }),
});
deviceBody.appendChild(deviceToggles);

// Environment
const environmentBody = accordion({
  id: "environment",
  title: "Light & environment",
  icon: "sun",
  summary: (state) => state.environment.lighting[0].toUpperCase() + state.environment.lighting.slice(1),
});
const lightingStack = stack(environmentBody, "Lighting mood");
chipGroup(lightingStack, {
  items: [
    { value: "studio", label: "Studio" },
    { value: "bright", label: "Bright" },
    { value: "noir", label: "Noir" },
  ],
  value: (state) => state.environment.lighting,
  onPick: (value) => editorStore.set("environment.lighting", value, { label: "Change lighting" }),
});
const environmentScrubs = stack(environmentBody, "Light placement");
scrubber(environmentScrubs, {
  label: "Intensity", min: 0.4, max: 2, step: 0.05, initial: 1,
  format: (v) => v.toFixed(2), value: (state) => state.environment.intensity,
  onInput: (v) => editorStore.set("environment.intensity", v, { history: false }),
});
scrubber(environmentScrubs, {
  label: "Wall distance", min: 0.3, max: 4, step: 0.05, initial: 1,
  format: (v) => v.toFixed(2), value: (state) => state.environment.wallGap,
  onInput: (v) => editorStore.set("environment.wallGap", v, { history: false }),
});
const environmentToggles = el("div", "control-stack");
toggleRow(environmentToggles, {
  label: "Shadows", description: "Ground the device in the scene",
  value: (state) => state.environment.shadows,
  onChange: (value) => editorStore.set("environment.shadows", value, { label: "Toggle shadows" }),
});
toggleRow(environmentToggles, {
  label: "Float", description: "Lift the device from the surface",
  value: (state) => state.environment.float,
  onChange: (value) => editorStore.set("environment.float", value, { label: "Toggle float" }),
});
toggleRow(environmentToggles, {
  label: "Auto-rotate", description: "Preview the composition from every side",
  value: (state) => state.environment.spin,
  onChange: (value) => editorStore.set("environment.spin", value, { label: "Toggle auto-rotate" }),
});
environmentBody.appendChild(environmentToggles);

// Background
const BACKGROUND_TYPES = [
  { value: "flat", label: "Wall" },
  { value: "stage", label: "Cove" },
  { value: "mirror", label: "Mirror" },
  { value: "transparent", label: "None" },
];
const backgroundBody = accordion({
  id: "background",
  title: "Background",
  icon: "layers",
  summary: (state) => scene.backgroundNames[state.environment.background.tab]?.[state.environment.background.index] || "Custom",
});
const typeStack = stack(backgroundBody, "Surface");
chipGroup(typeStack, {
  items: BACKGROUND_TYPES,
  value: (state) => state.environment.backgroundType,
  onPick: (value) => editorStore.set("environment.backgroundType", value, { label: "Change background surface" }),
  columns: 4,
});
const libraryStack = stack(backgroundBody, "Library");
const tabs = el("div", "tabs");
const thumbs = el("div", "thumbs");
const BACKGROUND_TABS = [
  ["studios", "Studios"],
  ["presets", "Presets"],
  ["wallpapers", "Art"],
  ["colors", "Colors"],
];
let activeBackgroundTab = editorStore.get().environment.background.tab;
let renderedBackgroundSelection = `${editorStore.get().environment.background.tab}:${editorStore.get().environment.background.index}`;
let backgroundThumbButtons = [];
function renderBackgroundLibrary() {
  tabs.textContent = "";
  thumbs.textContent = "";
  backgroundThumbButtons = [];
  for (const [id, label] of BACKGROUND_TABS) {
    const button = el("button", "tab", label);
    button.type = "button";
    button.setAttribute("role", "tab");
    button.setAttribute("aria-selected", String(id === activeBackgroundTab));
    button.addEventListener("click", () => {
      activeBackgroundTab = id;
      renderBackgroundLibrary();
    });
    tabs.appendChild(button);
  }
  scene.backgroundNames[activeBackgroundTab].forEach((name, index) => {
    const button = el("button", "thumb");
    button.type = "button";
    button.title = name;
    button.setAttribute("aria-label", `Background: ${name}`);
    const selected = editorStore.get().environment.background;
    button.setAttribute("aria-pressed", String(selected.tab === activeBackgroundTab && selected.index === index));
    button.style.backgroundImage = `url(${scene.thumbFor(activeBackgroundTab, index)})`;
    button.addEventListener("click", () => {
      editorStore.set("environment.background", { tab: activeBackgroundTab, index }, { label: "Change background" });
      renderBackgroundLibrary();
    });
    thumbs.appendChild(button);
    backgroundThumbButtons.push({ button, tab: activeBackgroundTab, index });
  });
}
libraryStack.append(tabs, thumbs);
renderBackgroundLibrary();
syncers.push((state) => {
  const selected = state.environment.background;
  const selectionKey = `${selected.tab}:${selected.index}`;
  if (selectionKey !== renderedBackgroundSelection) {
    renderedBackgroundSelection = selectionKey;
    activeBackgroundTab = selected.tab;
    renderBackgroundLibrary();
    return;
  }
  for (const item of backgroundThumbButtons) {
    item.button.setAttribute("aria-pressed", String(item.tab === selected.tab && item.index === selected.index));
  }
});

// Command bar and panel
const undoButton = document.getElementById("undoButton");
const redoButton = document.getElementById("redoButton");
const presetsButton = document.getElementById("presetsButton");
const exportButton = document.getElementById("exportButton");
const inspectorToggle = document.getElementById("inspectorToggle");
const inspectorClose = document.getElementById("inspectorClose");
const mobileEditorButton = document.getElementById("mobileEditorButton");
const projectName = document.getElementById("projectName");
const saveStatus = document.getElementById("saveStatus");
presetsButton.setAttribute("aria-label", "Presets");
exportButton.setAttribute("aria-label", "Export");

undoButton.addEventListener("click", editorStore.undo);
redoButton.addEventListener("click", editorStore.redo);

function setPanel(open) {
  editorStore.set("ui.panelOpen", open, { history: false, label: "Toggle inspector" });
}
inspectorToggle.addEventListener("click", () => setPanel(!editorStore.get().ui.panelOpen));
inspectorClose.addEventListener("click", () => setPanel(false));
mobileEditorButton.addEventListener("click", () => setPanel(true));

projectName.addEventListener("focus", () => editorStore.beginGesture());
projectName.addEventListener("input", () => editorStore.set("project.name", projectName.value, { history: false, label: "Rename project" }));
projectName.addEventListener("blur", () => editorStore.endGesture("Rename project"));
projectName.addEventListener("keydown", (event) => {
  if (event.key === "Enter") projectName.blur();
});

let activePopover = null;
let activePopoverSync = null;

function updateGuide() {
  if (activePopover !== "export") {
    frameGuide.style.display = "none";
    return;
  }
  const { width, height } = editorStore.get().export;
  const aspect = width / height;
  let guideWidth = innerWidth;
  let guideHeight = Math.round(guideWidth / aspect);
  if (guideHeight > innerHeight) {
    guideHeight = innerHeight;
    guideWidth = Math.round(guideHeight * aspect);
  }
  frameGuide.style.display = "block";
  frameGuide.style.width = `${guideWidth}px`;
  frameGuide.style.height = `${guideHeight}px`;
  frameGuide.style.left = `${(innerWidth - guideWidth) / 2}px`;
  frameGuide.style.top = `${(innerHeight - guideHeight) / 2}px`;
  scene.setExportAspect(aspect);
}

function closePopover() {
  activePopover = null;
  activePopoverSync = null;
  popoverLayer.textContent = "";
  frameGuide.style.display = "none";
  scene.setExportAspect(null);
  presetsButton.setAttribute("aria-expanded", "false");
  exportButton.setAttribute("aria-expanded", "false");
}

function popoverShell(kind, title, description) {
  closePopover();
  activePopover = kind;
  const popover = el("section", `popover popover--${kind}`);
  popover.setAttribute("role", "dialog");
  popover.setAttribute("aria-label", title);
  const header = el("header", "popover__header");
  const copy = el("div");
  copy.append(el("h2", null, title), el("p", null, description));
  const close = el("button", "icon-button");
  close.type = "button";
  close.setAttribute("aria-label", `Close ${title}`);
  close.innerHTML = ICONS.close;
  close.addEventListener("click", closePopover);
  header.append(copy, close);
  const body = el("div", "popover__body");
  popover.append(header, body);
  popoverLayer.appendChild(popover);
  return { popover, body };
}

function exportPopover() {
  const { popover, body } = popoverShell("export", "Export image", "Render the current composition at an exact size.");
  exportButton.setAttribute("aria-expanded", "true");

  const formatStack = stack(body, "Format");
  const formatButtons = new Map();
  const formatWrap = el("div", "chips");
  formatWrap.dataset.columns = "3";
  for (const format of ["png", "jpeg", "webp"]) {
    const button = el("button", "chip", format === "jpeg" ? "JPG" : format.toUpperCase());
    button.type = "button";
    button.addEventListener("click", () => editorStore.set("export.format", format, { label: "Change export format" }));
    formatWrap.appendChild(button);
    formatButtons.set(format, button);
  }
  formatStack.appendChild(formatWrap);

  const sizeLabel = addLabel(body, "Output size", "Pixels");
  sizeLabel.style.marginTop = "12px";
  const fields = el("div", "field-grid");
  const widthField = el("div", "field");
  const widthLabel = el("label", null, "Width");
  const widthInput = el("input", "number-input");
  widthInput.type = "number";
  widthInput.min = "320";
  widthInput.max = "7680";
  widthInput.step = "10";
  widthLabel.htmlFor = "export-width";
  widthInput.id = "export-width";
  widthField.append(widthLabel, widthInput);
  const heightField = el("div", "field");
  const heightLabel = el("label", null, "Height");
  const heightInput = el("input", "number-input");
  heightInput.type = "number";
  heightInput.min = "320";
  heightInput.max = "7680";
  heightInput.step = "10";
  heightLabel.htmlFor = "export-height";
  heightInput.id = "export-height";
  heightField.append(heightLabel, heightInput);
  fields.append(widthField, heightField);
  body.appendChild(fields);
  const commitDimension = (key, input) => {
    const value = Math.max(320, Math.min(7680, Number(input.value) || editorStore.get().export[key]));
    editorStore.set(`export.${key}`, Math.round(value), { label: `Set export ${key}` });
  };
  widthInput.addEventListener("change", () => commitDimension("width", widthInput));
  heightInput.addEventListener("change", () => commitDimension("height", heightInput));

  const presetWrap = el("div", "size-presets");
  const outputPresets = [
    ["Square", 2400, 2400],
    ["Portrait", 2160, 2700],
    ["Landscape", 2400, 1600],
    ["Slides", 2560, 1440],
  ];
  for (const [name, width, height] of outputPresets) {
    const button = el("button", "size-preset");
    button.type = "button";
    button.append(el("strong", null, name), el("span", null, `${width}×${height}`));
    button.addEventListener("click", () => editorStore.patch({ export: { width, height } }, { label: `Use ${name} export size` }));
    presetWrap.appendChild(button);
  }
  body.appendChild(presetWrap);

  const transparentWrap = el("div", "inline-toggle");
  const transparentInput = toggleRow(transparentWrap, {
    label: "Transparent canvas", description: "Remove the studio background",
    value: (state) => state.export.transparent,
    disabled: (state) => state.export.format === "jpeg",
    onChange: (value) => editorStore.set("export.transparent", value, { label: "Toggle transparent export" }),
  });
  body.appendChild(transparentWrap);
  const summary = el("div", "export-summary");
  body.appendChild(summary);

  const footer = el("footer", "popover__footer");
  const exportNow = el("button", "plain-button plain-button--primary");
  exportNow.type = "button";
  exportNow.innerHTML = `${ICONS.export}<span>Export image</span>`;
  exportNow.addEventListener("click", async () => {
    const original = exportNow.innerHTML;
    exportNow.disabled = true;
    exportNow.textContent = "Rendering…";
    try {
      const result = await scene.exportImage(editorStore.get().export);
      closePopover();
      toast(`Exported ${result.width} × ${result.height} ${result.format.toUpperCase()}`);
    } catch (error) {
      exportNow.innerHTML = original;
      exportNow.disabled = false;
      toast(error.message || "Export failed");
    }
  });
  footer.appendChild(exportNow);
  popover.appendChild(footer);

  activePopoverSync = (state) => {
    const output = state.export;
    for (const [format, button] of formatButtons) button.setAttribute("aria-pressed", String(format === output.format));
    if (document.activeElement !== widthInput) widthInput.value = String(output.width);
    if (document.activeElement !== heightInput) heightInput.value = String(output.height);
    transparentInput.checked = output.transparent;
    transparentInput.disabled = output.format === "jpeg";
    const megapixels = ((output.width * output.height) / 1_000_000).toFixed(1);
    summary.innerHTML = `<strong>${output.width} × ${output.height}px</strong> · ${megapixels} MP · ${output.format.toUpperCase()}`;
    updateGuide();
  };
  activePopoverSync(editorStore.get());
}

const COMPOSITION_PRESETS = [
  {
    name: "Editorial blue", detail: "Silver · studio · hero", image: scene.thumbFor("studios", 2),
    patch: { device: { type: "phone", finish: "Silver" }, camera: { angle: "Hero", rotation: { x: -4, y: 24, z: 0 } }, environment: { lighting: "studio", intensity: 1.05, backgroundType: "flat", background: { tab: "studios", index: 2 }, float: false } },
  },
  {
    name: "Soft sand", detail: "Laptop · cove · warm", image: scene.thumbFor("presets", 1),
    patch: { device: { type: "laptop", finish: "Desert" }, camera: { angle: "Isometric", rotation: { x: -16, y: 38, z: 0 } }, environment: { lighting: "studio", intensity: 1.1, backgroundType: "stage", background: { tab: "presets", index: 1 }, float: false } },
  },
  {
    name: "Noir float", detail: "Space black · dramatic", image: scene.thumbFor("wallpapers", 5),
    patch: { device: { type: "phone", finish: "Space black" }, camera: { angle: "Float", rotation: { x: -10, y: 22, z: 10 } }, environment: { lighting: "noir", intensity: 1.2, backgroundType: "flat", background: { tab: "wallpapers", index: 5 }, float: true } },
  },
  {
    name: "Gallery light", detail: "Browser · clean · centered", image: scene.thumbFor("colors", 0),
    patch: { device: { type: "card", finish: "Natural titanium" }, camera: { angle: "Centered", rotation: { x: 0, y: 0, z: 0 } }, environment: { lighting: "bright", intensity: 1.15, backgroundType: "flat", background: { tab: "colors", index: 0 }, float: false } },
  },
];

function presetsPopover() {
  const { body } = popoverShell("presets", "Composition presets", "Curated starting points that keep your source image intact.");
  presetsButton.setAttribute("aria-expanded", "true");
  const grid = el("div", "preset-grid");
  for (const preset of COMPOSITION_PRESETS) {
    const button = el("button", "preset-card");
    button.type = "button";
    button.style.backgroundImage = `url(${preset.image})`;
    button.append(el("strong", null, preset.name), el("span", null, preset.detail));
    button.addEventListener("click", () => {
      editorStore.patch(preset.patch, { label: `Apply ${preset.name} preset` });
      closePopover();
      toast(`${preset.name} applied`);
    });
    grid.appendChild(button);
  }
  body.appendChild(grid);
}

presetsButton.setAttribute("aria-haspopup", "dialog");
presetsButton.setAttribute("aria-expanded", "false");
exportButton.setAttribute("aria-haspopup", "dialog");
exportButton.setAttribute("aria-expanded", "false");
presetsButton.addEventListener("click", () => activePopover === "presets" ? closePopover() : presetsPopover());
exportButton.addEventListener("click", () => activePopover === "export" ? closePopover() : exportPopover());

document.addEventListener("pointerdown", (event) => {
  if (!activePopover) return;
  const popover = popoverLayer.querySelector(".popover");
  if (popover?.contains(event.target) || presetsButton.contains(event.target) || exportButton.contains(event.target)) return;
  closePopover();
});

window.addEventListener("resize", updateGuide);
window.addEventListener("keydown", (event) => {
  const command = event.metaKey || event.ctrlKey;
  if (command && event.key.toLowerCase() === "z") {
    event.preventDefault();
    if (event.shiftKey) editorStore.redo();
    else editorStore.undo();
    return;
  }
  if (event.key === "Escape") {
    if (activePopover) closePopover();
    else if (matchMedia("(max-width: 760px)").matches) setPanel(false);
  }
});

scene.onRotationInput((rotation, fromUser, phase) => {
  if (!fromUser) {
    for (const axis of ["x", "y", "z"]) rotationScrubbers[axis].set(rotation[axis]);
    return;
  }
  if (phase === "start") editorStore.beginGesture();
  if (phase === "update") {
    editorStore.patch({ camera: { angle: null, rotation } }, { history: false, label: "Rotate device" });
  }
  if (phase === "commit") editorStore.endGesture("Rotate device");
});

scene.onSourceChange(async (detail) => {
  if (!detail) return;
  editorStore.patch({
    source: {
      name: detail.name,
      width: detail.width,
      height: detail.height,
      aspect: detail.aspect,
      hasCustomImage: true,
      scale: 1,
      x: 0,
      y: 0,
    },
  }, { history: false, label: "Replace source image" });
  sourcePreview.style.backgroundImage = `url(${detail.previewUrl})`;
  await saveSource(detail.file);
  toast("Source image updated");
});

if (matchMedia("(max-width: 760px)").matches && editorStore.get().ui.panelOpen) {
  editorStore.set("ui.panelOpen", false, { history: false });
}

editorStore.subscribe((state, detail) => {
  scene.applyEditorState(state);
  for (const sync of syncers) sync(state);
  if (activePopoverSync) activePopoverSync(state);
  undoButton.disabled = !detail.canUndo;
  redoButton.disabled = !detail.canRedo;
  if (document.activeElement !== projectName) projectName.value = state.project.name;
  saveStatus.dataset.state = detail.saveStatus;
  saveStatus.textContent = detail.saveStatus === "saving" ? "Saving locally…" : detail.saveStatus === "error" ? "Couldn’t save" : "Saved locally";
  document.body.classList.toggle("panel-closed", !state.ui.panelOpen);
  inspectorPanel.inert = !state.ui.panelOpen;
  inspectorPanel.setAttribute("aria-hidden", String(!state.ui.panelOpen));
  inspectorToggle.setAttribute("aria-expanded", String(state.ui.panelOpen));
  mobileEditorButton.setAttribute("aria-expanded", String(state.ui.panelOpen));
});

async function restorePersistedImage() {
  const state = editorStore.get();
  if (!state.source.hasCustomImage) {
    sourcePreview.style.backgroundImage = `url(${scene.getSourcePreview()})`;
    return;
  }
  const saved = await restoreSource();
  if (!saved?.blob) {
    editorStore.patch({ source: { ...DEFAULT_STATE.source } }, { history: false });
    sourcePreview.style.backgroundImage = `url(${scene.getSourcePreview()})`;
    return;
  }
  try {
    const file = new File([saved.blob], saved.name, { type: saved.type || saved.blob.type });
    const detail = await scene.loadImageFile(file, { notify: false, name: saved.name });
    sourcePreview.style.backgroundImage = `url(${detail.previewUrl})`;
  } catch {
    editorStore.patch({ source: { ...DEFAULT_STATE.source } }, { history: false });
    sourcePreview.style.backgroundImage = `url(${scene.getSourcePreview()})`;
  }
}

restorePersistedImage();
