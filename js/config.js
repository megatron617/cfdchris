/**
 * Configuration and parameters for the fluid simulation
 */

export const CONFIG = {
    // Grid resolution (3D)
    gridSize: {
        x: 128,
        y: 128,
        z: 128
    },
    
    // Display canvas size
    displayWidth: 512,
    displayHeight: 512,
    
    // Simulation parameters
    iterations: 30,  // Reduced from 40 for 3D performance
    forceMultiplier: 30,
    dt: 0.1,  // Time step
    
    // Dissipation rates
    velocityDissipation: 0.98,
    dyeDissipation: 0.98,
    
    // Splat parameters
    splatRadius: 0.02,  // Slightly larger for 3D
    
    // Rendering
    colorBrightness: 3.0,
    
    // 3D-specific rendering settings
    renderMode: 'slice',  // 'slice' or 'raymarch'
    sliceAxis: 'z',       // 'x', 'y', or 'z'
    sliceDepth: 0.5,      // 0.0 to 1.0
    
    // Camera settings
    cameraMode: 'orbit',  // 'orbit' or 'freefly'
    cameraDistance: 2.5,
    cameraFOV: 60,
    
    // Ray marching settings (for future use)
    rayMarchSteps: 100,
    rayMarchStepSize: 0.01
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
