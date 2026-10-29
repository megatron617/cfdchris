/**
 * UI controls and updates
 */

import { CONFIG } from './config.js';
import { TransferFunction } from './transfer-function.js';

export class UIController {
    constructor(simulation, renderer = null) {
        this.simulation       = simulation;
        this.renderer         = renderer;
        this.transferFunction = null;   // set via setTransferFunction()
        this.running          = true;
        this.frameCount       = 0;
        this.lastTime         = 0;

        // Callbacks set by main.js
        this.onRenderModeChange = null;  // (mode) => void

        this.setupControls();
    }

    /** Attach the TransferFunction so ray-controls can update it. */
    setTransferFunction(tf) {
        this.transferFunction = tf;
    }

    setupControls() {
        // Iterations slider
        const iterationsSlider = document.getElementById('iterations');
        const iterationsValue  = document.getElementById('iter-val');
        if (iterationsSlider) {
            iterationsSlider.oninput = (e) => {
                const value = parseInt(e.target.value);
                iterationsValue.textContent = value;
                this.simulation.updateParams({ iterations: value });
            };
        }

        // Force slider
        const forceSlider = document.getElementById('force');
        const forceValue  = document.getElementById('force-val');
        if (forceSlider) {
            forceSlider.oninput = (e) => {
                const value = parseFloat(e.target.value);
                forceValue.textContent = value;
                this.simulation.updateParams({ forceMultiplier: value });
            };
        }

        // Dye decay (dissipation) slider
        // The slider stores values 980–1000 to avoid float step issues;
        // the real dissipation is that value ÷ 1000.
        const dyeSlider = document.getElementById('dye-dissipation');
        const dyeVal    = document.getElementById('dye-dissipation-val');
        if (dyeSlider) {
            // Reflect the live CONFIG value on page load
            dyeSlider.value      = Math.round(CONFIG.dyeDissipation * 1000);
            if (dyeVal) dyeVal.textContent = CONFIG.dyeDissipation.toFixed(3);

            dyeSlider.oninput = (e) => {
                const dissipation = parseInt(e.target.value) / 1000;
                CONFIG.dyeDissipation = dissipation;
                if (dyeVal) dyeVal.textContent = dissipation.toFixed(3);
            };
        }

        // ── Render mode toggle (SLICE / VOLUMETRIC) ──────────────────────────
        const renderModeBtn = document.getElementById('render-mode-toggle');
        if (renderModeBtn) {
            renderModeBtn.addEventListener('click', () => {
                const next = CONFIG.renderMode === 'slice' ? 'raymarch' : 'slice';
                if (this.renderer && typeof this.renderer.setMode === 'function') {
                    this.renderer.setMode(next);
                } else {
                    CONFIG.renderMode = next;
                }
                this.updateRenderModeButton();
                this.updateControlVisibility(next);
                if (this.onRenderModeChange) this.onRenderModeChange(next);
            });
        }

        // ── 3D Slice controls ─────────────────────────────────────────────
        const axisButtons = document.querySelectorAll('.axis-btn');
        axisButtons.forEach(btn => {
            btn.onclick = () => {
                if (this.renderer && this.renderer.setSliceAxis) {
                    axisButtons.forEach(b => b.classList.remove('active'));
                    btn.classList.add('active');
                    this.renderer.setSliceAxis(btn.dataset.axis);
                    this.updateSliceLabel();
                    if (!this.running) this.renderer.render();
                }
            };
        });

        const sliceDepthSlider = document.getElementById('slice-depth');
        if (sliceDepthSlider && this.renderer) {
            sliceDepthSlider.oninput = (e) => {
                const value = parseInt(e.target.value) / 100.0;
                if (this.renderer.setSliceDepth) {
                    this.renderer.setSliceDepth(value);
                    this.updateSliceLabel();
                    if (!this.running) this.renderer.render();
                }
            };
        }

        // ── Ray march controls (Task 9) ────────────────────────────────────
        const gradientSelect = document.getElementById('ray-gradient');
        if (gradientSelect) {
            gradientSelect.addEventListener('change', () => this._applyTransferFunction());
        }

        const opacityModeSelect = document.getElementById('ray-opacity-mode');
        if (opacityModeSelect) {
            opacityModeSelect.addEventListener('change', () => this._applyTransferFunction());
        }

        const opacityScaleSlider = document.getElementById('ray-opacity-scale');
        const opacityScaleVal    = document.getElementById('ray-opacity-scale-val');
        if (opacityScaleSlider) {
            opacityScaleSlider.oninput = (e) => {
                const v = parseFloat(e.target.value);
                CONFIG.opacityScale = v;
                if (opacityScaleVal) opacityScaleVal.textContent = v.toFixed(0);
            };
        }

        const stepCountSelect = document.getElementById('ray-step-count');
        if (stepCountSelect) {
            stepCountSelect.addEventListener('change', (e) => {
                CONFIG.rayMarchSteps = parseInt(e.target.value);
            });
        }

        const wireframeToggle = document.getElementById('show-wireframe');
        if (wireframeToggle && this.renderer) {
            wireframeToggle.addEventListener('change', (e) => {
                this.renderer.showWireframe = e.target.checked;
            });
        }

        // ── Clear / Pause ─────────────────────────────────────────────────
        const clearBtn = document.getElementById('clear');
        if (clearBtn) {
            clearBtn.onclick = () => {
                this.simulation.clear();
                if (!this.running && this.renderer) this.renderer.render();
            };
        }

        const pauseButton = document.getElementById('pause');
        if (pauseButton) {
            pauseButton.onclick = () => {
                this.running = !this.running;
                pauseButton.textContent = this.running ? 'Pause' : 'Resume';
                if (this.running && this.animateCallback) this.animateCallback();
            };
        }

        // Initialise visibility and button state to match CONFIG
        this.updateControlVisibility(CONFIG.renderMode);
        this.updateRenderModeButton();
    }

