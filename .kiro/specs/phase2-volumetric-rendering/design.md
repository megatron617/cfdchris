# Phase 2: Volumetric Rendering — Design

## Architecture Overview

Phase 2 builds on top of the complete Phase 1 stack. No existing files are removed; new capability is added via new classes and extended shaders.

```
FluidApp (main.js)
├── WebGLContext3D (webgl-utils.js)          ✅ Phase 1
├── FluidSimulation3D (simulation3d.js)      ✅ Phase 1
├── Camera3D / OrbitController (camera3d.js) ✅ Phase 1 (orbit only)
│    └── FreeFlightController               🔄 Phase 2 (stub → implement)
├── Raycaster3D (raycaster3d.js)             ✅ Phase 1
├── Renderer3D (renderer3d.js)               ✅ Phase 1 (slice only)
│    └── RayMarchRenderer                   🆕 Phase 2 (new class or method)
├── TransferFunction (transfer-function.js)  🆕 Phase 2
├── PerformanceOptimizer (performance-optimizer.js) ✅ Phase 1 (extend for 3D)
├── PerformanceDashboard (performance-dashboard.js) ✅ Phase 1 (extend)
└── UIController (ui-controller.js)          ✅ Phase 1 (extend)
```

---

## Task 8: Ray Marching Renderer

### Approach

The ray march renderer replaces the per-frame `renderSlice()` call in `renderer3d.js` when `CONFIG.renderMode === 'raymarch'`. The existing slice renderer stays untouched — `renderMode` toggles between them.

### Shader Design (`shaders3d.js`)

Replace the current `rayMarch3DFragmentShader` stub with a full implementation:

```glsl
// Inputs
uniform sampler3D u_dye;          // 3D dye field
uniform sampler1D u_transfer;     // transfer function LUT (256 entries)
uniform mat4 u_invViewProj;       // inverse view-projection for ray construction
uniform vec3 u_cameraPos;         // world-space camera position
uniform float u_stepCount;        // number of march steps (64–256)
uniform float u_opacityScale;     // opacity multiplier

// Algorithm
// 1. Reconstruct world-space ray from fragment coord + u_invViewProj
// 2. Intersect ray with unit cube [0,0,0]→[1,1,1] (slab method, same as raycaster3d.js)
// 3. March from tMin to tMax in u_stepCount equal steps
// 4. At each step:
//    a. Sample u_dye at current position (vec3)
//    b. Compute scalar = length(dye.rgb) or dye.r (configurable)
//    c. Look up RGBA from u_transfer at scalar
//    d. Scale alpha by (stepSize * u_opacityScale)
//    e. Front-to-back composite: color += (1 - accAlpha) * sample.a * sample.rgb
//                                accAlpha += (1 - accAlpha) * sample.a
// 5. Early exit when accAlpha > 0.95
// 6. Output vec4(color, accAlpha)
```

### `renderer3d.js` Changes

Add a `renderVolume(camera)` method alongside the existing `renderSlice()`:

```javascript
renderVolume(camera) {
    // 1. Compute inverse view-projection matrix from camera
    // 2. Bind transfer function texture to unit 1
    // 3. Bind dye 3D texture to unit 0
    // 4. Set uniforms: u_invViewProj, u_cameraPos, u_stepCount, u_opacityScale
    // 5. Draw fullscreen quad using rayMarch3D program
}
```

The `render(camera)` method dispatches to either based on `CONFIG.renderMode`.

### Matrix Math

The camera already exposes `getViewMatrix()` and `getProjectionMatrix()`. Combine and invert them to get `u_invViewProj`. A `mat4Multiply` and `mat4Invert` utility already exists in `raycaster3d.js` — extract these to a shared `math-utils.js` or duplicate in `renderer3d.js`.

### Performance Expectations

| Step Count | RTX 4060 FPS | Notes |
|------------|--------------|-------|
| 64         | ~55 FPS      | Low quality, visible banding |
| 128        | ~40 FPS      | Good balance (default) |
| 256        | ~20 FPS      | High quality |

---

## Task 9: Transfer Functions

### Design Rationale

Color gradient and opacity mode are independent properties and are kept separate in the implementation. The name "heat" describes a warm-hued color ramp; it says nothing about whether faint regions should be visible or suppressed. A user may want cool colors with sensitive opacity (to see thin blue tendrils), or a grayscale palette with threshold opacity (to cut haze and show only dense clumps). Coupling these into monolithic presets forces arbitrary, unjustifiable assignments.

The `TransferFunction` class therefore works as a composer: pick any color gradient, pick any opacity mode, and it builds the GPU texture from their combination.

### New File: `js/transfer-function.js`

```javascript
class TransferFunction {
    constructor(gl, size = 256) { ... }

    // Build and upload from independent gradient + opacity function
    // colorGradientFn : t (0–1) → [r, g, b]  (each 0–1)
    // opacityFn       : t (0–1) → alpha (0–1)
    set(colorGradientFn, opacityFn) {
        const data = new Float32Array(this.size * 4);
        for (let i = 0; i < this.size; i++) {
            const t = i / (this.size - 1);
            const [r, g, b] = colorGradientFn(t);
            data[i * 4 + 0] = r;
            data[i * 4 + 1] = g;
            data[i * 4 + 2] = b;
            data[i * 4 + 3] = opacityFn(t);
        }
        this.upload(data);
    }

    // Upload raw Float32Array (size×4 RGBA) to 256×1 TEXTURE_2D
    // WebGL2 does not expose sampler1D — use TEXTURE_2D and sample with vec2(scalar, 0.5)
    upload(rgbaFloat32Array) { ... }

    bind(unit) { ... }

    // ── Color gradient presets ───────────────────────────────────────────────
    // Each returns a function: t → [r, g, b]
    static gradients = {
        heat:      t => { /* black → red → yellow → white */ },
        cool:      t => { /* black → blue → cyan → white  */ },
        plasma:    t => { /* black → purple → orange → white */ },
        grayscale: t => [t, t, t],
    };

    // ── Opacity mode presets ─────────────────────────────────────────────────
    // Each returns a function: t → alpha (0–1)
    static opacityModes = {
        linear:    t => t,                              // proportional, neutral
        sensitive: t => Math.sqrt(t),                   // concave — reveals faint/thin regions
        dense:     t => t * t,                          // convex — suppresses noise, shows core
        threshold: t => t < 0.3 ? 0 : (t - 0.3) / 0.7, // cuts low-density haze entirely
    };
}
```

