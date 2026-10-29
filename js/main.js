/**
 * Main application entry point
 */

import { WebGLContext }         from './webgl-utils.js';
import { FluidSimulation3D }    from './simulation3d.js';
import { Renderer3D }           from './renderer3d.js';
import { OrbitController, FreeFlightController } from './camera3d.js';
import { InputHandler }         from './input-handler.js';
import { UIController }         from './ui-controller.js';
import { TransferFunction }     from './transfer-function.js';
import { KeyboardShortcuts }    from './keyboard-shortcuts.js';
import { CONFIG }               from './config.js';
import { GPUProfiler }          from './gpu-profiler.js';
import { PerformanceMonitor }   from './performance-monitor.js';
import { PerformanceDashboard } from './performance-dashboard.js';
import { PerformanceOptimizer } from './performance-optimizer.js';
import { initializeInstructionsModal } from './instructions-modal.js';

class FluidApp {
    constructor() {
        this.lastAnimateTime = 0;
        this.init();
    }

    init() {
        try {
            // Canvases
            this.webglCanvas   = document.getElementById('webglCanvas');
            this.displayCanvas = document.getElementById('displayCanvas');

            this.webglCanvas.width  = CONFIG.gridSize.x;
            this.webglCanvas.height = CONFIG.gridSize.y;
            this.displayCanvas.width  = CONFIG.displayWidth;
            this.displayCanvas.height = CONFIG.displayHeight;

            // WebGL
            this.webglContext = new WebGLContext(this.webglCanvas);

            // Performance
            this.gpuProfiler          = new GPUProfiler(this.webglContext.gl);
            this.performanceMonitor   = new PerformanceMonitor(this.gpuProfiler);
            this.performanceDashboard = new PerformanceDashboard(this.gpuProfiler);
            this.performanceMonitor.setCanvasSize(CONFIG.displayWidth, CONFIG.displayHeight);

            // Simulation
            this.simulation = new FluidSimulation3D(this.webglContext, this.performanceMonitor);

            // Performance optimizer
            this.performanceOptimizer = new PerformanceOptimizer(this.simulation, this.performanceMonitor);

            // Cameras — orbit (default) + free-flight
            this.orbitCamera = new OrbitController();
            this.freeCamera  = new FreeFlightController();
            this.camera      = this.orbitCamera;   // active camera

            // Transfer function (Task 9.2)
            this.transferFunction = new TransferFunction(this.webglContext.gl);

            // Renderer
            this.renderer = new Renderer3D(
                this.webglContext, this.displayCanvas,
                this.simulation, this.camera, this.performanceMonitor
            );
            this.renderer.setTransferFunction(this.transferFunction);

            // Input handler (Task 10.5 — will receive deltaTime via update(dt))
            this.inputHandler = new InputHandler(
                this.displayCanvas, this.simulation, this.renderer, this.orbitCamera
            );
            this.inputHandler.freeCamera = this.freeCamera;
            this.inputHandler.onCameraSwitch = (newCam) => {
                this.camera = newCam;
                this.renderer.camera = newCam;
                this.updateCameraInfo();
                this.updateCameraModeIndicator();
            };

            // UI controller
            this.uiController = new UIController(this.simulation, this.renderer);
            this.uiController.setTransferFunction(this.transferFunction);
            this.uiController.setAnimateCallback(() => this.animate());
            this.uiController.onRenderModeChange = (mode) => {
                this.updateSimModeBadge(mode);
            };

            // Keyboard shortcuts overlay (Task 12.5)
            this.keyboardShortcuts = new KeyboardShortcuts();

            // Add V key shortcut for render mode toggle
            document.addEventListener('keydown', (e) => {
                const active = document.activeElement;
                if (active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA')) return;
                if (e.key === 'v' || e.key === 'V') {
                    const btn = document.getElementById('render-mode-toggle');
                    if (btn) btn.click();
                }
            });

            // Instructions modal
            initializeInstructionsModal();

            // Performance controls
            this.setupPerformanceControls();
            this.setupOptimizerControls();
            this.setupInfoPanel();

            // Static grid info
            const g = CONFIG.gridSize;
            const voxels = g.x * g.y * g.z;
            const voxelLabel = voxels >= 1_000_000
                ? (voxels / 1_000_000).toFixed(1) + 'M'
                : (voxels / 1_000).toFixed(0) + 'K';
            const gridInfoEl   = document.getElementById('grid-info');
            const voxelsInfoEl = document.getElementById('voxels-info');
            if (gridInfoEl)   gridInfoEl.textContent   = `${g.x}×${g.y}×${g.z} (3D)`;
            if (voxelsInfoEl) voxelsInfoEl.textContent = voxelLabel;

            // Initial badge state
            this.updateRenderModeBadge();
            this.updateSimModeBadge(CONFIG.renderMode);
            this.updateCameraModeIndicator();

            console.log('Fluid simulation initialized!');
            const diagnostics = this.gpuProfiler.getDiagnostics();
            console.log('GPU:', diagnostics.gpuInfo.renderer);

            this.animate();

        } catch (error) {
            console.error('Initialization error:', error);
            alert('Failed to initialize: ' + error.message);
        }
    }

    setupPerformanceControls() {
        const perfButton = document.getElementById('performance-toggle');
        if (perfButton) {
            perfButton.addEventListener('click', () => this.performanceDashboard.toggle());
        }
        document.addEventListener('keydown', (e) => {
            if (e.key === 'p' || e.key === 'P') {
                if (document.activeElement.tagName !== 'INPUT' &&
                    document.activeElement.tagName !== 'TEXTAREA') {
                    this.performanceDashboard.toggle();
                }
            }
        });
    }

    setupOptimizerControls() {
        const gridSizeSelect = document.getElementById('grid-size-select');
        if (gridSizeSelect) {
            gridSizeSelect.value = String(CONFIG.gridSize.x);
            gridSizeSelect.addEventListener('change', (e) => {
                localStorage.setItem('gridSize', e.target.value);
                location.reload();
            });
        }

        const presetSelect = document.getElementById('quality-preset');
        if (presetSelect) {
            presetSelect.addEventListener('change', (e) => {
                this.performanceOptimizer.applyPreset(e.target.value);
            });
        }

        const autoOptToggle = document.getElementById('auto-optimize');
        if (autoOptToggle) {
            autoOptToggle.addEventListener('change', (e) => {
                this.performanceOptimizer.setAutoOptimize(e.target.checked);
            });
        }

        const benchmarkBtn = document.getElementById('benchmark-btn');
        if (benchmarkBtn) {
            benchmarkBtn.addEventListener('click', async () => {
                benchmarkBtn.disabled     = true;
                benchmarkBtn.textContent  = 'Benchmarking...';
                const result = await this.performanceOptimizer.benchmark(5000);
                benchmarkBtn.disabled     = false;
                benchmarkBtn.textContent  = 'Run Benchmark';
                alert(`Benchmark Results:\n\nAverage FPS: ${result.avgFPS?.toFixed(1) ?? 'N/A'}\nRecommended: ${result.recommendation?.toUpperCase() ?? 'N/A'}`);
            });
        }
    }

    /** Update the GPU hardware/software badge (existing). */
    updateRenderModeBadge() {
        const badge = document.getElementById('render-mode-badge');
        if (!badge) return;
        const diagnostics = this.gpuProfiler.getDiagnostics();
        const mode = diagnostics.renderMode.mode;
        badge.textContent = mode.toUpperCase();
        badge.className   = 'render-mode-badge ' + mode;
        badge.title       = mode === 'hardware'
            ? 'Using GPU hardware acceleration'
            : mode === 'software'
            ? 'Using software rendering — performance will be limited'
            : 'Rendering mode unknown';
    }

    /** Update the SLICE/VOLUMETRIC simulation mode badge (Task 12.3). */
    updateSimModeBadge(mode) {
        const badge = document.getElementById('sim-mode-badge');
        if (!badge) return;
        badge.textContent = mode === 'raymarch' ? 'VOLUMETRIC' : 'SLICE';
        badge.className   = 'mode-badge ' + (mode === 'raymarch' ? 'mode-volumetric' : 'mode-slice');
    }

    /** Update the camera mode indicator (Task 10.6). */
    updateCameraModeIndicator() {
        const el = document.getElementById('camera-mode-indicator');
        if (!el) return;
        el.textContent = CONFIG.cameraMode === 'freefly' ? 'FREE-FLIGHT' : 'ORBIT';
        el.className   = 'camera-mode-badge ' + CONFIG.cameraMode;
    }

    setupInfoPanel() {
        const panel      = document.getElementById('info');
        const header     = document.getElementById('info-header');
        const minimizeBtn = document.getElementById('info-minimize');
        if (!panel || !header || !minimizeBtn) return;

        minimizeBtn.addEventListener('click', () => {
            const minimized = panel.classList.toggle('minimized');
            minimizeBtn.textContent = minimized ? '+' : '−';
        });

        let isDragging = false, dragStartX, dragStartY, startLeft, startTop;

        header.addEventListener('mousedown', (e) => {
            if (e.target === minimizeBtn) return;
            isDragging = true;
            dragStartX = e.clientX;
            dragStartY = e.clientY;
            const rect = panel.getBoundingClientRect();
            startLeft = rect.left;
            startTop  = rect.top;
            panel.style.position = 'fixed';
            panel.style.left     = startLeft + 'px';
            panel.style.top      = startTop  + 'px';
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

        const now = performance.now();
        const dt  = this.lastAnimateTime > 0 ? now - this.lastAnimateTime : 16;
        this.lastAnimateTime = now;

        this.performanceMonitor.startFrame();
        this.uiController.updateFPS();

        // Update free-flight camera movement (Task 10.5)
        this.inputHandler.update(dt);

        // Keep renderer's camera reference in sync (for active camera after toggle)
        this.renderer.camera = this.inputHandler.camera;

        this.updateCameraInfo();
        this.performanceOptimizer.update();

        this.simulation.step();
        this.renderer.render();

        this.performanceMonitor.endFrame();

        if (this.performanceDashboard.isVisible()) {
            const metrics = this.performanceMonitor.getMetrics();
            this.performanceDashboard.update(metrics);
        }

        requestAnimationFrame(() => this.animate());
    }

    updateCameraInfo() {
        const cam = this.inputHandler.camera;
        if (!cam) return;

        const info = cam.getInfo();

        if (info.type === 'orbit') {
            // Orbit labels
            document.getElementById('cam-mode-label').textContent = 'Camera (Orbit)';
            this._setText('cam-azimuth',   info.azimuth);
            this._setText('cam-elevation', info.elevation);
            this._setText('cam-distance',  info.distance);
            this._showEl('cam-orbit-rows',  true);
            this._showEl('cam-free-rows',   false);
        } else {
            // Free-flight labels
            document.getElementById('cam-mode-label').textContent = 'Camera (Free-Flight)';
            this._setText('cam-pos-x', info.x);
            this._setText('cam-pos-y', info.y);
            this._setText('cam-pos-z', info.z);
            this._setText('cam-yaw',   info.yaw);
            this._setText('cam-pitch', info.pitch);
            this._showEl('cam-orbit-rows', false);
            this._showEl('cam-free-rows',  true);
        }

        // Raycast debug panel — updates whenever the user paints in ray-march mode
        const rayHitEl   = document.getElementById('ray-hit');
        const rayPointEl = document.getElementById('ray-point');
        const result     = this.inputHandler.lastRaycast;

        if (rayHitEl && rayPointEl) {
            if (!result) {
                rayHitEl.textContent   = '-';
                rayHitEl.style.color   = '#888';
                rayPointEl.textContent = '-';
                rayPointEl.style.color = '#888';
            } else if (result.hit) {
                const p = result.point;
                rayHitEl.textContent   = '✓ Yes';
                rayHitEl.style.color   = '#4f4';
                rayPointEl.textContent = `[${p[0].toFixed(2)}, ${p[1].toFixed(2)}, ${p[2].toFixed(2)}]`;
                rayPointEl.style.color = '#4af';
            } else {
                rayHitEl.textContent   = '✗ Miss';
                rayHitEl.style.color   = '#f44';
                rayPointEl.textContent = '-';
                rayPointEl.style.color = '#888';
            }
        }
    }

    _setText(id, value) {
        const el = document.getElementById(id);
        if (el) el.textContent = value;
    }

    _showEl(id, visible) {
        const el = document.getElementById(id);
        if (el) el.style.display = visible ? '' : 'none';
    }
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => new FluidApp());
} else {
    new FluidApp();
}
