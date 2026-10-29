# Phase 2: Volumetric Rendering — Tasks

## Task 8: Ray Marching Renderer

- [x] 8.1 Replace the `rayMarch3DFragmentShader` stub in `shaders3d.js` with a full implementation
  - Ray construction from fragment coord + `u_invViewProj` uniform
  - Ray-box intersection against unit cube [0,0,0]→[1,1,1] (slab method)
  - Front-to-back alpha compositing loop with configurable step count
  - Early-exit when accumulated opacity exceeds 0.95
  - Transfer function texture lookup (`sampler2D u_transfer`, 256×1)

- [x] 8.2 Register `rayMarch3D` shader program in `webgl-utils.js` `createPrograms()`
  - Compile with the existing `vertexShader` (fullscreen quad)
  - Verify all uniform locations: `u_dye`, `u_transfer`, `u_invViewProj`, `u_cameraPos`, `u_stepCount`, `u_opacityScale`

- [x] 8.3 Add `renderVolume(camera)` method to `renderer3d.js`
  - Compute inverse view-projection matrix from camera matrices
  - Bind dye 3D texture to unit 0, transfer function texture to unit 1
  - Set all uniforms and draw fullscreen quad

- [x] 8.4 Update `render(camera)` dispatch in `renderer3d.js` to route to `renderVolume` when `CONFIG.renderMode === 'raymarch'`

- [x] 8.5 Add render mode toggle button to `index.html` (SLICE / VOLUMETRIC)

- [x] 8.6 Wire toggle button in `ui-controller.js` and `main.js` to update `CONFIG.renderMode` and call `renderer.setMode()`

- [ ] 8.7 Test: volumetric view renders without WebGL errors, fluid dye is visible as a translucent cloud, ≥30 FPS at 128 steps on target hardware

## Task 9: Transfer Functions

- [x] 9.1 Create `js/transfer-function.js` with `TransferFunction` class
  - Constructor: takes `gl` and optional `size` (default 256)
  - `set(colorGradientFn, opacityFn)` — builds and uploads the composed 256×1 `TEXTURE_2D` (RGBA32F)
  - `upload(rgbaFloat32Array)` — low-level upload (used by `set`)
  - `bind(unit)` — binds texture to given texture unit
  - `static gradients` object with named color functions: `heat`, `cool`, `plasma`, `grayscale`
  - `static opacityModes` object with named opacity functions: `linear`, `sensitive`, `dense`, `threshold`
  - Color and opacity are kept separate — no preset bundles the two together

- [x] 9.2 Instantiate `TransferFunction` in `main.js`, default to `heat` gradient + `sensitive` opacity, pass to renderer

- [x] 9.3 Add two independent selectors to `index.html` inside a `#ray-controls` section:
  - Color gradient `<select>`: heat / cool / plasma / grayscale
  - Opacity mode `<select>`: linear / sensitive / dense / threshold

- [x] 9.4 Add opacity scale slider (range 0.1–2.0, step 0.1, default 1.0) to `#ray-controls`

- [x] 9.5 Add step count selector (options: 64 / 128 / 256, default 128) to `#ray-controls`

- [x] 9.6 Wire all new ray controls in `ui-controller.js` — on change, call `tf.set(gradients[grad], opacityModes[mode])` with the selected combination

- [ ] 9.7 Test: changing color gradient updates hue independently of opacity; changing opacity mode updates transparency independently of hue; all four combinations of gradient × opacity mode produce visually distinct results

## Task 10: Free-Flight Camera

- [x] 10.1 Complete `FreeFlightController` in `camera3d.js`
  - Position + yaw/pitch state (no roll)
  - `getViewMatrix()` using look-direction derived from yaw/pitch
  - `getProjectionMatrix()` — reuse same perspective as orbit controller
  - `update(dt, keys)` — WASD forward/back/strafe, QE up/down, Shift 2× speed, Ctrl 0.25× speed
  - `onMouseMove(dx, dy)` — updates yaw/pitch with clamping at ±89°

- [x] 10.2 Add key state tracking to `input-handler.js`
  - `keydown`/`keyup` listeners update a `keys` map
  - Each frame, pass `keys` and `deltaTime` to active camera controller's `update()`

- [x] 10.3 Implement F-key toggle between orbit and free-flight in `input-handler.js`
  - On switch to free-flight: copy orbit camera's `target` + `distance` to compute free-flight `position`
  - On switch to orbit: copy free-flight `position` back as orbit target

- [x] 10.4 Ensure right-click drag routes to the active camera controller (works for both orbit rotation and free-flight mouse look)

- [x] 10.5 Update `main.js` to pass `deltaTime` to `inputHandler.update(dt)` each frame

- [x] 10.6 Add camera mode indicator to `index.html` (shows ORBIT / FREE-FLIGHT)

- [ ] 10.7 Test: can fly through the volume; switching modes does not cause view jump; elevation clamping prevents gimbal flip

## Task 11: 3D Performance Monitoring

- [x] 11.1 Add `voxelThroughput` calculation to `performance-monitor.js`
  - Formula: `(gridX * gridY * gridZ) / avgFrameTimeMs * 1000` → Mvoxels/sec
  - Only meaningful when simulation is running (not paused)

- [x] 11.2 Add `rayMarchStepsPerFrame` tracking when `CONFIG.renderMode === 'raymarch'`
  - `stepCount * canvas.width * canvas.height` / 1M → Msteps/frame

- [x] 11.3 Extend `PerformanceOptimizer` auto-tune in `performance-optimizer.js`
  - When FPS < target and render mode is `raymarch`: first reduce step count (256→192→128→96→64) before touching Jacobi iterations
  - When FPS recovers: do not auto-increase step count (manual only)

- [x] 11.4 Add "Render" collapsible section to `performance-dashboard.js`
  - Render mode, ray march steps/frame (if active), voxel throughput

- [ ] 11.5 Test: dashboard shows correct voxel throughput; auto-optimizer reduces steps before iterations when in ray march mode

## Task 12: UI Polish

- [x] 12.1 Create `js/keyboard-shortcuts.js`
  - Renders an overlay `<div>` with a two-column shortcut table
  - Toggle on `?` or `H` key; dismiss on same key or `Escape`
  - Include all controls: paint, orbit, zoom, free-flight WASD/QE, F toggle, R reset, P performance, slice depth/axis, render mode

- [x] 12.2 Show/hide `#slice-controls` and `#ray-controls` sections based on active render mode
  - Add `updateControlVisibility(renderMode)` to `ui-controller.js`
  - Call it from `main.js` whenever render mode changes

- [x] 12.3 Add render mode badge element to `index.html` (near FPS counter)
  - Text: `SLICE` or `VOLUMETRIC`
  - Distinct background color per mode (blue for slice, purple for volumetric)

- [x] 12.4 Update `css/styles.css` with styles for:
  - `.mode-badge` — pill-shaped badge, positioned near FPS display
  - `.ray-controls` — grouped controls section for ray march settings
  - `.shortcut-overlay` — full-screen semi-transparent overlay with centered card
  - `.shortcut-table` — two-column key/description grid

- [x] 12.5 Wire `KeyboardShortcuts` component in `main.js` (instantiate and attach key listeners)

- [ ] 12.6 Test: shortcut overlay appears on `?`/`H` and dismisses on repeat press or `Escape`; controls sections correctly show/hide with render mode; badge updates correctly
