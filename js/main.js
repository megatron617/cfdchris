/**
 * Main application entry point
 */

import { WebGLContext } from './webgl-utils.js';
import { FluidSimulation3D } from './simulation3d.js';
import { Renderer3D } from './renderer3d.js';
import { OrbitController } from './camera3d.js';
import { InputHandler } from './input-handler.js';
import { UIController } from './ui-controller.js';
import { CONFIG } from './config.js';
import { GPUProfiler } from './gpu-profiler.js';
import { PerformanceMonitor } from './performance-monitor.js';
import { PerformanceDashboard } from './performance-dashboard.js';
import { PerformanceOptimizer } from './performance-optimizer.js';
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
            
            // Initialize performance optimizer
            this.performanceOptimizer = new PerformanceOptimizer(this.simulation, this.performanceMonitor);
            
            // Initialize 3D camera (orbit mode)
            this.camera = new OrbitController();
            
            // Initialize renderer with performance monitor and camera
            this.renderer = new Renderer3D(this.webglContext, this.displayCanvas, this.simulation, this.camera, this.performanceMonitor);
            
            // Initialize input handler with camera
            this.inputHandler = new InputHandler(this.displayCanvas, this.simulation, this.renderer, this.camera);
            
            // Initialize UI controller
            this.uiController = new UIController(this.simulation, this.renderer);
            this.uiController.setAnimateCallback(() => this.animate());
            
            // Initialize instructions modal
            initializeInstructionsModal();
            
            // Setup performance dashboard controls
            this.setupPerformanceControls();
            
            // Setup optimizer controls
            this.setupOptimizerControls();
            
            // Setup info panel (minimize + drag)
            this.setupInfoPanel();
            
            // Update rendering mode badge
            this.updateRenderModeBadge();
            
            // Update static grid info display
            const g = CONFIG.gridSize;
            const voxels = g.x * g.y * g.z;
            const voxelLabel = voxels >= 1_000_000
                ? (voxels / 1_000_000).toFixed(1) + 'M'
                : (voxels / 1_000).toFixed(0) + 'K';
            const gridInfoEl = document.getElementById('grid-info');
            const voxelsInfoEl = document.getElementById('voxels-info');
            if (gridInfoEl) gridInfoEl.textContent = `${g.x}×${g.y}×${g.z} (3D)`;
            if (voxelsInfoEl) voxelsInfoEl.textContent = voxelLabel;
            
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

    setupOptimizerControls() {
        // Grid size selector — syncs to the currently running grid (from localStorage/config)
        // and reloads immediately when changed so config.js picks up the new value
        const gridSizeSelect = document.getElementById('grid-size-select');
        if (gridSizeSelect) {
            // Reflect the grid size that is actually running right now
            gridSizeSelect.value = String(CONFIG.gridSize.x);
            
            gridSizeSelect.addEventListener('change', (e) => {
                localStorage.setItem('gridSize', e.target.value);
                location.reload();
            });
        }
        
        // Quality preset selector
        const presetSelect = document.getElementById('quality-preset');
        if (presetSelect) {
            presetSelect.addEventListener('change', (e) => {
                const preset = this.performanceOptimizer.applyPreset(e.target.value);
                console.log(`Quality preset changed to: ${preset.name}`);
            });
        }
        
        // Auto-optimize toggle
        const autoOptToggle = document.getElementById('auto-optimize');
        if (autoOptToggle) {
            autoOptToggle.addEventListener('change', (e) => {
                this.performanceOptimizer.setAutoOptimize(e.target.checked);
            });
        }
        
        // Benchmark button
        const benchmarkBtn = document.getElementById('benchmark-btn');
        if (benchmarkBtn) {
            benchmarkBtn.addEventListener('click', async () => {
                benchmarkBtn.disabled = true;
                benchmarkBtn.textContent = 'Benchmarking...';
                
                const result = await this.performanceOptimizer.benchmark(5000);
                
                benchmarkBtn.disabled = false;
                benchmarkBtn.textContent = 'Run Benchmark';
                
                // Show results
                alert(`Benchmark Results:\n\nAverage FPS: ${result.avgFPS.toFixed(1)}\nMin FPS: ${result.minFPS.toFixed(1)}\nMax FPS: ${result.maxFPS.toFixed(1)}\n\nRecommended: ${result.recommendation.toUpperCase()}`);
            });
        }
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

    setupInfoPanel() {
        const panel = document.getElementById('info');
        const header = document.getElementById('info-header');
        const minimizeBtn = document.getElementById('info-minimize');
        if (!panel || !header || !minimizeBtn) return;

        // Minimize / expand toggle
        minimizeBtn.addEventListener('click', () => {
            const minimized = panel.classList.toggle('minimized');
            minimizeBtn.textContent = minimized ? '+' : '−';
        });

        // Drag to reposition
        let isDragging = false;
        let dragStartX, dragStartY, startLeft, startTop;

        header.addEventListener('mousedown', (e) => {
            if (e.target === minimizeBtn) return;  // button click, not a drag
            isDragging = true;
            dragStartX = e.clientX;
            dragStartY = e.clientY;
            const rect = panel.getBoundingClientRect();
            startLeft = rect.left;
            startTop = rect.top;
            // Switch to fixed positioning so it can move freely on screen
            panel.style.position = 'fixed';
            panel.style.left = startLeft + 'px';
            panel.style.top = startTop + 'px';
            e.preventDefault();
        });

        document.addEventListener('mousemove', (e) => {
            if (!isDragging) return;
            panel.style.left = (startLeft + e.clientX - dragStartX) + 'px';
            panel.style.top  = (startTop  + e.clientY - dragStartY) + 'px';
        });

        document.addEventListener('mouseup', () => { isDragging = false; });
    }

    animate() {
        if (!this.uiController.isRunning()) return;
        
        // Start frame timing
        this.performanceMonitor.startFrame();
        
        // Update FPS counter
        this.uiController.updateFPS();
        
        // Update camera info display
        this.updateCameraInfo();
        
        // Update performance optimizer
        this.performanceOptimizer.update();
        
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

    updateCameraInfo() {
        if (!this.camera) return;
        
        const info = this.camera.getInfo();
        
        const azimuthElem = document.getElementById('cam-azimuth');
        const elevationElem = document.getElementById('cam-elevation');
        const distanceElem = document.getElementById('cam-distance');
        
        if (azimuthElem) azimuthElem.textContent = info.azimuth;
        if (elevationElem) elevationElem.textContent = info.elevation;
        if (distanceElem) distanceElem.textContent = info.distance;
        
        // Update raycast info
        if (this.inputHandler && this.inputHandler.lastRaycast) {
            const rayHitElem = document.getElementById('ray-hit');
            const rayPointElem = document.getElementById('ray-point');
            
            const result = this.inputHandler.lastRaycast;
            
            if (rayHitElem) {
                rayHitElem.textContent = result.hit ? '✓ Yes' : '✗ No';
                rayHitElem.style.color = result.hit ? '#4f4' : '#f44';
            }
            
            if (rayPointElem && result.hit) {
                const p = result.point;
                rayPointElem.textContent = `[${p[0].toFixed(2)}, ${p[1].toFixed(2)}, ${p[2].toFixed(2)}]`;
                rayPointElem.style.color = '#4af';
            }
        }
    }
}

// Start the application when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => new FluidApp());
} else {
    new FluidApp();
}