    // Apply the current gradient + opacity selection to the transfer function
    _applyTransferFunction() {
        if (!this.transferFunction) return;
        const gradSel = document.getElementById('ray-gradient');
        const opSel   = document.getElementById('ray-opacity-mode');
        if (!gradSel || !opSel) return;

        const grad = TransferFunction.gradients[gradSel.value]    || TransferFunction.gradients.heat;
        const op   = TransferFunction.opacityModes[opSel.value]   || TransferFunction.opacityModes.sensitive;
        this.transferFunction.set(grad, op);
    }

    /** Show/hide slice vs ray-march controls based on the active render mode. */
    updateControlVisibility(renderMode) {
        const sliceControls = document.getElementById('slice-controls');
        const rayControls   = document.getElementById('ray-controls');
        if (sliceControls) sliceControls.style.display = renderMode === 'slice'    ? '' : 'none';
        if (rayControls)   rayControls.style.display   = renderMode === 'raymarch' ? '' : 'none';
    }

    updateRenderModeButton() {
        const btn = document.getElementById('render-mode-toggle');
        if (!btn) return;
        const isRayMarch = CONFIG.renderMode === 'raymarch';
        btn.textContent  = isRayMarch ? 'SLICE' : 'VOLUMETRIC';
        btn.title        = isRayMarch ? 'Switch to slice view' : 'Switch to volumetric view';
    }

    updateSliceLabel() {
        const sliceDepthValue = document.getElementById('slice-depth-val');
        if (sliceDepthValue && this.renderer && this.renderer.getRenderInfo) {
            const info = this.renderer.getRenderInfo();
            sliceDepthValue.textContent = `Layer ${info.layerLabel}`;
        }
    }

    updateFPS() {
        const now = performance.now();
        this.frameCount++;

        if (now - this.lastTime > 500) {
            const fps = Math.round(this.frameCount / ((now - this.lastTime) / 1000));
            const el  = document.getElementById('fps');
            if (el) el.textContent = fps;
            this.frameCount = 0;
            this.lastTime   = now;
        }
    }

    setAnimateCallback(callback) {
        this.animateCallback = callback;
    }

    isRunning() {
        return this.running;
    }
}
