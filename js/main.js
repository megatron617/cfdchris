/**
 * Main application entry point
 */

import { WebGLContext } from './webgl-utils.js';
import { FluidSimulation3D } from './simulation3d.js';
import { Renderer3D } from './renderer3d.js';
import { InputHandler } from './input-handler.js';
import { UIController } from './ui-controller.js';
import { CONFIG } from './config.js';
import { GPUProfiler } from './gpu-profiler.js';
import { PerformanceMonitor } from './performance-monitor.js';
import { PerformanceDashboard } from './performance-dashboard.js';
import { initializeInstructionsModal } from './instructions-modal.js';

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
            this.webglCanvas.width = CONFIG.gridSize.x;
            this.webglCanvas.height = CONFIG.gridSize.y;
            this.displayCanvas.width = CONFIG.displayWidth;
            this.displayCanvas.height = CONFIG.displayHeight;
            
            // Initialize WebGL context
            this.webglContext = new WebGLContext(this.webglCanvas);
            
            // Initialize performance monitoring
            this.gpuProfiler = new GPUProfiler(this.webglContext.gl);
            this.performanceMonitor = new PerformanceMonitor(this.gpuProfiler);
            this.performanceDashboard = new PerformanceDashboard(this.gpuProfiler);
            
            // Initialize simulation with performance monitor
            this.simulation = new FluidSimulation3D(this.webglContext, this.performanceMonitor);
            
            // Initialize renderer with performance monitor
            this.renderer = new Renderer3D(this.webglContext, this.displayCanvas, this.simulation, this.performanceMonitor);
            
            // Initialize input handler
            this.inputHandler = new InputHandler(this.displayCanvas, this.simulation, this.renderer);
            
            // Initialize UI controller
            this.uiController = new UIController(this.simulation, this.renderer);
            this.uiController.setAnimateCallback(() => this.animate());
            
            // Initialize instructions modal
            initializeInstructionsModal();
            
            // Setup performance dashboard controls
            this.setupPerformanceControls();
            
            // Update rendering mode badge
            this.updateRenderModeBadge();
            
            console.log('Fluid simulation initialized!');
            console.log('Click and drag to create fluid motion');
            console.log('Press P to toggle performance dashboard');
            
            // Log GPU info
            const diagnostics = this.gpuProfiler.getDiagnostics();
            console.log('GPU:', diagnostics.gpuInfo.renderer);
            console.log('Rendering Mode:', diagnostics.renderMode.mode);
            console.log('GPU Timing Available:', diagnostics.capabilities.timerQueries);
            
            // Start animation
            this.animate();
            
        } catch (error) {
            console.error('Initialization error:', error);
            alert('Failed to initialize: ' + error.message);
        }
    }

    setupPerformanceControls() {
        // Performance toggle button
        const perfButton = document.getElementById('performance-toggle');
        if (perfButton) {
            perfButton.addEventListener('click', () => {
                this.performanceDashboard.toggle();
            });
        }
        
        // Keyboard shortcut (P key)
        document.addEventListener('keydown', (e) => {
            if (e.key === 'p' || e.key === 'P') {
                // Only toggle if not typing in an input
                if (document.activeElement.tagName !== 'INPUT' && 
                    document.activeElement.tagName !== 'TEXTAREA') {
                    this.performanceDashboard.toggle();
                }
            }
        });
    }

    updateRenderModeBadge() {
        const badge = document.getElementById('render-mode-badge');
        if (!badge) return;
        
        const diagnostics = this.gpuProfiler.getDiagnostics();
        const mode = diagnostics.renderMode.mode;
        
        badge.textContent = mode.toUpperCase();
        badge.className = 'render-mode-badge ' + mode;
        
        // Add tooltip
        let tooltipText = '';
        if (mode === 'hardware') {
            tooltipText = 'Using GPU hardware acceleration';
        } else if (mode === 'software') {
            tooltipText = 'Using software rendering (CPU) - Performance will be limited';
        } else {
            tooltipText = 'Unable to detect rendering mode';
        }
        badge.title = tooltipText;
    }

    animate() {
        if (!this.uiController.isRunning()) return;
        
        // Start frame timing
        this.performanceMonitor.startFrame();
        
        // Update FPS counter
        this.uiController.updateFPS();
        
        // Step simulation
        this.simulation.step();
        
        // Render
        this.renderer.render();
        
        // End frame timing
        this.performanceMonitor.endFrame();
        
        // Update performance dashboard (throttled internally)
        if (this.performanceDashboard.isVisible()) {
            const metrics = this.performanceMonitor.getMetrics();
            this.performanceDashboard.update(metrics);
        }
        
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
