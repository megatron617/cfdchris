/**
 * UI controls and updates
 */

export class UIController {
    constructor(simulation) {
        this.simulation = simulation;
        this.running = true;
        this.frameCount = 0;
        this.lastTime = 0;
        
        this.setupControls();
    }

    setupControls() {
        // Iterations slider
        const iterationsSlider = document.getElementById('iterations');
        const iterationsValue = document.getElementById('iter-val');
        iterationsSlider.oninput = (e) => {
            const value = parseInt(e.target.value);
            iterationsValue.textContent = value;
            this.simulation.updateParams({ iterations: value });
        };

        // Force slider
        const forceSlider = document.getElementById('force');
        const forceValue = document.getElementById('force-val');
        forceSlider.oninput = (e) => {
            const value = parseFloat(e.target.value);
            forceValue.textContent = value;
            this.simulation.updateParams({ forceMultiplier: value });
        };

        // Clear button
        document.getElementById('clear').onclick = () => {
            this.simulation.clear();
        };

        // Pause/Resume button
        const pauseButton = document.getElementById('pause');
        pauseButton.onclick = () => {
            this.running = !this.running;
            pauseButton.textContent = this.running ? 'Pause' : 'Resume';
            if (this.running && this.animateCallback) {
                this.animateCallback();
            }
        };
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
