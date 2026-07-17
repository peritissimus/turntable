import * as scene from "./scene.js";

const panel = document.getElementById("controls");
let activeSection = panel;

// ---------- tiny DOM helpers ----------
function el(tag, cls, text) {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text != null) n.textContent = text;
  return n;
}

function section(title) {
  const card = el("section", "control-section");
  card.setAttribute("aria-labelledby", `section-${title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`);
  const heading = el("h2", "sec-title", title);
  heading.id = card.getAttribute("aria-labelledby");
  card.appendChild(heading);
  panel.appendChild(card);
  activeSection = card;
}

function append(node) {
  activeSection.appendChild(node);
  return node;
}

function chipGroup(items, initial, onPick) {
  const wrap = el("div", "chips");
  wrap.dataset.count = String(items.length);
  const btns = items.map((label) => {
    const b = el("button", "chip" + (label === initial ? " on" : ""), label);
    b.addEventListener("click", () => {
      btns.forEach((x) => x.classList.remove("on"));
      b.classList.add("on");
      onPick(label);
    });
    wrap.appendChild(b);
    return b;
  });
  append(wrap);
  return {
    clear: () => btns.forEach((x) => x.classList.remove("on")),
  };
}

function scrubber({ label, min, max, value, step, fmt, onChange }) {
  const s = el("div", "scrub");
  s.tabIndex = 0;
  s.setAttribute("role", "slider");
  s.setAttribute("aria-label", label);
  const fill = el("div", "fill");
  const lbl = el("span", "lbl", label);
  const val = el("span", "val");
  s.append(fill, lbl, val);
  append(s);

  let v = value;
  const show = () => {
    fill.style.width = ((v - min) / (max - min)) * 100 + "%";
    val.textContent = fmt ? fmt(v) : String(v);
    s.setAttribute("aria-valuenow", String(v));
    s.setAttribute("aria-valuemin", String(min));
    s.setAttribute("aria-valuemax", String(max));
  };
  const set = (nv, fire = true) => {
    v = Math.min(max, Math.max(min, Math.round(nv / step) * step));
    v = +v.toFixed(4);
    show();
    if (fire) onChange(v);
  };

  let startX = 0, startV = 0, active = false;
  s.addEventListener("pointerdown", (e) => {
    active = true;
    startX = e.clientX;
    startV = v;
    s.setPointerCapture(e.pointerId);
  });
  s.addEventListener("pointermove", (e) => {
    if (!active) return;
    set(startV + ((e.clientX - startX) / s.clientWidth) * (max - min));
  });
  s.addEventListener("pointerup", () => { active = false; });
  s.addEventListener("dblclick", () => set(value));
  s.addEventListener("keydown", (e) => {
    if (e.key === "ArrowLeft" || e.key === "ArrowDown") { e.preventDefault(); set(v - step); }
    if (e.key === "ArrowRight" || e.key === "ArrowUp") { e.preventDefault(); set(v + step); }
  });

  show();
  return { set: (nv) => set(nv, false) };
}

function toggleRow(label, checked, onChange) {
  const row = el("div", "row");
  const lab = el("label", null, label);
  const sw = el("span", "switch");
  const input = document.createElement("input");
  input.type = "checkbox";
  input.checked = checked;
  const track = el("span", "track");
  sw.append(input, track);
  row.append(lab, sw);
  append(row);
  input.addEventListener("change", () => onChange(input.checked));
}

function button(label, cls, onClick) {
  const b = el("button", "btn" + (cls ? " " + cls : ""), label);
  b.addEventListener("click", onClick);
  append(b);
  return b;
}

// ---------- ANGLE ----------
section("Angle");
let rotScrubs; // set after rotation section builds
const angleChips = chipGroup(Object.keys(scene.ANGLES), "Hero", (name) => {
  const rot = scene.setAngle(name);
  if (rotScrubs) {
    rotScrubs.x.set(rot.x);
    rotScrubs.y.set(rot.y);
    rotScrubs.z.set(rot.z);
  }
});

// ---------- MODEL ----------
section("Model");
{
  const wrap = el("div", "selectwrap");
  const sel = document.createElement("select");
  [
    ["phone", "iPhone Pro"],
    ["tablet", "iPad Pro 13\u2033"],
    ["laptop", "MacBook Pro 14\u2033"],
    ["card", "Browser Frame"],
  ].forEach(([v, label]) => {
    const o = document.createElement("option");
    o.value = v;
    o.textContent = label;
    sel.appendChild(o);
  });
  sel.addEventListener("change", () => scene.setDevice(sel.value));
  wrap.appendChild(sel);
  append(wrap);
}

// ---------- FINISH ----------
section("Finish");
chipGroup(Object.keys(scene.FINISHES), "Natural titanium", scene.setFinish);

// ---------- LIGHTING ----------
section("Lighting");
chipGroup(["Studio", "Bright", "Noir"], "Studio", (name) => {
  scene.setLighting(name.toLowerCase());
});

