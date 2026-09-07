/**
 * Main application entry point
 */

import { WebGLContext } from './webgl-utils.js';
import { FluidSimulation } from './simulation.js';
import { Renderer } from './renderer.js';
import { InputHandler } from './input-handler.js';
import { UIController } from './ui-controller.js';
import { CONFIG } from './config.js';

class FluidApp {
    constructor() {
        this.init();
    }

    init() {
        try {
            // Get canvases
            this.webglCanvas = document.getElementById('webglCanvas');
            this.displayCanvas = document.getElementById('displayCanvas');
            
            // Set canvas sizes
            this.webglCanvas.width = CONFIG.gridSize;
            this.webglCanvas.height = CONFIG.gridSize;
            this.displayCanvas.width = CONFIG.displayWidth;
            this.displayCanvas.height = CONFIG.displayHeight;
            
            // Initialize WebGL context
            this.webglContext = new WebGLContext(this.webglCanvas);
            
            // Initialize simulation
            this.simulation = new FluidSimulation(this.webglContext);
            
            // Initialize renderer
            this.renderer = new Renderer(this.webglContext, this.displayCanvas, this.simulation);
            
            // Initialize input handler
            this.inputHandler = new InputHandler(this.displayCanvas, this.simulation);
            
            // Initialize UI controller
            this.uiController = new UIController(this.simulation);
            this.uiController.setAnimateCallback(() => this.animate());
            
            console.log('Fluid simulation initialized!');
            console.log('Click and drag to create fluid motion');
            
            // Start animation
            this.animate();
            
        } catch (error) {
            console.error('Initialization error:', error);
            alert('Failed to initialize: ' + error.message);
        }
    }

    animate() {
        if (!this.uiController.isRunning()) return;
        
        // Update FPS counter
        this.uiController.updateFPS();
        
        // Step simulation
        this.simulation.step();
        
        // Render
        this.renderer.render();
        
        // Continue loop
        requestAnimationFrame(() => this.animate());
    }
}

// Start the application when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => new FluidApp());
} else {
    new FluidApp();
}
