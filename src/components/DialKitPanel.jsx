import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import { DialRoot, useDialKitController } from "dialkit";
import "dialkit/styles.css";
import { ANGLES, FINISHES, onShadowGeometry } from "../scene.js";
import { editorStore } from "../state/store.js";

const CUSTOM_ANGLE = "custom";
const DEVICE_OPTIONS = [
  { value: "phone", label: "iPhone 15 Pro Max" },
  { value: "tablet", label: "iPad Pro 13″" },
  { value: "laptop", label: "MacBook Pro 14″" },
  { value: "card", label: "Browser frame" },
];
const LIGHTING_OPTIONS = [
  { value: "studio", label: "Studio" },
  { value: "bright", label: "Bright" },
  { value: "noir", label: "Noir" },
];

// DialKit derives control labels from these keys ("wallDistance" → "Wall
// Distance"), so the keys are chosen to read well to a designer rather than
// to mirror the store.
function stateToDialValues(state) {
  return {
    device: {
      model: state.device.type,
      finish: state.device.finish,
      glassGlare: state.device.glare,
    },
    camera: {
      angle: state.camera.angle || CUSTOM_ANGLE,
      rotateX: state.camera.rotation.x,
      rotateY: state.camera.rotation.y,
      rotateZ: state.camera.rotation.z,
    },
    imageFraming: {
      scale: state.source.scale,
      horizontal: state.source.x,
      vertical: state.source.y,
    },
    lighting: {
      mood: state.environment.lighting,
      brightness: state.environment.intensity,
      wallDistance: state.environment.wallGap,
      shadows: state.environment.shadows,
      float: state.environment.float,
      autoRotate: state.environment.spin,
    },
    keyLight: {
      horizontal: state.environment.keyLight.x,
      height: state.environment.keyLight.y,
      depth: state.environment.keyLight.z,
      strength: state.environment.keyLight.strength,
      softness: state.environment.keyLight.softness,
      shadowDensity: state.environment.keyLight.shadowDensity,
    },
  };
}

function same(a, b) {
  return JSON.stringify(a) === JSON.stringify(b);
}

function patchFromDialValues(values, state) {
  const currentAngle = state.camera.angle || CUSTOM_ANGLE;
  let camera;
  if (values.camera.angle !== currentAngle) {
    const preset = ANGLES[values.camera.angle];
    camera = preset
      ? { angle: values.camera.angle, rotation: { x: preset.rot[0], y: preset.rot[1], z: preset.rot[2] } }
      : { angle: null, rotation: state.camera.rotation };
  } else {
    const rotation = {
      x: values.camera.rotateX,
      y: values.camera.rotateY,
      z: values.camera.rotateZ,
    };
    camera = {
      angle: same(rotation, state.camera.rotation) ? state.camera.angle : null,
      rotation,
    };
  }

  return {
    source: {
      scale: values.imageFraming.scale,
      x: values.imageFraming.horizontal,
      y: values.imageFraming.vertical,
    },
    camera,
    device: {
      type: values.device.model,
      finish: values.device.finish,
      glare: values.device.glassGlare,
    },
    environment: {
      lighting: values.lighting.mood,
      intensity: values.lighting.brightness,
      wallGap: values.lighting.wallDistance,
      shadows: values.lighting.shadows,
      float: values.lighting.float,
      spin: values.lighting.autoRotate,
      keyLight: {
        x: values.keyLight.horizontal,
        y: values.keyLight.height,
        z: values.keyLight.depth,
        strength: values.keyLight.strength,
        softness: values.keyLight.softness,
        shadowDensity: values.keyLight.shadowDensity,
      },
    },
  };
}

