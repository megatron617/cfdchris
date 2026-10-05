/**
 * UI controls and updates
 */

export class UIController {
    constructor(simulation, renderer = null) {
        this.simulation = simulation;
        this.renderer = renderer;
        this.running = true;
        this.frameCount = 0;
        this.lastTime = 0;
        
        this.setupControls();
    }

    setupControls() {
        // Iterations slider
        const iterationsSlider = document.getElementById('iterations');
        const iterationsValue = document.getElementById('iter-val');
        if (iterationsSlider) {
            iterationsSlider.oninput = (e) => {
                const value = parseInt(e.target.value);
                iterationsValue.textContent = value;
                this.simulation.updateParams({ iterations: value });
            };
        }

        // Force slider
        const forceSlider = document.getElementById('force');
        const forceValue = document.getElementById('force-val');
        if (forceSlider) {
            forceSlider.oninput = (e) => {
                const value = parseFloat(e.target.value);
                forceValue.textContent = value;
                this.simulation.updateParams({ forceMultiplier: value });
            };
        }

        // Slice axis buttons (3D)
        const axisButtons = document.querySelectorAll('.axis-btn');
        axisButtons.forEach(btn => {
            btn.onclick = () => {
                if (this.renderer && this.renderer.setSliceAxis) {
                    // Update active state
                    axisButtons.forEach(b => b.classList.remove('active'));
                    btn.classList.add('active');
                    
                    // Set axis
                    const axis = btn.dataset.axis;
                    this.renderer.setSliceAxis(axis);
                    
                    // Update label
                    this.updateSliceLabel();
                    
                    // Re-render immediately when paused so the new axis is visible
                    if (!this.running) {
                        this.renderer.render();
                    }
                }
            };
        });

        // Slice depth slider (3D)
        const sliceDepthSlider = document.getElementById('slice-depth');
        const sliceDepthValue = document.getElementById('slice-depth-val');
        if (sliceDepthSlider && this.renderer) {
            sliceDepthSlider.oninput = (e) => {
                const value = parseInt(e.target.value) / 100.0;  // 0-100 → 0.0-1.0
                if (this.renderer.setSliceDepth) {
                    this.renderer.setSliceDepth(value);
                    this.updateSliceLabel();
                    
                    // Re-render immediately when paused so the new layer is visible
                    if (!this.running) {
                        this.renderer.render();
                    }
                }
            };
        }

        // Clear button
        const clearBtn = document.getElementById('clear');
        if (clearBtn) {
            clearBtn.onclick = () => {
                this.simulation.clear();
                // Re-render when paused so the cleared state is visible
                if (!this.running && this.renderer) {
                    this.renderer.render();
                }
            };
        }

        // Pause/Resume button
        const pauseButton = document.getElementById('pause');
        if (pauseButton) {
            pauseButton.onclick = () => {
                this.running = !this.running;
                pauseButton.textContent = this.running ? 'Pause' : 'Resume';
                if (this.running && this.animateCallback) {
                    this.animateCallback();
                }
            };
        }
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
            document.getElementById('fps').textContent = fps;
            this.frameCount = 0;
            this.lastTime = now;
        }
    }

    setAnimateCallback(callback) {
        this.animateCallback = callback;
    }

    isRunning() {
        return this.running;
    }
}