**Usage in `main.js`**:
```javascript
const tf = new TransferFunction(gl);
tf.set(TransferFunction.gradients.heat, TransferFunction.opacityModes.sensitive);
// Later, on UI change:
tf.set(TransferFunction.gradients.cool, TransferFunction.opacityModes.dense);
```

### Shader Change

```glsl
uniform sampler2D u_transfer;
// ...
vec4 tfColor = texture(u_transfer, vec2(scalar, 0.5));
```

### Shader Change

```glsl
uniform sampler2D u_transfer;
// ...
vec4 tfColor = texture(u_transfer, vec2(scalar, 0.5));
```

---

## Task 10: Free-Flight Camera

### `camera3d.js` — Complete `FreeFlightController`

```javascript
class FreeFlightController extends Camera3D {
    constructor(canvas) {
        // Default position: slightly outside the volume
        this.position = vec3(0.5, 0.5, -0.5);
        this.yaw   = 0;      // radians, horizontal
        this.pitch = 0;      // radians, vertical, clamped ±89°
        this.speed = 0.005;  // units per ms
        this.keys  = {};     // key state map
    }

    // Build view matrix from position + yaw/pitch (no roll)
    getViewMatrix() { ... }

    // Called each frame with delta time
    update(dt) {
        // WASD + QE movement relative to look direction
        // Apply key state map
    }

    // Mouse drag → yaw/pitch
    onMouseMove(dx, dy) { ... }
}
```

### Input Handler Changes (`input-handler.js`)

- Track key state (`keydown`/`keyup`) and pass to `FreeFlightController.update(dt)` each frame
- Right-click drag already rotates orbit camera; reuse for free-flight mouse look
- F key toggles `CONFIG.cameraMode` between `'orbit'` and `'freefly'`
- On toggle, copy position from one controller to the other so the view doesn't jump

---

## Task 11: 3D Performance Monitoring

### `performance-monitor.js` Extensions

Add fields:
- `voxelThroughput` — `(gridX * gridY * gridZ) / avgFrameTime` in Mvoxels/sec
- `rayMarchStepsPerFrame` — `stepCount * canvasWidth * canvasHeight` (only when ray march active)
- `activeRenderMode` — `'slice'` or `'raymarch'`

### `performance-optimizer.js` Extensions

The current optimizer reduces `CONFIG.iterations` (Jacobi steps). Extend the auto-tune loop:

1. First reduce ray march step count: 256 → 192 → 128 → 96 → 64
2. Then reduce Jacobi iterations (existing behavior)
3. Grid size reduction remains as last resort

### `performance-dashboard.js` Extensions

Add a "Render" section below "Simulation Timing":
- Render mode badge (SLICE / VOLUMETRIC)
- Ray march steps (when active)
- Voxel throughput

---

## Task 12: UI Polish

### Keyboard Shortcut Overlay

New file `js/keyboard-shortcuts.js`. Renders an overlay div with all shortcuts in a two-column grid. Toggle on `?` or `H` key. Dismiss on same key or `Escape`.

### Conditional Control Visibility

In `ui-controller.js`, add:
```javascript
updateControlVisibility(renderMode) {
    const sliceControls = document.getElementById('slice-controls');
    const rayControls   = document.getElementById('ray-controls');
    sliceControls.style.display = renderMode === 'slice' ? '' : 'none';
    rayControls.style.display   = renderMode === 'raymarch' ? '' : 'none';
}
```

Call this whenever `CONFIG.renderMode` changes.

### Render Mode Badge

Add a badge element near the existing FPS display:
```html
<span id="render-mode-badge" class="mode-badge">SLICE</span>
```
Update it in `main.js` when mode changes.

---

## File Change Summary

| File | Change |
|------|--------|
| `js/shaders3d.js` | Replace `rayMarch3DFragmentShader` stub with full implementation |
| `js/renderer3d.js` | Add `renderVolume(camera)`, update `render()` dispatch |
| `js/transfer-function.js` | **New** — TransferFunction class with presets |
| `js/camera3d.js` | Complete `FreeFlightController` stub |
| `js/input-handler.js` | Add key state map, F toggle, free-flight mouse look |
| `js/performance-monitor.js` | Add voxel throughput, ray march step tracking |
| `js/performance-optimizer.js` | Extend auto-tune to include ray march step count |
| `js/performance-dashboard.js` | Add Render section to dashboard |
| `js/keyboard-shortcuts.js` | **New** — Shortcut overlay component |
| `js/ui-controller.js` | Add `updateControlVisibility()`, bind new controls |
| `js/main.js` | Wire up all new components, pass camera to renderer |
| `index.html` | Add ray march controls, mode badge, shortcut overlay container |
| `css/styles.css` | Styles for mode badge, shortcut overlay, ray controls |