function SceneDialKitPanel() {
  const initialState = useMemo(() => editorStore.get(), []);
  const [shadowGeometry, setShadowGeometry] = useState({
    wallDistance: initialState.environment.wallGap,
    lightAngle: 0,
    shadowOffset: 0,
    penumbraWidth: 0,
    projectedWidth: 0,
    projectedHeight: 0,
  });
  const config = useMemo(() => ({
    device: {
      model: { type: "select", options: DEVICE_OPTIONS, default: initialState.device.type },
      finish: { type: "select", options: Object.keys(FINISHES), default: initialState.device.finish },
      glassGlare: initialState.device.glare,
    },
    camera: {
      _collapsed: true,
      angle: {
        type: "select",
        options: [
          ...Object.keys(ANGLES).map((name) => ({ value: name, label: name })),
          { value: CUSTOM_ANGLE, label: "Custom" },
        ],
        default: initialState.camera.angle || CUSTOM_ANGLE,
      },
      rotateX: [initialState.camera.rotation.x, -180, 180, 1],
      rotateY: [initialState.camera.rotation.y, -180, 180, 1],
      rotateZ: [initialState.camera.rotation.z, -180, 180, 1],
      resetCamera: { type: "action", label: "Reset camera" },
    },
    imageFraming: {
      _collapsed: true,
      scale: [initialState.source.scale, 1, 3, 0.02],
      horizontal: [initialState.source.x, -1, 1, 0.02],
      vertical: [initialState.source.y, -1, 1, 0.02],
    },
    lighting: {
      _collapsed: true,
      mood: { type: "select", options: LIGHTING_OPTIONS, default: initialState.environment.lighting },
      brightness: [initialState.environment.intensity, 0.4, 2, 0.05],
      wallDistance: [initialState.environment.wallGap, 0.3, 4, 0.05],
      shadows: initialState.environment.shadows,
      float: initialState.environment.float,
      autoRotate: initialState.environment.spin,
    },
    keyLight: {
      _collapsed: true,
      horizontal: [initialState.environment.keyLight.x, -8, 8, 0.1],
      height: [initialState.environment.keyLight.y, -5, 7, 0.1],
      depth: [initialState.environment.keyLight.z, -6, 8, 0.1],
      strength: [initialState.environment.keyLight.strength, 0.1, 3, 0.05],
      softness: [initialState.environment.keyLight.softness, 0.1, 4, 0.05],
      shadowDensity: [initialState.environment.keyLight.shadowDensity, 0.2, 1, 0.05],
      resetLight: { type: "action", label: "Reset light" },
    },
  }), [initialState]);

  const dial = useDialKitController("Scene controls", config, {
    id: "turntable-scene-controls",
    onAction: (path) => {
      if (path === "camera.resetCamera") {
        const hero = ANGLES.Hero;
        editorStore.patch({
          camera: { angle: "Hero", rotation: { x: hero.rot[0], y: hero.rot[1], z: hero.rot[2] } },
        }, { label: "Reset camera" });
      }
      if (path === "keyLight.resetLight") {
        editorStore.patch({
          environment: {
            keyLight: { x: 0, y: 0, z: 0, strength: 1, softness: 1, shadowDensity: 1 },
          },
        }, { label: "Reset light" });
      }
    },
    shortcuts: {
      "camera.rotateX": { key: "x", interaction: "drag" },
      "camera.rotateY": { key: "y", interaction: "drag" },
      "camera.rotateZ": { key: "z", interaction: "drag" },
      "lighting.wallDistance": { key: "d", mode: "fine" },
      "keyLight.horizontal": { key: "l", interaction: "drag" },
      "keyLight.height": { key: "h", interaction: "drag" },
    },
  });

  useEffect(() => {
    const state = editorStore.get();
    const patch = patchFromDialValues(dial.values, state);
    const nextComparable = {
      ...stateToDialValues(state),
      camera: {
        angle: patch.camera.angle || CUSTOM_ANGLE,
        rotateX: patch.camera.rotation.x,
        rotateY: patch.camera.rotation.y,
        rotateZ: patch.camera.rotation.z,
      },
    };
    if (!same(dial.values, nextComparable)) {
      editorStore.patch(patch, { label: "Adjust scene" });
    }
  }, [dial.values]);

  useEffect(() => editorStore.subscribe((state) => {
    const next = stateToDialValues(state);
    if (!same(next, dial.getValues())) dial.setValues(next);
  }), [dial.getValues, dial.setValues]);

  useEffect(() => onShadowGeometry(setShadowGeometry), []);

  const finishGesture = () => {
    window.setTimeout(() => editorStore.endGesture("Adjust scene"), 0);
  };

  return (
    <div
      className="turntable-dialkit"
      onPointerDownCapture={() => editorStore.beginGesture()}
      onPointerUpCapture={finishGesture}
      onPointerCancelCapture={finishGesture}
    >
      <DialRoot mode="inline" theme="dark" productionEnabled />
      <details className="shadow-readout">
        <summary>
          <span>Advanced diagnostics</span>
          <span className="shadow-readout__hint">{shadowGeometry.lightAngle.toFixed(0)}° · {shadowGeometry.shadowOffset.toFixed(2)} u offset</span>
        </summary>
        <output className="pivot-measurement" aria-label={`Shadow projection: ${shadowGeometry.wallDistance.toFixed(2)} units from rotation center to wall, ${shadowGeometry.lightAngle.toFixed(1)} degree incidence angle, ${shadowGeometry.shadowOffset.toFixed(2)} units projected displacement, ${shadowGeometry.projectedWidth.toFixed(2)} by ${shadowGeometry.projectedHeight.toFixed(2)} unit cross-section, ${shadowGeometry.penumbraWidth.toFixed(2)} unit penumbra`}>
          <span className="pivot-measurement-label">Rotation center to wall</span>
          <strong>{shadowGeometry.wallDistance.toFixed(2)} u</strong>
          <span className="pivot-measurement-label">Light angle to wall normal</span>
          <strong>{shadowGeometry.lightAngle.toFixed(1)}°</strong>
          <span className="pivot-measurement-label">Projected shadow displacement</span>
          <strong>{shadowGeometry.shadowOffset.toFixed(2)} u</strong>
          <span className="pivot-measurement-label">Projected cross-section</span>
          <strong>{shadowGeometry.projectedWidth.toFixed(2)} × {shadowGeometry.projectedHeight.toFixed(2)} u</strong>
          <span className="pivot-measurement-label">Calculated penumbra width</span>
          <strong>{shadowGeometry.penumbraWidth.toFixed(2)} u</strong>
          <span className="pivot-measurement-detail">Mesh projection + parallel-planes penumbra model</span>
        </output>
      </details>
    </div>
  );
}

let root;

export function mountDialKitPanel(target) {
  if (!target || root) return;
  root = createRoot(target);
  root.render(<SceneDialKitPanel />);
}
