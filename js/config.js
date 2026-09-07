/**
 * Configuration and parameters for the fluid simulation
 */

export const CONFIG = {
    // Grid resolution
    gridSize: 128,
    
    // Display canvas size
    displayWidth: 512,
    displayHeight: 512,
    
    // Simulation parameters
    iterations: 40,
    forceMultiplier: 30,
    dt: 0.1,  // Time step
    
    // Dissipation rates
    velocityDissipation: 0.98,
    dyeDissipation: 0.98,
    
    // Splat parameters
    splatRadius: 0.01,
    
    // Rendering
    colorBrightness: 3.0
};

// Color mode options
export const ColorMode = {
    DIRECTION: 'direction',
    RANDOM: 'random',
    RAINBOW: 'rainbow'
};

export const CURRENT_COLOR_MODE = ColorMode.RANDOM;
