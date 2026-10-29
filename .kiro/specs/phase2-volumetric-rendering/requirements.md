# Phase 2: Volumetric Rendering — Requirements

## Overview

Phase 1 delivered a fully functional 3D fluid simulation running at 60 FPS on high-end hardware. The simulation is currently visualized as a 2D slice through the 3D volume. Phase 2 upgrades the rendering pipeline to full volumetric visualization using ray marching, adds expressive color controls via transfer functions, enables free-flight navigation, and polishes the overall experience.

## Background

- The simulation runs on a 128×128×128 voxel grid using WebGL2 3D textures
- Phase 1 infrastructure (camera system, raycaster, slice renderer, performance optimizer) is already in place
- The `rayMarch3DFragmentShader` in `shaders3d.js` exists as a stub awaiting implementation
- The `FreeFlightController` class in `camera3d.js` is stubbed but not implemented

---

## Requirements

### Requirement 1: Ray Marching Volumetric Renderer

**User Story**: As a user, I want to see the full 3D fluid volume rendered as a glowing, translucent cloud so that I can understand the 3D structure of the fluid rather than viewing a single 2D slice.

**Acceptance Criteria**:
1. The renderer shall cast a ray from the camera through each screen pixel into the 3D volume.
2. Each ray shall sample the dye field at regular intervals along its path.
3. Samples shall be accumulated using front-to-back alpha compositing.
4. The renderer shall produce a visually coherent volumetric image at ≥30 FPS on RTX 4060-class hardware.
5. The user shall be able to switch between the existing slice view and the new ray march view at runtime.
6. Ray march step count shall be configurable (default: 128 steps).
7. Early-exit optimization shall terminate ray traversal when accumulated opacity exceeds 0.95.

### Requirement 2: Transfer Functions

**User Story**: As a user, I want to control how fluid density maps to color and opacity so that I can highlight the features I care about (e.g., high-speed regions, dense dye concentrations).

**Design Note**: Color gradient and opacity mode are independent concerns and shall be decoupled. A "heat" color palette (warm hues) does not imply any particular opacity curve — a user may reasonably want cool colors with a sensitivity-biased opacity, or a grayscale palette with a threshold opacity. Bundling them into monolithic presets would prevent this and would require arbitrary, unjustified decisions about which opacity curve belongs to each color name.

**Acceptance Criteria**:
1. The system shall support a 1D transfer function that maps a scalar value (0.0–1.0) to an RGBA color + opacity, composed from two independently chosen components.
2. **Color gradients** — at least four options shall be available:
   - `heat` — black → red → yellow → white
   - `cool` — black → blue → cyan → white
   - `plasma` — black → purple → orange → white
   - `grayscale` — black → white
3. **Opacity modes** — at least four options shall be available:
   - `linear` — α = t (proportional, neutral)
   - `sensitive` — α = √t (concave; reveals faint/thin regions)
   - `dense` — α = t² (convex; suppresses noise, highlights concentrated core)
   - `threshold` — α = 0 below 0.3, linear ramp above (cuts low-density haze entirely)
4. Color gradient and opacity mode shall each be independently selectable from the UI without page reload.
5. The composed transfer function (color gradient × opacity mode) shall be uploaded to the GPU as a 256×1 RGBA texture and sampled inside the ray march shader.
6. A global opacity scale multiplier (0.0–2.0, default 1.0) shall be available to brighten or dim the entire volume independently of the opacity mode curve.

### Requirement 3: Free-Flight Camera

**User Story**: As a user, I want to fly through the 3D fluid volume using WASD + mouse look so that I can explore the simulation from inside the volume.

**Acceptance Criteria**:
1. The `FreeFlightController` shall implement WASD movement (forward/back/strafe left/right) and QE vertical movement.
2. Mouse drag shall control yaw and pitch; roll shall not be implemented.
3. Movement speed shall be configurable and adjustable with Shift (2× boost) and Ctrl (0.25× slow).
4. The user shall be able to switch between orbit mode and free-flight mode without losing camera position.
5. Pressing F shall toggle between orbit and free-flight modes.
6. Camera position and orientation shall be passed to the ray march shader correctly in both modes.

### Requirement 4: 3D Performance Monitoring

**User Story**: As a developer/user, I want the performance dashboard to show 3D-specific metrics so that I can understand where the bottlenecks are in the volumetric pipeline.

**Acceptance Criteria**:
1. The dashboard shall display voxel throughput (M voxels/sec) alongside the existing FPS counter.
2. Ray march step count and steps-per-frame shall be tracked and displayed.
3. The auto-optimizer shall account for ray march cost when adjusting quality (reduce step count before reducing grid size).
4. All existing Phase 1 metrics shall continue to function correctly.

### Requirement 5: UI Polish

**User Story**: As a user, I want intuitive controls and visual feedback so that the application is easy to use and understand.

**Acceptance Criteria**:
1. A keyboard shortcut overlay shall be accessible by pressing `?` or `H`.
2. The overlay shall list all controls: mouse paint, right-click orbit, WASD flight, F toggle, R reset, P performance, slice depth, axis switch.
3. Slice controls shall be hidden when ray march mode is active (they are irrelevant).
4. Ray march controls (step count, opacity scale, transfer function) shall be hidden when slice mode is active.
5. An on-screen render mode badge shall show the current mode (SLICE / VOLUMETRIC).
6. The performance optimizer shall reduce ray march step count (not just Jacobi iterations) when FPS drops below target.