// ---------- ROTATION ----------
section("Rotation");
const deg = (v) => `${Math.round(v)}°`;
rotScrubs = {
  x: scrubber({ label: "X", min: -180, max: 180, value: -4, step: 1, fmt: deg,
    onChange: (v) => { scene.setRotation("x", v); angleChips.clear(); } }),
  y: scrubber({ label: "Y", min: -180, max: 180, value: 24, step: 1, fmt: deg,
    onChange: (v) => { scene.setRotation("y", v); angleChips.clear(); } }),
  z: scrubber({ label: "Z", min: -180, max: 180, value: 0, step: 1, fmt: deg,
    onChange: (v) => { scene.setRotation("z", v); angleChips.clear(); } }),
};

// dragging the stage (or auto-rotate) drives rotation from the scene side
scene.onRotationInput((rot, fromUser) => {
  rotScrubs.x.set(rot.x);
  rotScrubs.y.set(rot.y);
  rotScrubs.z.set(rot.z);
  if (fromUser) angleChips.clear();
});

// ---------- BACKGROUND TYPE ----------
section("Background type");
const backgroundTypes = {
  Wall: "flat",
  Cyclorama: "stage",
  Mirror: "mirror",
  Transparent: "transparent",
};
chipGroup(Object.keys(backgroundTypes), "Wall", (name) => {
  scene.setBackgroundType(backgroundTypes[name]);
});

// ---------- BACKGROUND ----------
section("Background");
{
  const tabs = el("div", "tabs");
  const grid = el("div", "thumbs");
  const TABS = [
    ["studios", "Studios"],
    ["presets", "Presets"],
    ["wallpapers", "Wallpapers"],
    ["colors", "Colors"],
  ];
  let activeTab = "studios";
  const selected = { studios: 0, presets: -1, wallpapers: -1, colors: -1 };

  function renderGrid() {
    grid.textContent = "";
    scene.backgroundNames[activeTab].forEach((name, i) => {
      const t = el("button", "thumb" + (selected[activeTab] === i ? " on" : ""));
      t.title = name;
      t.setAttribute("aria-label", "Background: " + name);
      t.style.backgroundImage = `url(${scene.thumbFor(activeTab, i)})`;
      t.addEventListener("click", () => {
        Object.keys(selected).forEach((k) => { selected[k] = -1; });
        selected[activeTab] = i;
        scene.setBackground(activeTab, i);
        [...grid.children].forEach((c) => c.classList.remove("on"));
        t.classList.add("on");
      });
      grid.appendChild(t);
    });
  }

  TABS.forEach(([id, label]) => {
    const b = el("button", "tab" + (id === activeTab ? " on" : ""), label);
    b.addEventListener("click", () => {
      activeTab = id;
      [...tabs.children].forEach((c) => c.classList.remove("on"));
      b.classList.add("on");
      renderGrid();
    });
    tabs.appendChild(b);
  });

  activeSection.append(tabs, grid);
  renderGrid();
}

// ---------- SCREEN ----------
section("Screen");
button("Upload Screenshot…", "ghost", scene.openUpload).style.marginTop = "0";
toggleRow("Glass glare", true, scene.setGlare);

// ---------- LIGHT & SHADOWS ----------
section("Light & shadows");
toggleRow("Shadows", true, scene.setShadows);
toggleRow("Float", scene.defaults.float, scene.setFloat);
toggleRow("Auto-rotate", false, scene.setSpin);
scrubber({
  label: "Distance", min: 0.3, max: 4, value: 1, step: 0.05,
  fmt: (v) => v.toFixed(2),
  onChange: scene.setWallGap,
});
scrubber({
  label: "Intensity", min: 0.4, max: 2, value: 1, step: 0.05,
  fmt: (v) => v.toFixed(2),
  onChange: scene.setLightMult,
});

// ---------- EXPORT ----------
section("Export");
const ASPECTS = { Auto: null, "1:1": 1, "4:5": 0.8, "16:9": 16 / 9 };
const guide = el("div");
guide.id = "frameGuide";
document.body.appendChild(guide);
let guideAspect = null;

function updateGuide() {
  if (!guideAspect) {
    guide.style.display = "none";
    return;
  }
  let w = innerWidth, h = Math.round(innerWidth / guideAspect);
  if (h > innerHeight) { h = innerHeight; w = Math.round(innerHeight * guideAspect); }
  guide.style.display = "block";
  guide.style.width = w + "px";
  guide.style.height = h + "px";
  guide.style.left = (innerWidth - w) / 2 + "px";
  guide.style.top = (innerHeight - h) / 2 + "px";
}
window.addEventListener("resize", updateGuide);

chipGroup(Object.keys(ASPECTS), "Auto", (label) => {
  guideAspect = ASPECTS[label];
  scene.setExportAspect(guideAspect);
  updateGuide();
});
append(el("div", "control-gap"));
chipGroup(["1×", "2×", "3×"], "2×", (label) => {
  scene.setExportScale(parseInt(label, 10));
});
append(el("div", "control-gap compact"));
button("Export PNG", null, scene.exportPNG);
button("Reset Camera", "ghost", () => {
  const rot = scene.resetCamera();
  rotScrubs.x.set(rot.x);
  rotScrubs.y.set(rot.y);
  rotScrubs.z.set(rot.z);
});
