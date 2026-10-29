/**
 * Configuration and parameters for the fluid simulation
 */

// Read grid size from localStorage (set by the UI selector in index.html).
// Falls back to 32 if nothing saved. This allows the grid-size dropdown
// to take effect after a page reload without touching this file.
const _savedGrid = parseInt(
    (typeof localStorage !== 'undefined' && localStorage.getItem('gridSize')) || '32',
    10
);

export const CONFIG = {
    // Grid resolution (3D) — driven by the UI selector (localStorage key: 'gridSize')
    gridSize: {
        x: _savedGrid,
        y: _savedGrid,
        z: _savedGrid
    },
    
    // Display canvas size
    displayWidth: 512,
    displayHeight: 512,
    
    // Simulation parameters
    iterations: 12,  // Tuned for 60 FPS at 128³ on RTX 4060 (verified)
    forceMultiplier: 30,
    dt: 0.016,  // ~1 frame at 60fps; keep dt × velocity < 0.5 to avoid CFL instability
    
    // Dissipation rates — applied as direct per-frame multipliers on the advected field.
    // 1.0 = fully conserved (physically correct for incompressible flow)
    // < 1.0 = artificial decay (hides solver error, useful for interactive visuals)
    velocityDissipation: 0.999,  // Slight damping to hide Jacobi residual accumulation
    dyeDissipation: 1.0,         // Dye is conserved — moves with fluid, never fades
    
    // Splat parameters
    // Radius in normalized texture coordinates (0-1). This is screen-space size —
    // it looks the same regardless of grid resolution because the splat shader
    // computes distance in the same 0-1 space the display canvas uses.
    // 0.05 = 5% of canvas width ≈ visible, interactive brush size.
    splatRadius: 0.05,
    
    // Rendering
    colorBrightness: 3.0,
    
    // 3D-specific rendering settings
    renderMode: 'raymarch',  // 'slice' or 'raymarch'
    sliceAxis: 'z',       // 'x', 'y', or 'z'
    sliceDepth: 0.5,      // 0.0 to 1.0
    
    // Camera settings
    cameraMode: 'orbit',  // 'orbit' or 'freefly'
    cameraDistance: 2.5,
    cameraFOV: 60,
    
    // Ray marching settings
    rayMarchSteps: 128,   // Step count for volumetric rendering (64/128/256)
    opacityScale: 20.0,   // Opacity multiplier — raised from 1.0; at 128 steps each step
                          // contributes ~0.0078×tf.a×scale, so ≈1.0 is nearly invisible
    densityScale: 3.0,    // Amplifies dye.rgb magnitude before TF lookup (matches slice's 3× brightness)
};

// Performance presets for different hardware
export const PerformancePreset = {
    LOW: {
        gridSize: { x: 64, y: 64, z: 64 },
        iterations: 20,
        rayMarchSteps: 50
    },
    MEDIUM: {
        gridSize: { x: 96, y: 96, z: 96 },
        iterations: 30,
        rayMarchSteps: 100
    },
    HIGH: {
        gridSize: { x: 128, y: 128, z: 128 },
        iterations: 40,
        rayMarchSteps: 150
    }
};

// Color mode options
export const ColorMode = {
    DIRECTION: 'direction',
    RANDOM: 'random',
    RAINBOW: 'rainbow'
};

export const CURRENT_COLOR_MODE = ColorMode.RANDOM;

// Slice axis options
export const SliceAxis = {
    X: 'x',
    Y: 'y',
    Z: 'z'
};

// Render mode options
export const RenderMode = {
    SLICE: 'slice',
    RAYMARCH: 'raymarch'
};
